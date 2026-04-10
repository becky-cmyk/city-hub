import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Clock, Cake, Heart, Users, Sparkles, SkipForward, AlarmClock } from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  follow_up: { icon: Clock, color: "text-blue-500", label: "Follow Up" },
  birthday: { icon: Cake, color: "text-pink-500", label: "Birthday" },
  anniversary: { icon: Heart, color: "text-red-500", label: "Anniversary" },
  referral_stale: { icon: Users, color: "text-amber-600", label: "Referral Stale" },
  engagement: { icon: Sparkles, color: "text-purple-500", label: "Engagement" },
};

export default function NudgesPanel({ cityId }: { cityId?: string }) {
  const { data, isLoading } = useQuery<{ data: any[]; total: number; budget: number }>({
    queryKey: ["/api/nudges/today", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/nudges/today?${p}`, { credentials: "include" });
      if (!res.ok) return { data: [], total: 0, budget: 0 };
      return res.json();
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (contactId: string) => apiRequest("POST", `/api/nudges/${contactId}/skip`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/nudges/today"] }),
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ contactId, days }: { contactId: string; days: number }) =>
      apiRequest("POST", `/api/nudges/${contactId}/snooze`, { days }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/nudges/today"] }),
  });

  const dismissReferralMutation = useMutation({
    mutationFn: async (triangleId: string) => apiRequest("POST", `/api/nudges/referral/${triangleId}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/nudges/today"] }),
  });

  const dismissEngagementMutation = useMutation({
    mutationFn: async (eventId: string) => apiRequest("POST", `/api/nudges/engagement/${eventId}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/nudges/today"] }),
  });

  const nudges = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" data-testid="text-nudges-title">Today's Nudges</h2>
        {data && (
          <Badge variant="outline" className="text-xs">
            {nudges.length} of {data.total} · Budget: {data.budget}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Computing nudges...</div>
      ) : nudges.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No nudges today. You're all caught up!</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {nudges.map((nudge: any, i: number) => {
            const config = TYPE_CONFIG[nudge.type] || TYPE_CONFIG.follow_up;
            const Icon = config.icon;
            return (
              <Card key={i} data-testid={`card-nudge-${i}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{nudge.contactName}</span>
                      <Badge variant="outline" className="text-[9px]">{config.label}</Badge>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{nudge.score}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{nudge.reason}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {nudge.contactId && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Skip today" onClick={() => skipMutation.mutate(nudge.contactId)} data-testid={`button-skip-${i}`}>
                          <SkipForward className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Snooze 7 days" onClick={() => snoozeMutation.mutate({ contactId: nudge.contactId, days: 7 })} data-testid={`button-snooze-${i}`}>
                          <AlarmClock className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {nudge.referralTriangleId && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Dismiss" onClick={() => dismissReferralMutation.mutate(nudge.referralTriangleId)} data-testid={`button-dismiss-ref-${i}`}>
                        <SkipForward className="h-3 w-3" />
                      </Button>
                    )}
                    {nudge.engagementEventId && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Dismiss" onClick={() => dismissEngagementMutation.mutate(nudge.engagementEventId)} data-testid={`button-dismiss-eng-${i}`}>
                        <SkipForward className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
