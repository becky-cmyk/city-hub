import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, X, Clock, Star, AlertCircle, MapPin } from "lucide-react";
import { useState } from "react";

interface ReviewData {
  id: string;
  businessId: string;
  userId: string;
  rating: number;
  comment: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  ownerResponse: string | null;
  ownerRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  businessName: string;
}

interface NeighborhoodReviewData {
  id: string;
  cityId: string;
  zoneId: string;
  userId: string;
  rating: number;
  comment: string | null;
  pros: string | null;
  cons: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  displayName: string;
  zoneName: string;
}

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  APPROVED: <Check className="h-3 w-3" />,
  REJECTED: <X className="h-3 w-3" />,
};

function ReviewCard({ review, onStatusChange }: { review: ReviewData; onStatusChange: () => void }) {
  const { toast } = useToast();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/reviews/${review.id}`, { status: "APPROVED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Review approved" });
      setActionInProgress(null);
      onStatusChange();
    },
    onError: () => {
      toast({ title: "Failed to approve review", variant: "destructive" });
      setActionInProgress(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/reviews/${review.id}`, { status: "REJECTED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Review rejected" });
      setActionInProgress(null);
      onStatusChange();
    },
    onError: () => {
      toast({ title: "Failed to reject review", variant: "destructive" });
      setActionInProgress(null);
    },
  });

  const handleApprove = () => {
    setActionInProgress("approve");
    approveMutation.mutate();
  };

  const handleReject = () => {
    setActionInProgress("reject");
    rejectMutation.mutate();
  };

  return (
    <Card className="p-4 space-y-3" data-testid={`card-review-${review.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm" data-testid={`text-business-name-${review.id}`}>
              {review.businessName}
            </h3>
            <Badge variant={statusColors[review.status]} data-testid={`badge-status-${review.id}`}>
              {statusIcons[review.status]}
              <span className="ml-1">{review.status}</span>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground" data-testid={`text-reviewer-name-${review.id}`}>
            By {review.displayName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
              }`}
              data-testid={`star-${review.id}-${i}`}
            />
          ))}
        </div>
      </div>

      {review.comment && (
        <div>
          <p className="text-sm text-foreground" data-testid={`text-comment-${review.id}`}>
            {review.comment}
          </p>
          <p className="text-xs text-muted-foreground mt-1" data-testid={`text-date-${review.id}`}>
            {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {review.ownerResponse && (
        <div className="bg-muted/50 rounded-md p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground" data-testid={`text-owner-response-label-${review.id}`}>
            <AlertCircle className="h-3 w-3" />
            Owner Response
          </div>
          <p className="text-xs text-foreground" data-testid={`text-owner-response-${review.id}`}>
            {review.ownerResponse}
          </p>
          {review.ownerRespondedAt && (
            <p className="text-[10px] text-muted-foreground">
              {new Date(review.ownerRespondedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {review.status === "PENDING" && (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={actionInProgress !== null}
            data-testid={`button-approve-${review.id}`}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            {actionInProgress === "approve" ? "Approving..." : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleReject}
            disabled={actionInProgress !== null}
            data-testid={`button-reject-${review.id}`}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {actionInProgress === "reject" ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function NeighborhoodReviewCard({ review, onStatusChange }: { review: NeighborhoodReviewData; onStatusChange: () => void }) {
  const { toast } = useToast();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/admin/community/neighborhood-reviews/${review.id}/status`, { status });
    },
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/neighborhood-reviews"] });
      toast({ title: `Review ${status === "APPROVED" ? "approved" : "rejected"}` });
      setActionInProgress(null);
      onStatusChange();
    },
    onError: () => {
      toast({ title: "Failed to update review", variant: "destructive" });
      setActionInProgress(null);
    },
  });

  return (
    <Card className="p-4 space-y-3" data-testid={`card-neighborhood-review-${review.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm flex items-center gap-1.5" data-testid={`text-zone-name-${review.id}`}>
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {review.zoneName}
            </h3>
            <Badge variant={statusColors[review.status]} data-testid={`badge-nhr-status-${review.id}`}>
              {statusIcons[review.status]}
              <span className="ml-1">{review.status}</span>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground" data-testid={`text-nhr-reviewer-${review.id}`}>
            By {review.displayName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      {review.comment && (
        <p className="text-sm text-foreground" data-testid={`text-nhr-comment-${review.id}`}>
          {review.comment}
        </p>
      )}

      {(review.pros || review.cons) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

      <p className="text-xs text-muted-foreground" data-testid={`text-nhr-date-${review.id}`}>
        {new Date(review.createdAt).toLocaleDateString()}
      </p>

      {review.status === "PENDING" && (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => { setActionInProgress("approve"); updateStatus.mutate("APPROVED"); }}
            disabled={actionInProgress !== null}
            data-testid={`button-nhr-approve-${review.id}`}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            {actionInProgress === "approve" ? "Approving..." : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => { setActionInProgress("reject"); updateStatus.mutate("REJECTED"); }}
            disabled={actionInProgress !== null}
            data-testid={`button-nhr-reject-${review.id}`}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {actionInProgress === "reject" ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function ReviewsList({ statusFilter, cityId }: { statusFilter: string | undefined; cityId?: string }) {
  const { data: reviews, isLoading, refetch } = useQuery<ReviewData[]>({
    queryKey: ["/api/admin/reviews", cityId, { statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/reviews?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (!reviews || reviews.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold mb-1">No reviews found</h3>
        <p className="text-sm text-muted-foreground">
          {statusFilter && statusFilter !== "all" ? `No ${statusFilter.toLowerCase()} reviews` : "No reviews yet"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} onStatusChange={() => refetch()} />
      ))}
    </div>
  );
}

function NeighborhoodReviewsList({ statusFilter, cityId }: { statusFilter: string | undefined; cityId?: string }) {
  const { data: reviews, isLoading, refetch } = useQuery<NeighborhoodReviewData[]>({
    queryKey: ["/api/admin/community/neighborhood-reviews", cityId, { statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/community/neighborhood-reviews?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch neighborhood reviews");
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (!reviews || reviews.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MapPin className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold mb-1">No neighborhood reviews found</h3>
        <p className="text-sm text-muted-foreground">
          {statusFilter && statusFilter !== "all" ? `No ${statusFilter.toLowerCase()} neighborhood reviews` : "No neighborhood reviews yet"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <NeighborhoodReviewCard key={review.id} review={review} onStatusChange={() => refetch()} />
      ))}
    </div>
  );
}

export default function ReviewModeration({ cityId }: { cityId?: string }) {
  const [activeTab, setActiveTab] = useState("business");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [nhrStatusFilter, setNhrStatusFilter] = useState<string>("PENDING");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-review-moderation-title">
          <AlertCircle className="h-5 w-5" />
          Review Moderation
        </h2>
        <p className="text-sm text-muted-foreground">Approve or reject reviews</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-review-type">
          <TabsTrigger value="business" data-testid="tab-business-reviews">Business Reviews</TabsTrigger>
          <TabsTrigger value="neighborhood" data-testid="tab-neighborhood-reviews">Neighborhood Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ReviewsList statusFilter={statusFilter === "all" ? undefined : statusFilter} cityId={cityId} />
        </TabsContent>

        <TabsContent value="neighborhood" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Select value={nhrStatusFilter} onValueChange={setNhrStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-nhr-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NeighborhoodReviewsList statusFilter={nhrStatusFilter === "all" ? undefined : nhrStatusFilter} cityId={cityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
