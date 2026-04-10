import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Check, X, Clock, Loader2, Shield } from "lucide-react";

interface EnterpriseReview {
  id: string;
  ownerUserId: string;
  presenceCount: number;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Denied", value: "DENIED" },
];

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "DENIED":
      return "destructive";
    case "PENDING":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReviewCard({ review }: { review: EnterpriseReview }) {
  const { toast } = useToast();
  const [denyNote, setDenyNote] = useState("");
  const [showDenyInput, setShowDenyInput] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/enterprise-reviews/${review.id}`, { status: "APPROVED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enterprise-reviews"] });
      toast({ title: "Enterprise review approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/enterprise-reviews/${review.id}`, {
        status: "DENIED",
        adminNote: denyNote.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enterprise-reviews"] });
      toast({ title: "Enterprise review denied" });
      setDenyNote("");
      setShowDenyInput(false);
    },
    onError: () => {
      toast({ title: "Failed to deny", variant: "destructive" });
    },
  });

  const isPending = review.status === "PENDING";

  return (
    <Card className="p-4 space-y-3" data-testid={`card-enterprise-review-${review.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold" data-testid={`text-owner-${review.id}`}>
              Owner: {review.ownerUserId}
            </span>
            <Badge variant={getStatusVariant(review.status)} data-testid={`badge-status-${review.id}`}>
              {review.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground" data-testid={`text-presence-count-${review.id}`}>
            Presence count: {review.presenceCount}
          </p>
        </div>
        <p className="text-xs text-muted-foreground" data-testid={`text-date-${review.id}`}>
          <Clock className="h-3 w-3 inline mr-1" />
          {formatDate(review.createdAt)}
        </p>
      </div>

      {review.adminNote && (
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-xs font-semibold text-foreground mb-1">Admin Note</p>
          <p className="text-sm text-foreground" data-testid={`text-admin-note-${review.id}`}>
            {review.adminNote}
          </p>
        </div>
      )}

      {isPending && (
        <div className="space-y-2 pt-2">
          {!showDenyInput ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                data-testid={`button-approve-${review.id}`}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDenyInput(true)}
                data-testid={`button-show-deny-${review.id}`}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Deny
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Admin note (optional)"
                value={denyNote}
                onChange={(e) => setDenyNote(e.target.value)}
                data-testid={`input-deny-note-${review.id}`}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => denyMutation.mutate()}
                  disabled={denyMutation.isPending}
                  data-testid={`button-deny-${review.id}`}
                >
                  {denyMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5 mr-1" />
                  )}
                  Deny
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowDenyInput(false); setDenyNote(""); }}
                  disabled={denyMutation.isPending}
                  data-testid={`button-cancel-deny-${review.id}`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function EnterpriseReviewsPanel({ cityId }: { cityId?: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const { data: reviews, isLoading } = useQuery<EnterpriseReview[]>({
    queryKey: ["/api/admin/enterprise-reviews", statusFilter, cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/enterprise-reviews?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-enterprise-reviews-title">
          <Shield className="h-5 w-5" />
          Enterprise Reviews
        </h2>
        <p className="text-sm text-muted-foreground">Review and manage enterprise upgrade requests</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            size="sm"
            variant={statusFilter === filter.value ? "default" : "outline"}
            onClick={() => setStatusFilter(filter.value)}
            data-testid={`button-filter-${filter.value}`}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !reviews || reviews.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-enterprise-reviews">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No enterprise reviews found</h3>
          <p className="text-sm text-muted-foreground">
            {statusFilter !== "all" ? `No ${statusFilter.toLowerCase()} reviews` : "No enterprise reviews yet"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
