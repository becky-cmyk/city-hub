import { useState, useCallback } from "react";
import { Star, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";

interface ReviewPrompt {
  id: string;
  business_id: string;
  business_name: string;
  business_handle?: string;
  logo_url?: string;
  primary_photo_url?: string;
}

interface ReviewPromptCardProps {
  prompt: ReviewPrompt;
  citySlug: string;
  onDismiss: (id: string) => void;
  onSubmit: (id: string) => void;
}

export function ReviewPromptCard({ prompt, citySlug, onDismiss, onSubmit }: ReviewPromptCardProps) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showText, setShowText] = useState(false);
  const { toast } = useToast();

  const handleDismiss = useCallback(async () => {
    try {
      await apiRequest("POST", `/api/feed/review-prompts/${prompt.id}/dismiss`);
      onDismiss(prompt.id);
    } catch {}
  }, [prompt.id, onDismiss]);

  const handleSubmitReview = useCallback(async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/cities/${citySlug}/reviews`, {
        businessId: prompt.business_id,
        rating,
        text: reviewText.trim() || undefined,
      });
      await apiRequest("POST", `/api/feed/review-prompts/${prompt.id}/responded`);
      toast({ title: t("review.submitted"), description: t("review.thanks") });
      onSubmit(prompt.id);
    } catch {
      toast({ title: t("review.couldntSubmit"), description: t("review.tryAgainLater"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [rating, reviewText, prompt, citySlug, toast, onSubmit]);

  const displayName = prompt.business_handle ? `@${prompt.business_handle}` : prompt.business_name;
  const imageUrl = prompt.logo_url || prompt.primary_photo_url;

  return (
    <div
      className="rounded-xl border border-purple-500/20 bg-gray-900/80 p-4 mx-1"
      data-testid={`review-prompt-${prompt.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={prompt.business_name}
              className="w-10 h-10 rounded-lg object-cover"
              data-testid={`review-prompt-img-${prompt.id}`}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-purple-400" />
            </div>
          )}
          <div>
            <p className="text-sm text-gray-400" data-testid={`review-prompt-label-${prompt.id}`}>
              {t("review.howWasExperience")}
            </p>
            <p className="text-sm font-medium text-white" data-testid={`review-prompt-name-${prompt.id}`}>
              {displayName}?
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-white/50 p-1"
          data-testid={`review-prompt-dismiss-${prompt.id}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 mb-3" data-testid={`review-prompt-stars-${prompt.id}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => {
              setRating(star);
              if (!showText) setShowText(true);
            }}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5"
            data-testid={`review-star-${star}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= (hoverRating || rating)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-white/30"
              }`}
            />
          </button>
        ))}
      </div>

      {showText && (
        <div className="space-y-2">
          <Textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder={t("review.addNote")}
            className="bg-gray-800/50 border-gray-700 text-white text-sm resize-none"
            rows={2}
            data-testid={`review-prompt-text-${prompt.id}`}
          />
          <Button
            onClick={handleSubmitReview}
            disabled={rating === 0 || submitting}
            size="sm"
            className="w-full bg-purple-600 text-white"
            data-testid={`review-prompt-submit-${prompt.id}`}
          >
            <Send className="w-4 h-4 mr-1.5" />
            {submitting ? t("review.submitting") : t("review.submitReview")}
          </Button>
        </div>
      )}
    </div>
  );
}
