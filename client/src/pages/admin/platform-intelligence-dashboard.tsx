import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, TrendingUp, Users, Newspaper, Radio, Download,
  Globe, Target, FileText, Activity, Building2, Monitor, UserPlus, UserCheck,
} from "lucide-react";

interface ReadershipData {
  totalProfileViews: number;
  uniqueVisitors: number;
  totalEvents: number;
  pageViewsByType: Array<{ page_type: string; total: number }>;
  viewsOverTime: Array<{ date: string; views: number }>;
}

interface EngagementData {
  funnel: { profile_views: number; clicks: number; lead_starts: number; lead_submits: number; saves: number };
  topByEngagement: Array<{ name: string; views: number; clicks: number; saves: number; leads: number; total_events: number }>;
  topSaved: Array<{ entity_id: string; name: string; total: number }>;
  totalLikes: number;
  totalFollows: number;
}

interface AudienceData {
  languageBreakdown: Array<{ language: string; total: number }>;
  zipOrigins: Array<{ zip_origin: string; total: number }>;
  referrerSources: Array<{ referrer: string; total: number }>;
  hourOfDay: Array<{ hour: number; total: number }>;
  dayOfWeek: Array<{ dow: number; total: number }>;
  deviceBreakdown: Array<{ device: string; total: number }>;
  returningVsNew: { returning_visitors: number; new_visitors: number };
}

interface ContentData {
  topRssArticles: Array<{ title: string; source_name: string; view_count: number; url: string; city_id: string }>;
  topPosts: Array<{ id: string; title: string; primary_tag: string; status: string; created_at: string; like_count: number }>;
  topFeedItems: Array<{ entity_id: string; views: number; taps: number; saves: number; shares: number }>;
}

interface SignalSummaryEntry { new: number; reviewed: number; dismissed: number; total: number }
interface SignalsData {
  signalSummary: Record<string, SignalSummaryEntry>;
  recentSignals: Array<{ id: string; signal_type: string; entity_type: string; entity_id: string; title: string; summary: string; score: number; status: string; created_at: string }>;
}

interface PipelineData {
  entityBuckets: Array<{ bucket: string; total: number; avg_dq: number; avg_cr: number; avg_pf: number }>;
  salesBuckets: Array<{ bucket: string; total: number; avg_priority: number }>;
  claimedVsUnclaimed: { claimed: number; unclaimed: number; total: number };
  scoredToClaimedConversion: { total_scored: number; scored_and_claimed: number };
}

interface MetroMetric {
  cityId: string; cityName: string; totalViews: number; totalClicks: number;
  totalLeads: number; entitiesTracked: number; totalBusinesses: number;
  claimedBusinesses: number; claimedPct: number; contentVolume30d: number; activeSignals: number;
}
interface MetroComparisonData { metros: MetroMetric[] }

interface CityOption { id: string; name: string }

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdfReport(cityId: string, days: number) {
  const params = new URLSearchParams();
  if (cityId !== "all") params.set("cityId", cityId);
  params.set("days", String(days));
  const url = `/api/admin/intelligence/dashboard/report/pdf?${params}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `intelligence-report-${new Date().toISOString().split("T")[0]}.pdf`;
  a.click();
}

const TABS = [
  { id: "readership", label: "Readership", icon: Eye },
  { id: "engagement", label: "Engagement", icon: TrendingUp },
  { id: "audience", label: "Audience", icon: Users },
  { id: "content", label: "Content", icon: Newspaper },
  { id: "signals", label: "Signals", icon: Radio },
  { id: "pipeline", label: "Pipeline", icon: Target },
  { id: "metros", label: "Metro Compare", icon: Globe },
] as const;

type TabId = typeof TABS[number]["id"];

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface PlatformIntelligenceDashboardProps {
  selectedCityId?: string;
  scope?: "platform" | "metro";
}

export default function PlatformIntelligenceDashboard({ selectedCityId, scope = "platform" }: PlatformIntelligenceDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("readership");
  const [cityId, setCityId] = useState<string>(selectedCityId || "all");
  const [days, setDays] = useState<number>(30);

  const effectiveCityId = scope === "metro" && selectedCityId ? selectedCityId : cityId;

  const { data: cities } = useQuery<CityOption[]>({ queryKey: ["/api/cities"] });

  const params = new URLSearchParams();
  if (effectiveCityId !== "all") params.set("cityId", effectiveCityId);
  params.set("days", String(days));

  const fetchTab = (endpoint: string) => async () => {
    const res = await fetch(`/api/admin/intelligence/dashboard/${endpoint}?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed");
    return res.json();
  };

  const { data: readership, isLoading: loadingR, isError: errorR } = useQuery({
    queryKey: ["/api/admin/intelligence/dashboard/readership", effectiveCityId, days],
    queryFn: fetchTab("readership"),
    enabled: activeTab === "readership",
  });

  const { data: engagement, isLoading: loadingE, isError: errorE } = useQuery({
    queryKey: ["/api/admin/intelligence/dashboard/engagement", effectiveCityId, days],
    queryFn: fetchTab("engagement"),
    enabled: activeTab === "engagement",
  });

  const { data: audience, isLoading: loadingA, isError: errorA } = useQuery({
    queryKey: ["/api/admin/intelligence/dashboard/audience", effectiveCityId, days],
    queryFn: fetchTab("audience"),
    enabled: activeTab === "audience",
  });

  const { data: content, isLoading: loadingC, isError: errorC } = useQuery({
    queryKey: ["/api/admin/intelligence/dashboard/content", effectiveCityId, days],
    queryFn: fetchTab("content"),
    enabled: activeTab === "content",
  });

  const { data: signals, isLoading: loadingS, isError: errorS } = useQuery({
    queryKey: ["/api/admin/intelligence/dashboard/signals", effectiveCityId, days],
    queryFn: fetchTab("signals"),
    enabled: activeTab === "signals",
  });

  const { data: pipeline, isLoading: loadingP, isError: errorP } = useQuery({
    queryKey: ["/api/admin/intelligence/dashboard/pipeline", effectiveCityId, days],
    queryFn: fetchTab("pipeline"),
    enabled: activeTab === "pipeline",
  });

  const { data: metros, isLoading: loadingM, isError: errorM } = useQuery({
    queryKey: ["/api/admin/intelligence/dashboard/metro-comparison"],
    queryFn: fetchTab("metro-comparison"),
    enabled: activeTab === "metros",
  });

  const isLoading = {
    readership: loadingR, engagement: loadingE, audience: loadingA,
    content: loadingC, signals: loadingS, pipeline: loadingP, metros: loadingM,
  }[activeTab];

  const isError = {
    readership: errorR, engagement: errorE, audience: errorA,
    content: errorC, signals: errorS, pipeline: errorP, metros: errorM,
  }[activeTab];

  const dayOptions = [7, 30, 90];

  const handleGenerateReport = () => {
    downloadPdfReport(effectiveCityId, days);
  };

  const visibleTabs = scope === "metro" ? TABS.filter(t => t.id !== "metros") : TABS;

  return (
    <div className="space-y-6" data-testid="platform-intelligence-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-intel-dashboard-title">
            {scope === "platform" ? "Platform Intelligence" : "Metro Intelligence Dashboard"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {scope === "platform" ? "Cross-metro intelligence & reporting" : "City-level intelligence & reporting"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {scope === "platform" && (
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger className="w-[180px]" data-testid="select-intel-city">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1">
            {dayOptions.map((d) => (
              <Button key={d} variant={days === d ? "default" : "outline"} size="sm" onClick={() => setDays(d)} data-testid={`btn-intel-days-${d}`}>
                {d}d
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleGenerateReport} data-testid="btn-generate-full-report">
            <FileText className="w-4 h-4 mr-1" /> Full Report
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className="shrink-0"
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-4 h-4 mr-1" /> {tab.label}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center" data-testid="error-state">
          <p className="text-sm text-muted-foreground mb-3">Failed to load data for this section.</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} data-testid="btn-retry">
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {activeTab === "readership" && readership && <ReadershipTab data={readership} />}
          {activeTab === "engagement" && engagement && <EngagementTab data={engagement} />}
          {activeTab === "audience" && audience && <AudienceTab data={audience} />}
          {activeTab === "content" && content && <ContentTab data={content} />}
          {activeTab === "signals" && signals && <SignalsTab data={signals} />}
          {activeTab === "pipeline" && pipeline && <PipelineTab data={pipeline} />}
          {activeTab === "metros" && metros && <MetroComparisonTab data={metros} />}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, subtitle }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; subtitle?: string }) {
  return (
    <Card data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function ReadershipTab({ data }: { data: ReadershipData }) {
  return (
    <div className="space-y-6" data-testid="section-readership">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Profile Views" value={data.totalProfileViews} icon={Eye} />
        <StatCard label="Unique Visitors" value={data.uniqueVisitors} icon={Users} />
        <StatCard label="Total Events" value={data.totalEvents} icon={Activity} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-page-views-type">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Page Views by Type</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("page-views-by-type.csv", ["Type", "Count"],
                (data.pageViewsByType || []).map((p) => [p.page_type, p.total]));
            }} data-testid="btn-export-page-views"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.pageViewsByType || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (data.pageViewsByType || []).map((p, i) => {
              const max = data.pageViewsByType[0]?.total || 1;
              return (
                <div key={i} data-testid={`page-type-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{p.page_type || "unknown"}</span>
                    <span className="text-xs text-muted-foreground">{p.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(p.total / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card data-testid="card-views-trend">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Views Over Time</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("views-over-time.csv", ["Date", "Views"],
                (data.viewsOverTime || []).map((v) => [v.date, v.views]));
            }} data-testid="btn-export-views-trend"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            {(data.viewsOverTime || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No trend data yet.</p>
            ) : (
              <div className="space-y-1">
                {(() => {
                  const items = data.viewsOverTime || [];
                  const max = Math.max(...items.map((v) => v.views), 1);
                  return items.slice(-14).map((v, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`trend-row-${i}`}>
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{new Date(v.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${(v.views / max) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{v.views}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EngagementTab({ data }: { data: EngagementData }) {
  const funnel = data.funnel || {};
  const funnelSteps = [
    { label: "Views", value: funnel.profile_views || 0, color: "bg-blue-500" },
    { label: "Clicks", value: funnel.clicks || 0, color: "bg-indigo-500" },
    { label: "Lead Starts", value: funnel.lead_starts || 0, color: "bg-violet-500" },
    { label: "Leads Submitted", value: funnel.lead_submits || 0, color: "bg-emerald-500" },
  ];
  const funnelMax = Math.max(...funnelSteps.map(s => s.value), 1);

  return (
    <div className="space-y-6" data-testid="section-engagement">
      <Card data-testid="card-conversion-funnel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnelSteps.map((step, i) => (
            <div key={i} data-testid={`funnel-step-${i}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{step.value.toLocaleString()}</span>
                  {i > 0 && funnelSteps[i - 1].value > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {((step.value / funnelSteps[i - 1].value) * 100).toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${step.color}`} style={{ width: `${(step.value / funnelMax) * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="flex gap-4 pt-2 border-t text-center">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Saves</p>
              <p className="text-lg font-bold">{(funnel.saves || 0).toLocaleString()}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total Likes</p>
              <p className="text-lg font-bold">{(data.totalLikes || 0).toLocaleString()}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total Follows</p>
              <p className="text-lg font-bold">{(data.totalFollows || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-top-engagement">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Top Businesses by Engagement</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => {
            downloadCsv("top-engagement.csv", ["Name", "Views", "Clicks", "Saves", "Leads", "Total"],
              (data.topByEngagement || []).map((b) => [b.name, b.views, b.clicks, b.saves, b.leads, b.total_events]));
          }} data-testid="btn-export-engagement"><Download className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {(data.topByEngagement || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No engagement data yet.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2.5 font-medium">#</th>
                    <th className="text-left p-2.5 font-medium">Business</th>
                    <th className="text-right p-2.5 font-medium">Views</th>
                    <th className="text-right p-2.5 font-medium">Clicks</th>
                    <th className="text-right p-2.5 font-medium">Saves</th>
                    <th className="text-right p-2.5 font-medium">Leads</th>
                    <th className="text-right p-2.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topByEngagement || []).slice(0, 15).map((b, i) => (
                    <tr key={i} className="border-t" data-testid={`engagement-row-${i}`}>
                      <td className="p-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="p-2.5 font-medium truncate max-w-[200px]">{b.name}</td>
                      <td className="p-2.5 text-right">{b.views}</td>
                      <td className="p-2.5 text-right">{b.clicks}</td>
                      <td className="p-2.5 text-right">{b.saves}</td>
                      <td className="p-2.5 text-right">{b.leads}</td>
                      <td className="p-2.5 text-right font-semibold">{b.total_events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(data.topSaved || []).length > 0 && (
        <Card data-testid="card-most-saved">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Most Saved</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("most-saved.csv", ["Business", "Saves"],
                (data.topSaved || []).map((s) => [s.name, s.save_count]));
            }} data-testid="btn-export-saved"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.topSaved || []).map((s, i) => {
              const max = data.topSaved[0]?.save_count || 1;
              return (
                <div key={i} className="flex items-center gap-2" data-testid={`saved-${i}`}>
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.save_count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(s.save_count / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AudienceTab({ data }: { data: AudienceData }) {
  const rvn = data.returningVsNew || {};
  const totalVisitors = (rvn.returning_visitors || 0) + (rvn.new_visitors || 0);

  return (
    <div className="space-y-6" data-testid="section-audience">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="New Visitors" value={rvn.new_visitors || 0} icon={UserPlus}
          subtitle={totalVisitors > 0 ? `${((rvn.new_visitors / totalVisitors) * 100).toFixed(1)}%` : undefined} />
        <StatCard label="Returning Visitors" value={rvn.returning_visitors || 0} icon={UserCheck}
          subtitle={totalVisitors > 0 ? `${((rvn.returning_visitors / totalVisitors) * 100).toFixed(1)}%` : undefined} />
        {(data.deviceBreakdown || []).slice(0, 2).map((d: { device: string; total: number }) => (
          <StatCard key={d.device} label={d.device === "mobile" ? "Mobile" : d.device === "desktop" ? "Desktop" : d.device.charAt(0).toUpperCase() + d.device.slice(1)}
            value={d.total} icon={Monitor} />
        ))}
      </div>

      {(data.deviceBreakdown || []).length > 0 && (
        <Card data-testid="card-device-breakdown">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Device Breakdown</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("device-breakdown.csv", ["Device", "Count"],
                (data.deviceBreakdown || []).map((d: { device: string; total: number }) => [d.device, String(d.total)]));
            }} data-testid="btn-export-devices"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            {(() => {
              const total = (data.deviceBreakdown || []).reduce((s: number, d: { total: number }) => s + d.total, 0);
              const colors = ["bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-violet-500"];
              const textColors = ["text-blue-600", "text-amber-600", "text-emerald-600", "text-rose-600", "text-violet-600"];
              return (
                <div className="space-y-3">
                  <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                    {(data.deviceBreakdown || []).map((d: { device: string; total: number }, i: number) => (
                      <div key={d.device} className={`h-full ${colors[i % colors.length]}`} style={{ width: `${(d.total / total) * 100}%` }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {(data.deviceBreakdown || []).map((d: { device: string; total: number }, i: number) => (
                      <div key={d.device} className="text-center" data-testid={`device-${d.device}`}>
                        <div className={`text-lg font-bold ${textColors[i % textColors.length]}`}>{total > 0 ? ((d.total / total) * 100).toFixed(1) : 0}%</div>
                        <div className="text-xs text-muted-foreground">{d.device} ({d.total})</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-language-breakdown">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Language Breakdown</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("language-breakdown.csv", ["Language", "Count"],
                (data.languageBreakdown || []).map((l) => [l.language, l.total]));
            }} data-testid="btn-export-language"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            {(data.languageBreakdown || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (() => {
              const total = data.languageBreakdown.reduce((_s: number, l) => s + l.total, 0);
              return (
                <div className="space-y-3">
                  <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                    {data.languageBreakdown.map((l, i) => {
                      const colors = ["bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500"];
                      return <div key={i} className={`h-full ${colors[i % colors.length]}`} style={{ width: `${(l.total / total) * 100}%` }} />;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {data.languageBreakdown.map((l, i) => {
                      const colors = ["text-blue-600", "text-amber-600", "text-emerald-600", "text-rose-600"];
                      return (
                        <div key={i} className="text-center" data-testid={`lang-${l.language}`}>
                          <div className={`text-lg font-bold ${colors[i % colors.length]}`}>{((l.total / total) * 100).toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">{l.language?.toUpperCase()} ({l.total})</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card data-testid="card-zip-origins">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Top Zip Origins</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("zip-origins.csv", ["Zip", "Count"],
                (data.zipOrigins || []).map((z) => [z.zip_origin, z.total]));
            }} data-testid="btn-export-zips"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.zipOrigins || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No zip data yet.</p>
            ) : (data.zipOrigins || []).slice(0, 10).map((z, i) => {
              const max = data.zipOrigins[0]?.total || 1;
              return (
                <div key={i} className="flex items-center gap-2" data-testid={`zip-${i}`}>
                  <span className="text-xs font-mono w-12">{z.zip_origin}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(z.total / max) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{z.total}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card data-testid="card-referrers">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Top Referrers</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("referrers.csv", ["Referrer", "Count"],
                (data.referrerSources || []).map((r) => [r.referrer, r.total]));
            }} data-testid="btn-export-referrers"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.referrerSources || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrer data yet.</p>
            ) : (data.referrerSources || []).map((r, i) => {
              const max = data.referrerSources[0]?.total || 1;
              return (
                <div key={i} data-testid={`referrer-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate">{r.referrer}</span>
                    <span className="text-xs text-muted-foreground">{r.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(r.total / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card data-testid="card-time-patterns">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity by Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data.hourOfDay || []).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Hour of Day</p>
                <div className="flex items-end gap-0.5 h-16">
                  {Array.from({ length: 24 }, (_, h) => {
                    const entry = (data.hourOfDay || []).find((e) => e.hour === h);
                    const val = entry?.total || 0;
                    const max = Math.max(...(data.hourOfDay || []).map((e) => e.total), 1);
                    return (
                      <div key={h} className="flex-1 bg-violet-500 rounded-t" style={{ height: `${(val / max) * 100}%`, minHeight: val ? "2px" : "0" }}
                        title={`${h}:00 — ${val}`} data-testid={`hour-${h}`} />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                  <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                </div>
              </div>
            )}
            {(data.dayOfWeek || []).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Day of Week</p>
                <div className="flex gap-1">
                  {Array.from({ length: 7 }, (_, d) => {
                    const entry = (data.dayOfWeek || []).find((e) => e.dow === d);
                    const val = entry?.total || 0;
                    const max = Math.max(...(data.dayOfWeek || []).map((e) => e.total), 1);
                    return (
                      <div key={d} className="flex-1 text-center" data-testid={`dow-${d}`}>
                        <div className="h-12 flex items-end justify-center">
                          <div className="w-full bg-rose-500 rounded-t" style={{ height: `${(val / max) * 100}%`, minHeight: val ? "2px" : "0" }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{DOW_LABELS[d]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContentTab({ data }: { data: ContentData }) {
  return (
    <div className="space-y-6" data-testid="section-content">
      <Card data-testid="card-top-rss">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Top RSS Articles</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => {
            downloadCsv("top-rss.csv", ["Title", "Source", "Views"],
              (data.topRssArticles || []).map((r) => [r.title, r.source_name, r.view_count]));
          }} data-testid="btn-export-rss"><Download className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {(data.topRssArticles || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No RSS data yet.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Title</th>
                    <th className="text-left p-2.5 font-medium">Source</th>
                    <th className="text-right p-2.5 font-medium">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topRssArticles || []).map((r, i) => (
                    <tr key={i} className="border-t" data-testid={`rss-row-${i}`}>
                      <td className="p-2.5 truncate max-w-[300px]">{r.title}</td>
                      <td className="p-2.5"><Badge variant="secondary" className="text-xs">{r.source_name}</Badge></td>
                      <td className="p-2.5 text-right font-medium">{r.view_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-top-posts">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Top Posts</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => {
            downloadCsv("top-posts.csv", ["Title", "Tag", "Likes"],
              (data.topPosts || []).map((p) => [p.title, p.primary_tag, p.like_count]));
          }} data-testid="btn-export-posts"><Download className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {(data.topPosts || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No post data yet.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Title</th>
                    <th className="text-left p-2.5 font-medium">Tag</th>
                    <th className="text-right p-2.5 font-medium">Likes</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topPosts || []).map((p, i) => (
                    <tr key={i} className="border-t" data-testid={`post-row-${i}`}>
                      <td className="p-2.5 truncate max-w-[300px]">{p.title || "(untitled)"}</td>
                      <td className="p-2.5">{p.primary_tag && <Badge variant="outline" className="text-xs">{p.primary_tag}</Badge>}</td>
                      <td className="p-2.5 text-right font-medium">{p.like_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(data.topFeedItems || []).length > 0 && (
        <Card data-testid="card-top-feed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Top Feed Items</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("top-feed.csv", ["Entity ID", "Views", "Taps", "Saves", "Shares"],
                (data.topFeedItems || []).map((f) => [f.entity_id, f.views, f.taps, f.saves, f.shares]));
            }} data-testid="btn-export-feed"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Entity</th>
                    <th className="text-right p-2.5 font-medium">Views</th>
                    <th className="text-right p-2.5 font-medium">Taps</th>
                    <th className="text-right p-2.5 font-medium">Saves</th>
                    <th className="text-right p-2.5 font-medium">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topFeedItems || []).map((f, i) => (
                    <tr key={i} className="border-t" data-testid={`feed-row-${i}`}>
                      <td className="p-2.5 font-mono text-xs truncate max-w-[200px]">{f.entity_id}</td>
                      <td className="p-2.5 text-right">{f.views}</td>
                      <td className="p-2.5 text-right">{f.taps}</td>
                      <td className="p-2.5 text-right">{f.saves}</td>
                      <td className="p-2.5 text-right">{f.shares}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SignalsTab({ data }: { data: SignalsData }) {
  const signalTypes = Object.entries(data.signalSummary || {});
  const SIGNAL_COLORS: Record<string, string> = {
    UNCLAIMED_HIGH_DEMAND: "bg-orange-500",
    UPGRADE_READY: "bg-emerald-500",
    DORMANT_CLAIMED: "bg-slate-400",
    TRENDING_TOPIC: "bg-violet-500",
    CONTRIBUTOR_CANDIDATE: "bg-blue-500",
  };

  return (
    <div className="space-y-6" data-testid="section-signals">
      <Card data-testid="card-signal-summary">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Signal Summary</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => {
            downloadCsv("signal-summary.csv", ["Type", "New", "Reviewed", "Dismissed", "Total"],
              signalTypes.map(([type, c]: [string, any]) => [type, c.new, c.reviewed, c.dismissed, c.total]));
          }} data-testid="btn-export-signals"><Download className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {signalTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signals yet.</p>
          ) : (
            <div className="space-y-3">
              {signalTypes.map(([type, counts]: [string, any]) => (
                <div key={type} data-testid={`signal-type-${type}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{type.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{counts.new} new</Badge>
                      <span className="text-xs text-muted-foreground">{counts.total} total</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${SIGNAL_COLORS[type] || "bg-blue-500"}`}
                      style={{ width: `${(counts.total / Math.max(...signalTypes.map(([, c]: [string, any]) => c.total), 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(data.recentSignals || []).length > 0 && (
        <Card data-testid="card-recent-signals">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {(data.recentSignals || []).slice(0, 15).map((s, i) => (
                <div key={s.id || i} className="flex items-center justify-between py-2.5 gap-2" data-testid={`recent-signal-${i}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={s.status === "new" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
                    <span className="text-xs text-muted-foreground">{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PipelineTab({ data }: { data: PipelineData }) {
  const cv = data.claimedVsUnclaimed || {};
  const conversion = data.scoredToClaimedConversion || {};
  const conversionRate = conversion.total_scored > 0 ? ((conversion.scored_and_claimed / conversion.total_scored) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6" data-testid="section-pipeline">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Businesses" value={cv.total || 0} icon={Building2} />
        <StatCard label="Claimed" value={cv.claimed || 0} icon={Target} subtitle={cv.total ? `${((cv.claimed / cv.total) * 100).toFixed(1)}%` : "0%"} />
        <StatCard label="Unclaimed" value={cv.unclaimed || 0} icon={Building2} />
        <StatCard label="Score → Claimed" value={`${conversionRate}%`} icon={TrendingUp} subtitle={`${conversion.scored_and_claimed || 0} of ${conversion.total_scored || 0}`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-entity-buckets">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Entity Scoring Buckets</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("entity-buckets.csv", ["Bucket", "Count", "Avg DQ", "Avg CR", "Avg PF"],
                (data.entityBuckets || []).map((b) => [b.bucket, b.total, b.avg_dq, b.avg_cr, b.avg_pf]));
            }} data-testid="btn-export-entity-buckets"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.entityBuckets || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No scored entities yet.</p>
            ) : (data.entityBuckets || []).map((b, i) => {
              const max = data.entityBuckets[0]?.total || 1;
              const bucketColors: Record<string, string> = {
                TARGET: "bg-emerald-500", VERIFY_LATER: "bg-amber-500",
                CONTENT_SOURCE_ONLY: "bg-slate-400", NEEDS_REVIEW: "bg-rose-500",
              };
              return (
                <div key={i} data-testid={`entity-bucket-${b.bucket}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{b.bucket.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{b.total}</span>
                      <span className="text-[10px] text-muted-foreground">DQ:{b.avg_dq} CR:{b.avg_cr} PF:{b.avg_pf}</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${bucketColors[b.bucket] || "bg-blue-500"}`} style={{ width: `${(b.total / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card data-testid="card-sales-buckets">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Sales Buckets</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              downloadCsv("sales-buckets.csv", ["Bucket", "Count", "Avg Priority"],
                (data.salesBuckets || []).map((b) => [b.bucket, b.total, b.avg_priority]));
            }} data-testid="btn-export-sales-buckets"><Download className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.salesBuckets || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales bucket data yet.</p>
            ) : (data.salesBuckets || []).map((b, i) => {
              const max = data.salesBuckets[0]?.total || 1;
              return (
                <div key={i} data-testid={`sales-bucket-${b.bucket}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate">{b.bucket.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{b.total}</span>
                      <Badge variant="outline" className="text-[10px]">Pri: {b.avg_priority}</Badge>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${(b.total / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetroComparisonTab({ data }: { data: MetroComparisonData }) {
  const metros = data.metros || [];
  return (
    <div className="space-y-6" data-testid="section-metro-comparison">
      <Card data-testid="card-metro-table">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">Metro-by-Metro Comparison</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => {
            downloadCsv("metro-comparison.csv",
              ["City", "Views", "Clicks", "Leads", "Businesses", "Claimed", "Claimed %", "Content (30d)", "Signals"],
              metros.map((m) => [m.cityName, m.totalViews, m.totalClicks, m.totalLeads, m.totalBusinesses, m.claimedBusinesses, m.claimedPct, m.contentVolume30d, m.activeSignals])
            );
          }} data-testid="btn-export-metro-compare"><Download className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {metros.length === 0 ? (
            <p className="text-sm text-muted-foreground">No metro data yet.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Metro</th>
                    <th className="text-right p-2.5 font-medium">Views</th>
                    <th className="text-right p-2.5 font-medium">Clicks</th>
                    <th className="text-right p-2.5 font-medium">Leads</th>
                    <th className="text-right p-2.5 font-medium">Businesses</th>
                    <th className="text-right p-2.5 font-medium">Claimed %</th>
                    <th className="text-right p-2.5 font-medium">Content (30d)</th>
                    <th className="text-right p-2.5 font-medium">Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {metros.map((m, i) => (
                    <tr key={m.cityId} className="border-t" data-testid={`metro-compare-${m.cityId}`}>
                      <td className="p-2.5 font-medium">{m.cityName}</td>
                      <td className="p-2.5 text-right">{m.totalViews.toLocaleString()}</td>
                      <td className="p-2.5 text-right">{m.totalClicks.toLocaleString()}</td>
                      <td className="p-2.5 text-right">{m.totalLeads.toLocaleString()}</td>
                      <td className="p-2.5 text-right">{m.totalBusinesses.toLocaleString()}</td>
                      <td className="p-2.5 text-right">
                        <Badge variant={m.claimedPct >= 50 ? "default" : "outline"} className="text-[10px]">{m.claimedPct}%</Badge>
                      </td>
                      <td className="p-2.5 text-right">{m.contentVolume30d}</td>
                      <td className="p-2.5 text-right">{m.activeSignals > 0 ? (
                        <Badge variant="outline" className="text-[10px]">{m.activeSignals}</Badge>
                      ) : "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {metros.length > 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-metro-views-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Views by Metro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const max = Math.max(...metros.map((m) => m.totalViews), 1);
                return metros.map((m) => (
                  <div key={m.cityId} className="flex items-center gap-2">
                    <span className="text-xs w-24 truncate">{m.cityName}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(m.totalViews / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{m.totalViews.toLocaleString()}</span>
                  </div>
                ));
              })()}
            </CardContent>
          </Card>

          <Card data-testid="card-metro-claimed-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Claimed % by Metro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metros.map((m) => (
                <div key={m.cityId} className="flex items-center gap-2">
                  <span className="text-xs w-24 truncate">{m.cityName}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${m.claimedPct >= 50 ? "bg-emerald-500" : m.claimedPct >= 25 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${m.claimedPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{m.claimedPct}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
