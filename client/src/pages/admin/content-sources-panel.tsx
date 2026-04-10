import { useQuery } from "@tanstack/react-query";
import type { MetroSource } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock, PauseCircle, Rss, Globe, Database as DatabaseIcon, Calendar, BarChart3, Newspaper } from "lucide-react";

const SOURCE_TYPE_GROUPS: Record<string, { label: string; icon: typeof Rss; types: string[] }> = {
  news: { label: "News RSS Feeds", icon: Newspaper, types: ["RSS"] },
  events: { label: "Events", icon: Calendar, types: ["EVENTBRITE", "ICAL"] },
  government: { label: "Government & Open Data", icon: DatabaseIcon, types: ["SOCRATA", "ARCGIS", "CENSUS", "BLS", "DOT"] },
  jobs: { label: "Jobs & Workforce", icon: BarChart3, types: ["USAJOBS"] },
  other: { label: "Other Sources", icon: Globe, types: [] },
};

function getGroup(sourceType: string): string {
  for (const [key, group] of Object.entries(SOURCE_TYPE_GROUPS)) {
    if (group.types.includes(sourceType)) return key;
  }
  return "other";
}

function statusBadge(status: string | null) {
  switch (status) {
    case "OK":
      return <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400" data-testid="badge-status-ok"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
    case "ERROR":
      return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 dark:text-red-400" data-testid="badge-status-error"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
    case "DISABLED":
      return <Badge variant="outline" className="text-muted-foreground border-muted bg-muted/30" data-testid="badge-status-disabled"><PauseCircle className="h-3 w-3 mr-1" />Disabled</Badge>;
    case "NEVER_RUN":
    default:
      return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400" data-testid="badge-status-never"><Clock className="h-3 w-3 mr-1" />Never Run</Badge>;
  }
}

function timeAgo(date: string | Date | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function ContentSourcesPanel({ cityId }: { cityId?: string }) {
  const { data: sources, isLoading } = useQuery<MetroSource[]>({
    queryKey: ["/api/admin/content-sources", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/content-sources?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="loading-content-sources">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped: Record<string, MetroSource[]> = {};
  for (const s of sources || []) {
    const g = getGroup(s.sourceType);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(s);
  }

  const totalSources = sources?.length || 0;
  const activeSources = sources?.filter(s => s.status === "OK").length || 0;
  const errorSources = sources?.filter(s => s.status === "ERROR").length || 0;

  return (
    <div className="space-y-6" data-testid="content-sources-panel">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="heading-content-sources">Content Sources</h2>
        <p className="text-sm text-muted-foreground mt-1">All data aggregation connectors feeding into your metro hub</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="stat-total-sources">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalSources}</div>
              <div className="text-xs text-muted-foreground">Total Sources</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-sources">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeSources}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-error-sources">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{errorSources}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.entries(SOURCE_TYPE_GROUPS).map(([key, group]) => {
        const items = grouped[key];
        if (!items || items.length === 0) return null;
        const Icon = group.icon;
        return (
          <Card key={key} data-testid={`source-group-${key}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {group.label}
                <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.map((source) => (
                  <div key={source.id} className="px-4 py-3 flex items-center gap-3" data-testid={`source-row-${source.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" data-testid={`source-name-${source.id}`}>{source.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{source.sourceType}</span>
                        {source.baseUrl && (
                          <>
                            <span className="text-muted-foreground/50">|</span>
                            <span className="truncate max-w-[200px]">{source.baseUrl}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`source-last-pull-${source.id}`}>
                      {timeAgo(source.lastPulledAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{source.pullFrequency}</span>
                      {statusBadge(source.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {totalSources === 0 && (
        <Card data-testid="empty-sources">
          <CardContent className="p-8 text-center">
            <DatabaseIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No content sources configured yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
