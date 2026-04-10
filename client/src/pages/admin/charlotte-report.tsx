import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Send, TrendingUp, Building2, Users, AlertTriangle, MapPin,
  Mail, Zap, Target, Clock, BarChart3, FileText, Rss, Inbox,
  ArrowRight, CheckCircle, Activity, Loader2, Heart, Vote, Star,
} from "lucide-react";

interface DailyReport {
  generatedAt: string;
  salesPulse: {
    outreachSent: number;
    claimedThisWeek: number;
    conversionRate: number;
    pendingDrafts: number;
  };
  hubSignals: {
    topZones: Array<{
      name: string;
      slug: string;
      totalBusinesses: number;
      claimed: number;
      newThisWeek: number;
    }>;
  };
  newOpportunityActivity: {
    newBusinesses: number;
    newCaptures: number;
    newRssItems: number;
    newSubmissions: number;
    seededReady: number;
  };
  topLeads: Array<{
    entityId: string;
    name: string;
    zone: string;
    prospectFitScore: number;
    contactReadyScore: number;
    bucket: string;
    contactEmail: string | null;
    contactPhone: string | null;
  }>;
  exceptions: {
    count: number;
    items: Array<{
      id: string;
      type: string;
      title: string;
      summary: string;
      priority: string;
      createdAt: string;
    }>;
  };
  suggestedActions: Array<{
    signalType: string;
    action: string;
    score: number;
  }>;
  emailPipeline: {
    readyToReach: number;
    target: number;
    pendingCrawls: number;
    recentEmailsFound: number;
    lastCrawlAt: string | null;
    deficit: number;
  } | null;
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  med: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-muted text-muted-foreground",
};

const SIGNAL_ICONS: Record<string, any> = {
  UNCLAIMED_HIGH_DEMAND: Target,
  UPGRADE_READY: TrendingUp,
  DORMANT_CLAIMED: AlertTriangle,
  TRENDING_TOPIC: Zap,
  CONTRIBUTOR_CANDIDATE: Users,
};

const SIGNAL_NAV_MAP: Record<string, string> = {
  UNCLAIMED_HIGH_DEMAND: "opportunity-radar",
  UPGRADE_READY: "businesses",
  DORMANT_CLAIMED: "businesses",
  TRENDING_TOPIC: "cms",
  CONTRIBUTOR_CANDIDATE: "businesses",
};

interface EngagementSummary {
  neighborhoodReviews: number;
  polls: number;
  pollVotes: number;
  votingCampaigns: number;
  votingBallots: number;
  quizzes: number;
  quizAttempts: number;
  surveys: number;
  surveyResponses: number;
  contentReactions: number;
}

export default function CharlotteReport({ onNavigate, cityId }: { onNavigate?: (section: string) => void; cityId?: string }) {
  const { toast } = useToast();
  const { data: report, isLoading } = useQuery<DailyReport>({
    queryKey: ["/api/admin/charlotte/daily-report"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: engagement } = useQuery<EngagementSummary>({
    queryKey: ["/api/admin/community/engagement-summary"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/community/engagement-summary");
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const boostMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/email-lead-pipeline/boost");
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/daily-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-lead-pipeline"] });
      toast({ title: "Pipeline Boosted", description: data?.message || "Boost completed" });
    },
    onError: (err: any) => {
      toast({ title: "Boost failed", description: err.message || "Could not boost pipeline", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-1" data-testid="charlotte-report-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-4 text-center text-muted-foreground" data-testid="charlotte-report-empty">
        No report data available. Run a Charlotte scan first.
      </div>
    );
  }

  const { salesPulse, hubSignals, newOpportunityActivity, topLeads, exceptions, suggestedActions, emailPipeline } = report;

  return (
    <div className="space-y-6 p-1" data-testid="charlotte-report">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-report-title">Charlotte Daily Report</h2>
        <p className="text-sm text-muted-foreground">
          Generated {new Date(report.generatedAt).toLocaleString()}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" /> Sales Pulse (7-day)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className="cursor-pointer"
            onClick={() => onNavigate?.("communications-hub")}
            data-testid="nav-outreach-sent"
          >
            <Card data-testid="card-outreach-sent">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Outreach Sent</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-outreach-sent">{salesPulse.outreachSent}</p>
              </CardContent>
            </Card>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => onNavigate?.("businesses")}
            data-testid="nav-claimed-week"
          >
            <Card data-testid="card-claimed-week">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Listings Claimed</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-claimed-week">{salesPulse.claimedThisWeek}</p>
              </CardContent>
            </Card>
          </div>
          <Card data-testid="card-conversion-rate">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Conversion Rate</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-conversion-rate">{salesPulse.conversionRate}%</p>
            </CardContent>
          </Card>
          <div
            className="cursor-pointer"
            onClick={() => onNavigate?.("communications-hub")}
            data-testid="nav-pending-drafts"
          >
            <Card data-testid="card-pending-drafts">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Pending Drafts</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-pending-drafts">{salesPulse.pendingDrafts}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {emailPipeline && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Activity className="h-4 w-4" /> Email Lead Pipeline
          </h3>
          <div
            className="cursor-pointer"
            onClick={() => onNavigate?.("opportunity-radar")}
            data-testid="nav-email-pipeline"
          >
            <Card data-testid="card-email-pipeline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Daily Target Progress</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        emailPipeline.readyToReach >= emailPipeline.target
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : emailPipeline.readyToReach >= 5
                            ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                            : "bg-red-500/10 text-red-600 border-red-500/20"
                      }`}
                      data-testid="badge-pipeline-status"
                    >
                      {emailPipeline.readyToReach >= emailPipeline.target ? "On Target" : "Under Target"}
                    </Badge>
                  </div>
                  <span className="text-lg font-bold" data-testid="text-pipeline-progress">
                    {emailPipeline.readyToReach}/{emailPipeline.target}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      emailPipeline.readyToReach >= emailPipeline.target
                        ? "bg-green-500"
                        : emailPipeline.readyToReach >= 5
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, (emailPipeline.readyToReach / emailPipeline.target) * 100)}%` }}
                    data-testid="bar-pipeline-progress"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Email Leads Ready</p>
                    <p className="text-sm font-semibold" data-testid="text-email-leads-ready">{emailPipeline.readyToReach}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pending Crawls</p>
                    <p className="text-sm font-semibold" data-testid="text-pending-crawls">{emailPipeline.pendingCrawls}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Emails Found (24h)</p>
                    <p className="text-sm font-semibold" data-testid="text-recent-emails">{emailPipeline.recentEmailsFound}</p>
                  </div>
                </div>
                {emailPipeline.deficit > 0 && (
                  <div className="mt-3 border-t pt-2 flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      Need {emailPipeline.deficit} more email leads. Run more Google Places imports to build the email pipeline.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        boostMutation.mutate();
                      }}
                      disabled={boostMutation.isPending}
                      data-testid="button-boost-pipeline"
                    >
                      {boostMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3 mr-1" />
                      )}
                      Boost Pipeline
                    </Button>
                  </div>
                )}
                {emailPipeline.lastCrawlAt && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Last crawl: {new Date(emailPipeline.lastCrawlAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> Hub Signals — Top Neighborhoods
          </h3>
          <Card data-testid="card-hub-signals">
            <CardContent className="p-0">
              {hubSignals.topZones.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No zone data yet.</p>
              ) : (
                <div className="divide-y">
                  {hubSignals.topZones.map((zone) => (
                    <div
                      key={zone.slug}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer rounded-md"
                      onClick={() => onNavigate?.("businesses")}
                      data-testid={`zone-row-${zone.slug}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{zone.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {zone.totalBusinesses} total, {zone.claimed} claimed
                        </p>
                      </div>
                      {zone.newThisWeek > 0 && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          +{zone.newThisWeek} new
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> New Opportunity Activity (24h)
          </h3>
          <Card data-testid="card-opportunity-activity">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> New Businesses
                </span>
                <span className="text-sm font-semibold" data-testid="text-new-businesses">{newOpportunityActivity.newBusinesses}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> New Captures
                </span>
                <span className="text-sm font-semibold" data-testid="text-new-captures">{newOpportunityActivity.newCaptures}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Rss className="h-3.5 w-3.5" /> New RSS Items
                </span>
                <span className="text-sm font-semibold" data-testid="text-new-rss">{newOpportunityActivity.newRssItems}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> New Submissions
                </span>
                <span className="text-sm font-semibold" data-testid="text-new-submissions">{newOpportunityActivity.newSubmissions}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Seeded Ready for Activation
                </span>
                <span className="text-sm font-bold" data-testid="text-seeded-ready">{newOpportunityActivity.seededReady}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {engagement && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Heart className="h-4 w-4" /> Community Engagement
          </h3>
          <div
            className="cursor-pointer"
            onClick={() => onNavigate?.("engagement-hub")}
            data-testid="nav-engagement-section"
          >
            <Card data-testid="card-engagement-summary">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Polls</p>
                    <p className="text-sm font-semibold" data-testid="text-eng-polls">{engagement.polls}</p>
                    <p className="text-[10px] text-muted-foreground">{engagement.pollVotes} votes</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Surveys</p>
                    <p className="text-sm font-semibold" data-testid="text-eng-surveys">{engagement.surveys}</p>
                    <p className="text-[10px] text-muted-foreground">{engagement.surveyResponses} responses</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quizzes</p>
                    <p className="text-sm font-semibold" data-testid="text-eng-quizzes">{engagement.quizzes}</p>
                    <p className="text-[10px] text-muted-foreground">{engagement.quizAttempts} attempts</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Voting</p>
                    <p className="text-sm font-semibold" data-testid="text-eng-voting">{engagement.votingCampaigns}</p>
                    <p className="text-[10px] text-muted-foreground">{engagement.votingBallots} ballots</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                    <p className="text-sm font-semibold" data-testid="text-eng-reviews">{engagement.neighborhoodReviews}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reactions</p>
                    <p className="text-sm font-semibold" data-testid="text-eng-reactions">{engagement.contentReactions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Target className="h-4 w-4" /> Top Contactable Leads
        </h3>
        <Card data-testid="card-top-leads">
          <CardContent className="p-0">
            {topLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No scored leads with contact info yet.</p>
            ) : (
              <div className="divide-y">
                {topLeads.map((lead, i) => (
                  <div
                    key={lead.entityId}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer rounded-md"
                    onClick={() => onNavigate?.("opportunity-radar")}
                    data-testid={`lead-row-${lead.entityId}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {lead.zone}{lead.contactEmail ? ` · ${lead.contactEmail}` : ""}{lead.contactPhone ? ` · ${lead.contactPhone}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        Fit: {lead.prospectFitScore}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Ready: {lead.contactReadyScore}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Inbox className="h-4 w-4" /> Exceptions / Needs Human Review
          {exceptions.count > 0 && (
            <Badge variant="destructive" className="text-[10px]" data-testid="badge-exception-count">
              {exceptions.count}
            </Badge>
          )}
        </h3>
        <Card data-testid="card-exceptions">
          <CardContent className="p-0">
            {exceptions.items.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No exceptions requiring attention.</p>
            ) : (
              <div className="divide-y">
                {exceptions.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer rounded-md"
                    onClick={() => onNavigate?.("inbox")}
                    data-testid={`exception-row-${item.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[item.priority] || ""}`}>
                          {item.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{item.title}</p>
                      {item.summary && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.summary}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <ArrowRight className="h-4 w-4" /> Suggested Actions for Today
        </h3>
        <Card data-testid="card-suggested-actions">
          <CardContent className="p-0">
            {suggestedActions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">
                No suggested actions. Run a Charlotte scan to discover opportunities.
              </p>
            ) : (
              <div className="divide-y">
                {suggestedActions.map((action, i) => {
                  const Icon = SIGNAL_ICONS[action.signalType] || Zap;
                  const navTarget = SIGNAL_NAV_MAP[action.signalType] || "opportunity-radar";
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer rounded-md"
                      onClick={() => onNavigate?.(navTarget)}
                      data-testid={`action-row-${i}`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm flex-1">{action.action}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Score: {action.score}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
