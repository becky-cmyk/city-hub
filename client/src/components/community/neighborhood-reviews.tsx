import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Star, CheckCircle, User, ChevronDown } from "lucide-react";
import { format } from "date-fns";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  pros: string | null;
  cons: string | null;
  createdAt: string;
  displayName: string;
  zoneName: string;
}

interface ReviewStats {
  avgRating: number;
  count: number;
}

interface NeighborhoodReviewsProps {
  cityId: string;
  zoneId: string;
  neighborhoodName: string;
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${s <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  return (
    <Card className="p-4 space-y-2" data-testid={`card-neighborhood-review-${review.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium" data-testid={`text-reviewer-${review.id}`}>{review.displayName}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(review.createdAt), "MMM d, yyyy")}</p>
          </div>
        </div>
        <StarRating rating={review.rating} />
      </div>
      {review.comment && (
        <p className="text-sm text-foreground leading-relaxed" data-testid={`text-review-comment-${review.id}`}>
          {review.comment}
        </p>
      )}
      {(review.pros || review.cons) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {review.pros && (
            <div className="text-xs">
              <span className="font-medium text-green-500">Pros: </span>
              <span className="text-muted-foreground">{review.pros}</span>
            </div>
          )}
          {review.cons && (
            <div className="text-xs">
              <span className="font-medium text-red-400">Cons: </span>
              <span className="text-muted-foreground">{review.cons}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function WriteReviewForm({ cityId, zoneId, neighborhoodName, onSuccess }: {
  cityId: string;
  zoneId: string;
  neighborhoodName: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/neighborhood-reviews", {
        cityId,
        zoneId,
        rating,
        comment: comment.trim() || null,
        pros: pros.trim() || null,
        cons: cons.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Review submitted", description: "Your review is pending moderation." });
      setRating(0);
      setComment("");
      setPros("");
      setCons("");
      queryClient.invalidateQueries({ queryKey: ["/api/community/neighborhood-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/neighborhood-reviews/stats"] });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to submit review";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (rating < 1) {
      toast({ title: "Please select a rating", variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  }, [user, rating, submitMutation, toast]);

  return (
    <>
      <Card className="p-5 space-y-4" data-testid="form-neighborhood-review">
        <h3 className="font-semibold text-sm">Rate {neighborhoodName}</h3>
        <div className="flex items-center gap-1" data-testid="star-picker-neighborhood">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHoveredStar(s)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(s)}
              className="p-0.5 transition-transform"
              data-testid={`button-neighborhood-star-${s}`}
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  s <= (hoveredStar || rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts about this neighborhood..."
          rows={3}
          data-testid="input-neighborhood-review-comment"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Pros (optional)</label>
            <Textarea
              value={pros}
              onChange={(e) => setPros(e.target.value)}
              placeholder="What do you like?"
              rows={2}
              data-testid="input-neighborhood-review-pros"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cons (optional)</label>
            <Textarea
              value={cons}
              onChange={(e) => setCons(e.target.value)}
              placeholder="What could be better?"
              rows={2}
              data-testid="input-neighborhood-review-cons"
            />
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending || rating < 1}
          className="w-full"
          data-testid="button-submit-neighborhood-review"
        >
          {submitMutation.isPending ? "Submitting..." : user ? "Submit Review" : "Sign In to Review"}
        </Button>
      </Card>
      <AuthDialog open={showAuth} onOpenChange={setShowAuth} defaultTab="register" />
    </>
  );
}

export function NeighborhoodReviews({ cityId, zoneId, neighborhoodName }: NeighborhoodReviewsProps) {
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const PREVIEW_COUNT = 3;

  const { data: stats, isLoading: statsLoading } = useQuery<ReviewStats>({
    queryKey: ["/api/community/neighborhood-reviews/stats", { cityId, zoneId }],
    queryFn: async () => {
      const res = await fetch(`/api/community/neighborhood-reviews/stats?cityId=${cityId}&zoneId=${zoneId}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!cityId && !!zoneId,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery<ReviewItem[]>({
    queryKey: ["/api/community/neighborhood-reviews", { cityId, zoneId }],
    queryFn: async () => {
      const res = await fetch(`/api/community/neighborhood-reviews?cityId=${cityId}&zoneId=${zoneId}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
    enabled: !!cityId && !!zoneId,
  });

  if (statsLoading || reviewsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const avgRating = stats?.avgRating || 0;
  const count = stats?.count || 0;
  const displayedReviews = showAll ? (reviews || []) : (reviews || []).slice(0, PREVIEW_COUNT);
  const hasMore = (reviews || []).length > PREVIEW_COUNT;

  return (
    <section className="space-y-4" data-testid="section-neighborhood-reviews">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-community-reviews-title">Community Reviews</h2>
          {count > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={avgRating} size="md" />
              <span className="text-sm font-medium" data-testid="text-avg-rating">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground" data-testid="text-review-count">
                ({count} {count === 1 ? "review" : "reviews"})
              </span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          data-testid="button-write-review"
        >
          <Star className="h-3.5 w-3.5 mr-1.5" />
          Write a Review
        </Button>
      </div>

      {showForm && (
        <WriteReviewForm
          cityId={cityId}
          zoneId={zoneId}
          neighborhoodName={neighborhoodName}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {count === 0 && !showForm && (
        <Card className="p-6 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review {neighborhoodName}!</p>
        </Card>
      )}

      {displayedReviews.length > 0 && (
        <div className="space-y-3">
          {displayedReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {hasMore && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(true)}
          className="w-full text-muted-foreground"
          data-testid="button-show-all-reviews"
        >
          <ChevronDown className="h-4 w-4 mr-1" />
          Show all {(reviews || []).length} reviews
        </Button>
      )}
    </section>
  );
}
