import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Heart, Send, Bookmark, Check, Loader2, ExternalLink, Clock, Ticket, Copy, MapPin, Calendar, DollarSign, UserPlus } from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FeedCardItem } from "./feed-card";
import { useI18n, localized, type TranslationKey } from "@/lib/i18n";

interface FeedDetailProps {
  item: FeedCardItem | null;
  citySlug: string;
  onClose: () => void;
  onTagClick?: (tag: { slug: string; label: string; type?: string }) => void;
  onLike?: (item: FeedCardItem) => void;
  onSave?: (item: FeedCardItem) => void;
  onRepost?: (item: FeedCardItem) => void;
  liked?: boolean;
  saved?: boolean;
  requireAuth?: (action: string) => boolean;
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
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
  if (diff <= 0) return t("feedDetail.expired");
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return t("feedDetail.daysHoursLeft", { d: String(Math.floor(hours / 24)), h: String(hours % 24) });
  if (hours > 0) return t("feedDetail.hoursMinutesLeft", { h: String(hours), m: String(mins) });
  return t("feedDetail.minutesLeft", { m: String(mins) });
}

export function FeedDetail({ item, citySlug, onClose, onTagClick, onLike, onSave, onRepost, liked, saved, requireAuth }: FeedDetailProps) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [localLiked, setLocalLiked] = useState(liked || false);
  const [localSaved, setLocalSaved] = useState(saved || false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    setLocalLiked(liked || false);
    setLocalSaved(saved || false);
  }, [liked, saved]);

  if (!item) return null;

  const isCommerce = item.type === "shop_item" || item.type === "shop_drop";
  const isDrop = item.type === "shop_drop";
  const isRss = item.type === "rss";
  const isEvent = item.type === "event";
  const isExternal = isExternalUrl(item.url);
  const rssHasLocalPage = isRss && !isExternal;
  const useIframe = !isCommerce && !isEvent && (!isRss || rssHasLocalPage);

  const displayHandle = item.handle ? `@${item.handle}` : (item.businessName || null);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  };

  const handleLike = () => {
    if (requireAuth && !requireAuth("like this")) return;
    setLocalLiked(!localLiked);
    onLike?.(item);
  };

  const handleSave = () => {
    if (requireAuth && !requireAuth("save this")) return;
    setLocalSaved(!localSaved);
    onSave?.(item);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/${citySlug}/pulse/${item.type}/${item.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: localized(locale, item.title, item.titleEs), url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: t("feedDetail.linkCopied"), description: t("feedDetail.readyToShare") });
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenFullPage = () => {
    handleAnimatedClose();
    if (isExternal) {
      window.open(item.url, "_blank", "noopener");
    } else {
      navigate(item.url);
    }
  };

  const handleClaim = async () => {
    if (requireAuth && !requireAuth("claim this deal")) return;
    if (claimCode) return;
    setClaiming(true);
    try {
      const itemType = isDrop ? "shop_drop" : "shop_item";
      const res = await apiRequest("POST", "/api/shop/claims", { itemType, itemId: item.id });
      const claim = await res.json();
      setClaimCode(claim.claimCode);
      toast({ title: t("feedDetail.claimed"), description: t("feedDetail.claimedDesc") });
    } catch (err: any) {
      toast({ title: t("feedDetail.couldntClaim"), description: err.message || t("review.tryAgainLater") });
    } finally {
      setClaiming(false);
    }
  };

  const handleCopyClaimCode = async () => {
    if (!claimCode) return;
    try {
      await navigator.clipboard.writeText(claimCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {}
  };

  const iframeSrc = isExternal ? item.url : item.url;

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-250 ${isClosing ? "opacity-0" : "opacity-100"}`}
        onClick={handleAnimatedClose}
        data-testid="feed-detail-overlay"
      />

      <div
        className={`fixed inset-x-0 inset-y-0 z-50 flex flex-col bg-gray-950 md:inset-x-auto md:inset-y-3 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl md:rounded-2xl md:border md:border-white/10 md:overflow-hidden transition-transform duration-300 ease-out ${isClosing ? "translate-y-full md:translate-y-[110%]" : "translate-y-0 animate-in slide-in-from-bottom duration-300"}`}
        data-testid="feed-detail-modal"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-950/95 backdrop-blur-sm border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex flex-col min-w-0">
              {displayHandle && (
                <span className="text-[11px] font-medium text-purple-400 truncate" data-testid="feed-detail-handle">
                  {displayHandle}
                </span>
              )}
              <h3 className="text-sm font-semibold text-white truncate" data-testid="feed-detail-title">
                {localized(locale, item.title, item.titleEs)}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleLike}
              className={`rounded-full p-2 transition-colors ${localLiked ? "text-red-400 bg-red-500/15" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              data-testid={`detail-like-btn-${item.id}`}
            >
              <Heart className={`h-4 w-4 ${localLiked ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={handleSave}
              className={`rounded-full p-2 transition-colors ${localSaved ? "text-amber-400 bg-amber-500/15" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              data-testid={`detail-save-btn-${item.id}`}
            >
              <Bookmark className={`h-4 w-4 ${localSaved ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={handleShare}
              className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              data-testid="feed-detail-share-btn"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Send className="h-4 w-4 rotate-[-30deg]" />}
            </button>
            <button
              onClick={() => onRepost?.(item)}
              className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              data-testid="feed-detail-repost-btn"
              title={t("feedDetail.shareToProfile")}
            >
              <UserPlus className="h-4 w-4" />
            </button>
            {useIframe && (
              <button
                onClick={handleOpenFullPage}
                className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                data-testid="feed-detail-open-full"
                title={t("feedDetail.openFullPage")}
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleAnimatedClose}
              className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors ml-1"
              data-testid="feed-detail-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-gray-950 overflow-hidden">
          {isCommerce ? (
            <div className="overflow-y-auto h-full">
              {item.imageUrl ? (
                <div className="relative aspect-video w-full">
                  <img src={item.imageUrl} alt={localized(locale, item.title, item.titleEs)} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
                </div>
              ) : (
                <div className="relative aspect-video w-full bg-gradient-to-br from-purple-900/50 via-indigo-900/30 to-gray-900">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
                </div>
              )}

              <div className="px-5 pb-6 -mt-8 relative z-10">
                {item.businessName && (
                  <p className="text-[11px] text-white/50 font-medium uppercase tracking-wide mb-1" data-testid={`detail-business-name-${item.id}`}>
                    {item.businessName}
                  </p>
                )}
                <h2 className="text-xl font-bold text-white mb-2 leading-tight">{localized(locale, item.title, item.titleEs)}</h2>

                {item.price != null && (
                  <div className="flex items-center gap-2 mb-3 flex-wrap" data-testid={`detail-price-${item.id}`}>
                    <span className="text-2xl font-bold text-white">{formatPrice(item.price)}</span>
                    {item.compareAtPrice && item.compareAtPrice > item.price && (
                      <span className="text-sm text-white/50 line-through">{formatPrice(item.compareAtPrice)}</span>
                    )}
                    {isDrop && item.discountPercent && (
                      <span className="inline-flex items-center rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-bold text-white" data-testid={`detail-discount-${item.id}`}>
                        {item.discountPercent}% {t("feedDetail.off")}
                      </span>
                    )}
                  </div>
                )}

                {isDrop && item.expiresAt && (
                  <div className="flex items-center gap-2 mb-3" data-testid={`detail-countdown-${item.id}`}>
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">{formatCountdown(item.expiresAt, t)}</span>
                  </div>
                )}

                {isDrop && item.claimCount != null && item.claimCount > 0 && (
                  <div className="flex items-center gap-2 mb-3" data-testid={`detail-social-proof-${item.id}`}>
                    <Ticket className="h-3.5 w-3.5 text-amber-400/70" />
                    <span className="text-sm text-white/60">
                      {item.maxClaims
                        ? t("feedDetail.claimedOfMax", { count: String(item.claimCount), max: String(item.maxClaims) })
                        : t("feedDetail.claimed_count", { count: String(item.claimCount) })}
                    </span>
                  </div>
                )}

                {item.subtitle && (
                  <p className="text-sm text-white/70 leading-relaxed mb-4" data-testid="feed-detail-description">{localized(locale, item.subtitle, item.subtitleEs)}</p>
                )}

                {claimCode && (
                  <div className="mb-5 rounded-2xl bg-gradient-to-r from-amber-900/60 to-orange-900/60 border border-amber-400/30 p-4" data-testid={`detail-claim-code-${item.id}`}>
                    <p className="text-[10px] text-amber-200/70 font-medium uppercase tracking-wider mb-1">{t("feedDetail.yourClaimCode")}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-mono font-bold text-white tracking-[0.2em]">{claimCode}</span>
                      <button onClick={handleCopyClaimCode} className="rounded-full p-2 bg-white/10 hover:bg-white/20 transition-colors" data-testid={`detail-copy-code-btn-${item.id}`}>
                        {codeCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-white/70" />}
                      </button>
                    </div>
                    <p className="text-xs text-amber-200/50 mt-2">{t("feedDetail.showCodeHint", { type: isDrop ? "deal" : "item" })}</p>
                  </div>
                )}

                {!claimCode && (
                  <Button
                    className={`w-full mb-3 font-semibold ${isDrop ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" : "bg-gradient-to-r from-emerald-500 to-green-500 text-white"}`}
                    onClick={handleClaim}
                    disabled={claiming}
                    data-testid={`detail-claim-btn-${item.id}`}
                  >
                    {claiming ? (
                      <span className="animate-pulse">{t("feedDetail.claiming")}</span>
                    ) : (
                      <>
                        <Ticket className="h-4 w-4 mr-2" />
                        {isDrop ? t("feedDetail.claimThisDeal") : t("feedDetail.claimThisItem")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : isRss ? (
            <div className="overflow-y-auto h-full">
              {item.imageUrl && (
                <div className="relative aspect-video w-full">
                  <img src={item.imageUrl} alt={localized(locale, item.title, item.titleEs)} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
                </div>
              )}
              <div className="px-5 pb-6 relative z-10" style={{ marginTop: item.imageUrl ? "-2rem" : "1rem" }}>
                {item.businessName && (
                  <p className="text-[11px] text-purple-400/80 font-medium uppercase tracking-wide mb-2" data-testid="rss-source-name">
                    {item.businessName}
                  </p>
                )}
                <h2 className="text-xl font-bold text-white mb-3 leading-tight" data-testid="rss-detail-title">{localized(locale, item.title, item.titleEs)}</h2>
                {(() => {
                  const body = localized(locale, item.articleBody, item.articleBodyEs);
                  if (body) {
                    const clean = DOMPurify.sanitize(body, {
                      ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "img", "figure", "figcaption", "span", "div"],
                      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class", "width", "height"],
                    });
                    return (
                      <div
                        className="prose prose-invert prose-sm max-w-none mb-6 text-white/80 leading-relaxed [&_a]:text-purple-400 [&_a]:underline [&_img]:rounded-lg [&_img]:my-4"
                        dangerouslySetInnerHTML={{ __html: clean }}
                        data-testid="rss-inline-article-body"
                      />
                    );
                  }
                  return item.subtitle ? (
                    <p className="text-[15px] text-white/70 leading-relaxed mb-6" data-testid="rss-detail-summary">{localized(locale, item.subtitle, item.subtitleEs)}</p>
                  ) : null;
                })()}
                {item.externalUrl && (
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-white/40 hover:text-white/60 transition-colors"
                    data-testid="rss-view-original-source"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("feedDetail.viewOriginalSource")}
                  </a>
                )}
              </div>
            </div>
          ) : isEvent ? (
            <div className="overflow-y-auto h-full">
              {item.imageUrl && (
                <div className="relative aspect-video w-full">
                  <img src={item.imageUrl} alt={localized(locale, item.title, item.titleEs)} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
                </div>
              )}
              <div className="px-5 pb-6 relative z-10" style={{ marginTop: item.imageUrl ? "-2rem" : "1rem" }}>
                <h2 className="text-xl font-bold text-white mb-3 leading-tight" data-testid="event-detail-title">{localized(locale, item.title, item.titleEs)}</h2>

                <div className="space-y-2.5 mb-4">
                  {item.startDate && (
                    <div className="flex items-center gap-2.5 text-white/80" data-testid="event-detail-date">
                      <Calendar className="h-4 w-4 text-purple-400 shrink-0" />
                      <span className="text-sm">
                        {(() => {
                          const sd = new Date(item.startDate);
                          const dateStr = sd.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                          const timeStr = sd.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                          if (item.endDate) {
                            const ed = new Date(item.endDate);
                            const endTimeStr = ed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                            return `${dateStr} \u00B7 ${timeStr} \u2013 ${endTimeStr}`;
                          }
                          return `${dateStr} \u00B7 ${timeStr}`;
                        })()}
                      </span>
                    </div>
                  )}

                  {(item.eventLocationName || item.businessName) && (
                    <div className="flex items-start gap-2.5 text-white/80" data-testid="event-detail-venue">
                      <MapPin className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-medium">{item.eventLocationName || item.businessName}</span>
                        {item.eventAddress && (
                          <span className="block text-xs text-white/50 mt-0.5">{item.eventAddress}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {item.eventCostText && (
                    <div className="flex items-center gap-2.5 text-white/80" data-testid="event-detail-cost">
                      <DollarSign className="h-4 w-4 text-purple-400 shrink-0" />
                      <span className="text-sm">{item.eventCostText}</span>
                    </div>
                  )}
                </div>

                {item.subtitle && (
                  <p className="text-[15px] text-white/70 leading-relaxed mb-5" data-testid="event-detail-description">{localized(locale, item.subtitle, item.subtitleEs)}</p>
                )}

                <button
                  onClick={handleOpenFullPage}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
                  data-testid="event-detail-view-full"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("feedDetail.viewFullEventPage")}
                </button>
              </div>
            </div>
          ) : useIframe ? (
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                    <span className="text-sm text-white/50">{t("feed.loading")}</span>
                  </div>
                </div>
              )}
              <iframe
                src={iframeSrc}
                className="w-full h-full border-0"
                onLoad={() => setIframeLoaded(true)}
                data-testid="feed-detail-iframe"
                title={item.title}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
