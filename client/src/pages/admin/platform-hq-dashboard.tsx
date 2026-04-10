import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Building2, TrendingUp, Users, MapPin, Globe, Target,
  ArrowUpRight, DollarSign, BarChart3, Landmark, ChevronRight,
} from "lucide-react";

interface PlatformStats {
  totalMetros: number;
  activeMetros: number;
  totalBusinesses: number;
  totalOperators: number;
  territoriesSold: number;
  territoriesAvailable: number;
  totalMrr: number;
  revenueByMetro: { cityName: string; cityCode: string; mrr: number; businessCount: number; isActive: boolean }[];
  pipeline: { stage: string; count: number }[];
  pendingDeals: { id: string; name: string; territory: string; stage: string; value: number }[];
}

interface PlatformHqDashboardProps {
  onNavigate: (section: string) => void;
  cityId?: string;
}

export default function PlatformHqDashboard({ onNavigate, cityId }: PlatformHqDashboardProps) {
  const { data: stats, isLoading, isError, refetch } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/platform/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/platform/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load platform stats");
      return res.json();
    },
  });

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-platform-hq-heading">Platform HQ</h2>
          <p className="text-sm text-muted-foreground">CityMetroHub Overview</p>
        </div>
        <Card className="p-8 text-center" data-testid="platform-hq-error">
          <p className="text-sm text-destructive mb-3">Unable to load platform data</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-platform-stats">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-platform-hq-heading">Platform HQ</h2>
          <p className="text-sm text-muted-foreground">CityMetroHub Overview</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const pipelineStages = stats?.pipeline || [];
  const totalPipeline = pipelineStages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-platform-hq-heading">Platform HQ</h2>
        <p className="text-sm text-muted-foreground">CityMetroHub company-wide overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4" data-testid="stat-active-metros">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Globe className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats?.activeMetros || 0}</p>
          <p className="text-xs text-muted-foreground">Active Metros</p>
          {(stats?.totalMetros || 0) > (stats?.activeMetros || 0) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{stats?.totalMetros} total</p>
          )}
        </Card>

        <Card className="p-4" data-testid="stat-total-mrr">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">${((stats?.totalMrr || 0) / 100).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total MRR</p>
        </Card>

        <Card className="p-4" data-testid="stat-total-businesses">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats?.totalBusinesses || 0}</p>
          <p className="text-xs text-muted-foreground">Total Businesses</p>
        </Card>

        <Card className="p-4" data-testid="stat-total-operators">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats?.totalOperators || 0}</p>
          <p className="text-xs text-muted-foreground">Operators</p>
        </Card>

        <Card className="p-4" data-testid="stat-territories-sold">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats?.territoriesSold || 0}</p>
          <p className="text-xs text-muted-foreground">Territories Sold</p>
        </Card>

        <Card className="p-4" data-testid="stat-territories-available">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Target className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats?.territoriesAvailable || 0}</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </Card>

        <Card className="p-4" data-testid="stat-pipeline-total">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{totalPipeline}</p>
          <p className="text-xs text-muted-foreground">In Pipeline</p>
        </Card>

        <Card className="p-4 cursor-pointer" onClick={() => onNavigate("revenue")} data-testid="stat-revenue-link">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <p className="text-sm font-semibold">Revenue Details</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            View full breakdown <ArrowUpRight className="h-3 w-3" />
          </p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5" data-testid="section-metro-pipeline">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Metro Pipeline</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => onNavigate("license-crm")} data-testid="button-view-pipeline">
              View CRM <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {pipelineStages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pipeline data yet</p>
          ) : (
            <div className="space-y-3">
              {pipelineStages.map((stage, idx) => {
                const maxCount = Math.max(...pipelineStages.map(s => s.count), 1);
                const pct = (stage.count / maxCount) * 100;
                const stageColors = ["bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-emerald-500"];
                return (
                  <div key={stage.stage} data-testid={`pipeline-stage-${stage.stage.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground capitalize">{stage.stage.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="font-medium">{stage.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${stageColors[idx % stageColors.length]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5" data-testid="section-metros-health">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Metros</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => onNavigate("hub-management")} data-testid="button-view-hubs">
              Manage <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {!stats?.revenueByMetro || stats.revenueByMetro.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No metro data</p>
          ) : (
            <div className="space-y-2">
              {stats.revenueByMetro.map((metro) => (
                <div key={metro.cityCode} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`metro-row-${metro.cityCode.toLowerCase()}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold">
                      {metro.cityCode}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{metro.cityName}</p>
                      <p className="text-xs text-muted-foreground">{metro.businessCount} businesses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${(metro.mrr / 100).toLocaleString()}/mo</p>
                    {!metro.isActive && <Badge variant="outline" className="text-[9px]">Inactive</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {stats?.pendingDeals && stats.pendingDeals.length > 0 && (
        <Card className="p-5" data-testid="section-pending-deals">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Pending License Deals</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => onNavigate("territory-sales")} data-testid="button-view-deals">
              All Deals <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            {stats.pendingDeals.slice(0, 5).map((deal) => (
              <div key={deal.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`deal-row-${deal.id}`}>
                <div>
                  <p className="text-sm font-medium">{deal.name}</p>
                  <p className="text-xs text-muted-foreground">{deal.territory}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] capitalize">{deal.stage.replace(/_/g, " ").toLowerCase()}</Badge>
                  {deal.value > 0 && <p className="text-xs font-medium mt-1">${(deal.value / 100).toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
