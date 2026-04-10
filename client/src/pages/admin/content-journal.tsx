import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Check, X, Clock, Loader2, FileText } from "lucide-react";

interface ContentAttachment {
  id: string;
  title: string;
  contentType: string;
  presenceName: string;
  snippet: string | null;
  sourceLabel: string | null;
  approvalStatus: string;
  createdAt: string;
}

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "REJECTED":
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

function AttachmentCard({ attachment }: { attachment: ContentAttachment }) {
  const { toast } = useToast();
  const [batchTag, setBatchTag] = useState("");
  const [showBatchInput, setShowBatchInput] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { approvalStatus: "APPROVED" };
      if (batchTag.trim()) {
        body.batchTag = batchTag.trim();
      }
      await apiRequest("PATCH", `/api/admin/content-attachments/${attachment.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-attachments"] });
      toast({ title: "Content approved" });
      setBatchTag("");
      setShowBatchInput(false);
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/content-attachments/${attachment.id}`, { approvalStatus: "REJECTED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-attachments"] });
      toast({ title: "Content rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject", variant: "destructive" });
    },
  });

  const isPending = attachment.approvalStatus === "PENDING";

  return (
    <Card className="p-4 space-y-3" data-testid={`card-content-attachment-${attachment.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="font-semibold text-sm" data-testid={`text-title-${attachment.id}`}>
              {attachment.title}
            </h3>
            <Badge variant="outline" data-testid={`badge-content-type-${attachment.id}`}>
              {attachment.contentType}
            </Badge>
            <Badge variant={getStatusVariant(attachment.approvalStatus)} data-testid={`badge-status-${attachment.id}`}>
              {attachment.approvalStatus}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground" data-testid={`text-presence-name-${attachment.id}`}>
            {attachment.presenceName}
          </p>
          {attachment.sourceLabel && (
            <p className="text-xs text-muted-foreground" data-testid={`text-source-${attachment.id}`}>
              Source: {attachment.sourceLabel}
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground" data-testid={`text-date-${attachment.id}`}>
          <Clock className="h-3 w-3 inline mr-1" />
          {formatDate(attachment.createdAt)}
        </p>
      </div>

      {attachment.snippet && (
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-sm text-foreground" data-testid={`text-snippet-${attachment.id}`}>
            {attachment.snippet}
          </p>
        </div>
      )}

      {isPending && (
        <div className="space-y-2 pt-2">
          {!showBatchInput ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setShowBatchInput(true)}
                data-testid={`button-show-approve-${attachment.id}`}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                data-testid={`button-reject-${attachment.id}`}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5 mr-1" />
                )}
                Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Batch tag (optional, e.g. founder-batch-1)"
                value={batchTag}
                onChange={(e) => setBatchTag(e.target.value)}
                data-testid={`input-batch-tag-${attachment.id}`}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  data-testid={`button-approve-${attachment.id}`}
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
                  variant="outline"
                  onClick={() => { setShowBatchInput(false); setBatchTag(""); }}
                  disabled={approveMutation.isPending}
                  data-testid={`button-cancel-approve-${attachment.id}`}
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

export default function ContentJournalPanel({ cityId }: { cityId?: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const queryKey = statusFilter === "all"
    ? ["/api/admin/content-attachments", cityId]
    : ["/api/admin/content-attachments", `?status=${statusFilter}`, cityId];

  const { data: attachments, isLoading } = useQuery<ContentAttachment[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/content-attachments?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-content-journal-title">
          <FileText className="h-5 w-5" />
          Content Journal
        </h2>
        <p className="text-sm text-muted-foreground">Review and manage content attachment submissions</p>
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
      ) : !attachments || attachments.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-content-attachments">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No content attachments found</h3>
          <p className="text-sm text-muted-foreground">
            {statusFilter !== "all" ? `No ${statusFilter.toLowerCase()} submissions` : "No content submissions yet"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => (
            <AttachmentCard key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
}
