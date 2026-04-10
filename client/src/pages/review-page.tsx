import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { BizImage } from "@/components/biz-image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Star, CheckCircle, MapPin } from "lucide-react";
import type { Business } from "@shared/schema";

interface ReviewStats {
  avgRating: number;
  count: number;
  distribution: Record<string, number>;
}

export default function ReviewPage({ citySlug, slug }: { citySlug: string; slug?: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const businessSlug = slug || "";

  const { data: business, isLoading: bizLoading } = useQuery<Business>({
    queryKey: ["/api/cities", citySlug, "businesses", businessSlug],
    enabled: !!businessSlug,
  });

  const { data: reviewData } = useQuery<{ reviews: any[]; stats: ReviewStats }>({
    queryKey: ["/api/cities", citySlug, "businesses", businessSlug, "reviews"],
    enabled: !!businessSlug,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cities/${citySlug}/businesses/${businessSlug}/reviews`, {
        rating,
        comment,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "businesses", businessSlug, "reviews"] });
      toast({ title: t("review.submitted"), description: t("review.submittedDesc") });
    },
    onError: (err: any) => {
      toast({ title: t("toast.error"), description: err.message || t("review.submitError"), variant: "destructive" });
    },
  });

  if (bizLoading) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-semibold mb-2" data-testid="text-review-not-found">{t("biz.notFound")}</h2>
      </div>
    );
  }

  const stats = reviewData?.stats;
  const combinedRating = stats?.avgRating || (business.googleRating ? parseFloat(business.googleRating) : 0);
  const totalReviews = (stats?.count || 0) + (business.googleReviewCount || 0);

  const handleSubmit = () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (rating < 1 || rating > 5) {
      toast({ title: t("toast.error"), description: t("review.selectRating"), variant: "destructive" });
      return;
    }
    if (!comment || comment.length < 10) {
      toast({ title: t("toast.error"), description: t("review.commentMinLength"), variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <Card className="p-8 text-center space-y-4">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="text-xl font-semibold" data-testid="text-review-success">{t("review.thankYou")}</h2>
          <p className="text-muted-foreground" data-testid="text-review-pending">{t("review.pendingModeration")}</p>
          <Button variant="outline" onClick={() => window.location.href = `/${citySlug}/directory/${businessSlug}`} data-testid="button-back-to-listing">
            {t("review.backToListing")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4 space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <BizImage src={business.imageUrl} alt={business.name} className="h-16 w-16 rounded-md object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" data-testid="text-review-business-name">{business.name}</h1>
            {business.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{[business.address, business.city, business.state].filter(Boolean).join(", ")}</span>
              </p>
            )}
          </div>
        </div>

        {totalReviews > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${s <= Math.round(combinedRating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                />
              ))}
            </div>
            <span className="text-sm font-medium" data-testid="text-review-combined-rating">{combinedRating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground" data-testid="text-review-count">
              ({totalReviews} {totalReviews === 1 ? t("review.reviewSingular") : t("review.reviewPlural")})
            </span>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold" data-testid="text-review-form-title">{t("review.leaveReview")}</h2>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("review.yourRating")}</p>
          <div className="flex items-center gap-1" data-testid="star-picker">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onMouseEnter={() => setHoveredStar(s)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(s)}
                className="p-1 transition-transform"
                data-testid={`button-star-${s}`}
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    s <= (hoveredStar || rating)
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-rating-label">
              {rating === 5 ? t("review.rating5") :
               rating === 4 ? t("review.rating4") :
               rating === 3 ? t("review.rating3") :
               rating === 2 ? t("review.rating2") :
               t("review.rating1")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t("review.yourReview")}</label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("review.commentPlaceholder")}
            rows={4}
            data-testid="input-review-comment"
          />
          <p className="text-xs text-muted-foreground">
            {t("review.minChars")}
          </p>
        </div>

        {!user && !authLoading && (
          <p className="text-sm text-muted-foreground">
            {t("review.loginRequired")}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending || (!user && authLoading)}
          className="w-full"
          data-testid="button-submit-review"
        >
          {submitMutation.isPending ? t("review.submitting") : user ? t("review.submitReview") : t("review.signInAndSubmit")}
        </Button>
      </Card>

      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        onSuccess={() => {
          setShowAuth(false);
          if (rating >= 1 && comment.length >= 10) {
            submitMutation.mutate();
          }
        }}
      />
    </div>
  );
}
