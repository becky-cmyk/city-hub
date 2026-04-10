import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search, Camera, Link, Rss, FileDown, Check, X, Trash2,
  RefreshCw, Upload, Globe, MapPin, AlertCircle, Loader2, Zap, FileSpreadsheet
} from "lucide-react";
import { useState, useRef, createContext, useContext } from "react";
import { Link as WouterLink } from "wouter";
import { useAdminCitySelection } from "@/hooks/use-city";

const CityIdContext = createContext<string>("");

export default function ContentIntake({ cityId: propCityId }: { cityId?: string }) {
  const { selectedCityId, selectedCitySlug } = useAdminCitySelection();
  const CITY_SLUG = selectedCitySlug;
  const { data: city } = useQuery<{ id: string }>({ queryKey: ["/api/cities", CITY_SLUG], enabled: !!CITY_SLUG });
  const cityId = propCityId || selectedCityId || city?.id || "";

  if (!cityId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <CityIdContext.Provider value={cityId}>
      <ContentIntakeInner />
    </CityIdContext.Provider>
  );
}

function ContentIntakeInner() {
  const CITY_ID = useContext(CityIdContext);
  const validTabs = ["autoseed", "search", "csv", "photo", "url", "feeds", "drafts"];
  const urlTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
  const initialTab = urlTab && validTabs.includes(urlTab) ? urlTab : "autoseed";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg" data-testid="text-intake-title">Content Intake Toolkit</h2>
      <p className="text-sm text-muted-foreground">Import businesses, events, and articles from multiple sources. All imports create pending drafts for review before publishing.</p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap scrollbar-hide">
          <TabsTrigger value="autoseed" data-testid="tab-intake-autoseed" aria-label="Auto-Seed"><Zap className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Auto-Seed</span></TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-intake-search" aria-label="Google Search"><Search className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Google Search</span></TabsTrigger>
          <TabsTrigger value="csv" data-testid="tab-intake-csv" aria-label="CSV Upload"><FileSpreadsheet className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">CSV Upload</span></TabsTrigger>
          <TabsTrigger value="photo" data-testid="tab-intake-photo" aria-label="Photo Capture"><Camera className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Photo Capture</span></TabsTrigger>
          <TabsTrigger value="url" data-testid="tab-intake-url" aria-label="URL / Story"><Link className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">URL / Story</span></TabsTrigger>
          <TabsTrigger value="feeds" data-testid="tab-intake-feeds" aria-label="Sources"><Rss className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Sources</span></TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-intake-drafts" aria-label="Drafts"><FileDown className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Drafts</span></TabsTrigger>
        </TabsList>

        <TabsContent value="autoseed" className="mt-4"><AutoSeedPanel /></TabsContent>
        <TabsContent value="search" className="mt-4"><GooglePlacesSearchPanel /></TabsContent>
        <TabsContent value="csv" className="mt-4"><CsvUploadPanel /></TabsContent>
        <TabsContent value="photo" className="mt-4"><PhotoCapturePanel /></TabsContent>
        <TabsContent value="url" className="mt-4"><UrlExtractPanel /></TabsContent>
        <TabsContent value="feeds" className="mt-4"><ContentFeedsPanel /></TabsContent>
        <TabsContent value="drafts" className="mt-4"><DraftsReviewPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function AutoSeedPanel() {
  const CITY_ID = useContext(CityIdContext);
  const { selectedCitySlug } = useAdminCitySelection();
  const CITY_SLUG = selectedCitySlug;
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null);
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: zones } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/cities", CITY_SLUG, "zones"] });
  const { data: categories } = useQuery<{ id: string; name: string; slug: string }[]>({ queryKey: ["/api/categories"] });

  const seedCategories = (categories || []).filter((c: { slug: string }) => !["events"].includes(c.slug));

  const runAutoSeed = async () => {
    setSeeding(true);
    setProgress(null);
    try {
      const body: Record<string, string> = { cityId: CITY_ID };
      if (selectedZone !== "all") body.zoneId = selectedZone;
      if (selectedCategory !== "all") body.categoryId = selectedCategory;
      const resp = await apiRequest("POST", "/api/admin/intake/auto-seed", body);
      const data = await resp.json();
      setProgress(data);
      toast({ title: `Auto-seed complete! ${data.totalImported} businesses imported as drafts.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intake/drafts"] });
    } catch {
      toast({ title: "Auto-seed failed", variant: "destructive" });
    }
    setSeeding(false);
  };

  const progressItems = (progress?.progress || []) as { zone: string; category: string; found: number; imported: number; skipped: number; error?: string; count?: number }[];
  const apiErrorItems = (progress?.apiErrors || []) as { zone: string; category: string; error: string }[];

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <h3 className="font-medium text-sm sm:text-base">Auto-Seed: Fill Your Commerce Hub</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Search Google Places across zones and categories. Filter to a specific neighborhood or category, or run a full sweep.
          All results are routed to the Admin Inbox for review.
        </p>

        <div className="flex gap-2 flex-col sm:flex-row">
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-seed-zone">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {(zones || []).map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-seed-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {seedCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 inline mr-1 text-amber-600" />
          {selectedZone === "all" && selectedCategory === "all"
            ? "Full sweep: searches all zones and categories. May take 1-2 minutes."
            : "Filtered search. Faster than a full sweep."}
        </div>
        <Button onClick={runAutoSeed} disabled={seeding} className="w-full sm:w-auto" data-testid="button-auto-seed">
          {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          {seeding ? "Seeding... please wait" : "Run Auto-Seed"}
        </Button>
      </Card>

      {progress && (
        <Card className="p-3 sm:p-4 space-y-3">
          {(progress.totalImported as number) === 0 && (progress.totalApiErrors as number) > 0 ? (
            <>
              <h3 className="font-medium flex items-center gap-2 text-red-600 text-sm sm:text-base">
                <AlertCircle className="w-4 h-4" /> Auto-Seed Failed
              </h3>
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs sm:text-sm space-y-2" data-testid="text-seed-error">
                <p className="font-medium text-red-700 dark:text-red-400">{progress.totalApiErrors as number} of {progress.totalSearches as number} searches failed</p>
                {apiErrorItems[0]?.error && (
                  <p className="text-red-600 dark:text-red-300 text-xs">{apiErrorItems[0].error}</p>
                )}
                {apiErrorItems[0]?.error?.includes("Billing") && (
                  <p className="text-xs text-red-500 dark:text-red-400">Enable billing on your Google Cloud project for Places API. Visit <a href="https://console.cloud.google.com/project/_/billing/enable" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a>.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                <Check className="w-4 h-4 text-green-500" /> Auto-Seed Complete
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-lg sm:text-2xl font-bold" data-testid="text-seed-total">{progress.totalImported as number}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-lg sm:text-2xl font-bold">{progress.totalFound as number}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Found</p>
                </div>
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-lg sm:text-2xl font-bold">{progress.zonesProcessed as number}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Zones</p>
                </div>
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-lg sm:text-2xl font-bold">{progress.totalSearches as number}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Searches</p>
                </div>
              </div>
              {progressItems.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {progressItems.filter(p => (p.imported || p.count || 0) > 0).map((p, i: number) => (
                    <div key={i} className="text-[11px] sm:text-xs flex justify-between px-2 py-1 bg-muted/50 rounded gap-1">
                      <span className="truncate min-w-0">{p.zone} / {p.category}</span>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{p.imported || p.count || 0} new</Badge>
                        {p.found > 0 && <Badge variant="secondary" className="text-[10px]">{p.found} found</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Check the Admin Inbox to review and publish these businesses.</p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function CsvUploadPanel() {
  const CITY_ID = useContext(CityIdContext);
  const { selectedCitySlug } = useAdminCitySelection();
  const CITY_SLUG = selectedCitySlug;
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [draftType, setDraftType] = useState("BUSINESS");
  const [result, setResult] = useState<any>(null);

  const { data: zones } = useQuery({ queryKey: ["/api/cities", CITY_SLUG, "zones"] });
  const { data: categories } = useQuery({ queryKey: ["/api/categories"] });
  const [zoneId, setZoneId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const handleUpload = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cityId", CITY_ID);
      formData.append("draftType", draftType);
      if (zoneId) formData.append("zoneId", zoneId);
      if (categoryId) formData.append("categoryId", categoryId);

      const resp = await fetch("/api/admin/intake/csv-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await resp.json();
      if (data.imported) {
        setResult(data);
        toast({ title: `Imported ${data.imported} rows as drafts!` });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/intake/drafts"] });
      } else {
        toast({ title: data.error || "Upload failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <h3 className="font-medium text-sm sm:text-base">CSV / Spreadsheet Upload</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Upload a CSV file with business or event data. Each row becomes a draft.
          Headers: name, description, address, city, state, zip, phone, website, email (businesses) or title, description, date, location, venue, cost (events).
        </p>

        <div className="flex gap-2 items-center flex-col sm:flex-row">
          <Select value={draftType} onValueChange={setDraftType}>
            <SelectTrigger className="w-full sm:w-36" data-testid="select-csv-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUSINESS">Business</SelectItem>
              <SelectItem value="EVENT">Event</SelectItem>
            </SelectContent>
          </Select>

          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger className="w-full sm:w-44" data-testid="select-csv-zone">
              <SelectValue placeholder="Neighborhood (optional)" />
            </SelectTrigger>
            <SelectContent>
              {(zones as any[] || []).map((z: any) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full sm:w-44" data-testid="select-csv-category">
              <SelectValue placeholder="Category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {(categories as any[] || []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <input
          type="file"
          accept=".csv,.tsv,.txt"
          ref={fileRef}
          className="hidden"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-csv-upload">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}
          {uploading ? "Processing..." : "Upload CSV File"}
        </Button>
      </Card>

      {result && (
        <Card className="p-3 sm:p-4 space-y-2">
          <h3 className="font-medium flex items-center gap-2 text-sm sm:text-base">
            <Check className="w-4 h-4 text-green-500" /> CSV Import Complete
          </h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-muted rounded p-2 text-center">
              <p className="text-lg sm:text-xl font-bold">{result.imported}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Imported</p>
            </div>
            <div className="bg-muted rounded p-2 text-center">
              <p className="text-lg sm:text-xl font-bold">{result.totalRows}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total Rows</p>
            </div>
            <div className="bg-muted rounded p-2 text-center">
              <p className="text-lg sm:text-xl font-bold">{result.skipped}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Check the Admin Inbox to review and publish.</p>
        </Card>
      )}
    </div>
  );
}

function GooglePlacesSearchPanel() {
  const CITY_ID = useContext(CityIdContext);
  const { selectedCitySlug } = useAdminCitySelection();
  const CITY_SLUG = selectedCitySlug;
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: zones } = useQuery({ queryKey: ["/api/cities", CITY_SLUG, "zones"] });
  const { data: categories } = useQuery({ queryKey: ["/api/categories"] });
  const [zoneId, setZoneId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const resp = await apiRequest("POST", "/api/admin/intake/google-places-search", {
        query: query + (CITY_SLUG ? ` ${CITY_SLUG}` : ""),
        cityId: CITY_ID,
      });
      const data = await resp.json();
      setResults(data.results || []);
      setSelected(new Set());
    } catch (err) {
      toast({ title: "Search failed", variant: "destructive" });
    }
    setSearching(false);
  };

  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  };

  const doImport = async () => {
    if (!zoneId) { toast({ title: "Select a zone first", variant: "destructive" }); return; }
    if (selected.size === 0) { toast({ title: "Select places to import", variant: "destructive" }); return; }
    setImporting(true);
    try {
      const places = Array.from(selected).map(i => results[i]);
      const resp = await apiRequest("POST", "/api/admin/intake/google-places-import", {
        cityId: CITY_ID,
        zoneId,
        categoryIds: categoryId ? [categoryId] : [],
        places,
      });
      const data = await resp.json();
      toast({ title: `Imported ${data.imported} draft(s)` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intake/drafts"] });
      setSelected(new Set());
    } catch (err) {
      toast({ title: "Import failed", variant: "destructive" });
    }
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <h3 className="font-medium text-sm sm:text-base">Search Google Places</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. coffee shops, barbershops, yoga studios..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            data-testid="input-places-query"
          />
          <Button onClick={doSearch} disabled={searching} data-testid="button-places-search">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex gap-2 flex-col sm:flex-row">
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-zone">
              <SelectValue placeholder="Select Neighborhood" />
            </SelectTrigger>
            <SelectContent>
              {(zones as any[] || []).map((z: any) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-category">
              <SelectValue placeholder="Category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {(categories as any[] || []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {results.length > 0 && (
        <Card className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-medium text-sm sm:text-base">{results.length} Results</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAll} data-testid="button-select-all">
                {selected.size === results.length ? "Deselect All" : "Select All"}
              </Button>
              <Button size="sm" onClick={doImport} disabled={importing || selected.size === 0} data-testid="button-import-selected">
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileDown className="w-4 h-4 mr-1" />}
                Import {selected.size}
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selected.has(i) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onClick={() => toggleSelect(i)}
                data-testid={`card-place-result-${i}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${selected.has(i) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                    {selected.has(i) && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-sm text-muted-foreground truncate"><MapPin className="w-3 h-3 inline mr-1" />{r.address}</p>
                    {r.rating && <p className="text-xs text-muted-foreground mt-1">★ {r.rating} ({r.reviewCount} reviews)</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PhotoCapturePanel() {
  const CITY_ID = useContext(CityIdContext);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [draftType, setDraftType] = useState("BUSINESS");
  const [result, setResult] = useState<any>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("cityId", CITY_ID);
      formData.append("draftType", draftType);

      const resp = await fetch("/api/admin/intake/photo-extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await resp.json();
      if (data.draft) {
        setResult(data.draft);
        toast({ title: "Photo processed! Draft created." });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/intake/drafts"] });
      } else {
        toast({ title: data.error || "Processing failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <h3 className="font-medium text-sm sm:text-base">Photo Capture & AI Extraction</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">Upload a photo of a business card, flyer, event poster, or storefront sign. AI will extract the information automatically.</p>

        <div className="flex gap-2 items-center flex-wrap">
          <Select value={draftType} onValueChange={setDraftType}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-photo-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUSINESS">Business</SelectItem>
              <SelectItem value="EVENT">Event</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileRef}
            className="hidden"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full sm:w-auto" data-testid="button-photo-upload">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Camera className="w-4 h-4 mr-1" />}
            {uploading ? "Processing..." : "Upload Photo"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-3 sm:p-4 space-y-2">
          <h3 className="font-medium flex items-center gap-2 text-sm sm:text-base">
            <Check className="w-4 h-4 text-green-500" /> Draft Created
          </h3>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64" data-testid="text-photo-result">
            {JSON.stringify(result.extractedData, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground">Check the Admin Inbox to review and publish.</p>
        </Card>
      )}
    </div>
  );
}

function UrlExtractPanel() {
  const CITY_ID = useContext(CityIdContext);
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [draftType, setDraftType] = useState("ARTICLE");
  const [mode, setMode] = useState<"extract" | "story">("story");
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const doExtract = async () => {
    if (!url.trim()) return;
    setExtracting(true);
    setResult(null);
    try {
      const endpoint = mode === "story"
        ? "/api/admin/intake/story-from-url"
        : "/api/admin/intake/url-extract";
      const body = mode === "story"
        ? { url, cityId: CITY_ID }
        : { url, cityId: CITY_ID, draftType };
      const resp = await apiRequest("POST", endpoint, body);
      const data = await resp.json();
      if (data.draft) {
        setResult(data.draft);
        toast({ title: mode === "story" ? "Story generated! Draft created." : "Content extracted! Draft created." });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/intake/drafts"] });
      } else {
        toast({ title: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
    setExtracting(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex gap-2">
          <Button
            variant={mode === "story" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("story"); setResult(null); }}
            data-testid="button-mode-story"
          >
            <Zap className="w-3.5 h-3.5 mr-1" /> Generate Story
          </Button>
          <Button
            variant={mode === "extract" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("extract"); setResult(null); }}
            data-testid="button-mode-extract"
          >
            <Globe className="w-3.5 h-3.5 mr-1" /> Extract Data
          </Button>
        </div>

        {mode === "story" ? (
          <>
            <h3 className="font-medium text-sm sm:text-base">Story from URL</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Paste a news article URL. AI will read it and write an original, locally-focused story inspired by the source. The draft goes to your review queue.
            </p>
          </>
        ) : (
          <>
            <h3 className="font-medium text-sm sm:text-base">URL Content Extraction</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Paste a URL to a news article, event page, or business listing. AI will extract and structure the content.
            </p>
            <Select value={draftType} onValueChange={setDraftType}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-url-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARTICLE">Article</SelectItem>
                <SelectItem value="EVENT">Event</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        <div className="flex gap-2">
          <Input
            placeholder={mode === "story" ? "https://example.com/news-article..." : "https://example.com/page..."}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doExtract()}
            data-testid="input-url"
          />
          <Button onClick={doExtract} disabled={extracting || !url.trim()} data-testid="button-url-extract">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : mode === "story" ? <Zap className="w-4 h-4 mr-1" /> : <Globe className="w-4 h-4 mr-1" />}
            {extracting ? "Working..." : mode === "story" ? "Generate" : "Extract"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-3 sm:p-4 space-y-2">
          <h3 className="font-medium flex items-center gap-2 text-sm sm:text-base">
            <Check className="w-4 h-4 text-green-500" /> {mode === "story" ? "Story Draft Created" : "Draft Created"}
          </h3>
          {mode === "story" && (result as Record<string, unknown>).extractedData && (
            <div className="space-y-2">
              <p className="font-medium text-sm">{((result as Record<string, unknown>).extractedData as Record<string, unknown>)?.title as string}</p>
              <p className="text-xs text-muted-foreground">{((result as Record<string, unknown>).extractedData as Record<string, unknown>)?.excerpt as string}</p>
              <div className="bg-muted rounded p-3 text-xs max-h-64 overflow-y-auto whitespace-pre-wrap" data-testid="text-story-content">
                {((result as Record<string, unknown>).extractedData as Record<string, unknown>)?.content as string}
              </div>
            </div>
          )}
          {mode === "extract" && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64" data-testid="text-url-result">
              {JSON.stringify((result as Record<string, unknown>).extractedData, null, 2)}
            </pre>
          )}
          <p className="text-xs text-muted-foreground">Check the Admin Inbox to review and publish.</p>
        </Card>
      )}
    </div>
  );
}

function ContentFeedsPanel() {
  const CITY_ID = useContext(CityIdContext);
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [sourceType, setSourceType] = useState("RSS");
  const [pullFrequency, setPullFrequency] = useState("DAILY");
  const [runningAll, setRunningAll] = useState(false);
  const [pullingId, setPullingId] = useState<string | null>(null);

  const { data: sources, isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ["/api/admin/intelligence/sources", CITY_ID],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/sources?cityId=${CITY_ID}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sources");
      return res.json();
    },
  });

  const addSource = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/intelligence/sources", {
        cityId: CITY_ID,
        name,
        sourceType,
        baseUrl: feedUrl,
        pullFrequency,
        enabled: true,
      });
    },
    onSuccess: () => {
      toast({ title: "Source added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/sources", CITY_ID] });
      setShowAdd(false);
      setName("");
      setFeedUrl("");
    },
    onError: () => toast({ title: "Failed to add source", variant: "destructive" }),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/intelligence/sources/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/sources", CITY_ID] });
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/intelligence/sources/${id}`),
    onSuccess: () => {
      toast({ title: "Source deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/sources", CITY_ID] });
    },
  });

  const pullSource = async (id: string) => {
    setPullingId(id);
    try {
      const resp = await apiRequest("POST", "/api/admin/intelligence/run-pulls", { sourceId: id });
      const data = await resp.json();
      const r = data.results?.[0];
      toast({ title: r ? `Pulled: ${r.rowsFetched || 0} fetched, ${r.rowsInserted || 0} new` : "Pull complete" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/sources", CITY_ID] });
    } catch {
      toast({ title: "Pull failed", variant: "destructive" });
    }
    setPullingId(null);
  };

  const runAllPulls = async () => {
    setRunningAll(true);
    try {
      const resp = await apiRequest("POST", "/api/admin/intelligence/run-pulls", { cityId: CITY_ID });
      const data = await resp.json();
      toast({ title: `Ran ${data.ran} source(s)` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/sources", CITY_ID] });
    } catch {
      toast({ title: "Run failed", variant: "destructive" });
    }
    setRunningAll(false);
  };

  const statusBadge = (status: string) => {
    if (status === "OK") return <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">OK</Badge>;
    if (status === "ERROR") return <Badge variant="destructive" className="text-[10px]">Error</Badge>;
    if (status === "DISABLED") return <Badge variant="secondary" className="text-[10px]">Disabled</Badge>;
    return <Badge variant="outline" className="text-[10px]">Never Run</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-sm sm:text-base">Metro Sources</h3>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage RSS feeds, iCal calendars, open data connectors, and other automated content sources.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runAllPulls} disabled={runningAll} data-testid="button-run-all-pulls">
              {runningAll ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              <span className="hidden sm:inline">Run All</span>
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-source">
              <Rss className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </Card>

      {showAdd && (
        <Card className="p-3 sm:p-4 space-y-3">
          <h3 className="font-medium text-sm">Add New Source</h3>
          <Input placeholder="Source name" value={name} onChange={e => setName(e.target.value)} data-testid="input-source-name" />
          <Input placeholder="Feed / API URL" value={feedUrl} onChange={e => setFeedUrl(e.target.value)} data-testid="input-source-url" />
          <div className="flex gap-2 flex-col sm:flex-row">
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RSS">RSS Feed</SelectItem>
                <SelectItem value="ICAL">iCal Calendar</SelectItem>
                <SelectItem value="SOCRATA">Socrata Open Data</SelectItem>
                <SelectItem value="ARCGIS">ArcGIS</SelectItem>
                <SelectItem value="EVENTBRITE">Eventbrite</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pullFrequency} onValueChange={setPullFrequency}>
              <SelectTrigger className="w-full sm:w-36" data-testid="select-pull-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOURLY">Hourly</SelectItem>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => addSource.mutate()} disabled={addSource.isPending || !name || !feedUrl} data-testid="button-save-source">
              {addSource.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading sources...</p>}
      {(sources || []).length === 0 && !isLoading && (
        <Card className="p-6 text-center text-muted-foreground">
          <Rss className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No sources configured yet. Add an RSS feed or data connector to start.</p>
        </Card>
      )}

      <div className="space-y-2">
        {(sources || []).map((s) => {
          const enabled = !!s.enabled;
          return (
            <Card key={s.id as string} className={`p-3 transition-opacity ${enabled ? "" : "opacity-50"}`} data-testid={`card-source-${s.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate text-sm">{s.name as string}</p>
                    <Badge variant="outline" className="text-[10px]">{s.sourceType as string}</Badge>
                    <Badge variant="outline" className="text-[10px]">{s.pullFrequency as string}</Badge>
                    {statusBadge(s.status as string)}
                    <Badge variant="outline" className="text-[10px]">{(s.itemCount as number) || 0} items</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.baseUrl as string || "No URL"}</p>
                  {s.lastPulledAt && <p className="text-[10px] text-muted-foreground">Last pulled: {new Date(s.lastPulledAt as string).toLocaleString()}</p>}
                  {s.lastError && <p className="text-[10px] text-red-500 truncate">{s.lastError as string}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => toggleEnabled.mutate({ id: s.id as string, enabled: checked })}
                    data-testid={`switch-toggle-source-${s.id}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => pullSource(s.id as string)}
                    disabled={pullingId === s.id}
                    data-testid={`button-pull-source-${s.id}`}
                  >
                    {pullingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteSource.mutate(s.id as string)} data-testid={`button-delete-source-${s.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DraftsReviewPanel() {
  const CITY_ID = useContext(CityIdContext);

  const { data: counts } = useQuery({
    queryKey: ["/api/admin/intake/drafts/counts", { cityId: CITY_ID }],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/intake/drafts/counts?cityId=${CITY_ID}`, { credentials: "include" });
      return resp.json();
    },
  });

  const countMap = (Array.isArray(counts) ? counts : []).reduce((acc: Record<string, number>, c: Record<string, unknown>) => { acc[c.status as string] = c.count as number; return acc; }, {} as Record<string, number>);
  const total = Object.values(countMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6 text-center space-y-4">
        <FileDown className="w-10 h-10 mx-auto opacity-60" />
        <div>
          <h3 className="font-medium text-sm sm:text-base">Drafts are managed in the Admin Inbox</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            All imported content is routed to the inbox for review, approval, and publishing.
          </p>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {countMap.PENDING ? <Badge variant="secondary" className="text-xs">{countMap.PENDING} pending</Badge> : null}
            {countMap.PUBLISHED ? <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">{countMap.PUBLISHED} published</Badge> : null}
            {countMap.REJECTED ? <Badge variant="outline" className="text-xs">{countMap.REJECTED} rejected</Badge> : null}
          </div>
        )}

        <WouterLink href="/admin/inbox">
          <Button data-testid="button-go-to-inbox">
            Go to Admin Inbox
          </Button>
        </WouterLink>
      </Card>
    </div>
  );
}
