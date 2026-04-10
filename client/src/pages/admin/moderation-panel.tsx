import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Check, X, Clock, Bot, AlertTriangle, Eye,
  Image as ImageIcon, Calendar, Store, MessageSquare, RefreshCw,
} from "lucide-react";

interface ModerationItem {
  id: string;
  contentType: string;
  contentId: string;
  submittedByUserId: string | null;
  metroId: string | null;
  cityId: string | null;
  status: string;
  aiRecommendation: string | null;
  aiReasoning: string | null;
  reviewedByAdminId: string | null;
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  contentPreview: {
    title: string;
    body: string | null;
    coverImageUrl: string | null;
    submitterEmail: string | null;
    authorUserId: string | null;
  } | null;
}

interface ModerationResponse {
  items: ModerationItem[];
  total: number;
  limit: number;
  offset: number;
}

interface ModerationStats {
  pending: number;
  aiReviewed: number;
  approved: number;
  rejected: number;
}

const contentTypeConfig: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  post: { label: "Post", icon: MessageSquare, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  event_tip: { label: "Event Tip", icon: Calendar, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  business_update: { label: "Business", icon: Store, color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  photo: { label: "Photo", icon: ImageIcon, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  repost: { label: "Repost", icon: RefreshCw, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
};

function AiBadge({ recommendation, reasoning }: { recommendation: string | null; reasoning: string | null }) {
  if (!recommendation) return null;

  const config: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
    approve: { variant: "default", label: "AI: Approve" },
    reject: { variant: "destructive", label: "AI: Reject" },
    flag: { variant: "secondary", label: "AI: Needs Review" },
  };

  const c = config[recommendation] || config.flag;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Bot className="h-3.5 w-3.5" />
        <Badge variant={c.variant} data-testid={`badge-ai-rec-${recommendation}`}>
          {c.label}
        </Badge>
      </div>
      {reasoning && (
        <p className="text-xs text-muted-foreground pl-5 italic" data-testid="text-ai-reasoning">
          {reasoning}
        </p>
      )}
    </div>
  );
}

function ModerationCard({ item, onAction }: { item: ModerationItem; onAction: () => void }) {
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/moderation/${item.id}/approve`, { reviewNotes: reviewNotes || undefined }),
    onSuccess: () => {
      toast({ title: "Approved", description: "Content has been approved and published." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation"] });
      onAction();
    },
    onError: () => toast({ title: "Error", description: "Failed to approve", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/moderation/${item.id}/reject`, { reviewNotes: reviewNotes || undefined }),
    onSuccess: () => {
      toast({ title: "Rejected", description: "Content has been rejected." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation"] });
      onAction();
    },
    onError: () => toast({ title: "Error", description: "Failed to reject", variant: "destructive" }),
  });

  const typeConfig = contentTypeConfig[item.contentType] || contentTypeConfig.post;
  const TypeIcon = typeConfig.icon;
  const isPending = approveMutation.isPending || rejectMutation.isPending;
  const isReviewed = item.status === "approved" || item.status === "rejected";

  return (
    <Card className="p-4" data-testid={`moderation-card-${item.id}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${typeConfig.color}`}>
              <TypeIcon className="h-3.5 w-3.5" />
              {typeConfig.label}
            </div>
            <Badge variant={item.status === "pending" ? "outline" : item.status === "ai_reviewed" ? "secondary" : item.status === "approved" ? "default" : "destructive"} data-testid={`badge-status-${item.status}`}>
              {item.status === "ai_reviewed" ? "AI Reviewed" : item.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(item.submittedAt).toLocaleDateString()} {new Date(item.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {item.contentPreview && (
          <div className="space-y-2">
            {item.contentPreview.coverImageUrl && (
              <img
                src={item.contentPreview.coverImageUrl}
                alt=""
                className="w-full max-h-48 object-cover rounded-md"
                data-testid="img-content-preview"
              />
            )}
            <h4 className="text-sm font-semibold" data-testid="text-content-title">
              {item.contentPreview.title}
            </h4>
            {item.contentPreview.body && (
              <p className="text-xs text-muted-foreground line-clamp-3" data-testid="text-content-body">
                {item.contentPreview.body}
              </p>
            )}
            {item.contentPreview.submitterEmail && (
              <p className="text-xs text-muted-foreground">
                Submitted by: {item.contentPreview.submitterEmail}
              </p>
            )}
          </div>
        )}

        <AiBadge recommendation={item.aiRecommendation} reasoning={item.aiReasoning} />

        {!isReviewed && (
          <div className="space-y-2">
            {showNotes && (
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add review notes (optional)..."
                className="text-xs resize-none"
                rows={2}
                data-testid="input-review-notes"
              />
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={isPending}
                data-testid={`button-approve-${item.id}`}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectMutation.mutate()}
                disabled={isPending}
                data-testid={`button-reject-${item.id}`}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotes(!showNotes)}
                data-testid="button-toggle-notes"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                {showNotes ? "Hide Notes" : "Add Notes"}
              </Button>
            </div>
          </div>
        )}

        {isReviewed && item.reviewNotes && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            Review notes: {item.reviewNotes}
          </p>
        )}
      </div>
    </Card>
  );
}

export default function ModerationPanel({ cityId }: { cityId?: string }) {
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: stats } = useQuery<ModerationStats>({
    queryKey: ["/api/admin/moderation/stats", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/moderation/stats?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data, isLoading, refetch } = useQuery<ModerationResponse>({
    queryKey: ["/api/admin/moderation/queue", statusFilter, cityId],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter, limit: "50" });
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/moderation/queue?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  return (
    <div className="space-y-4 p-4 max-w-4xl" data-testid="moderation-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-moderation-title">Moderation Queue</h2>
          <p className="text-xs text-muted-foreground">Review and approve community submissions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-queue">
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <span className="text-xl font-bold" data-testid="stat-pending">{stats.pending}</span>
          </Card>
          <Card className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Bot className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-muted-foreground">AI Reviewed</span>
            </div>
            <span className="text-xl font-bold" data-testid="stat-ai-reviewed">{stats.aiReviewed}</span>
          </Card>
          <Card className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">Approved</span>
            </div>
            <span className="text-xl font-bold" data-testid="stat-approved">{stats.approved}</span>
          </Card>
          <Card className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <X className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-muted-foreground">Rejected</span>
            </div>
            <span className="text-xl font-bold" data-testid="stat-rejected">{stats.rejected}</span>
          </Card>
        </div>
      )}

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList data-testid="tabs-moderation-filter">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending {stats?.pending ? `(${stats.pending})` : ""}
          </TabsTrigger>
          <TabsTrigger value="ai_reviewed" data-testid="tab-ai-reviewed">
            AI Reviewed {stats?.aiReviewed ? `(${stats.aiReviewed})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2 mb-2" />
              <Skeleton className="h-3 w-full" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && data?.items && data.items.length === 0 && (
        <Card className="p-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="text-empty-queue">
            No items in the {statusFilter} queue
          </p>
        </Card>
      )}

      {!isLoading && data?.items && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((item) => (
            <ModerationCard key={item.id} item={item} onAction={() => refetch()} />
          ))}
        </div>
      )}

      {data && data.total > data.limit && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {data.items.length} of {data.total} items
        </p>
      )}
    </div>
  );
}
