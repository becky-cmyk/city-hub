import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Search, MapPin, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ImportJob {
  id: string;
  mode: string;
  areaMode: string | null;
  zipCode: string | null;
  queryText: string | null;
  categoryKeyword: string | null;
  centerLat: string | null;
  centerLng: string | null;
  radiusMeters: number | null;
  resolvedAreaLabel: string | null;
  requestedCount: number;
  importedCount: number;
  status: string;
  createdAt: string;
}

interface ImportResult {
  id: string;
  placeId: string;
  name: string;
  formattedAddress: string | null;
  primaryType: string | null;
  status: string;
  presenceId: number | null;
}

interface DailyUsage {
  textSearchCount: number;
  textSearchLimit: number;
  detailsCount: number;
  detailsLimit: number;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    queued: "secondary",
    running: "default",
    completed: "outline",
    failed: "destructive",
    discovered: "secondary",
    imported: "default",
    skipped: "outline",
  };
  return <Badge variant={variants[status] || "outline"} data-testid={`badge-status-${status}`}>{status}</Badge>;
}

function JobResultsPanel({ jobId }: { jobId: string }) {
  const { data: results, isLoading } = useQuery<ImportResult[]>({
    queryKey: ["/api/admin/places/import-jobs", jobId, "results"],
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!results || results.length === 0) return <p className="text-sm text-muted-foreground py-2">No results yet</p>;

  return (
    <div className="space-y-1 max-h-60 overflow-y-auto" data-testid={`results-list-${jobId}`}>
      {results.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate" data-testid={`text-result-name-${r.id}`}>{r.name}</p>
            <p className="text-xs text-muted-foreground truncate">{r.formattedAddress}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {r.primaryType && <span className="text-xs text-muted-foreground">{r.primaryType}</span>}
            <StatusBadge status={r.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function JobCard({ job }: { job: ImportJob }) {
  const [expanded, setExpanded] = useState(false);

  const icon = job.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
    job.status === "failed" ? <XCircle className="h-4 w-4 text-red-500" /> :
    job.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> :
    <Clock className="h-4 w-4 text-muted-foreground" />;

  return (
    <Card className="p-4 space-y-2" data-testid={`card-job-${job.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {icon}
            <span className="text-sm font-semibold">
              {job.mode === "text_search" ? `"${job.queryText}"` : job.categoryKeyword || "Nearby search"}
            </span>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {job.resolvedAreaLabel && <span>{job.resolvedAreaLabel}</span>}
            <span>{job.importedCount}/{job.requestedCount} imported</span>
            <span>{new Date(job.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} data-testid={`button-expand-${job.id}`}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      {expanded && <JobResultsPanel jobId={job.id} />}
    </Card>
  );
}

export default function PlacesImportPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"text_search" | "nearby_search">("text_search");
  const [areaMode, setAreaMode] = useState<"zip" | "manual" | "clt_default">("clt_default");
  const [queryText, setQueryText] = useState("");
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("5000");
  const [requestedCount, setRequestedCount] = useState("20");

  const { data: usage } = useQuery<DailyUsage>({
    queryKey: ["/api/admin/places/usage", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/places/usage?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load usage");
      return res.json();
    },
  });
  const { data: jobs, isLoading: jobsLoading } = useQuery<ImportJob[]>({
    queryKey: ["/api/admin/places/import-jobs", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/places/import-jobs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load import jobs");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        mode,
        areaMode,
        requestedCount: parseInt(requestedCount) || 20,
      };
      if (mode === "text_search") body.queryText = queryText;
      if (mode === "nearby_search") body.categoryKeyword = categoryKeyword;
      if (areaMode === "zip") body.zipCode = zipCode;
      if (areaMode === "manual") {
        body.centerLat = centerLat;
        body.centerLng = centerLng;
        body.radiusMeters = parseInt(radiusMeters) || 5000;
      }
      await apiRequest("POST", "/api/admin/places/import-jobs", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/places/import-jobs"] });
      toast({ title: "Import job started" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to start import", description: e.message, variant: "destructive" });
    },
  });

  const canSubmit = mode === "text_search" ? queryText.trim().length > 0 :
    (areaMode === "manual" ? centerLat && centerLng : true);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-places-import-title">
          <MapPin className="h-5 w-5" />
          Google Places Import
        </h2>
        <p className="text-sm text-muted-foreground">Discover and import local businesses from Google Places</p>
      </div>

      {usage && (
        <div className="flex gap-4 flex-wrap" data-testid="usage-stats">
          <Card className="p-3 flex-1 min-w-[160px]">
            <p className="text-xs text-muted-foreground mb-1">Text Searches Today</p>
            <p className="text-lg font-bold">{usage.textSearchCount} / {usage.textSearchLimit}</p>
          </Card>
          <Card className="p-3 flex-1 min-w-[160px]">
            <p className="text-xs text-muted-foreground mb-1">Detail Lookups Today</p>
            <p className="text-lg font-bold">{usage.detailsCount} / {usage.detailsLimit}</p>
          </Card>
        </div>
      )}

      <Card className="p-4 space-y-4" data-testid="import-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Search Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger data-testid="select-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text_search">Text Search</SelectItem>
                <SelectItem value="nearby_search">Nearby Search</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <Select value={areaMode} onValueChange={(v) => setAreaMode(v as any)}>
              <SelectTrigger data-testid="select-area-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clt_default">Charlotte (default)</SelectItem>
                <SelectItem value="zip">ZIP Code</SelectItem>
                <SelectItem value="manual">Manual Coords</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "text_search" && (
          <div className="space-y-2">
            <Label>Search Query</Label>
            <Input
              placeholder='e.g. "coffee shops in [your city]"'
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              data-testid="input-query-text"
            />
          </div>
        )}

        {mode === "nearby_search" && (
          <div className="space-y-2">
            <Label>Category Keyword</Label>
            <Input
              placeholder='e.g. "restaurant", "gym", "salon"'
              value={categoryKeyword}
              onChange={(e) => setCategoryKeyword(e.target.value)}
              data-testid="input-category-keyword"
            />
          </div>
        )}

        {areaMode === "zip" && (
          <div className="space-y-2">
            <Label>ZIP Code</Label>
            <Input
              placeholder="28202"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              data-testid="input-zip-code"
            />
          </div>
        )}

        {areaMode === "manual" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input placeholder="35.2271" value={centerLat} onChange={(e) => setCenterLat(e.target.value)} data-testid="input-center-lat" />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input placeholder="-80.8431" value={centerLng} onChange={(e) => setCenterLng(e.target.value)} data-testid="input-center-lng" />
            </div>
            <div className="space-y-2">
              <Label>Radius (m)</Label>
              <Input placeholder="5000" value={radiusMeters} onChange={(e) => setRadiusMeters(e.target.value)} data-testid="input-radius" />
            </div>
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="space-y-2">
            <Label>Max Results</Label>
            <Input
              type="number"
              min="1"
              max="60"
              value={requestedCount}
              onChange={(e) => setRequestedCount(e.target.value)}
              className="w-24"
              data-testid="input-requested-count"
            />
          </div>
          <Button
            onClick={() => createJobMutation.mutate()}
            disabled={!canSubmit || createJobMutation.isPending}
            data-testid="button-start-import"
          >
            {createJobMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Start Import
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold text-sm" data-testid="text-job-history-title">Import History</h3>
        {jobsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <Card className="p-8 text-center" data-testid="empty-jobs">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No import jobs yet. Start one above.</p>
          </Card>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
