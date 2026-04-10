import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { format } from "date-fns";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { Link } from "wouter";

interface ReviewItem {
  id: string;
  rating: number;
  text: string;
  displayName: string;
  source: string;
  createdAt: string;
}

interface ReviewsBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  reviews?: ReviewItem[];
  googleRating?: string;
  googleReviewCount?: number;
  citySlug?: string;
  businessSlug?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  google: "bg-blue-600",
  yelp: "bg-red-600",
  facebook: "bg-indigo-600",
  internal: "bg-teal-600",
};

function StarDistributionBar({ reviews, accentColor }: { reviews: ReviewItem[]; accentColor: string }) {
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

  return (
    <div className="space-y-1.5 w-full max-w-xs" data-testid="chart-star-distribution">
      {([5, 4, 3, 2, 1] as const).map((star) => {
        const count = distribution[star];
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs w-8 text-right text-muted-foreground">{star} star</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: accentColor }}
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

export function ReviewsBlock({ block, template, accentColor, locale, reviews, googleRating, googleReviewCount, citySlug, businessSlug }: ReviewsBlockProps) {
  const { headline } = block.content;
  const headlineText = t(headline, locale) || (locale === "es" ? "Reseñas" : "Reviews");
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;
  const reviewList = useMemo(() => {
    const list = reviews || [];
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews]);

  if (reviewList.length === 0 && !googleRating) return null;

  const avg = reviewList.length > 0
    ? reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length
    : 0;

  const gRating = googleRating ? parseFloat(googleRating) : 0;
  const gCount = googleReviewCount || 0;
  const hubCount = reviewList.length;
  const totalCount = gCount + hubCount;
  const combinedAvg = totalCount > 0 ? (gRating * gCount + avg * hubCount) / totalCount : 0;

  const reviewLinkHref = citySlug && businessSlug ? `/${citySlug}/review/${businessSlug}` : null;

  return (
    <section id="reviews" className={`${template.sectionSpacing} px-6 md:px-8 bg-muted/30`} data-testid="block-reviews">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-4`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-reviews-headline"
        >
          {headlineText}
        </h2>

        <Card className="p-6 mb-8" data-testid="card-review-summary">
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl font-bold" data-testid="text-combined-rating">{combinedAvg.toFixed(1)}</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-5 w-5 ${s <= Math.round(combinedAvg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-review-source-breakdown">
                Based on{gCount > 0 ? ` ${gCount} Google review${gCount === 1 ? "" : "s"}` : ""}
                {gCount > 0 && hubCount > 0 ? " and" : ""}
                {hubCount > 0 ? ` ${hubCount} Hub review${hubCount === 1 ? "" : "s"}` : ""}
              </p>
            </div>

            {reviewList.length > 0 && (
              <StarDistributionBar reviews={reviewList} accentColor={accentColor} />
            )}
          </div>

          {reviewLinkHref && (
            <div className="flex justify-center mt-4">
              <Link href={reviewLinkHref}>
                <Button
                  style={{ backgroundColor: accentColor, borderColor: accentColor }}
                  className="text-white border"
                  data-testid="button-write-review"
                >
                  {locale === "es" ? "Escribir una Reseña" : "Write a Review"}
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {reviewList.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {reviewList.slice(0, 6).map((review) => {
              const sourceColor = SOURCE_COLORS[review.source] || SOURCE_COLORS.internal;
              return (
                <Card key={review.id} className={`${template.cardStyle} p-5 space-y-3`} data-testid={`card-review-${review.id}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>
                        {(review.displayName || "A")[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{review.displayName || (locale === "es" ? "Anónimo" : "Anonymous")}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Badge className={`${sourceColor} text-white text-[9px] border-0`}>
                      {review.source === "internal" ? "Hub" : review.source.charAt(0).toUpperCase() + review.source.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }}>
                    {review.text}
                  </p>
                  {review.createdAt && (
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(review.createdAt), "MMM d, yyyy")}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
