import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Download, TrendingUp, Search, Globe, AlertTriangle } from "lucide-react";

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

export default function IntelligenceReportTab({ cityId: propCityId }: { cityId?: string }) {
  const [filterCityId, setFilterCityId] = useState<string>(propCityId || "all");
  const [days, setDays] = useState<number>(30);

  const { data: cities } = useQuery<any[]>({
    queryKey: ["/api/cities"],
  });

  const params = new URLSearchParams();
  if (filterCityId !== "all") params.set("cityId", filterCityId);
  params.set("days", String(days));

  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/report", filterCityId, days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/report?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
  });

  const dayOptions = [7, 30, 90];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCityId} onValueChange={setFilterCityId}>
          <SelectTrigger className="w-[200px]" data-testid="select-report-city">
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities?.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          {dayOptions.map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
              data-testid={`btn-days-${d}`}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading report...</div>
      ) : !report ? (
        <div className="text-center py-12 text-muted-foreground">No report data available.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-search-intelligence">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="w-4 h-4" /> Search Intelligence
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const items = report.searchQueries || [];
                  downloadCsv("search-queries.csv", ["Query", "Count"], items.map((q: any) => [q.query, q.count]));
                }}
                data-testid="btn-export-search"
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(report.searchQueries || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No search data yet.</p>
              ) : (
                (report.searchQueries || []).map((q: any, i: number) => {
                  const max = report.searchQueries[0]?.count || 1;
                  return (
                    <div key={i} className="flex items-center gap-2" data-testid={`search-query-${i}`}>
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate">{q.query}</span>
                          <span className="text-xs text-muted-foreground">{q.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(q.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-language-demand">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" /> Language Demand
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const lang = report.languageDemand || {};
                  downloadCsv("language-demand.csv", ["Language", "Count", "Percentage"], [
                    ["English", lang.en || 0, lang.enPct || 0],
                    ["Spanish", lang.es || 0, lang.esPct || 0],
                  ]);
                }}
                data-testid="btn-export-language"
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {!report.languageDemand ? (
                <p className="text-sm text-muted-foreground">No language data yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4 justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{report.languageDemand.enPct ?? 0}%</div>
                      <div className="text-xs text-muted-foreground">English</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">{report.languageDemand.esPct ?? 0}%</div>
                      <div className="text-xs text-muted-foreground">Spanish</div>
                    </div>
                  </div>
                  <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${report.languageDemand.enPct ?? 50}%` }}
                    />
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${report.languageDemand.esPct ?? 50}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>EN: {report.languageDemand.en ?? 0}</span>
                    <span>ES: {report.languageDemand.es ?? 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-decision-factors">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Decision Factors
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const items = report.decisionFactors || [];
                  downloadCsv("decision-factors.csv", ["Factor", "Count"], items.map((f: any) => [f.factor, f.count]));
                }}
                data-testid="btn-export-factors"
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.decisionFactors || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No decision factor data yet.</p>
              ) : (
                (report.decisionFactors || []).map((f: any, i: number) => {
                  const max = report.decisionFactors[0]?.count || 1;
                  return (
                    <div key={i} data-testid={`factor-${i}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{f.factor}</span>
                        <span className="text-xs text-muted-foreground">{f.count}</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${(f.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-abandonment-patterns">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Abandonment Patterns
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const items = report.abandonmentPatterns || [];
                  downloadCsv("abandonment-patterns.csv", ["Reason", "Count"], items.map((a: any) => [a.reason, a.count]));
                }}
                data-testid="btn-export-abandonment"
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report.abandonmentPatterns || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No abandonment data yet.</p>
              ) : (
                (report.abandonmentPatterns || []).map((a: any, i: number) => {
                  const max = report.abandonmentPatterns[0]?.count || 1;
                  return (
                    <div key={i} data-testid={`abandonment-${i}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{a.reason}</span>
                        <span className="text-xs text-muted-foreground">{a.count}</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${(a.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2" data-testid="card-top-content">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Top Content
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const items = report.topContent || [];
                  downloadCsv("top-content.csv", ["Title", "Source", "Views"], items.map((c: any) => [c.title, c.source, c.views]));
                }}
                data-testid="btn-export-content"
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {(report.topContent || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No content data yet.</p>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Title</th>
                        <th className="text-left p-3 font-medium">Source</th>
                        <th className="text-right p-3 font-medium">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.topContent || []).map((c: any, i: number) => (
                        <tr key={i} className="border-t" data-testid={`row-content-${i}`}>
                          <td className="p-3">{c.title}</td>
                          <td className="p-3 text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">{c.source}</Badge>
                          </td>
                          <td className="p-3 text-right font-medium">{c.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2" data-testid="card-zone-activity">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Activity by Zone
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const items = report.zoneActivity || [];
                  downloadCsv("zone-activity.csv", ["Zone", "Count"], items.map((z: any) => [z.zone, z.count]));
                }}
                data-testid="btn-export-zones"
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {(report.zoneActivity || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No zone activity data yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(report.zoneActivity || []).map((z: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`zone-${i}`}>
                      <span className="text-sm font-medium">{z.zone}</span>
                      <Badge variant="secondary">{z.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}