import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageSquare } from "lucide-react";
import type { TierApplicationRequest, InquiryRequest } from "@shared/schema";

export default function TierInquiryPanel({ cityId }: { cityId?: string }) {
  const { data: tierApps, isLoading: loadingTier } = useQuery<TierApplicationRequest[]>({
    queryKey: ["/api/admin/tier-applications"],
  });

  const { data: inquiries, isLoading: loadingInquiries } = useQuery<InquiryRequest[]>({
    queryKey: ["/api/admin/inquiry-requests"],
  });

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold" data-testid="text-tier-inquiry-title">Tiers & Inquiries</h2>
      <Tabs defaultValue="tiers">
        <TabsList>
          <TabsTrigger value="tiers" data-testid="tab-tiers">
            <Users className="w-4 h-4 mr-1" />
            Tier Applications
            {tierApps && tierApps.length > 0 && (
              <Badge variant="secondary" className="ml-1">{tierApps.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inquiries" data-testid="tab-inquiries">
            <MessageSquare className="w-4 h-4 mr-1" />
            Inquiries
            {inquiries && inquiries.length > 0 && (
              <Badge variant="secondary" className="ml-1">{inquiries.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-2 mt-3">
          {loadingTier ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : !tierApps || tierApps.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-tier-apps">No tier applications yet.</p>
          ) : (
            tierApps.map((app) => (
              <Card key={app.id} className="p-3" data-testid={`card-tier-app-${app.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium" data-testid={`text-tier-user-${app.id}`}>User: {app.userId}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested: <span className="font-medium">{app.requestedTier}</span>
                    </p>
                    {app.reason && (
                      <p className="text-xs text-muted-foreground">{app.reason}</p>
                    )}
                  </div>
                  <Badge
                    variant={app.status === "approved" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}
                    data-testid={`badge-tier-status-${app.id}`}
                  >
                    {app.status}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="inquiries" className="space-y-2 mt-3">
          {loadingInquiries ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : !inquiries || inquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-inquiries">No inquiry requests yet.</p>
          ) : (
            inquiries.map((inq) => (
              <Card key={inq.id} className="p-3" data-testid={`card-inquiry-${inq.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium" data-testid={`text-inquiry-subject-${inq.id}`}>
                      {inq.subject || "(No subject)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      To: {inq.toEntityType} ({inq.toEntityId})
                    </p>
                    {inq.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{inq.message}</p>
                    )}
                  </div>
                  <Badge
                    variant={inq.status === "responded" ? "default" : inq.status === "closed" ? "destructive" : "secondary"}
                    data-testid={`badge-inquiry-status-${inq.id}`}
                  >
                    {inq.status}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
