import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface ScoreReason { label: string; points: number }
interface SalesBucket { bucket: string; priorityScore: number }
interface EntityIntelData {
  engagement: { views30d: number; callClicks30d: number; websiteClicks30d: number; directionsClicks30d: number; leadsStarted30d: number; leadsSubmitted30d: number } | null;
  scores: { dataQualityScore: number; contactReadyScore: number; prospectFitScore: number; bucket: string; reasonsJson: ScoreReason[] | null } | null;
  salesBuckets: SalesBucket[];
  engagementTrend: { current: number; prior: number; trend: "up" | "down" | "flat" } | null;
}

interface EntityIntelligenceCardProps {
  entityId: string;
}

export function EntityIntelligenceCard({ entityId }: EntityIntelligenceCardProps) {
  const { data, isLoading } = useQuery<EntityIntelData>({
    queryKey: ["/api/admin/intelligence/dashboard/entity", entityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/dashboard/entity/${entityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!entityId,
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!data || (!data.engagement && !data.scores)) {
    return null;
  }

  const eng = data.engagement;
  const scores = data.scores;
  const trend = data.engagementTrend;
  const buckets = data.salesBuckets || [];

  const TrendIcon = trend?.trend === "up" ? TrendingUp : trend?.trend === "down" ? TrendingDown : Minus;
  const trendColor = trend?.trend === "up" ? "text-emerald-600" : trend?.trend === "down" ? "text-rose-600" : "text-muted-foreground";
  const trendLabel = trend?.trend === "up" ? "Up" : trend?.trend === "down" ? "Down" : "Flat";

  const scoreReasons = scores?.reasonsJson || [];

  const bucketColors: Record<string, string> = {
    TARGET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    VERIFY_LATER: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    CONTENT_SOURCE_ONLY: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    NEEDS_REVIEW: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };

  return (
    <Card data-testid="entity-intelligence-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" /> Intelligence Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {eng && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">30-Day Engagement</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
              <div data-testid="intel-views">
                <p className="text-lg font-bold">{eng.views30d || 0}</p>
                <p className="text-[10px] text-muted-foreground">Views</p>
              </div>
              <div data-testid="intel-calls">
                <p className="text-lg font-bold">{eng.callClicks30d || 0}</p>
                <p className="text-[10px] text-muted-foreground">Calls</p>
              </div>
              <div data-testid="intel-web-clicks">
                <p className="text-lg font-bold">{eng.websiteClicks30d || 0}</p>
                <p className="text-[10px] text-muted-foreground">Web Clicks</p>
              </div>
              <div data-testid="intel-directions">
                <p className="text-lg font-bold">{eng.directionsClicks30d || 0}</p>
                <p className="text-[10px] text-muted-foreground">Directions</p>
              </div>
              <div data-testid="intel-leads-started">
                <p className="text-lg font-bold">{eng.leadsStarted30d || 0}</p>
                <p className="text-[10px] text-muted-foreground">Leads Started</p>
              </div>
              <div data-testid="intel-leads-submitted">
                <p className="text-lg font-bold">{eng.leadsSubmitted30d || 0}</p>
                <p className="text-[10px] text-muted-foreground">Leads Submitted</p>
              </div>
            </div>
          </div>
        )}

        {trend && (
          <div className="flex items-center gap-2 py-1 border-t border-b" data-testid="intel-trend">
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
            <span className={`text-sm font-medium ${trendColor}`}>{trendLabel} vs prior 30 days</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Current: {trend.current} | Prior: {trend.prior}
            </span>
          </div>
        )}

        {scores && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Scores</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <ScoreBar label="Data Quality" score={scores.dataQualityScore} color="bg-blue-500" />
              <ScoreBar label="Contact Ready" score={scores.contactReadyScore} color="bg-emerald-500" />
              <ScoreBar label="Prospect Fit" score={scores.prospectFitScore} color="bg-violet-500" />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Bucket:</span>
              <Badge variant="outline" className={`text-[10px] ${bucketColors[scores.bucket] || ""}`} data-testid="intel-bucket">
                {scores.bucket?.replace(/_/g, " ")}
              </Badge>
            </div>

            {scoreReasons.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Score Breakdown ({scoreReasons.length} factors)
                </summary>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {scoreReasons.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2" data-testid={`reason-${i}`}>
                      <span className="truncate">{r.label}</span>
                      <span className={`font-mono shrink-0 ${r.points > 0 ? "text-emerald-600" : r.points < 0 ? "text-rose-600" : ""}`}>
                        {r.points > 0 ? "+" : ""}{r.points}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {buckets.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Sales Buckets</p>
            <div className="flex flex-wrap gap-1.5">
              {buckets.map((b, i) => (
                <Badge key={i} variant="outline" className="text-[10px]" data-testid={`sales-bucket-badge-${i}`}>
                  {b.bucket?.replace(/_/g, " ")} (Pri: {b.priorityScore})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
