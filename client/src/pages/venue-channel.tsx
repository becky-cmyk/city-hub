import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useState } from "react";
import { Play, Radio, ShoppingBag, ChevronRight, Home, ExternalLink, Tag, Clock, X, Store } from "lucide-react";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { useI18n } from "@/lib/i18n";
import { FeedCard, type FeedCardItem } from "@/components/feed/feed-card";
import type { VenueChannel, VideoContent, LiveSession, Offer, Business } from "@shared/schema";

interface ChannelPageData {
  channel: VenueChannel;
  videos: VideoContent[];
  liveSession: LiveSession | null;
  offers: Offer[];
}

function YouTubeEmbed({ videoId, title, live }: { videoId: string; title: string; live?: boolean }) {
  const src = live
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
    : `https://www.youtube.com/embed/${videoId}?rel=0`;

  return (
    <div className="aspect-video rounded-md overflow-hidden">
      <iframe
        src={src}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        data-testid="iframe-youtube-embed"
      />
    </div>
  );
}

function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatPrice(cents: number | null | undefined): string {
  if (!cents) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ShopNowPanel({ offers, locale }: { offers: Offer[]; locale: string }) {
  const [open, setOpen] = useState(true);

  if (!open || offers.length === 0) return null;

  return (
    <Card className="border-2 border-primary/30 p-0 overflow-visible" data-testid="panel-shop-now">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4" />
          <h3 className="font-semibold text-sm" data-testid="text-shop-now-title">
            {locale === "es" ? "Compra Ahora" : "Shop Now"}
          </h3>
          <Badge variant="destructive" className="animate-pulse text-[10px]">
            {locale === "es" ? "En Vivo" : "Live"}
          </Badge>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setOpen(false)} data-testid="button-close-shop-panel">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {offers.map((offer) => (
            <div key={offer.id} className="flex gap-3 items-start" data-testid={`shop-offer-${offer.id}`}>
              {offer.imageUrl && (
                <img
                  src={offer.imageUrl}
                  alt={offer.title}
                  className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-1" data-testid={`text-shop-offer-title-${offer.id}`}>
                  {offer.title}
                </h4>
                {offer.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{offer.description}</p>
                )}
                <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                  <span className="font-semibold text-sm" data-testid={`text-shop-offer-price-${offer.id}`}>
                    {formatPrice(offer.price)}
                  </span>
                  {offer.checkoutUrl && (
                    <a href={offer.checkoutUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" data-testid={`button-shop-buy-${offer.id}`}>
                        <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                        {locale === "es" ? "Comprar" : "Buy"}
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function VenueChannelPage({ citySlug, channelSlug }: { citySlug: string; channelSlug: string }) {
  const { t, locale } = useI18n();
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ChannelPageData>({
    queryKey: ["/api/venue-channels", channelSlug],
  });

  useRegisterAdminEdit("businesses", data?.channel?.businessId, "Edit Venue");

  const channel = data?.channel;
  const videos = data?.videos || [];
  const liveSession = data?.liveSession;
  const activeOffers = data?.offers || [];

  const { data: business } = useQuery<Business>({
    queryKey: ["/api/cities", citySlug, "businesses-by-id", channel?.businessId],
    enabled: false,
  });

  const { data: businessFeedData } = useQuery<{ items: FeedCardItem[]; total: number }>({
    queryKey: [`/api/business/${channel?.businessId}/feed?citySlug=${citySlug}`],
    enabled: !!channel?.businessId,
  });

  const currentPlayVideoId = activeVideoId
    || (liveSession?.status === "live" ? extractYouTubeVideoId(liveSession.youtubeLiveUrl) || liveSession.youtubeVideoId : null)
    || null;

  usePageMeta({
    title: channel ? `${channel.channelTitle} | CLT Metro Hub` : "Channel | CLT Metro Hub",
    description: channel?.channelDescription?.slice(0, 160) || "Watch local business content on CLT Metro Hub.",
    canonical: `${window.location.origin}/${citySlug}/channel/${channelSlug}`,
    ogType: "video.other",
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-video w-full rounded-md" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <Card className="p-12 text-center">
        <h3 className="font-semibold text-lg mb-1" data-testid="text-channel-not-found">
          {locale === "es" ? "Canal no encontrado" : "Channel not found"}
        </h3>
        <Link href={`/${citySlug}`}>
          <Button variant="ghost" className="mt-2" data-testid="button-back-home">{t("biz.home")}</Button>
        </Link>
      </Card>
    );
  }

  const videoStructuredData = videos.map((v) => ({
    "@type": "VideoObject",
    name: v.title,
    ...(v.description && { description: v.description }),
    ...(v.thumbnailUrl && { thumbnailUrl: v.thumbnailUrl }),
    ...(v.youtubeUrl && { contentUrl: v.youtubeUrl }),
    ...(v.youtubeVideoId && { embedUrl: `https://www.youtube.com/embed/${v.youtubeVideoId}` }),
    uploadDate: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
    ...(v.durationSec && { duration: `PT${Math.floor(v.durationSec / 60)}M${v.durationSec % 60}S` }),
  }));

  return (
    <div className="space-y-6">
      {videoStructuredData.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: videoStructuredData.map((v, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: v,
          })),
        }} />
      )}

      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap" data-testid="nav-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/${citySlug}`}>
          <span className="hover:text-foreground cursor-pointer flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
            {t("biz.home")}
          </span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-[250px]" data-testid="text-channel-breadcrumb">
          {channel.channelTitle}
        </span>
      </nav>

      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl" data-testid="text-channel-title">{channel.channelTitle}</h1>
            {channel.channelDescription && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-channel-description">
                {channel.channelDescription}
              </p>
            )}
          </div>
          {liveSession?.status === "live" && (
            <Badge variant="destructive" className="animate-pulse" data-testid="badge-live-now">
              <Radio className="h-3 w-3 mr-1" />
              {locale === "es" ? "En Vivo" : "Live Now"}
            </Badge>
          )}
        </div>
      </div>

      {liveSession?.status === "live" && (
        <>
        <Card className="p-5" data-testid="card-live-session">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold">{liveSession.title}</h2>
          </div>
          {(extractYouTubeVideoId(liveSession.youtubeLiveUrl) || liveSession.youtubeVideoId) && (
            <YouTubeEmbed
              videoId={(extractYouTubeVideoId(liveSession.youtubeLiveUrl) || liveSession.youtubeVideoId)!}
              title={liveSession.title}
              live
            />
          )}
          {liveSession.description && (
            <p className="text-sm text-muted-foreground mt-3">{liveSession.description}</p>
          )}
        </Card>

        {liveSession.attachedOfferIds && liveSession.attachedOfferIds.length > 0 && activeOffers.length > 0 && (
          <ShopNowPanel
            offers={activeOffers.filter((o) => liveSession.attachedOfferIds.includes(o.id))}
            locale={locale}
          />
        )}
      </>
      )}

      {currentPlayVideoId && !liveSession?.status?.includes("live") && (
        <Card className="p-5" data-testid="card-video-player">
          <YouTubeEmbed videoId={currentPlayVideoId} title={channel.channelTitle} />
        </Card>
      )}

      {videos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" data-testid="heading-videos">
            <Play className="h-4 w-4" />
            {locale === "es" ? "Videos" : "Videos"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => {
              const vidId = video.youtubeVideoId || extractYouTubeVideoId(video.youtubeUrl);
              const thumbnail = video.thumbnailUrl || (vidId ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg` : null);

              return (
                <Card
                  key={video.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => vidId && setActiveVideoId(vidId)}
                  data-testid={`card-video-${video.id}`}
                >
                  <div className="aspect-video overflow-hidden rounded-t-md relative">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Play className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {activeVideoId === vidId && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Badge data-testid="badge-now-playing">
                          {locale === "es" ? "Reproduciendo" : "Now Playing"}
                        </Badge>
                      </div>
                    )}
                    {video.durationSec && (
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(video.durationSec)}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-video-title-${video.id}`}>
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {activeOffers.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" data-testid="heading-offers">
            <ShoppingBag className="h-4 w-4" />
            {locale === "es" ? "Ofertas" : "Offers"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {businessFeedData?.items && businessFeedData.items.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3" data-testid="heading-pulse">
            {locale === "es" ? "Publicaciones Recientes" : "Recent Posts"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {businessFeedData.items.slice(0, 4).map((item) => (
              <FeedCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OfferCard({ offer, locale }: { offer: Offer; locale: string }) {
  const PRODUCT_TYPE_LABELS: Record<string, string> = {
    product: locale === "es" ? "Producto" : "Product",
    event: locale === "es" ? "Evento" : "Event",
    bundle: "Bundle",
    gift_card: locale === "es" ? "Tarjeta de Regalo" : "Gift Card",
    reservation: locale === "es" ? "Reservación" : "Reservation",
    promotion: locale === "es" ? "Promoción" : "Promotion",
  };

  return (
    <Card className="overflow-visible" data-testid={`card-offer-${offer.id}`}>
      {offer.imageUrl && (
        <div className="aspect-[16/9] overflow-hidden rounded-t-md">
          <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="font-medium text-sm" data-testid={`text-offer-title-${offer.id}`}>{offer.title}</h3>
          <Badge variant="secondary" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            {PRODUCT_TYPE_LABELS[offer.productType] || offer.productType}
          </Badge>
        </div>
        {offer.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{offer.description}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <span className="font-semibold text-sm" data-testid={`text-offer-price-${offer.id}`}>
            {formatPrice(offer.price)}
          </span>
          {offer.checkoutUrl && (
            <a href={offer.checkoutUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" data-testid={`button-buy-${offer.id}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {locale === "es" ? "Comprar" : "Buy"}
              </Button>
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
