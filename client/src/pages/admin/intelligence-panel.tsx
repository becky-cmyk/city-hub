import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Building2,
  Home,
  Radio,
  Globe,
  Upload,
  Download,
  Search,
  FileText,
  BarChart3,
  RefreshCw,
  Plug,
  Play,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  Eye,
  Power,
  Plus,
  Newspaper,
  Megaphone,
  Activity,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Send,
  AlertTriangle,
  Store,
  Briefcase,
  Wifi,
  HelpCircle,
  Wrench,
  Factory,
  ShoppingBag,
  Tags,
  Target,
  CheckCircle,
  Link2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import RssReviewTab from "./rss-review-tab";
import EditorialControlTab from "./editorial-control-tab";
import ReviewQueueTab from "./review-queue-tab";
import CampaignsTab from "./campaigns-tab";
import IntelligenceReportTab from "./intelligence-report-tab";

const TAG_CATEGORIES: Record<string, { label: string; tags: string[] }> = {
  contractors: {
    label: "Contractors",
    tags: [
      "CONSTRUCTION_CONTRACTOR", "ROOFING_CONTRACTOR", "HVAC_CONTRACTOR",
      "PLUMBING_CONTRACTOR", "ELECTRICAL_CONTRACTOR", "GENERAL_CONTRACTOR",
      "COMMERCIAL_BUILDOUT_SIGNAL",
    ],
  },
  industrial: {
    label: "Industrial",
    tags: [
      "MANUFACTURING", "FABRICATION", "INDUSTRIAL_SUPPLY",
      "WHOLESALE_DISTRIBUTION", "WAREHOUSE_LOGISTICS", "INDUSTRIAL_CORRIDOR_LOCATION",
    ],
  },
  consumerFacing: {
    label: "Consumer-Facing",
    tags: [
      "FOOD_SERVICE", "RETAIL_STOREFRONT", "BEAUTY_PERSONAL_CARE",
      "AUTOMOTIVE_SERVICE", "HEALTHCARE_MEDICAL",
    ],
  },
  other: {
    label: "Other",
    tags: ["PROFESSIONAL_SERVICES", "RELIGIOUS_NONPROFIT"],
  },
};

function tagCategoryFor(tag: string): string {
  for (const [cat, def] of Object.entries(TAG_CATEGORIES)) {
    if (def.tags.includes(tag)) return cat;
  }
  return "other";
}

function tagDisplayName(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ /g, " ");
}

function IndustryTagsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [tagFilter, setTagFilter] = useState("all");
  const [minConfidence, setMinConfidence] = useState("");
  const [hasPhoneFilter, setHasPhoneFilter] = useState("all");
  const [hasWebsiteFilter, setHasWebsiteFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/industry/stats", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/industry/stats?${p}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: entities, isLoading: entitiesLoading, refetch: refetchEntities } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/industry/entities", cityId, tagFilter, minConfidence, hasPhoneFilter, hasWebsiteFilter, searchText],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (tagFilter !== "all") params.set("tag", tagFilter);
      if (minConfidence) params.set("minConfidence", minConfidence);
      if (hasPhoneFilter === "yes") params.set("hasPhone", "true");
      if (hasWebsiteFilter === "yes") params.set("hasWebsite", "true");
      if (hasWebsiteFilter === "no") params.set("hasWebsite", "false");
      if (searchText) params.set("search", searchText);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/intelligence/industry/entities?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const runTaggerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/industry/run", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Industry Tagger Complete",
        description: `Tagged ${data.tagged || data.processed || 0} entities`,
      });
      refetchStats();
      refetchEntities();
    },
    onError: (err: any) => toast({ title: "Industry Tagger Failed", description: err.message, variant: "destructive" }),
  });

  const tagDistribution = stats?.tagDistribution || [];
  const totalTagged = stats?.totalTaggedEntities || 0;

  const grouped: Record<string, { label: string; tags: { tag: string; count: number; avg_confidence: number }[] }> = {};
  for (const [cat, def] of Object.entries(TAG_CATEGORIES)) {
    grouped[cat] = { label: def.label, tags: [] };
  }
  for (const row of tagDistribution) {
    const cat = tagCategoryFor(row.tag);
    if (!grouped[cat]) grouped[cat] = { label: "Other", tags: [] };
    grouped[cat].tags.push(row);
  }

  const entityRows = entities?.data || [];
  const entityTotal = entities?.total || 0;

  const confidenceBadgeVariant = (c: number): "default" | "secondary" | "outline" => {
    if (c >= 80) return "default";
    if (c >= 60) return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold" data-testid="text-industry-tags-title">Industry Tags</h3>
        <Badge variant="secondary" data-testid="badge-total-tagged">{totalTagged} entities tagged</Badge>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => runTaggerMutation.mutate()}
            disabled={runTaggerMutation.isPending}
            data-testid="btn-run-industry-tagger"
          >
            <Tags className="w-4 h-4 mr-1" />
            {runTaggerMutation.isPending ? "Tagging..." : "Run Industry Tagger"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { refetchStats(); refetchEntities(); }}
            data-testid="btn-refresh-industry"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {statsLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading industry tag stats...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(grouped).map(([cat, group]) => {
            const catTotal = group.tags.reduce((sum, t) => sum + (Number(t.count) || 0), 0);
            if (catTotal === 0 && tagDistribution.length > 0) return null;
            const catIcon = cat === "contractors" ? <Wrench className="w-4 h-4" /> :
              cat === "industrial" ? <Factory className="w-4 h-4" /> :
              cat === "consumerFacing" ? <ShoppingBag className="w-4 h-4" /> :
              <Briefcase className="w-4 h-4" />;
            return (
              <Card key={cat} data-testid={`card-category-${cat}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {catIcon}
                    {group.label}
                  </CardTitle>
                  <Badge variant="secondary">{catTotal}</Badge>
                </CardHeader>
                <CardContent className="pb-4">
                  {group.tags.length > 0 ? (
                    <div className="space-y-1">
                      {group.tags.map((t) => (
                        <div key={t.tag} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate mr-2">{tagDisplayName(t.tag)}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="outline" className="text-[10px]">{t.count}</Badge>
                            <span className="text-[10px] text-muted-foreground">~{t.avg_confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No tags in this category</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-semibold" data-testid="text-tagged-entities-title">Tagged Entities</h4>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[220px]" data-testid="select-industry-tag-filter">
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {Object.entries(TAG_CATEGORIES).map(([cat, def]) => (
                def.tags.map((tag) => (
                  <SelectItem key={tag} value={tag}>{tagDisplayName(tag)}</SelectItem>
                ))
              ))}
            </SelectContent>
          </Select>
          <Select value={minConfidence || "any"} onValueChange={(v) => setMinConfidence(v === "any" ? "" : v)}>
            <SelectTrigger className="w-[160px]" data-testid="select-min-confidence">
              <SelectValue placeholder="Min Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Confidence</SelectItem>
              <SelectItem value="50">50%+</SelectItem>
              <SelectItem value="60">60%+</SelectItem>
              <SelectItem value="70">70%+</SelectItem>
              <SelectItem value="80">80%+</SelectItem>
              <SelectItem value="90">90%+</SelectItem>
            </SelectContent>
          </Select>
          <Select value={hasPhoneFilter} onValueChange={setHasPhoneFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-has-phone">
              <SelectValue placeholder="Phone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Phone</SelectItem>
              <SelectItem value="yes">Has Phone</SelectItem>
            </SelectContent>
          </Select>
          <Select value={hasWebsiteFilter} onValueChange={setHasWebsiteFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-has-website">
              <SelectValue placeholder="Website" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Website</SelectItem>
              <SelectItem value="yes">Has Website</SelectItem>
              <SelectItem value="no">No Website</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search by name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-[200px]"
            data-testid="input-industry-search"
          />
          <div className="text-xs text-muted-foreground ml-auto" data-testid="text-entity-count">{entityTotal} results</div>
        </div>

        {entitiesLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading tagged entities...</div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Entity Name</th>
                  <th className="text-left p-3 font-medium">Tag</th>
                  <th className="text-center p-3 font-medium">Confidence</th>
                  <th className="text-left p-3 font-medium">Evidence</th>
                  <th className="text-center p-3 font-medium">Phone</th>
                  <th className="text-center p-3 font-medium">Email</th>
                  <th className="text-center p-3 font-medium">Website</th>
                  <th className="text-left p-3 font-medium">Outreach</th>
                  <th className="text-left p-3 font-medium">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {entityRows.map((row: any, idx: number) => {
                  const evidence = typeof row.evidence_json === "string" ? JSON.parse(row.evidence_json) : row.evidence_json;
                  const evidenceSummary = evidence?.reasoning || evidence?.source || (Array.isArray(evidence?.matches) ? evidence.matches.join(", ") : "");
                  const phone = row.phone || row.detected_phone;
                  const email = row.owner_email || row.detected_email;
                  return (
                    <tr key={`${row.entity_id}-${row.tag}-${idx}`} className="border-t hover:bg-muted/30" data-testid={`row-industry-entity-${row.entity_id}`}>
                      <td className="p-3">
                        <div className="font-medium text-xs" data-testid={`text-entity-name-${row.entity_id}`}>{row.name || "—"}</div>
                        {row.address && <div className="text-[10px] text-muted-foreground">{row.address}</div>}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs" data-testid={`badge-tag-${row.entity_id}`}>{tagDisplayName(row.tag)}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={confidenceBadgeVariant(row.confidence)} className="text-xs" data-testid={`badge-confidence-${row.entity_id}`}>
                          {row.confidence}%
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{evidenceSummary || "—"}</span>
                      </td>
                      <td className="p-3 text-center">
                        {phone ? (
                          <Phone className="w-3 h-3 text-green-600 dark:text-green-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {email ? (
                          <Mail className="w-3 h-3 text-blue-600 dark:text-blue-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {row.website_url ? (
                          <Globe className="w-3 h-3 text-purple-600 dark:text-purple-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-xs">{row.recommended_method || "—"}</span>
                      </td>
                      <td className="p-3">
                        {row.bucket ? (
                          <Badge
                            variant={row.bucket === "TARGET" ? "default" : row.bucket === "CONTENT_SOURCE_ONLY" ? "outline" : "secondary"}
                            className={`text-xs ${row.bucket === "TARGET" ? "bg-green-600 text-white" : ""}`}
                          >
                            {row.bucket}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {entityRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No tagged entities found. Run the industry tagger to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProspectPipelineSection({ cityId }: { cityId?: string }) {
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/pipeline/status", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/pipeline/status?${p}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/pipeline/runs", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/pipeline/runs?${p}`, { credentials: "include" });
      return res.json();
    },
  });

  const runPipelineMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/pipeline/run", {});
      return res.json();
    },
    onSuccess: (data) => {
      const r = data.results || data.resultsJson || {};
      toast({
        title: "Pipeline Complete",
        description: `Crawled: ${r.crawlProcessed || 0}, Classified: ${r.classified || 0}, Scored: ${r.scored || 0}, Promoted: ${r.promoted || 0}, Review: ${r.needsReview || 0}`,
      });
      refetchStatus();
      refetchRuns();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/crawl/stats"] });
    },
    onError: (err: any) => toast({ title: "Pipeline Failed", description: err.message, variant: "destructive" }),
  });

  const isRunning = status?.isRunning || runPipelineMutation.isPending;
  const lastRun = status?.lastRun;
  const lastResults = lastRun?.resultsJson;

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "In progress...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const nextScheduled = () => {
    if (!status?.scheduleHour) return "Unknown";
    const hour = status.scheduleHour;
    const now = new Date();
    const next = new Date();
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };

  const displayRuns = (runs || []).slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold" data-testid="text-pipeline-title">Prospect Pipeline</h3>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Badge
            variant={isRunning ? "default" : "secondary"}
            data-testid="badge-pipeline-status"
          >
            {isRunning ? (
              <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Running</>
            ) : (
              <><Activity className="w-3 h-3 mr-1" /> Idle</>
            )}
          </Badge>
          <Button
            size="sm"
            onClick={() => runPipelineMutation.mutate()}
            disabled={isRunning}
            data-testid="btn-run-pipeline"
          >
            <Play className="w-4 h-4 mr-1" />
            {runPipelineMutation.isPending ? "Running Pipeline..." : "Run Pipeline Now"}
          </Button>
        </div>
      </div>

      {statusLoading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading pipeline status...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-pipeline-last-run">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Last Run</div>
                <div className="text-sm font-medium" data-testid="text-pipeline-last-run">
                  {lastRun?.startedAt ? new Date(lastRun.startedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "Never"}
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-pipeline-next-scheduled">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Next Scheduled</div>
                <div className="text-sm font-medium" data-testid="text-pipeline-next-scheduled">{nextScheduled()}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-pipeline-promoted">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Total Promoted</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-pipeline-total-promoted">{status?.totalPromoted || 0}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-pipeline-pending">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Pending Targets</div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-pipeline-pending-targets">{status?.pendingTargets || 0}</div>
              </CardContent>
            </Card>
          </div>

          {lastResults && (
            <Card data-testid="card-pipeline-last-results">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm">Last Run Results</CardTitle>
                <Badge variant={lastRun?.status === "COMPLETED" ? "default" : lastRun?.status === "FAILED" ? "destructive" : "secondary"}>
                  {lastRun?.status}
                </Badge>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold" data-testid="text-result-crawl-enqueued">{lastResults.crawlEnqueued || 0}</div>
                    <div className="text-xs text-muted-foreground">Enqueued</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold" data-testid="text-result-crawl-processed">{lastResults.crawlProcessed || 0}</div>
                    <div className="text-xs text-muted-foreground">Crawled</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold" data-testid="text-result-classified">{lastResults.classified || 0}</div>
                    <div className="text-xs text-muted-foreground">Classified</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold" data-testid="text-result-scored">{lastResults.scored || 0}</div>
                    <div className="text-xs text-muted-foreground">Scored</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400" data-testid="text-result-promoted">{lastResults.promoted || 0}</div>
                    <div className="text-xs text-muted-foreground">Promoted</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="text-result-needs-review">{lastResults.needsReview || 0}</div>
                    <div className="text-xs text-muted-foreground">Needs Review</div>
                  </div>
                </div>
                {lastRun?.errorMessage && (
                  <div className="mt-3 text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{lastRun.errorMessage}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {displayRuns.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2" data-testid="text-pipeline-history-title">Pipeline Run History</h4>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Started</th>
                      <th className="text-left p-3 font-medium">Trigger</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Duration</th>
                      <th className="text-right p-3 font-medium">Crawled</th>
                      <th className="text-right p-3 font-medium">Classified</th>
                      <th className="text-right p-3 font-medium">Scored</th>
                      <th className="text-right p-3 font-medium">Promoted</th>
                      <th className="text-right p-3 font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRuns.map((run: any, idx: number) => {
                      const r = run.resultsJson || {};
                      return (
                        <tr key={run.id || idx} className="border-t hover:bg-muted/30" data-testid={`row-pipeline-run-${run.id || idx}`}>
                          <td className="p-3 text-xs">
                            {run.startedAt ? new Date(run.startedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{run.triggeredBy || "—"}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={run.status === "COMPLETED" ? "default" : run.status === "FAILED" ? "destructive" : "secondary"}
                              className={run.status === "COMPLETED" ? "bg-green-600 text-white" : ""}
                            >
                              {run.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {run.startedAt ? formatDuration(run.startedAt, run.completedAt) : "—"}
                          </td>
                          <td className="p-3 text-right text-xs">{r.crawlProcessed ?? "—"}</td>
                          <td className="p-3 text-right text-xs">{r.classified ?? "—"}</td>
                          <td className="p-3 text-right text-xs">{r.scored ?? "—"}</td>
                          <td className="p-3 text-right text-xs font-medium text-green-600 dark:text-green-400">{r.promoted ?? "—"}</td>
                          <td className="p-3 text-right text-xs">{r.needsReview ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CrawlScoringTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/crawl/stats", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/crawl/stats?${p}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 15000,
  });

  const enqueueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/crawl/enqueue", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Crawl Jobs Enqueued", description: `${data.count} jobs enqueued` });
      refetchStats();
    },
    onError: (err: any) => toast({ title: "Enqueue Failed", description: err.message, variant: "destructive" }),
  });

  const runCrawlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/crawl/run", { limit: 50 });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Crawl Complete", description: `Processed ${data.processed}: ${data.succeeded} succeeded, ${data.failed} failed` });
      refetchStats();
    },
    onError: (err: any) => toast({ title: "Crawl Failed", description: err.message, variant: "destructive" }),
  });

  const scoringMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/scoring/run", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Scoring Complete", description: `Processed ${data.processed} entities, ${data.errors} errors` });
      refetchStats();
    },
    onError: (err: any) => toast({ title: "Scoring Failed", description: err.message, variant: "destructive" }),
  });

  const classifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/classify/run", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Classification Complete",
        description: `Classified ${data.classification?.processed || 0} locations, ${data.outreach?.processed || 0} outreach recommendations`,
      });
      refetchStats();
    },
    onError: (err: any) => toast({ title: "Classification Failed", description: err.message, variant: "destructive" }),
  });

  const crawl = stats?.crawl || {};
  const scores = stats?.scores || [];
  const recent = stats?.recent || [];
  const crawlEnabled = stats?.crawlEnabled ?? false;
  const classification = stats?.classification || {};
  const outreach = stats?.outreach || {};

  const targetCount = scores.find?.((s: any) => s.bucket === "TARGET")?.count || 0;
  const verifyCount = scores.find?.((s: any) => s.bucket === "VERIFY_LATER")?.count || 0;
  const contentCount = scores.find?.((s: any) => s.bucket === "CONTENT_SOURCE_ONLY")?.count || 0;
  const needsReviewCount = scores.find?.((s: any) => s.bucket === "NEEDS_REVIEW")?.count || 0;

  const totalClassified = Object.values(classification).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
  const totalOutreach = Object.values(outreach).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);

  return (
    <div className="space-y-6">
      <ProspectPipelineSection cityId={cityId} />

      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={crawlEnabled ? "default" : "secondary"}
          data-testid="badge-crawl-enabled"
        >
          <Power className="w-3 h-3 mr-1" />
          {crawlEnabled ? "Crawling Enabled" : "Crawling Disabled"}
        </Badge>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => enqueueMutation.mutate()}
            disabled={enqueueMutation.isPending}
            data-testid="btn-enqueue-crawls"
          >
            <Plus className="w-4 h-4 mr-1" />
            {enqueueMutation.isPending ? "Enqueuing..." : "Enqueue Crawls"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runCrawlMutation.mutate()}
            disabled={runCrawlMutation.isPending || !crawlEnabled}
            data-testid="btn-run-crawl"
          >
            <Play className="w-4 h-4 mr-1" />
            {runCrawlMutation.isPending ? "Running..." : "Run Crawl Queue"}
          </Button>
          <Button
            size="sm"
            onClick={() => scoringMutation.mutate()}
            disabled={scoringMutation.isPending}
            data-testid="btn-run-scoring"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            {scoringMutation.isPending ? "Scoring..." : "Run Scoring"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => classifyMutation.mutate()}
            disabled={classifyMutation.isPending}
            data-testid="btn-run-classification"
          >
            <MapPin className="w-4 h-4 mr-1" />
            {classifyMutation.isPending ? "Classifying..." : "Run Classification"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetchStats()}
            data-testid="btn-refresh-stats"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {statsLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading stats...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card data-testid="card-crawl-total">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{crawl.total || 0}</div>
                <div className="text-xs text-muted-foreground">Total Entities</div>
              </CardContent>
            </Card>
            <Card data-testid="card-crawl-pending">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{crawl.pending || 0}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </CardContent>
            </Card>
            <Card data-testid="card-crawl-success">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{crawl.success || 0}</div>
                <div className="text-xs text-muted-foreground">Crawled OK</div>
              </CardContent>
            </Card>
            <Card data-testid="card-crawl-failed">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{crawl.failed || 0}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </CardContent>
            </Card>
            <Card data-testid="card-crawl-blocked">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{crawl.blocked || 0}</div>
                <div className="text-xs text-muted-foreground">Blocked</div>
              </CardContent>
            </Card>
            <Card data-testid="card-crawl-nowebsite">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-muted-foreground">{crawl.noWebsite || 0}</div>
                <div className="text-xs text-muted-foreground">No Website</div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3" data-testid="text-score-distribution-title">Score Distribution (Buckets)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-bucket-target">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">TARGET</span>
                    <Badge variant="default" className="bg-green-600 text-white">{targetCount}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">High prospect fit, contact-ready businesses</p>
                  {scores.find?.((s: any) => s.bucket === "TARGET") && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>Avg Prospect Fit: {scores.find((s: any) => s.bucket === "TARGET")?.avg_prospect_fit || 0}</div>
                      <div>Avg Contact Ready: {scores.find((s: any) => s.bucket === "TARGET")?.avg_contact_ready || 0}</div>
                      <div>Avg Data Quality: {scores.find((s: any) => s.bucket === "TARGET")?.avg_data_quality || 0}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card data-testid="card-bucket-verify">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">VERIFY LATER</span>
                    <Badge variant="secondary">{verifyCount}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Need additional verification before outreach</p>
                  {scores.find?.((s: any) => s.bucket === "VERIFY_LATER") && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>Avg Prospect Fit: {scores.find((s: any) => s.bucket === "VERIFY_LATER")?.avg_prospect_fit || 0}</div>
                      <div>Avg Contact Ready: {scores.find((s: any) => s.bucket === "VERIFY_LATER")?.avg_contact_ready || 0}</div>
                      <div>Avg Data Quality: {scores.find((s: any) => s.bucket === "VERIFY_LATER")?.avg_data_quality || 0}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card data-testid="card-bucket-content">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">CONTENT SOURCE</span>
                    <Badge variant="outline">{contentCount}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Content-only, not prospects for sales outreach</p>
                  {scores.find?.((s: any) => s.bucket === "CONTENT_SOURCE_ONLY") && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>Avg Prospect Fit: {scores.find((s: any) => s.bucket === "CONTENT_SOURCE_ONLY")?.avg_prospect_fit || 0}</div>
                      <div>Avg Contact Ready: {scores.find((s: any) => s.bucket === "CONTENT_SOURCE_ONLY")?.avg_contact_ready || 0}</div>
                      <div>Avg Data Quality: {scores.find((s: any) => s.bucket === "CONTENT_SOURCE_ONLY")?.avg_data_quality || 0}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card data-testid="card-bucket-needs-review">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">NEEDS REVIEW</span>
                    <Badge variant="secondary" className={needsReviewCount > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" : ""}>
                      {needsReviewCount}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Low confidence — requires manual review</p>
                  {scores.find?.((s: any) => s.bucket === "NEEDS_REVIEW") && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>Avg Prospect Fit: {scores.find((s: any) => s.bucket === "NEEDS_REVIEW")?.avg_prospect_fit || 0}</div>
                      <div>Avg Contact Ready: {scores.find((s: any) => s.bucket === "NEEDS_REVIEW")?.avg_contact_ready || 0}</div>
                      <div>Avg Data Quality: {scores.find((s: any) => s.bucket === "NEEDS_REVIEW")?.avg_data_quality || 0}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3" data-testid="text-location-type-title">Location Type Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card data-testid="card-loc-storefront">
                <CardContent className="p-4 text-center">
                  <Store className="w-5 h-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                  <div className="text-2xl font-bold">{classification.STOREFRONT || 0}</div>
                  <div className="text-xs text-muted-foreground">Storefront</div>
                </CardContent>
              </Card>
              <Card data-testid="card-loc-office">
                <CardContent className="p-4 text-center">
                  <Briefcase className="w-5 h-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                  <div className="text-2xl font-bold">{classification.OFFICE || 0}</div>
                  <div className="text-xs text-muted-foreground">Office</div>
                </CardContent>
              </Card>
              <Card data-testid="card-loc-home">
                <CardContent className="p-4 text-center">
                  <Home className="w-5 h-5 mx-auto mb-1 text-purple-600 dark:text-purple-400" />
                  <div className="text-2xl font-bold">{classification.HOME_BASED || 0}</div>
                  <div className="text-xs text-muted-foreground">Home-Based</div>
                </CardContent>
              </Card>
              <Card data-testid="card-loc-virtual">
                <CardContent className="p-4 text-center">
                  <Wifi className="w-5 h-5 mx-auto mb-1 text-cyan-600 dark:text-cyan-400" />
                  <div className="text-2xl font-bold">{classification.VIRTUAL || 0}</div>
                  <div className="text-xs text-muted-foreground">Virtual</div>
                </CardContent>
              </Card>
              <Card data-testid="card-loc-unknown">
                <CardContent className="p-4 text-center">
                  <HelpCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-2xl font-bold">{classification.UNKNOWN || 0}</div>
                  <div className="text-xs text-muted-foreground">Unknown</div>
                </CardContent>
              </Card>
            </div>
            {totalClassified > 0 && (
              <p className="text-xs text-muted-foreground mt-2" data-testid="text-total-classified">{totalClassified} entities classified</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3" data-testid="text-outreach-method-title">Outreach Method Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Card data-testid="card-outreach-walkin">
                <CardContent className="p-4 text-center">
                  <Store className="w-5 h-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                  <div className="text-xl font-bold">{outreach.WALK_IN || 0}</div>
                  <div className="text-xs text-muted-foreground">Walk-In</div>
                </CardContent>
              </Card>
              <Card data-testid="card-outreach-mailer">
                <CardContent className="p-4 text-center">
                  <Send className="w-5 h-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                  <div className="text-xl font-bold">{outreach.MAILER || 0}</div>
                  <div className="text-xs text-muted-foreground">Mailer</div>
                </CardContent>
              </Card>
              <Card data-testid="card-outreach-phone">
                <CardContent className="p-4 text-center">
                  <Phone className="w-5 h-5 mx-auto mb-1 text-indigo-600 dark:text-indigo-400" />
                  <div className="text-xl font-bold">{outreach.PHONE_FIRST || 0}</div>
                  <div className="text-xs text-muted-foreground">Phone First</div>
                </CardContent>
              </Card>
              <Card data-testid="card-outreach-form">
                <CardContent className="p-4 text-center">
                  <Globe className="w-5 h-5 mx-auto mb-1 text-teal-600 dark:text-teal-400" />
                  <div className="text-xl font-bold">{outreach.WEBSITE_FORM || 0}</div>
                  <div className="text-xs text-muted-foreground">Web Form</div>
                </CardContent>
              </Card>
              <Card data-testid="card-outreach-social">
                <CardContent className="p-4 text-center">
                  <MessageSquare className="w-5 h-5 mx-auto mb-1 text-pink-600 dark:text-pink-400" />
                  <div className="text-xl font-bold">{outreach.SOCIAL_DM || 0}</div>
                  <div className="text-xs text-muted-foreground">Social DM</div>
                </CardContent>
              </Card>
              <Card data-testid="card-outreach-email">
                <CardContent className="p-4 text-center">
                  <Mail className="w-5 h-5 mx-auto mb-1 text-orange-600 dark:text-orange-400" />
                  <div className="text-xl font-bold">{outreach.EMAIL || 0}</div>
                  <div className="text-xs text-muted-foreground">Email</div>
                </CardContent>
              </Card>
              <Card data-testid="card-outreach-unknown">
                <CardContent className="p-4 text-center">
                  <HelpCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-xl font-bold">{outreach.UNKNOWN || 0}</div>
                  <div className="text-xs text-muted-foreground">Unknown</div>
                </CardContent>
              </Card>
            </div>
            {totalOutreach > 0 && (
              <p className="text-xs text-muted-foreground mt-2" data-testid="text-total-outreach">{totalOutreach} outreach recommendations</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3" data-testid="text-recent-crawls-title">Recent Crawl Results</h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Entity</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Confidence</th>
                    <th className="text-left p-3 font-medium">Phone</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Contact Form</th>
                    <th className="text-left p-3 font-medium">Feed</th>
                    <th className="text-left p-3 font-medium">Crawled At</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r: any, idx: number) => (
                    <tr key={r.entity_id || idx} className="border-t hover:bg-muted/30" data-testid={`row-crawl-${r.entity_id || idx}`}>
                      <td className="p-3 font-medium">{r.business_name || r.entity_id}</td>
                      <td className="p-3">
                        <Badge
                          variant={r.crawl_status === "SUCCESS" ? "default" : "secondary"}
                          className={r.crawl_status === "SUCCESS" ? "bg-green-600 text-white" : r.crawl_status === "FAILED" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : ""}
                        >
                          {r.crawl_status}
                        </Badge>
                      </td>
                      <td className="p-3">{r.confidence_score ?? "—"}</td>
                      <td className="p-3 text-xs">{r.detected_phone || "—"}</td>
                      <td className="p-3 text-xs">{r.detected_email || "—"}</td>
                      <td className="p-3 text-xs">{r.detected_contact_form_url ? "Yes" : "—"}</td>
                      <td className="p-3 text-xs">{r.detected_feed_url ? "Yes" : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.crawled_at ? new Date(r.crawled_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No crawl results yet. Enqueue and run crawls to see results.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status, type }: { status: string; type: "outreach" | "partner" | "leaseUp" | "signal" }) {
  const colors: Record<string, string> = {
    uncontacted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    attempted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    connected: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    not_interested: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    converted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    partnered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    planning: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    under_construction: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    lease_up: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    stabilized: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    unknown: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    business_filing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    multifamily: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    language_spike: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    search_spike: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    permit: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
    zoning: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    vacancy: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  };
  return (
    <Badge className={`text-xs font-medium ${colors[status] || colors.unknown}`} data-testid={`badge-status-${status}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function ImportDialog({ type, onSuccess }: { type: "filings" | "multifamily"; onSuccess: () => void }) {
  const [mode, setMode] = useState<"json" | "csv">("json");
  const [jsonText, setJsonText] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const jsonMutation = useMutation({
    mutationFn: async () => {
      const parsed = JSON.parse(jsonText);
      const body = type === "filings" ? { filings: Array.isArray(parsed) ? parsed : [parsed] } : { properties: Array.isArray(parsed) ? parsed : [parsed] };
      const res = await apiRequest("POST", `/api/admin/intelligence/ingest/${type === "filings" ? "business-filings" : "multifamily"}`, body);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Import Complete", description: `${data.inserted} inserted, ${data.skipped} skipped` });
      setJsonText("");
      setOpen(false);
      onSuccess();
    },
    onError: (err: any) => toast({ title: "Import Failed", description: err.message, variant: "destructive" }),
  });

  const handleCsvUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/admin/intelligence/ingest/csv/${type === "filings" ? "business-filings" : "multifamily"}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "CSV Import Complete", description: `${data.inserted} inserted, ${data.skipped} skipped` });
        setOpen(false);
        onSuccess();
      } else {
        toast({ title: "CSV Import Failed", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "CSV Import Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`btn-import-${type}`}>
          <Upload className="w-4 h-4 mr-1" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import {type === "filings" ? "Business Filings" : "Multifamily Properties"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "json" ? "default" : "outline"} size="sm" onClick={() => setMode("json")} data-testid="btn-mode-json">Paste JSON</Button>
            <Button variant={mode === "csv" ? "default" : "outline"} size="sm" onClick={() => setMode("csv")} data-testid="btn-mode-csv">Upload CSV</Button>
          </div>
          {mode === "json" ? (
            <>
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={type === "filings" ? `[{"businessName":"ACME LLC","filingDate":"2024-01-15","stateCode":"NC","status":"active"}]` : `[{"propertyName":"Skyline Apts","address":"123 Main St","unitCount":200}]`}
                rows={8}
                data-testid="textarea-json-import"
              />
              <Button onClick={() => jsonMutation.mutate()} disabled={jsonMutation.isPending || !jsonText.trim()} data-testid="btn-submit-json">
                {jsonMutation.isPending ? "Importing..." : "Import JSON"}
              </Button>
            </>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
                className="block w-full text-sm"
                data-testid="input-csv-upload"
              />
              <p className="text-xs text-muted-foreground mt-2">Upload a CSV file with headers matching field names</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilingsTab({ cityId }: { cityId?: string }) {
  const [search, setSearch] = useState("");
  const [outreachFilter, setOutreachFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/business-filings", cityId, search, outreachFilter, zoneFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (search) params.set("search", search);
      if (outreachFilter !== "all") params.set("outreachStatus", outreachFilter);
      if (zoneFilter !== "all") params.set("zoneId", zoneFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/intelligence/business-filings?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: zonesData } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/zones", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/zones?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, outreachStatus }: { id: string; outreachStatus: string }) => {
      await apiRequest("PATCH", `/api/admin/intelligence/business-filings/${id}/status`, { outreachStatus });
    },
    onSuccess: () => { refetch(); toast({ title: "Status updated" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search filings..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-filings" />
        </div>
        <Select value={outreachFilter} onValueChange={setOutreachFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-outreach-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="uncontacted">Uncontacted</SelectItem>
            <SelectItem value="attempted">Attempted</SelectItem>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-zone-filter"><SelectValue placeholder="ZIP Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ZIPs</SelectItem>
            {zonesData?.map((z: any) => (
              <SelectItem key={z.id} value={z.id}>{z.name} ({z.zipCodes?.[0]})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ImportDialog type="filings" onSuccess={refetch} />
        <Button variant="outline" size="sm" asChild data-testid="btn-export-filings">
          <a href={`/api/admin/intelligence/export/business-filings.csv?${outreachFilter !== "all" ? `outreachStatus=${outreachFilter}` : ""}`} download><Download className="w-4 h-4 mr-1" /> Export</a>
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">{data?.total || 0} filings total</div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Business Name</th>
                <th className="text-left p-3 font-medium">Filing Date</th>
                <th className="text-left p-3 font-medium">State</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Industry</th>
                <th className="text-left p-3 font-medium">Outreach</th>
              </tr>
            </thead>
            <tbody>
              {data?.filings?.map((f: any) => (
                <tr key={f.id} className="border-t hover:bg-muted/30" data-testid={`row-filing-${f.id}`}>
                  <td className="p-3 font-medium">{f.businessName}</td>
                  <td className="p-3 text-muted-foreground">{f.filingDate || "—"}</td>
                  <td className="p-3">{f.stateCode}</td>
                  <td className="p-3">{f.status || "—"}</td>
                  <td className="p-3 text-muted-foreground">{f.industryCode || "—"}</td>
                  <td className="p-3">
                    <Select value={f.outreachStatus || "uncontacted"} onValueChange={(v) => statusMutation.mutate({ id: f.id, outreachStatus: v })}>
                      <SelectTrigger className="w-[130px] h-8 text-xs" data-testid={`select-outreach-${f.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncontacted">Uncontacted</SelectItem>
                        <SelectItem value="attempted">Attempted</SelectItem>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {(!data?.filings || data.filings.length === 0) && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No filings yet. Import data to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MultifamilyTab({ cityId }: { cityId?: string }) {
  const [search, setSearch] = useState("");
  const [leaseFilter, setLeaseFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/multifamily", cityId, search, leaseFilter, partnerFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (search) params.set("search", search);
      if (leaseFilter !== "all") params.set("leaseUpStatus", leaseFilter);
      if (partnerFilter !== "all") params.set("partnerStatus", partnerFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/intelligence/multifamily?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      await apiRequest("PATCH", `/api/admin/intelligence/multifamily/${id}/status`, updates);
    },
    onSuccess: () => { refetch(); toast({ title: "Updated" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-multifamily" />
        </div>
        <Select value={leaseFilter} onValueChange={setLeaseFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-lease-filter"><SelectValue placeholder="Lease Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lease Status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="under_construction">Under Construction</SelectItem>
            <SelectItem value="lease_up">Lease Up</SelectItem>
            <SelectItem value="stabilized">Stabilized</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
        <Select value={partnerFilter} onValueChange={setPartnerFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-partner-filter"><SelectValue placeholder="Partner Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Partners</SelectItem>
            <SelectItem value="uncontacted">Uncontacted</SelectItem>
            <SelectItem value="attempted">Attempted</SelectItem>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
            <SelectItem value="partnered">Partnered</SelectItem>
          </SelectContent>
        </Select>
        <ImportDialog type="multifamily" onSuccess={refetch} />
        <Button variant="outline" size="sm" asChild data-testid="btn-export-multifamily">
          <a href={`/api/admin/intelligence/export/multifamily.csv?${leaseFilter !== "all" ? `leaseUpStatus=${leaseFilter}` : ""}`} download><Download className="w-4 h-4 mr-1" /> Export</a>
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">{data?.total || 0} properties total</div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Property</th>
                <th className="text-left p-3 font-medium">Address</th>
                <th className="text-left p-3 font-medium">Units</th>
                <th className="text-left p-3 font-medium">Lease Status</th>
                <th className="text-left p-3 font-medium">Rent Range</th>
                <th className="text-left p-3 font-medium">Management</th>
                <th className="text-left p-3 font-medium">Partner</th>
              </tr>
            </thead>
            <tbody>
              {data?.properties?.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-muted/30" data-testid={`row-property-${p.id}`}>
                  <td className="p-3 font-medium">{p.propertyName}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.address}</td>
                  <td className="p-3">{p.unitCount || "—"}</td>
                  <td className="p-3"><StatusBadge status={p.leaseUpStatus || "unknown"} type="leaseUp" /></td>
                  <td className="p-3 text-muted-foreground">{p.rentLow && p.rentHigh ? `$${p.rentLow}-$${p.rentHigh}` : "—"}</td>
                  <td className="p-3 text-xs">{p.managementCompany || "—"}</td>
                  <td className="p-3">
                    <Select value={p.partnerStatus || "uncontacted"} onValueChange={(v) => statusMutation.mutate({ id: p.id, partnerStatus: v })}>
                      <SelectTrigger className="w-[130px] h-8 text-xs" data-testid={`select-partner-${p.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncontacted">Uncontacted</SelectItem>
                        <SelectItem value="attempted">Attempted</SelectItem>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="partnered">Partnered</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {(!data?.properties || data.properties.length === 0) && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No properties yet. Import data to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SignalsTab({ cityId }: { cityId?: string }) {
  const [signalFilter, setSignalFilter] = useState("all");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/signals", cityId, signalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (signalFilter !== "all") params.set("signalType", signalFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/intelligence/signals?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={signalFilter} onValueChange={setSignalFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-signal-filter"><SelectValue placeholder="Signal Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Signals</SelectItem>
            <SelectItem value="business_filing">Business Filing</SelectItem>
            <SelectItem value="multifamily">Multifamily</SelectItem>
            <SelectItem value="language_spike">Language Spike</SelectItem>
            <SelectItem value="search_spike">Search Spike</SelectItem>
            <SelectItem value="permit">Permit</SelectItem>
            <SelectItem value="zoning">Zoning</SelectItem>
            <SelectItem value="vacancy">Vacancy</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" asChild data-testid="btn-export-signals">
          <a href={`/api/admin/intelligence/export/signals.csv?${signalFilter !== "all" ? `signalType=${signalFilter}` : ""}`} download><Download className="w-4 h-4 mr-1" /> Export</a>
        </Button>
        <div className="text-sm text-muted-foreground ml-auto">{data?.total || 0} signals</div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-2">
          {data?.signals?.map((s: any) => (
            <Card key={s.id} className="p-3" data-testid={`card-signal-${s.id}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={s.signalType} type="signal" />
                    <span className="text-xs text-muted-foreground">{s.signalDate || new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-medium text-sm">{s.title}</h4>
                  {s.summary && <p className="text-xs text-muted-foreground mt-1">{s.summary}</p>}
                </div>
                {s.score > 0 && (
                  <Badge variant="secondary" className="text-xs">Score: {s.score}</Badge>
                )}
              </div>
            </Card>
          ))}
          {(!data?.signals || data.signals.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">No signals yet. Import data to generate signals.</div>
          )}
        </div>
      )}
    </div>
  );
}

function LanguageTab({ cityId }: { cityId?: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/language-stats", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/language-stats?${p}`, { credentials: "include" });
      return res.json();
    },
  });

  const enCount = data?.byLanguage?.find((l: any) => l.language === "en")?.count || 0;
  const esCount = data?.byLanguage?.find((l: any) => l.language === "es")?.count || 0;
  const totalEvents = Number(data?.total || 0);

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-stat-total">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{totalEvents}</div>
                <div className="text-xs text-muted-foreground">Total Events</div>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-en">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{enCount}</div>
                <div className="text-xs text-muted-foreground">English (EN)</div>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-es">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{esCount}</div>
                <div className="text-xs text-muted-foreground">Spanish (ES)</div>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-ratio">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{totalEvents > 0 ? Math.round((Number(esCount) / totalEvents) * 100) : 0}%</div>
                <div className="text-xs text-muted-foreground">ES Usage %</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">By Event Type</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.byEventType?.length > 0 ? (
                  <div className="space-y-2">
                    {data.byEventType.map((e: any) => (
                      <div key={e.eventType} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{e.eventType.replace(/_/g, " ")}</span>
                        <Badge variant="secondary">{e.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No events recorded yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Search Queries</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.topSearches?.length > 0 ? (
                  <div className="space-y-2">
                    {data.topSearches.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="truncate mr-2">{s.queryText}</span>
                        <Badge variant="secondary">{s.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No searches recorded yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {data?.byZone?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Activity by ZIP Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {data.byZone.map((z: any) => (
                    <div key={z.zoneId} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                      <span className="text-xs truncate">{z.zoneId?.substring(0, 8)}...</span>
                      <Badge variant="secondary" className="text-xs">{z.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SourcesTab({ cityId }: { cityId?: string }) {
  const [selectedCity, setSelectedCity] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editSource, setEditSource] = useState<any | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: allCities } = useQuery<any[]>({ queryKey: ["/api/cities"] });

  const effectiveCityFilter = selectedCity !== "all" ? selectedCity : cityId;
  const { data: sources, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/sources", effectiveCityFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (effectiveCityFilter) p.set("cityId", effectiveCityFilter);
      const qs = p.toString();
      const res = await fetch(`/api/admin/intelligence/sources${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to load sources");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/admin/intelligence/sources/${id}`, { enabled });
    },
    onSuccess: () => { refetch(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/intelligence/sources/${id}`);
    },
    onSuccess: () => { refetch(); toast({ title: "Source deleted" }); },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const runMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", "/api/admin/intelligence/run-pulls", { sourceId });
      return res.json();
    },
    onSuccess: (data) => {
      const r = data.results?.[0];
      toast({
        title: "Pull Complete",
        description: r?.error
          ? `Error: ${r.error}`
          : `Fetched ${r?.rowsFetched || 0}, Inserted ${r?.rowsInserted || 0}, Updated ${r?.rowsUpdated || 0}`,
      });
      refetch();
    },
    onError: (err: any) => toast({ title: "Pull failed", description: err.message, variant: "destructive" }),
  });

  const sourceStatusColor: Record<string, string> = {
    OK: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    ERROR: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    DISABLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    NEVER_RUN: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  };

  const sourceTypeColor: Record<string, string> = {
    SOCRATA: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    ARCGIS: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    CENSUS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    BLS: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    DOT: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="w-[200px]" data-testid="select-source-city">
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {allCities?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} data-testid="btn-add-source">
          <Plus className="w-4 h-4 mr-1" /> Add Source
        </Button>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-sources">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading sources...</div>
      ) : !sources?.length ? (
        <div className="text-center py-8 text-muted-foreground">No sources configured. Add one to get started.</div>
      ) : (
        <div className="space-y-3">
          {sources.map((src: any) => (
            <Card key={src.id} className="overflow-hidden" data-testid={`card-source-${src.id}`}>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Switch
                      checked={src.enabled}
                      onCheckedChange={(val) => toggleMutation.mutate({ id: src.id, enabled: val })}
                      data-testid={`switch-enabled-${src.id}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate" data-testid={`text-source-name-${src.id}`}>{src.name}</span>
                        <Badge className={`text-xs ${sourceTypeColor[src.sourceType] || ""}`}>{src.sourceType}</Badge>
                        <Badge className={`text-xs ${sourceStatusColor[src.status] || ""}`}>{src.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {src.baseUrl || src.layerUrl || "No URL configured"}
                        {src.datasetId && ` · ${src.datasetId}`}
                        {" · "}{src.pullFrequency}
                      </div>
                      {src.lastPulledAt && (
                        <div className="text-xs text-muted-foreground">
                          Last pull: {new Date(src.lastPulledAt).toLocaleString()}
                        </div>
                      )}
                      {src.lastError && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                          Error: {src.lastError}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runMutation.mutate(src.id)}
                      disabled={runMutation.isPending}
                      title="Run now"
                      data-testid={`btn-run-${src.id}`}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRuns(expandedRuns === src.id ? null : src.id)}
                      title="Run history"
                      data-testid={`btn-history-${src.id}`}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewRows(previewRows === src.id ? null : src.id)}
                      title="Preview rows"
                      data-testid={`btn-preview-${src.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditSource(src)}
                      title="Edit"
                      data-testid={`btn-edit-${src.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { if (confirm("Delete this source and all its data?")) deleteMutation.mutate(src.id); }}
                      title="Delete"
                      data-testid={`btn-delete-${src.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>

              {expandedRuns === src.id && <RunHistory sourceId={src.id} />}
              {previewRows === src.id && <RawRowsPreview sourceId={src.id} />}
            </Card>
          ))}
        </div>
      )}

      {(showAddDialog || editSource) && (
        <SourceFormDialog
          source={editSource}
          cities={allCities || []}
          onClose={() => { setShowAddDialog(false); setEditSource(null); }}
          onSaved={() => { setShowAddDialog(false); setEditSource(null); refetch(); }}
        />
      )}
    </div>
  );
}

function RunHistory({ sourceId }: { sourceId: string }) {
  const { data: runs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/sources", sourceId, "runs"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/sources/${sourceId}/runs?limit=10`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load runs");
      return res.json();
    },
  });

  if (isLoading) return <div className="px-4 pb-4 text-xs text-muted-foreground">Loading runs...</div>;
  if (!runs?.length) return <div className="px-4 pb-4 text-xs text-muted-foreground">No pull runs yet</div>;

  const runStatusColor: Record<string, string> = {
    SUCCESS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    FAILED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    SKIPPED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div className="border-t px-4 pb-4 pt-3">
      <h4 className="text-xs font-semibold mb-2">Recent Pull Runs</h4>
      <div className="space-y-1">
        {runs.map((run: any) => (
          <div key={run.id} className="flex items-center gap-2 text-xs" data-testid={`row-run-${run.id}`}>
            <Badge className={`text-[10px] ${runStatusColor[run.status] || ""}`}>{run.status}</Badge>
            <span>{new Date(run.startedAt).toLocaleString()}</span>
            <span className="text-muted-foreground">
              F:{run.rowsFetched} I:{run.rowsInserted} U:{run.rowsUpdated}
            </span>
            {run.errorMessage && (
              <span className="text-red-500 truncate max-w-[200px]">{run.errorMessage}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RawRowsPreview({ sourceId }: { sourceId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/sources", sourceId, "rows"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/sources/${sourceId}/rows?limit=20`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load rows");
      return res.json();
    },
  });

  if (isLoading) return <div className="px-4 pb-4 text-xs text-muted-foreground">Loading rows...</div>;
  if (!data?.rows?.length) return <div className="px-4 pb-4 text-xs text-muted-foreground">No raw rows stored</div>;

  return (
    <div className="border-t px-4 pb-4 pt-3">
      <h4 className="text-xs font-semibold mb-2">Raw Rows ({data.total} total, showing {data.rows.length})</h4>
      <div className="max-h-[300px] overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 pr-2">External ID</th>
              <th className="pb-1 pr-2">ZIP</th>
              <th className="pb-1 pr-2">Timestamp</th>
              <th className="pb-1">Payload Preview</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: any) => (
              <tr key={row.id} className="border-t border-border/50" data-testid={`row-raw-${row.id}`}>
                <td className="py-1 pr-2 font-mono">{row.externalId || "—"}</td>
                <td className="py-1 pr-2">{row.zipCode || "—"}</td>
                <td className="py-1 pr-2">{row.recordTimestamp ? new Date(row.recordTimestamp).toLocaleDateString() : "—"}</td>
                <td className="py-1 max-w-[300px] truncate font-mono text-[10px]">
                  {JSON.stringify(row.payloadJson).slice(0, 120)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceFormDialog({
  source,
  cities,
  onClose,
  onSaved,
}: {
  source: any | null;
  cities: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!source;
  const [name, setName] = useState(source?.name || "");
  const [cityId, setCityId] = useState(source?.cityId || "");
  const [sourceType, setSourceType] = useState(source?.sourceType || "SOCRATA");
  const [baseUrl, setBaseUrl] = useState(source?.baseUrl || "");
  const [datasetId, setDatasetId] = useState(source?.datasetId || "");
  const [layerUrl, setLayerUrl] = useState(source?.layerUrl || "");
  const [pullFrequency, setPullFrequency] = useState(source?.pullFrequency || "DAILY");
  const [paramsJsonStr, setParamsJsonStr] = useState(
    source?.paramsJson ? JSON.stringify(source.paramsJson, null, 2) : "{}"
  );
  const [enabled, setEnabled] = useState(source?.enabled || false);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsedParams: any = {};
      try { parsedParams = JSON.parse(paramsJsonStr); } catch { throw new Error("Invalid JSON in params"); }

      const body = { name, cityId, sourceType, baseUrl, datasetId, layerUrl, pullFrequency, paramsJson: parsedParams, enabled };

      if (isEdit) {
        await apiRequest("PATCH", `/api/admin/intelligence/sources/${source.id}`, body);
      } else {
        await apiRequest("POST", "/api/admin/intelligence/sources", body);
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Source updated" : "Source created" });
      onSaved();
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Source" : "Add Source"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Charlotte Open Data - Permits" data-testid="input-source-name" />
          </div>
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <Select value={cityId} onValueChange={setCityId}>
                <SelectTrigger data-testid="select-source-city-form"><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  {cities.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Source Type</label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger data-testid="select-source-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOCRATA">Socrata</SelectItem>
                  <SelectItem value="ARCGIS">ArcGIS</SelectItem>
                  <SelectItem value="CENSUS">Census</SelectItem>
                  <SelectItem value="BLS">BLS</SelectItem>
                  <SelectItem value="DOT">DOT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pull Frequency</label>
              <Select value={pullFrequency} onValueChange={setPullFrequency}>
                <SelectTrigger data-testid="select-pull-frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Base URL</label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://data.charlottenc.gov" data-testid="input-base-url" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Dataset ID</label>
              <Input value={datasetId} onChange={(e) => setDatasetId(e.target.value)} placeholder="xxxx-yyyy" data-testid="input-dataset-id" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Layer URL</label>
              <Input value={layerUrl} onChange={(e) => setLayerUrl(e.target.value)} placeholder="ArcGIS FeatureServer URL" data-testid="input-layer-url" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Params JSON</label>
            <Textarea
              value={paramsJsonStr}
              onChange={(e) => setParamsJsonStr(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder='{"dateField": "date", "zipField": "zip_code"}'
              data-testid="textarea-params-json"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="switch-source-enabled" />
            <label className="text-sm">Enabled</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} data-testid="btn-cancel-source">Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name} data-testid="btn-save-source">
              {saveMutation.isPending ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ADMIN_BUCKET_CONFIG: Record<string, { label: string; color: string }> = {
  CONTACT_READY_NO_WEBSITE: { label: "No Website, Contact Ready", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  STOREFRONT_WALKIN_READY: { label: "Walk-in Ready", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  DEMAND_PRESENT_NOT_VERIFIED: { label: "Demand Already Here", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  DATA_INCONSISTENT: { label: "Fix Public Info", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  WEBSITE_DEGRADED: { label: "Broken Website", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  DIGITAL_GAP_HIGH: { label: "Digital Gap", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  CONVERSION_GAP: { label: "Conversion Gap", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  HIGH_ACTIVITY: { label: "High Activity", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
};

function SalesBucketsTab({ cityId }: { cityId?: string }) {
  const [bucketFilter, setBucketFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/sales-buckets/stats", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/sales-buckets/stats?${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: entityData, isLoading: entitiesLoading, refetch: refetchEntities } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/sales-buckets/entities", cityId, bucketFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (bucketFilter !== "ALL") params.set("bucket", bucketFilter);
      if (search) params.set("search", search);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/intelligence/sales-buckets/entities?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/sales-buckets/recompute", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Sales Buckets Recomputed", description: `${data.buckets?.bucketsAssigned ?? 0} bucket assignments, ${data.engagement?.computed ?? 0} engagement stats` });
      refetchStats();
      refetchEntities();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const distribution: any[] = stats?.bucketDistribution ?? [];
  const totalBucketed = stats?.totalBucketedEntities ?? 0;
  const entities: any[] = entityData?.data ?? [];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold" data-testid="text-sales-buckets-title">Sales Buckets</h3>
          <p className="text-xs text-muted-foreground">{totalBucketed} entities with bucket assignments</p>
        </div>
        <Button
          size="sm"
          onClick={() => recomputeMutation.mutate()}
          disabled={recomputeMutation.isPending}
          data-testid="btn-recompute-buckets"
        >
          {recomputeMutation.isPending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Recompute Now
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {distribution.map((d: any) => {
          const cfg = ADMIN_BUCKET_CONFIG[d.bucket] || { label: d.bucket, color: "bg-gray-100 text-gray-800" };
          return (
            <Card key={d.bucket} className="cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => setBucketFilter(d.bucket)} data-testid={`card-bucket-stat-${d.bucket.toLowerCase()}`}>
              <CardContent className="py-3 px-4">
                <Badge className={`${cfg.color} text-[10px] mb-1`}>{cfg.label}</Badge>
                <p className="text-xl font-bold">{d.count}</p>
                <p className="text-[10px] text-muted-foreground">Avg priority: {d.avg_priority}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {distribution.length === 0 && !statsLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No sales buckets computed yet.</p>
            <p className="text-xs mt-1">Run the pipeline or click "Recompute Now" to generate buckets.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="w-[220px] h-8 text-xs" data-testid="select-bucket-filter">
            <SelectValue placeholder="Filter by bucket" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Buckets</SelectItem>
            {Object.entries(ADMIN_BUCKET_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="pl-9 h-8 text-xs"
            data-testid="input-bucket-search"
          />
        </div>
      </div>

      {entitiesLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}</div>
      ) : entities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-bucket-entities">No entities match the current filter.</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {entities.map((e: any) => {
            const cfg = ADMIN_BUCKET_CONFIG[e.bucket] || { label: e.bucket, color: "bg-gray-100 text-gray-800" };
            return (
              <div key={`${e.entity_id}-${e.bucket}`} className="p-3 flex items-center justify-between gap-3" data-testid={`row-bucket-entity-${e.entity_id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{e.name}</p>
                    <Badge className={`${cfg.color} text-[10px] shrink-0`}>{cfg.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    {e.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {e.phone}</span>}
                    {e.website_url && <span className="flex items-center gap-0.5"><Globe className="h-3 w-3" /> Website</span>}
                    {!e.website_url && <Badge variant="destructive" className="text-[10px]">No Website</Badge>}
                    {e.recommended_method && <Badge variant="secondary" className="text-[10px]">{e.recommended_method.replace(/_/g, " ")}</Badge>}
                  </div>
                  {e.reasons_json && Array.isArray(e.reasons_json) && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {e.reasons_json.slice(0, 4).map((r: string, i: number) => (
                        <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-primary" data-testid={`text-bucket-priority-${e.entity_id}`}>{e.priority_score}</p>
                  <p className="text-[10px] text-muted-foreground">priority</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DIR_BUCKET_CONFIG: Record<string, { label: string; color: string }> = {
  MICRO_LICENSE_TARGET: { label: "Micro License Target", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  PARTNER_TARGET: { label: "Partner Target", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  IGNORE: { label: "Ignore", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
};

const NICHE_OPTIONS = ["PETS", "FOOD", "SENIOR", "HOME_SERVICES", "MULTIFAMILY", "EVENTS", "NEIGHBORHOODS", "NIGHTLIFE", "ARTS_CULTURE", "WELLNESS", "FAMILY_KIDS"];

function MicroProspectsTab({ cityId }: { cityId?: string }) {
  const [bucketFilter, setBucketFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState("ALL");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/directory-prospects/stats", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/directory-prospects/stats?${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: entityData, isLoading: entitiesLoading, refetch: refetchEntities } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/directory-prospects", cityId, bucketFilter, statusFilter, search, nicheFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (bucketFilter !== "ALL") params.set("bucket", bucketFilter);
      if (statusFilter !== "ALL") params.set("crawl_status", statusFilter);
      if (search) params.set("search", search);
      if (nicheFilter !== "ALL") params.set("niche", nicheFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/intelligence/directory-prospects?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/directory-prospects/generate", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Candidates Generated", description: `${data.generated} new candidates, ${data.skipped} already existed` });
      refetchStats();
      refetchEntities();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const crawlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/intelligence/directory-prospects/crawl", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Crawl Complete", description: `${data.crawled} crawled: ${data.succeeded} succeeded, ${data.failed} failed, ${data.blocked} blocked` });
      refetchStats();
      refetchEntities();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/intelligence/directory-prospects/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      refetchEntities();
      setEditingNotes(null);
      setFollowUpId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const recrawlMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/intelligence/directory-prospects/${id}/recrawl`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Re-crawl Complete", description: `Score: ${data.score}` });
      refetchEntities();
      refetchStats();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bucketDist: any[] = stats?.bucketDistribution ?? [];
  const crawlStatus: any[] = stats?.crawlStatusBreakdown ?? [];
  const totalProspects = stats?.totalProspects ?? 0;
  const prospects: any[] = entityData?.data ?? [];

  const toggleEvidence = (id: string) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold" data-testid="text-micro-prospects-title">Micro License Prospects</h3>
          <p className="text-xs text-muted-foreground">{totalProspects} directory/collector sites discovered</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="btn-generate-candidates"
          >
            {generateMutation.isPending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Generate Candidates
          </Button>
          <Button
            size="sm"
            onClick={() => crawlMutation.mutate()}
            disabled={crawlMutation.isPending}
            data-testid="btn-run-directory-crawl"
          >
            {crawlMutation.isPending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            Run Crawler
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold" data-testid="text-total-prospects">{totalProspects}</p>
          </CardContent>
        </Card>
        {bucketDist.map((d: any) => {
          const cfg = DIR_BUCKET_CONFIG[d.bucket] || { label: d.bucket, color: "bg-gray-100" };
          return (
            <Card key={d.bucket} className="cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => setBucketFilter(d.bucket)}>
              <CardContent className="py-3 px-4">
                <Badge className={`${cfg.color} text-[10px] mb-1`}>{cfg.label}</Badge>
                <p className="text-xl font-bold">{d.count}</p>
                <p className="text-[10px] text-muted-foreground">Avg score: {d.avg_score}</p>
              </CardContent>
            </Card>
          );
        })}
        {crawlStatus.map((s: any) => (
          <Card key={s.crawl_status} className="cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => setStatusFilter(s.crawl_status)}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">{s.crawl_status}</p>
              <p className="text-xl font-bold">{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalProspects === 0 && !statsLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No directory prospects yet.</p>
            <p className="text-xs mt-1">Click "Generate Candidates" to scan existing entities for directory-like sites.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-dir-bucket-filter">
            <SelectValue placeholder="Bucket" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Buckets</SelectItem>
            {Object.entries(DIR_BUCKET_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-dir-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={nicheFilter} onValueChange={setNicheFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-dir-niche-filter">
            <SelectValue placeholder="Niche" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Niches</SelectItem>
            {NICHE_OPTIONS.map(n => <SelectItem key={n} value={n}>{n.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain or name..."
            className="pl-9 h-8 text-xs"
            data-testid="input-dir-search"
          />
        </div>
      </div>

      {entitiesLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded" />)}</div>
      ) : prospects.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-dir-prospects">No prospects match the current filter.</p>
      ) : (
        <div className="space-y-3">
          {prospects.map((p: any) => {
            const cfg = DIR_BUCKET_CONFIG[p.bucket] || { label: p.bucket, color: "bg-gray-100 text-gray-800" };
            const nicheTags: any[] = p.niche_tags_json || [];
            const territory = p.territory_json || {};
            const monetization: string[] = p.monetization_signals_json || [];
            const contact = p.contact_methods_json || {};
            const evidence: string[] = p.evidence_json || [];
            const isExpanded = expandedEvidence.has(p.id);

            return (
              <Card key={p.id} data-testid={`card-dir-prospect-${p.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={`https://${p.root_domain}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm text-primary hover:underline truncate" data-testid={`link-domain-${p.id}`}>
                          {p.root_domain}
                        </a>
                        <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.crawl_status}</Badge>
                      </div>
                      {p.entity_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">Entity: {p.entity_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-primary" data-testid={`text-dir-score-${p.id}`}>{p.directory_score}</p>
                      <p className="text-[10px] text-muted-foreground">score</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {nicheTags.map((t: any) => (
                      <Badge key={t.tag} variant="secondary" className="text-[10px]">
                        {t.tag?.replace(/_/g, " ")} ({t.confidence})
                      </Badge>
                    ))}
                    {monetization.map((m: string, i: number) => (
                      <Badge key={i} className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                        {m}
                      </Badge>
                    ))}
                  </div>

                  {(territory.cities?.length > 0 || territory.neighborhoods?.length > 0 || territory.zips?.length > 0) && (
                    <p className="text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 inline mr-0.5" />
                      {[...(territory.cities || []), ...(territory.neighborhoods || []).slice(0, 3)].join(", ")}
                      {territory.zips?.length > 0 && ` (${territory.zips.length} zips)`}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {contact.emails?.length > 0 && (
                      <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" /> {contact.emails[0]}</span>
                    )}
                    {contact.phones?.length > 0 && (
                      <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {contact.phones[0]}</span>
                    )}
                    {contact.contactFormUrl && (
                      <span className="flex items-center gap-0.5"><Globe className="h-3 w-3" /> Form</span>
                    )}
                    {Object.keys(contact.socials || {}).length > 0 && (
                      <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {Object.keys(contact.socials).join(", ")}</span>
                    )}
                  </div>

                  {p.contacted_at && (
                    <p className="text-[10px] text-muted-foreground">Contacted: {new Date(p.contacted_at).toLocaleDateString()}</p>
                  )}
                  {p.follow_up_at && (
                    <p className="text-[10px] text-muted-foreground">Follow-up: {new Date(p.follow_up_at).toLocaleDateString()}</p>
                  )}
                  {p.notes && (
                    <p className="text-xs bg-muted/50 p-2 rounded">{p.notes}</p>
                  )}

                  {evidence.length > 0 && (
                    <div>
                      <button onClick={() => toggleEvidence(p.id)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5" data-testid={`btn-evidence-${p.id}`}>
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {evidence.length} evidence items
                      </button>
                      {isExpanded && (
                        <div className="mt-1 space-y-0.5">
                          {evidence.map((e: string, i: number) => (
                            <p key={i} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{e}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => updateMutation.mutate({ id: p.id, body: { contacted_at: new Date().toISOString() } })}
                      disabled={updateMutation.isPending}
                      data-testid={`btn-mark-contacted-${p.id}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Mark Contacted
                    </Button>
                    {editingNotes === p.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="h-7 text-xs w-40"
                          placeholder="Add notes..."
                          data-testid={`input-notes-${p.id}`}
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { updateMutation.mutate({ id: p.id, body: { notes: noteText } }); }}
                        >Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNotes(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setEditingNotes(p.id); setNoteText(p.notes || ""); }}
                        data-testid={`btn-add-notes-${p.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" /> Notes
                      </Button>
                    )}
                    {followUpId === p.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="h-7 text-xs w-36"
                          data-testid={`input-followup-${p.id}`}
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { updateMutation.mutate({ id: p.id, body: { follow_up_at: followUpDate } }); setFollowUpId(null); }}
                        >Set</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFollowUpId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setFollowUpId(p.id); setFollowUpDate(""); }}
                        data-testid={`btn-followup-${p.id}`}
                      >
                        Follow-up
                      </Button>
                    )}
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => recrawlMutation.mutate(p.id)}
                      disabled={recrawlMutation.isPending}
                      data-testid={`btn-recrawl-${p.id}`}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Re-crawl
                    </Button>
                    <Select value={p.bucket} onValueChange={(val) => updateMutation.mutate({ id: p.id, body: { bucket: val } })}>
                      <SelectTrigger className="h-7 text-xs w-[160px]" data-testid={`select-bucket-${p.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DIR_BUCKET_CONFIG).map(([key, cfg2]) => (
                          <SelectItem key={key} value={key}>{cfg2.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

export default function IntelligencePanel({ defaultTab, cityId }: { defaultTab?: string; cityId?: string } = {}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold" data-testid="text-intelligence-title">Metro Intelligence Engine</h2>
          <p className="text-sm text-muted-foreground">Silent aggregation mode — internal data collection and analysis</p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab || "filings"} className="w-full">
        <TabsList className="w-full justify-start" data-testid="tabs-intelligence">
          <TabsTrigger value="filings" className="flex items-center gap-1" data-testid="tab-filings">
            <FileText className="w-4 h-4" /> Business Filings
          </TabsTrigger>
          <TabsTrigger value="multifamily" className="flex items-center gap-1" data-testid="tab-multifamily">
            <Home className="w-4 h-4" /> Multifamily
          </TabsTrigger>
          <TabsTrigger value="signals" className="flex items-center gap-1" data-testid="tab-signals">
            <Radio className="w-4 h-4" /> Signals Feed
          </TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-1" data-testid="tab-language">
            <Globe className="w-4 h-4" /> Language & Demand
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-1" data-testid="tab-sources">
            <Plug className="w-4 h-4" /> Sources
          </TabsTrigger>
          <TabsTrigger value="rss-review" className="flex items-center gap-1" data-testid="tab-rss-review">
            <Newspaper className="w-4 h-4" /> RSS Review
          </TabsTrigger>
          <TabsTrigger value="editorial" className="flex items-center gap-1" data-testid="tab-editorial">
            <Edit className="w-4 h-4" /> Editorial Control
          </TabsTrigger>
          <TabsTrigger value="review-queue" className="flex items-center gap-1" data-testid="tab-review-queue">
            <AlertTriangle className="w-4 h-4" /> Review Queue
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-1" data-testid="tab-campaigns">
            <Megaphone className="w-4 h-4" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="crawl-scoring" className="flex items-center gap-1" data-testid="tab-crawl-scoring">
            <Search className="w-4 h-4" /> Crawl & Scoring
          </TabsTrigger>
          <TabsTrigger value="industry-tags" className="flex items-center gap-1" data-testid="tab-industry-tags">
            <Tags className="w-4 h-4" /> Industry Tags
          </TabsTrigger>
          <TabsTrigger value="sales-buckets" className="flex items-center gap-1" data-testid="tab-sales-buckets">
            <Target className="w-4 h-4" /> Sales Buckets
          </TabsTrigger>
          <TabsTrigger value="micro-prospects" className="flex items-center gap-1" data-testid="tab-micro-prospects">
            <Search className="w-4 h-4" /> Micro Prospects
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-1" data-testid="tab-report">
            <Activity className="w-4 h-4" /> Intelligence Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filings"><FilingsTab cityId={cityId} /></TabsContent>
        <TabsContent value="multifamily"><MultifamilyTab cityId={cityId} /></TabsContent>
        <TabsContent value="signals"><SignalsTab cityId={cityId} /></TabsContent>
        <TabsContent value="language"><LanguageTab cityId={cityId} /></TabsContent>
        <TabsContent value="sources"><SourcesTab cityId={cityId} /></TabsContent>
        <TabsContent value="rss-review"><RssReviewTab cityId={cityId} /></TabsContent>
        <TabsContent value="editorial"><EditorialControlTab cityId={cityId} /></TabsContent>
        <TabsContent value="review-queue"><ReviewQueueTab cityId={cityId} /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab cityId={cityId} /></TabsContent>
        <TabsContent value="crawl-scoring"><CrawlScoringTab cityId={cityId} /></TabsContent>
        <TabsContent value="industry-tags"><IndustryTagsTab cityId={cityId} /></TabsContent>
        <TabsContent value="sales-buckets"><SalesBucketsTab cityId={cityId} /></TabsContent>
        <TabsContent value="micro-prospects"><MicroProspectsTab cityId={cityId} /></TabsContent>
        <TabsContent value="report"><IntelligenceReportTab cityId={cityId} /></TabsContent>
      </Tabs>
    </div>
  );
}
