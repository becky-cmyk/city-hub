import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Star, Shield, Crown, Navigation, Globe, Repeat, Briefcase, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useI18n, localized } from "@/lib/i18n";
import { getBusinessUrl } from "@/lib/business-url";
import { TrustSummary, deriveTrustSignals } from "@/components/trust-card";

const BAD_IMAGE_PATTERNS = [
  /maps\.googleapis\.com\/maps\/api\/staticmap/i,
  /maps\.googleapis\.com\/maps\/api\/streetview/i,
  /tile\.openstreetmap/i,
  /\.tile\./i,
  /\/map_imagery\//i,
  /\/maptile\//i,
  /staticmap\?/i,
  /streetviewpixels/i,
];

function isMapOrBadImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

interface BusinessCardProps {
  business: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    descriptionEs?: string | null;
    imageUrl?: string | null;
    address?: string | null;
    listingTier: string;
    isFeatured: boolean;
    isVerified: boolean;
    categoryIds: string[];
    tier?: string;
    priorityScore?: number;
    badges?: { chamber: boolean; premium: boolean };
    priceRange?: number | null;
    googleRating?: string | null;
    micrositeThemeColor?: string | null;
    micrositeTagline?: string | null;
    barterNetworks?: string[] | null;
    creatorType?: string | null;
  };
  citySlug: string;
  categories?: { id: string; name: string; slug: string }[];
  highlight?: boolean;
  sponsoredLabel?: boolean;
  distance?: number | null;
  isHiring?: boolean;
  isNew?: boolean;
}

const BIZ_PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, hsl(174 62% 35%), hsl(211 55% 55%))",
  "linear-gradient(135deg, hsl(273 66% 30%), hsl(174 62% 45%))",
  "linear-gradient(135deg, hsl(46 88% 45%), hsl(14 77% 50%))",
  "linear-gradient(135deg, hsl(211 55% 40%), hsl(273 66% 45%))",
  "linear-gradient(135deg, hsl(152 30% 40%), hsl(174 62% 50%))",
];

export function BusinessCard({ business, citySlug, categories = [], highlight = false, sponsoredLabel = false, distance, isHiring = false, isNew = false }: BusinessCardProps) {
  const { locale } = useI18n();
  const catNames = categories.filter((c) => business.categoryIds.includes(c.id)).map((c) => c.name);
  const { t } = useI18n();
  const isVerified = business.isVerified || business.listingTier === "ENHANCED";
  const hasMicrosite = business.listingTier === "ENHANCED" || business.tier === "ENHANCED";
  const themeColor = business.micrositeThemeColor || undefined;
  const gradientIdx = parseInt(business.id.replace(/\D/g, "") || "0") % BIZ_PLACEHOLDER_GRADIENTS.length;
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!business.imageUrl && !isMapOrBadImageUrl(business.imageUrl) && !imgFailed;

  const handleBgError = useCallback(() => setImgFailed(true), []);

  const tierBadgeLabel = (business.badges?.chamber || business.badges?.premium) ? "Premium" : null;
  const tierBadgeColor = (business.badges?.chamber || business.badges?.premium) ? "hsl(273 66% 40%)" : null;

  return (
    <Link href={getBusinessUrl(citySlug, business.slug, business.categoryIds, categories)}>
      <div
        className={`biz-card ${hasMicrosite ? "biz-card-microsite" : ""}`}
        style={{
          height: "180px",
          ...(hasMicrosite && themeColor ? { "--microsite-color": themeColor } as any : {}),
        }}
        data-testid={`card-business-${business.id}`}
      >
        {hasImage ? (
          <>
            <div className="biz-bg" style={{ backgroundImage: `url(${business.imageUrl})` }} />
            <img
              src={business.imageUrl!}
              alt=""
              className="sr-only"
              onError={handleBgError}
              aria-hidden="true"
            />
          </>
        ) : (
          <div className="biz-bg" style={{ background: BIZ_PLACEHOLDER_GRADIENTS[gradientIdx] }} />
        )}
        <div className="biz-overlay" />

        {tierBadgeLabel && (
          <div className="biz-cut-badge" style={{ backgroundColor: tierBadgeColor! }} data-testid={`badge-tier-${business.id}`}>
            <Shield className="h-2.5 w-2.5 inline mr-0.5 align-[-2px]" />
            {tierBadgeLabel}
          </div>
        )}

        <div className="biz-content">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-sm leading-tight truncate">{business.name}</h3>
            {business.isVerified && (
              <Badge className="text-[9px] gap-0.5 bg-white/20 border-white/30 text-white">
                <Star className="h-2.5 w-2.5" />{t("badge.verified")}
              </Badge>
            )}
            {sponsoredLabel && (
              <Badge className="text-[9px] bg-white/20 border-white/30 text-white" data-testid="badge-sponsored">
                {t("badge.sponsored")}
              </Badge>
            )}
            {business.isFeatured && !sponsoredLabel && (
              <Badge className="text-[9px] bg-white/20 border-white/30 text-white">{t("badge.featured")}</Badge>
            )}
            {hasMicrosite && (
              <Badge
                className="text-[9px] gap-0.5 rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: themeColor || "hsl(var(--brand-teal))",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
                data-testid={`badge-hubsite-${business.id}`}
              >
                <Globe className="h-2.5 w-2.5" />Hub Site
              </Badge>
            )}
            {business.barterNetworks && business.barterNetworks.includes("itex") && (
              <Badge
                className="text-[9px] gap-0.5 bg-emerald-600/80 border-emerald-400/40 text-white"
                data-testid={`badge-itex-${business.id}`}
              >
                <Repeat className="h-2.5 w-2.5" />ITEX
              </Badge>
            )}
            {isHiring && (
              <Badge
                className="text-[9px] gap-0.5 bg-green-600/90 border-green-400/40 text-white"
                data-testid={`badge-hiring-${business.id}`}
              >
                <Briefcase className="h-2.5 w-2.5" />Now Hiring
              </Badge>
            )}
            {business.creatorType && (
              <Badge
                className="text-[9px] gap-0.5 bg-purple-600/80 border-purple-400/40 text-white"
                data-testid={`badge-creator-${business.id}`}
              >
                <Sparkles className="h-2.5 w-2.5" />{business.creatorType}
              </Badge>
            )}
            {isNew && (
              <Badge
                className="text-[9px] gap-0.5 bg-sky-600/80 border-sky-400/40 text-white"
                data-testid={`badge-new-${business.id}`}
              >
                New
              </Badge>
            )}
          </div>
          <div className="mt-1">
            <TrustSummary
              compact
              signals={deriveTrustSignals({
                isVerified: business.isVerified,
                claimStatus: business.isVerified ? "CLAIMED" : "UNCLAIMED",
                googleRating: business.googleRating,
                creatorType: business.creatorType,
                listingTier: business.listingTier,
                isFeatured: business.isFeatured,
              })}
            />
          </div>
          {isVerified && (business.micrositeTagline || business.description) && (
            <p className="mt-1 text-xs text-white/75 line-clamp-2">
              {business.micrositeTagline || localized(locale, business.description, business.descriptionEs)}
            </p>
          )}
          {isVerified ? (
            <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-white/60 flex-wrap">
              {business.address && (
                <span className="flex items-center gap-0.5 truncate max-w-[200px]">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{business.address}</span>
                </span>
              )}
              {business.googleRating && (
                <span className="flex items-center gap-0.5" data-testid={`rating-${business.id}`}>
                  <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  {business.googleRating}
                </span>
              )}
              {business.priceRange && (
                <span className="font-semibold text-white/80" data-testid={`price-${business.id}`}>
                  {"$".repeat(business.priceRange)}
                </span>
              )}
              {distance != null && (
                <span className="flex items-center gap-0.5" data-testid={`distance-${business.id}`}>
                  <Navigation className="h-2.5 w-2.5" />
                  {distance} {t("directory.milesAway")}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-[10px] text-amber-400/70">Not yet verified</p>
          )}
          {catNames.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {catNames.slice(0, 3).map((name) => (
                <span key={name} className="text-white/60 border border-white/20 rounded px-1.5 py-0.5 text-[9px]">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

interface EventCardProps {
  event: {
    id: string;
    title: string;
    titleEs?: string | null;
    slug: string;
    description?: string | null;
    descriptionEs?: string | null;
    imageUrl?: string | null;
    startDateTime: string | Date;
    endDateTime?: string | Date | null;
    locationName?: string | null;
    costText?: string | null;
    isFeatured: boolean;
    sponsorBusinessIds?: string[] | null;
  };
  citySlug: string;
}

const SLANT_PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, hsl(273 66% 30%), hsl(324 85% 50%))",
  "linear-gradient(135deg, hsl(14 77% 45%), hsl(46 88% 55%))",
  "linear-gradient(135deg, hsl(174 62% 35%), hsl(211 55% 55%))",
  "linear-gradient(135deg, hsl(324 85% 50%), hsl(273 66% 40%))",
  "linear-gradient(135deg, hsl(46 88% 45%), hsl(14 77% 55%))",
];

export function EventCard({ event, citySlug }: EventCardProps) {
  const { t, locale } = useI18n();
  const startDate = new Date(event.startDateTime);
  const gradientIdx = parseInt(event.id.replace(/\D/g, "") || "0") % SLANT_PLACEHOLDER_GRADIENTS.length;
  const hasImage = !!event.imageUrl;

  return (
    <Link href={`/${citySlug}/events/${event.slug}`}>
      <div
        className="slant-card cursor-pointer"
        style={{ height: "220px" }}
        data-testid={`card-event-${event.id}`}
      >
        {hasImage ? (
          <div className="slant-bg" style={{ backgroundImage: `url(${event.imageUrl})` }} />
        ) : (
          <div className="slant-bg" style={{ background: SLANT_PLACEHOLDER_GRADIENTS[gradientIdx] }} />
        )}
        <div className="slant-overlay" />
        <div className="slant-date-badge">
          <div className="text-[10px] uppercase tracking-wide leading-none">{format(startDate, "MMM")}</div>
          <div className="text-lg leading-none mt-0.5">{format(startDate, "d")}</div>
        </div>
        <div className="slant-content">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-bold text-base leading-tight flex-1">{localized(locale, event.title, event.titleEs)}</h3>
            {event.sponsorBusinessIds && event.sponsorBusinessIds.length > 0 && (
              <Badge className="text-[10px] shrink-0 bg-white/20 border-white/30 text-white" data-testid={`badge-sponsored-${event.id}`}>
                {t("badge.sponsored")}
              </Badge>
            )}
            {event.isFeatured && (
              <Badge className="text-[10px] shrink-0 bg-white/20 border-white/30 text-white">{t("badge.featured")}</Badge>
            )}
          </div>
          {event.description && (
            <p className="mt-1 line-clamp-2 text-xs text-white/80">{localized(locale, event.description, event.descriptionEs)}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-white/70 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />{format(startDate, "h:mm a")}
            </span>
            {event.locationName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{event.locationName}
              </span>
            )}
            {event.costText && (
              <span className="font-medium text-white/90">{event.costText}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    titleEs?: string | null;
    slug: string;
    excerpt?: string | null;
    excerptEs?: string | null;
    imageUrl?: string | null;
    publishedAt?: string | Date | null;
    isFeatured: boolean;
  };
  citySlug: string;
}

const BLOB_SHAPES = ["blob-shape-1", "blob-shape-2", "blob-shape-3", "blob-shape-4"];

const BLOB_PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, hsl(211 55% 45%), hsl(174 62% 50%))",
  "linear-gradient(135deg, hsl(273 66% 35%), hsl(211 55% 55%))",
  "linear-gradient(135deg, hsl(152 30% 40%), hsl(174 62% 50%))",
  "linear-gradient(135deg, hsl(324 85% 50%), hsl(14 77% 55%))",
];

export function ArticleCard({ article, citySlug }: ArticleCardProps) {
  const { t, locale } = useI18n();
  const blobIdx = parseInt(article.id.replace(/\D/g, "") || "0") % BLOB_SHAPES.length;
  const gradientIdx = parseInt(article.id.replace(/\D/g, "") || "0") % BLOB_PLACEHOLDER_GRADIENTS.length;
  const hasImage = !!article.imageUrl;

  return (
    <Link href={`/${citySlug}/articles/${article.slug}`}>
      <div
        className={`blob-card cursor-pointer ${BLOB_SHAPES[blobIdx]}`}
        style={{ height: "280px" }}
        data-testid={`card-article-${article.id}`}
      >
        {hasImage ? (
          <div className="blob-bg" style={{ backgroundImage: `url(${article.imageUrl})` }} />
        ) : (
          <div className="blob-bg" style={{ background: BLOB_PLACEHOLDER_GRADIENTS[gradientIdx] }} />
        )}
        <div className="blob-overlay" />
        <div className="blob-content">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-bold text-base leading-tight flex-1">{localized(locale, article.title, article.titleEs)}</h3>
            {article.isFeatured && (
              <Badge className="text-[10px] shrink-0 bg-white/20 border-white/30 text-white">{t("badge.featured")}</Badge>
            )}
          </div>
          {article.excerpt && (
            <p className="mt-1.5 line-clamp-3 text-sm text-white/80">{localized(locale, article.excerpt, article.excerptEs)}</p>
          )}
          {article.publishedAt && (
            <p className="mt-2 text-xs text-white/60">
              {format(new Date(article.publishedAt), "MMM d, yyyy")}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
