import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowRightLeft, Check, X, Clock, Loader2, Building2, User, Mail } from "lucide-react";
import { useState } from "react";

interface TransferRequest {
  id: string;
  businessId: string;
  businessName: string;
  requestedByName: string;
  requestedByUserId: string;
  newOwnerName: string;
  newOwnerEmail: string;
  reason: string | null;
  status: string;
  adminNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending Admin Review", value: "PENDING_ADMIN_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Expired", value: "EXPIRED" },
];

function getStatusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "APPROVED":
    case "ACCEPTED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "PENDING_ADMIN_REVIEW":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "PENDING_ADMIN_REVIEW":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "APPROVED":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "REJECTED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "ACCEPTED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "EXPIRED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    default:
      return "";
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

function TransferCard({ request, onActionComplete }: { request: TransferRequest; onActionComplete: () => void }) {
  const { toast } = useToast();
  const [adminNotes, setAdminNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const actionMutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      await apiRequest("PATCH", `/api/admin/transfer-requests/${request.id}`, {
        action,
        adminNotes: adminNotes.trim() || null,
      });
    },
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-requests"] });
      toast({ title: `Transfer request ${action === "approve" ? "approved" : "rejected"}` });
      setAdminNotes("");
      setShowNotes(false);
      onActionComplete();
    },
    onError: (_err, action) => {
      toast({
        title: `Failed to ${action} transfer request`,
        variant: "destructive",
      });
    },
  });

  const isPending = request.status === "PENDING_ADMIN_REVIEW";

  return (
    <Card className="p-4 space-y-3" data-testid={`card-transfer-${request.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="font-semibold text-sm" data-testid={`text-business-name-${request.id}`}>
              {request.businessName}
            </h3>
            <Badge
              className={`no-default-hover-elevate no-default-active-elevate ${getStatusColor(request.status)}`}
              data-testid={`badge-status-${request.id}`}
            >
              {request.status.replace(/_/g, " ")}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span data-testid={`text-requested-by-${request.id}`}>Requested by {request.requestedByName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span data-testid={`text-new-owner-${request.id}`}>
              New owner: {request.newOwnerName} ({request.newOwnerEmail})
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground" data-testid={`text-date-${request.id}`}>
          <Clock className="h-3 w-3 inline mr-1" />
          {formatDate(request.createdAt)}
        </p>
      </div>

      {request.reason && (
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-xs font-semibold text-foreground mb-1">Reason</p>
          <p className="text-sm text-foreground" data-testid={`text-reason-${request.id}`}>
            {request.reason}
          </p>
        </div>
      )}

      {request.adminNotes && (
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-xs font-semibold text-foreground mb-1">Admin Notes</p>
          <p className="text-sm text-foreground" data-testid={`text-admin-notes-${request.id}`}>
            {request.adminNotes}
          </p>
          {request.reviewedAt && (
            <p className="text-[10px] text-muted-foreground mt-1">Reviewed {formatDate(request.reviewedAt)}</p>
          )}
        </div>
      )}

      {isPending && (
        <div className="space-y-2 pt-2">
          {!showNotes ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setShowNotes(true)}
                data-testid={`button-show-approve-${request.id}`}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowNotes(true)}
                data-testid={`button-show-reject-${request.id}`}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="Admin notes (optional)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="text-sm"
                data-testid={`textarea-admin-notes-${request.id}`}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => actionMutation.mutate("approve")}
                  disabled={actionMutation.isPending}
                  data-testid={`button-approve-${request.id}`}
                >
                  {actionMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => actionMutation.mutate("reject")}
                  disabled={actionMutation.isPending}
                  data-testid={`button-reject-${request.id}`}
                >
                  {actionMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5 mr-1" />
                  )}
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowNotes(false); setAdminNotes(""); }}
                  disabled={actionMutation.isPending}
                  data-testid={`button-cancel-${request.id}`}
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

function TransferList({ statusFilter, cityId }: { statusFilter: string | undefined; cityId?: string }) {
  const { data: requests, isLoading, refetch } = useQuery<TransferRequest[]>({
    queryKey: ["/api/admin/transfer-requests", cityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/transfer-requests?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load transfer requests");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Card className="p-8 text-center" data-testid="empty-transfer-requests">
        <ArrowRightLeft className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold mb-1">No transfer requests found</h3>
        <p className="text-sm text-muted-foreground">
          {statusFilter ? `No ${statusFilter.replace(/_/g, " ").toLowerCase()} requests` : "No transfer requests yet"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <TransferCard key={request.id} request={request} onActionComplete={() => refetch()} />
      ))}
    </div>
  );
}

export default function TransferPanel({ cityId }: { cityId?: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_ADMIN_REVIEW");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-transfer-panel-title">
          <ArrowRightLeft className="h-5 w-5" />
          Ownership Transfer Requests
        </h2>
        <p className="text-sm text-muted-foreground">Review and manage business ownership transfer requests</p>
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

      <TransferList statusFilter={statusFilter === "all" ? undefined : statusFilter} cityId={cityId} />
    </div>
  );
}
