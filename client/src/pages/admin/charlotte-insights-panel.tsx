import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, MessageCircle, AlertTriangle, TrendingUp, MapPin,
  RefreshCw, Loader2, BarChart3, ArrowUp,
} from "lucide-react";

interface Insight {
  id: string;
  insightType: string;
  content: Record<string, unknown>;
  timeWindow: string;
  cityId: string | null;
  rank: number;
  createdAt: string;
}

type TimeWindow = "24h" | "7d" | "30d";
type InsightTab = "trending_search" | "common_question" | "unanswered_query" | "demand_signal" | "hot_neighborhood";

const TABS: { value: InsightTab; label: string; icon: typeof Search }[] = [
  { value: "trending_search", label: "Trending Searches", icon: Search },
  { value: "common_question", label: "Common Questions", icon: MessageCircle },
  { value: "unanswered_query", label: "Unanswered Queries", icon: AlertTriangle },
  { value: "demand_signal", label: "Demand Signals", icon: TrendingUp },
  { value: "hot_neighborhood", label: "Hot Neighborhoods", icon: MapPin },
];

const TIME_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function CountBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{value}</span>
    </div>
  );
}

function TrendingSearches({ insights }: { insights: Insight[] }) {
  const maxCount = Math.max(...insights.map(i => (i.content.count as number) || 0), 1);
  if (insights.length === 0) return <EmptyState label="No trending searches found for this period." />;
  return (
    <div className="space-y-2" data-testid="section-trending-searches">
      {insights.map((ins) => {
        const c = ins.content;
        return (
          <div key={ins.id} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">{ins.rank}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid={`text-search-query-${ins.rank}`}>{c.query as string}</p>
              <CountBar value={c.count as number} max={maxCount} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommonQuestions({ insights }: { insights: Insight[] }) {
  const maxCount = Math.max(...insights.map(i => (i.content.count as number) || 0), 1);
  if (insights.length === 0) return <EmptyState label="No common questions found for this period." />;
  return (
    <div className="space-y-2" data-testid="section-common-questions">
      {insights.map((ins) => {
        const c = ins.content;
        return (
          <div key={ins.id} className="flex items-start gap-3">
            <MessageCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm" data-testid={`text-question-${ins.rank}`}>{c.question as string}</p>
              <CountBar value={c.count as number} max={maxCount} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UnansweredQueries({ insights }: { insights: Insight[] }) {
  const maxCount = Math.max(...insights.map(i => (i.content.count as number) || 0), 1);
  if (insights.length === 0) return <EmptyState label="No unanswered queries found. Great coverage!" />;
  return (
    <div className="space-y-2" data-testid="section-unanswered-queries">
      {insights.map((ins) => {
        const c = ins.content;
        return (
          <div key={ins.id} className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" data-testid={`text-unanswered-${ins.rank}`}>{c.query as string}</p>
              <div className="flex items-center gap-2">
                <CountBar value={c.count as number} max={maxCount} />
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 shrink-0">No listings</Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DemandSignals({ insights }: { insights: Insight[] }) {
  const maxCount = Math.max(...insights.map(i => (i.content.count as number) || 0), 1);
  if (insights.length === 0) return <EmptyState label="No demand signals detected for this period." />;
  return (
    <div className="space-y-2" data-testid="section-demand-signals">
      {insights.map((ins) => {
        const c = ins.content;
        return (
          <div key={ins.id} className="flex items-start gap-3">
            <ArrowUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" data-testid={`text-demand-${ins.rank}`}>{c.query as string}</p>
                {c.locationHint && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    <MapPin className="h-2.5 w-2.5 mr-0.5" />{c.locationHint as string}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <CountBar value={c.count as number} max={maxCount} />
                <Badge variant="outline" className={`text-[10px] shrink-0 ${c.hasListings ? "text-blue-600 border-blue-200" : "text-red-600 border-red-200"}`}>
                  {c.hasListings ? "Few listings" : "No listings"}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HotNeighborhoods({ insights }: { insights: Insight[] }) {
  const maxCount = Math.max(...insights.map(i => (i.content.searchCount as number) || 0), 1);
  if (insights.length === 0) return <EmptyState label="No neighborhood activity found for this period." />;
  return (
    <div className="space-y-2" data-testid="section-hot-neighborhoods">
      {insights.map((ins) => {
        const c = ins.content;
        return (
          <div key={ins.id} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">{ins.rank}.</span>
            <MapPin className="h-4 w-4 text-violet-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" data-testid={`text-neighborhood-${ins.rank}`}>{c.neighborhood as string}</p>
              <CountBar value={c.searchCount as number} max={maxCount} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-8 text-center">
      <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground" data-testid="text-empty-insights">{label}</p>
    </div>
  );
}

export default function CharlotteInsightsPanel({ cityId }: { cityId?: string }) {
  const [activeTab, setActiveTab] = useState<InsightTab>("trending_search");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");
  const { toast } = useToast();

  const insightsQuery = useQuery<Insight[]>({
    queryKey: ["/api/admin/charlotte/insights", activeTab, timeWindow, cityId],
    queryFn: async () => {
      const params = new URLSearchParams({ type: activeTab, timeWindow });
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/charlotte/insights?${params}`);
      if (!res.ok) throw new Error("Failed to load insights");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const statsQuery = useQuery<Record<string, number>>({
    queryKey: ["/api/admin/charlotte/insights/stats", timeWindow, cityId],
    queryFn: async () => {
      const params = new URLSearchParams({ timeWindow });
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/charlotte/insights/stats?${params}`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/charlotte/insights/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/insights/stats"] });
      toast({ title: "Insights refreshed" });
    },
    onError: () => {
      toast({ title: "Refresh failed", variant: "destructive" });
    },
  });

  const insights = insightsQuery.data || [];
  const stats = statsQuery.data || {};
  const totalInsights = Object.values(stats).reduce((sum, v) => sum + v, 0);

  const renderContent = () => {
    if (insightsQuery.isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      );
    }

    switch (activeTab) {
      case "trending_search": return <TrendingSearches insights={insights} />;
      case "common_question": return <CommonQuestions insights={insights} />;
      case "unanswered_query": return <UnansweredQueries insights={insights} />;
      case "demand_signal": return <DemandSignals insights={insights} />;
      case "hot_neighborhood": return <HotNeighborhoods insights={insights} />;
    }
  };

  return (
    <div className="space-y-4" data-testid="charlotte-insights-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h2 className="text-lg font-semibold" data-testid="text-insights-title">Public Intelligence</h2>
          {totalInsights > 0 && (
            <Badge variant="outline" className="text-xs">{totalInsights} signals</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-insights"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const count = stats[tab.value] || 0;
            return (
              <Button
                key={tab.value}
                variant={activeTab === tab.value ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setActiveTab(tab.value)}
                data-testid={`button-tab-${tab.value}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <Badge variant={activeTab === tab.value ? "secondary" : "outline"} className="text-[10px] ml-0.5 px-1">{count}</Badge>
                )}
              </Button>
            );
          })}
        </div>
        <div className="flex gap-1 shrink-0">
          {TIME_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={timeWindow === opt.value ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => setTimeWindow(opt.value)}
              data-testid={`button-time-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
