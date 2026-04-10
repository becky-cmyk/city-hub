import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShieldCheck, MessageSquare, ClipboardList, Check, X, Clock, Search } from "lucide-react";
import ModerationPanel from "./moderation-panel";
import ReviewModeration from "./review-moderation";

interface AdminSubmission {
  id: string;
  type: string;
  status: string;
  submitterName: string;
  submitterEmail: string;
  createdAt: string;
  payload: any;
}

function SubmissionsPanel({ submissions, reviewMutation }: { submissions?: AdminSubmission[]; reviewMutation: any }) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg" data-testid="text-submissions-title">Pending Submissions</h2>
      {submissions && submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <Card key={sub.id} className="p-4" data-testid={`card-submission-${sub.id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{sub.type}</Badge>
                    <Badge
                      variant={sub.status === "PENDING" ? "secondary" : sub.status === "APPROVED" ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {sub.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold" data-testid={`text-submission-name-${sub.id}`}>
                    {sub.payload?.name || sub.payload?.title || sub.payload?.businessName || "Submission"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-submitter-${sub.id}`}>
                    By {sub.submitterName} ({sub.submitterEmail})
                  </p>
                  {sub.type === "OWNER_EDIT" && sub.payload?.changes && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p className="font-medium">Requested changes:</p>
                      {Object.entries(sub.payload.changes).filter(([k]) => k !== "ownerName").map(([key, val]) => (
                        <p key={key}>{key}: {String(val)}</p>
                      ))}
                    </div>
                  )}
                  {sub.payload?.googlePlaceId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Search className="inline h-3 w-3 mr-1" />Google Place ID: {sub.payload.googlePlaceId}
                    </p>
                  )}
                </div>
                {sub.status === "PENDING" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => reviewMutation.mutate({ id: sub.id, status: "APPROVED" })}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-approve-${sub.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewMutation.mutate({ id: sub.id, status: "REJECTED" })}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-reject-${sub.id}`}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No pending submissions</h3>
          <p className="text-sm text-muted-foreground" data-testid="text-no-submissions">All submissions have been reviewed</p>
        </Card>
      )}
    </div>
  );
}

function SubmissionsWrapper({ cityId }: { cityId?: string }) {
  const { toast } = useToast();

  const { data: submissions, isLoading } = useQuery<AdminSubmission[]>({
    queryKey: ["/api/admin/submissions", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/submissions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load submissions");
      return res.json();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/submissions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      toast({ title: "Submission updated" });
    },
    onError: () => {
      toast({ title: "Failed to update submission", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return <SubmissionsPanel submissions={submissions} reviewMutation={reviewMutation} />;
}

export default function ModerationHub({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-4 p-4" data-testid="moderation-hub">
      <Tabs defaultValue="queue">
        <TabsList data-testid="tabs-moderation-hub">
          <TabsTrigger value="queue" data-testid="tab-moderation-queue">
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            Moderation Queue
          </TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-review-moderation">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Review Moderation
          </TabsTrigger>
          <TabsTrigger value="submissions" data-testid="tab-submissions">
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Submissions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="queue" data-testid="content-moderation-queue">
          <ModerationPanel cityId={cityId} />
        </TabsContent>
        <TabsContent value="reviews" data-testid="content-review-moderation">
          <ReviewModeration cityId={cityId} />
        </TabsContent>
        <TabsContent value="submissions" data-testid="content-submissions">
          <SubmissionsWrapper cityId={cityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
