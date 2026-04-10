import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDefaultCityId } from "@/hooks/use-city";
import {
  Mail, MousePointerClick, Phone, Globe, MapPin, Calendar,
  MessageSquare, Users, TrendingUp, ArrowUpRight, Loader2
} from "lucide-react";
import { useState } from "react";

interface LeadRow {
  id: string;
  cityId: string;
  businessId: string;
  zoneId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  budgetRange?: string;
  timeframe?: string;
  status: string;
  score: number;
  createdAt: string;
  updatedAt: string;
  businessName?: string;
}

interface LeadEventRow {
  id: string;
  businessId: string;
  eventType: string;
  occurredAt: string;
  pagePath?: string;
  businessName?: string;
}

interface LeadSubmissionRow {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  occurredAt: string;
  source: string;
  businessName?: string;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "default",
  ACCEPTED: "secondary",
  DECLINED: "outline",
  SPAM: "destructive",
  CLOSED: "outline",
};

function eventTypeLabel(type: string): string {
  switch (type) {
    case "CLICK_WEBSITE": return "Website Click";
    case "CLICK_DIRECTIONS": return "Directions Click";
    case "CLICK_CALL": return "Call Click";
    case "CLICK_BOOKING": return "Booking Click";
    case "FORM_SUBMIT": return "Form Submit";
    default: return type;
  }
}

function eventTypeIcon(type: string) {
  switch (type) {
    case "CLICK_WEBSITE": return <Globe className="h-3.5 w-3.5" />;
    case "CLICK_DIRECTIONS": return <MapPin className="h-3.5 w-3.5" />;
    case "CLICK_CALL": return <Phone className="h-3.5 w-3.5" />;
    case "CLICK_BOOKING": return <Calendar className="h-3.5 w-3.5" />;
    default: return <MousePointerClick className="h-3.5 w-3.5" />;
  }
}

export default function LeadsPanel({ cityId: propCityId }: { cityId?: string }) {
  const defaultCityId = useDefaultCityId();
  const cityId = propCityId || defaultCityId;
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: allLeads, isLoading: leadsLoading } = useQuery<LeadRow[]>({
    queryKey: ["/api/admin/leads", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/leads?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load leads");
      return res.json();
    },
    enabled: !!cityId,
  });

  const { data: leadEvents, isLoading: eventsLoading } = useQuery<LeadEventRow[]>({
    queryKey: ["/api/admin/leads/events", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/leads/events?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load lead events");
      return res.json();
    },
    enabled: !!cityId,
  });

  const { data: leadSubmissions, isLoading: subsLoading } = useQuery<LeadSubmissionRow[]>({
    queryKey: ["/api/admin/leads/submissions", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/leads/submissions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load lead submissions");
      return res.json();
    },
    enabled: !!cityId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/leads/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      toast({ title: "Lead status updated" });
    },
  });

  const filteredLeads = statusFilter === "all"
    ? allLeads
    : allLeads?.filter((l) => l.status === statusFilter);

  const totalLeads = allLeads?.length || 0;
  const newLeads = allLeads?.filter((l) => l.status === "NEW").length || 0;
  const acceptedLeads = allLeads?.filter((l) => l.status === "ACCEPTED").length || 0;
  const totalEvents = leadEvents?.length || 0;
  const totalSubs = leadSubmissions?.length || 0;
  const conversionRate = totalEvents > 0 ? ((totalSubs / totalEvents) * 100).toFixed(1) : "0";

  const eventsByType: Record<string, number> = {};
  leadEvents?.forEach((e) => {
    eventsByType[e.eventType] = (eventsByType[e.eventType] || 0) + 1;
  });

  if (!cityId) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground" data-testid="text-leads-no-city">No city selected</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-leads-title">Leads & Attribution</h2>
        <p className="text-sm text-muted-foreground">Track lead activity, form submissions, and click attribution</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs">Total Leads</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-leads-total">{leadsLoading ? <Skeleton className="h-7 w-12" /> : totalLeads}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="text-xs">New</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-leads-new">{leadsLoading ? <Skeleton className="h-7 w-12" /> : newLeads}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MousePointerClick className="h-4 w-4" />
            <span className="text-xs">Click Events</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-leads-events">{eventsLoading ? <Skeleton className="h-7 w-12" /> : totalEvents}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Conversion Rate</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-leads-conversion">{eventsLoading || subsLoading ? <Skeleton className="h-7 w-12" /> : `${conversionRate}%`}</p>
        </Card>
      </div>

      {Object.keys(eventsByType).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Attribution by Source</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(eventsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                {eventTypeIcon(type)}
                <span className="text-muted-foreground">{eventTypeLabel(type)}</span>
                <Badge variant="secondary" data-testid={`badge-event-type-${type}`}>{count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads" data-testid="tab-leads-list">Leads</TabsTrigger>
          <TabsTrigger value="submissions" data-testid="tab-leads-submissions">Submissions</TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-leads-events">Click Events</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-leads-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="DECLINED">Declined</SelectItem>
                <SelectItem value="SPAM">Spam</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{filteredLeads?.length || 0} leads</span>
          </div>

          {leadsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filteredLeads && filteredLeads.length > 0 ? (
            <div className="space-y-2">
              {filteredLeads.map((lead) => (
                <Card key={lead.id} className="p-4" data-testid={`card-lead-${lead.id}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" data-testid={`text-lead-name-${lead.id}`}>{lead.name}</span>
                        <Badge variant={STATUS_COLORS[lead.status] || "secondary"} data-testid={`badge-lead-status-${lead.id}`}>
                          {lead.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{lead.email}</span>
                        {lead.phone && <span>{lead.phone}</span>}
                      </div>
                      {lead.businessName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ArrowUpRight className="h-3 w-3" />
                          <span data-testid={`text-lead-business-${lead.id}`}>{lead.businessName}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1" data-testid={`text-lead-message-${lead.id}`}>{lead.message}</p>
                      {(lead.budgetRange || lead.timeframe) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                          {lead.budgetRange && <span>Budget: {lead.budgetRange}</span>}
                          {lead.timeframe && <span>Timeframe: {lead.timeframe}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground" data-testid={`text-lead-date-${lead.id}`}>
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                      <Select
                        value={lead.status}
                        onValueChange={(val) => updateStatusMutation.mutate({ id: lead.id, status: val })}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs" data-testid={`select-lead-status-${lead.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="ACCEPTED">Accepted</SelectItem>
                          <SelectItem value="DECLINED">Declined</SelectItem>
                          <SelectItem value="SPAM">Spam</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Mail className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground" data-testid="text-leads-empty">No leads yet</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="space-y-2">
          {subsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : leadSubmissions && leadSubmissions.length > 0 ? (
            leadSubmissions.map((sub) => (
              <Card key={sub.id} className="p-4" data-testid={`card-submission-${sub.id}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm" data-testid={`text-sub-name-${sub.id}`}>{sub.name}</span>
                      <span className="text-xs text-muted-foreground">{sub.email}</span>
                    </div>
                    {sub.businessName && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowUpRight className="h-3 w-3" />
                        <span>{sub.businessName}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">{sub.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(sub.occurredAt).toLocaleDateString()}
                    </span>
                    <Badge variant="secondary">{sub.source}</Badge>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground" data-testid="text-submissions-empty">No form submissions yet</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-2">
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : leadEvents && leadEvents.length > 0 ? (
            leadEvents.map((ev) => (
              <Card key={ev.id} className="p-3" data-testid={`card-event-${ev.id}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    {eventTypeIcon(ev.eventType)}
                    <span className="text-sm font-medium">{eventTypeLabel(ev.eventType)}</span>
                    {ev.businessName && (
                      <span className="text-xs text-muted-foreground truncate">{ev.businessName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ev.pagePath && (
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{ev.pagePath}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.occurredAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <MousePointerClick className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground" data-testid="text-events-empty">No click events recorded yet</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}