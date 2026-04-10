import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Review {
  id: string;
  businessId: string;
  userId: string;
  rating: number;
  comment: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  ownerResponse: string | null;
  ownerRespondedAt: Date | null;
  displayName?: string;
  createdAt: Date;
}

interface ReviewsResponse {
  reviews: Review[];
  stats: {
    avgRating: number;
    count: number;
  };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status, t }: { status: "PENDING" | "APPROVED" | "REJECTED"; t: (key: TranslationKey, replacements?: Record<string, string>) => string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "secondary",
    APPROVED: "default",
    REJECTED: "destructive",
  };

  const labelKeys: Record<string, TranslationKey> = {
    PENDING: "ownerReviews.pending",
    APPROVED: "ownerReviews.approved",
    REJECTED: "ownerReviews.rejected",
  };

  return (
    <Badge variant={variants[status]} data-testid={`badge-status-${status.toLowerCase()}`}>
      {t(labelKeys[status])}
    </Badge>
  );
}

export default function OwnerReviews({
  citySlug,
  businessSlug,
}: {
  citySlug: string;
  businessSlug: string;
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [respondingToId, setRespondingToId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const { data: reviewsData, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["/api/cities", citySlug, "owner", businessSlug, "reviews"],
  });

  const respondMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/cities/${citySlug}/owner/${businessSlug}/reviews/${reviewId}/respond`,
        { response: responseText }
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("ownerReviews.responseSubmitted"),
        description: t("ownerReviews.responsePosted"),
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/cities", citySlug, "owner", businessSlug, "reviews"],
      });
      setRespondingToId(null);
      setResponseText("");
    },
    onError: () => {
      toast({
        title: t("ownerReviews.failedSubmit"),
        description: t("ownerReviews.tryAgain"),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const reviews = reviewsData?.reviews || [];
  const stats = reviewsData?.stats || { avgRating: 0, count: 0 };

  return (
    <div className="space-y-6" data-testid="owner-reviews">
      {stats.count > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4" data-testid="text-reviews-stats-title">
            {t("ownerReviews.statistics")}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <StarRating rating={Math.round(stats.avgRating)} />
              <span className="text-2xl font-bold" data-testid="text-avg-rating">
                {stats.avgRating.toFixed(1)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground" data-testid="text-review-count">
              {t("ownerReviews.basedOn")} {stats.count} {stats.count === 1 ? t("reviewSection.review") : t("reviewSection.reviewsPlural")}
            </span>
          </div>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4" data-testid="text-reviews-heading">
          {t("ownerReviews.allReviews")}
        </h2>

        {reviews.length > 0 ? (
          <div className="space-y-3" data-testid="list-reviews">
            {reviews.map((review) => (
              <Card key={review.id} className="p-5" data-testid={`card-review-${review.id}`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StarRating rating={review.rating} />
                        <span className="text-sm font-semibold" data-testid={`text-reviewer-name-${review.id}`}>
                          {review.displayName || t("ownerReviews.anonymous")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid={`text-review-date-${review.id}`}>
                        {format(new Date(review.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <StatusBadge status={review.status} t={t} />
                  </div>

                  <p
                    className="text-sm text-foreground whitespace-pre-wrap"
                    data-testid={`text-review-comment-${review.id}`}
                  >
                    {review.comment}
                  </p>

                  {review.ownerResponse ? (
                    <Card
                      className="mt-3 p-4 bg-muted/50"
                      data-testid={`card-owner-response-${review.id}`}
                    >
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        {t("ownerReviews.yourResponse")}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {review.ownerResponse}
                      </p>
                      {review.ownerRespondedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(review.ownerRespondedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </Card>
                  ) : review.status === "APPROVED" ? (
                    respondingToId === review.id ? (
                      <div className="mt-3 space-y-2 p-4 bg-muted/30 rounded-md">
                        <Textarea
                          placeholder={t("ownerReviews.writePlaceholder")}
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          className="resize-none"
                          rows={3}
                          data-testid={`textarea-response-${review.id}`}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRespondingToId(null);
                              setResponseText("");
                            }}
                            data-testid={`button-cancel-response-${review.id}`}
                          >
                            {t("ownerReviews.cancel")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => respondMutation.mutate(review.id)}
                            disabled={!responseText.trim() || respondMutation.isPending}
                            data-testid={`button-submit-response-${review.id}`}
                          >
                            {respondMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                {t("ownerReviews.submitting")}
                              </>
                            ) : (
                              t("ownerReviews.submitResponse")
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRespondingToId(review.id)}
                        data-testid={`button-respond-${review.id}`}
                      >
                        {t("ownerReviews.respond")}
                      </Button>
                    )
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center" data-testid="card-no-reviews">
            <p className="text-muted-foreground">
              {t("ownerReviews.noReviews")}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
