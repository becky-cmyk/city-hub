import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MessageCircle, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface ReviewData {
  id: string;
  rating: number;
  displayName: string;
  userId?: string | null;
  comment: string;
  createdAt: string;
  ownerResponse?: string;
  ownerRespondedAt?: string;
}

interface ReviewStats {
  avgRating: number;
  count: number;
}

interface ReviewsResponse {
  reviews: ReviewData[];
  stats: ReviewStats;
}

interface CombinedRating {
  combinedAvg: number;
  totalCount: number;
  googleRating: number;
  googleCount: number;
  hubAvg: number;
  hubCount: number;
}

interface EngagementLevelInfo {
  level: number;
  title: string;
  titleEs: string;
}

const LEVEL_STYLES: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  3: "bg-[#5B1D8F]/15 text-[#5B1D8F] dark:text-[#C084FC]",
  4: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

function EngagementBadge({ level, title, t }: { level: number; title: string; t: (key: TranslationKey, r?: Record<string, string>) => string }) {
  if (level <= 1) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          className={`text-[10px] gap-0.5 ${LEVEL_STYLES[level] || ""}`}
          data-testid={`badge-engagement-level-${level}`}
        >
          <Award className="h-2.5 w-2.5" />
          {title}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t("reviewSection.levelMember", { level: String(level) })}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function computeCombinedRating(
  googleRating?: string,
  googleReviewCount?: number,
  hubAvgRating?: number,
  hubCount?: number,
): CombinedRating {
  const gRating = googleRating ? parseFloat(googleRating) : 0;
  const gCount = googleReviewCount || 0;
  const hAvg = hubAvgRating || 0;
  const hCount = hubCount || 0;
  const totalCount = gCount + hCount;
  const combinedAvg = totalCount > 0
    ? (gRating * gCount + hAvg * hCount) / totalCount
    : 0;
  return { combinedAvg, totalCount, googleRating: gRating, googleCount: gCount, hubAvg: hAvg, hubCount: hCount };
}

interface ReviewSectionProps {
  citySlug: string;
  businessSlug: string;
  businessId: string;
  businessName: string;
  listingTier: string;
  googleRating?: string;
  googleReviewCount?: number;
  onRequireAuth?: () => void;
}

function StarDistributionChart({ reviews, accentColor, t }: { reviews: ReviewData[]; accentColor?: string; t: (key: TranslationKey) => string }) {
  const distribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      counts[star]++;
    });
    return counts;
  }, [reviews]);

  const total = reviews.length;
  if (total === 0) return null;
  const barColor = accentColor || "hsl(var(--primary))";

  return (
    <div className="space-y-1.5" data-testid="chart-star-distribution">
      {([5, 4, 3, 2, 1] as const).map((star) => {
        const count = distribution[star];
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs w-8 text-right text-muted-foreground">{star} {t("reviewSection.star")}</span>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
                data-testid={`bar-star-${star}`}
              />
            </div>
            <span className="text-xs w-6 text-muted-foreground" data-testid={`text-star-count-${star}`}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export { StarDistributionChart };

function StarRating({ rating, interactive = false, onRatingChange }: { rating: number; interactive?: boolean; onRatingChange?: (r: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => interactive && onRatingChange?.(star)}
          disabled={!interactive}
          className={`transition-colors ${interactive ? "cursor-pointer" : "cursor-default"}`}
          data-testid={`button-star-${star}`}
        >
          <Star
            className={`h-5 w-5 ${
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewSection({
  citySlug,
  businessSlug,
  businessId,
  businessName,
  listingTier,
  googleRating,
  googleReviewCount,
  onRequireAuth,
}: ReviewSectionProps) {
  const { t } = useI18n();
  const { data: reviewsData, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["/api/cities", citySlug, "businesses", businessSlug, "reviews"],
  });

  const rawReviews = reviewsData?.reviews || [];
  const reviews = useMemo(() => {
    return [...rawReviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawReviews]);
  const stats = reviewsData?.stats || { avgRating: 0, count: 0 };

  const reviewerUserIds = useMemo(() => {
    return reviews.map(r => r.userId).filter(Boolean) as string[];
  }, [reviews]);

  const { data: engagementLevels } = useQuery<Record<string, EngagementLevelInfo>>({
    queryKey: ["/api/public/engagement-levels", reviewerUserIds.join(",")],
    queryFn: async () => {
      if (reviewerUserIds.length === 0) return {};
      const resp = await fetch(`/api/public/engagement-levels?userIds=${reviewerUserIds.join(",")}`);
      if (!resp.ok) return {};
      return resp.json();
    },
    enabled: reviewerUserIds.length > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const isEnhanced = listingTier === "ENHANCED";
  const hasGoogleRating = googleRating && parseFloat(googleRating) > 0;
  const combined = computeCombinedRating(googleRating, googleReviewCount, stats.avgRating, stats.count);
  const hasCombinedRating = combined.totalCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-reviews-heading">
            {t("reviewSection.reviews")}
          </h2>
          {hasCombinedRating && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <StarRating rating={Math.round(combined.combinedAvg)} />
                  <span
                    className="font-semibold text-lg"
                    data-testid="text-average-rating"
                  >
                    {combined.combinedAvg.toFixed(1)}
                  </span>
                </div>
                <span
                  className="text-sm text-muted-foreground"
                  data-testid="text-review-count"
                >
                  {combined.totalCount} {combined.totalCount === 1 ? t("reviewSection.review") : t("reviewSection.reviewsPlural")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-review-sources">
                {t("reviewSection.basedOn")}{combined.googleCount > 0 ? ` ${combined.googleCount} ${combined.googleCount === 1 ? t("reviewSection.googleReview") : t("reviewSection.googleReviews")}` : ""}
                {combined.googleCount > 0 && combined.hubCount > 0 ? ` ${t("reviewSection.and")}` : ""}
                {combined.hubCount > 0 ? ` ${combined.hubCount} ${combined.hubCount === 1 ? t("reviewSection.hubReview") : t("reviewSection.hubReviews")}` : ""}
              </p>
            </div>
          )}
        </div>
        {onRequireAuth ? (
          <Button
            data-testid="button-write-review"
            onClick={() => {
              onRequireAuth();
            }}
          >
            {t("reviewSection.writeReview")}
          </Button>
        ) : (
          <Link href={`/${citySlug}/review/${businessSlug}`}>
            <Button
              data-testid="button-write-review"
            >
              {t("reviewSection.writeReview")}
            </Button>
          </Link>
        )}
      </div>

      {reviews.length > 0 && (
        <Card className="p-5" data-testid="card-review-summary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-4xl font-bold" data-testid="text-summary-rating">
                {combined.combinedAvg.toFixed(1)}
              </span>
              <StarRating rating={Math.round(combined.combinedAvg)} />
              <span className="text-sm text-muted-foreground mt-1">
                {combined.totalCount} {combined.totalCount === 1 ? t("reviewSection.review") : t("reviewSection.reviewsPlural")}
              </span>
            </div>
            <StarDistributionChart reviews={reviews} t={t} />
          </div>
        </Card>
      )}

      {reviews.length > 0 ? (
        <div className="space-y-3" data-testid="list-reviews">
          {reviews.map((review) => {
            const levelInfo = review.userId && engagementLevels ? engagementLevels[review.userId] : null;
            return (
              <Card
                key={review.id}
                className={`p-4 ${review.ownerResponse ? "border-primary/20" : ""}`}
                data-testid={`card-review-${review.id}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-sm font-semibold" data-testid={`text-reviewer-name-${review.id}`}>
                          {review.displayName || t("reviewSection.anonymous")}
                        </span>
                        {levelInfo && (
                          <EngagementBadge level={levelInfo.level} title={levelInfo.title} t={t} />
                        )}
                        {review.ownerResponse && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5" data-testid={`badge-responded-${review.id}`}>
                            <MessageCircle className="h-2.5 w-2.5" />
                            {t("reviewSection.responded")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1" data-testid={`text-review-date-${review.id}`}>
                        {format(new Date(review.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-sm text-foreground whitespace-pre-wrap"
                    data-testid={`text-review-comment-${review.id}`}
                  >
                    {review.comment}
                  </p>

                  {review.ownerResponse && (
                    <Card className="mt-3 p-3 bg-muted/50" data-testid={`card-owner-response-${review.id}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]" data-testid={`badge-owner-${review.id}`}>
                          {t("reviewSection.owner")}
                        </Badge>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t("reviewSection.responseFrom")} {businessName}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {review.ownerResponse}
                      </p>
                      {review.ownerRespondedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(review.ownerRespondedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </Card>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center" data-testid="card-no-reviews">
          <p className="text-muted-foreground">
            {t("reviewSection.noReviews")}
          </p>
        </Card>
      )}

      {(hasGoogleRating || stats.count > 0) && (
        <div className="space-y-3 border-t pt-6">
          <h3 className="font-semibold" data-testid="text-review-sources-heading">
            {t("reviewSection.reviewSources")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasGoogleRating && (
              <Card className="p-4" data-testid="card-google-rating">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" data-testid="badge-google-source">
                    Google
                  </Badge>
                  <div className="flex items-center gap-1">
                    <StarRating rating={Math.round(parseFloat(googleRating))} />
                    <span className="font-semibold" data-testid="text-google-rating">
                      {googleRating}
                    </span>
                  </div>
                  {googleReviewCount !== undefined && googleReviewCount > 0 && (
                    <span className="text-xs text-muted-foreground" data-testid="text-google-review-count">
                      ({googleReviewCount})
                    </span>
                  )}
                </div>
              </Card>
            )}
            {stats.count > 0 && (
              <Card className="p-4" data-testid="card-hub-rating">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" data-testid="badge-hub-source">
                    {t("reviewSection.hubReviewsBadge")}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <StarRating rating={Math.round(stats.avgRating)} />
                    <span className="font-semibold" data-testid="text-hub-rating">
                      {stats.avgRating.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground" data-testid="text-hub-review-count">
                    ({stats.count})
                  </span>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
