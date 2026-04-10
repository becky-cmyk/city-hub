import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, Building2, Calendar, FileText, Loader2, ArrowRight, Briefcase, MapPin, ShoppingBag, Sparkles, Newspaper, List, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { mainLogo } from "@/lib/logos";

interface QuickSearchResult {
  businesses: { id: string; name: string; slug: string; imageUrl: string | null; presenceType: string; creatorType?: string | null; handle?: string | null }[];
  events: { id: string; title: string; slug: string; imageUrl: string | null; startDateTime: string }[];
  articles: { id: string; title: string; slug: string; imageUrl: string | null }[];
  jobs: { id: string; title: string; slug: string; employer: string | null; employmentType: string | null }[];
  attractions: { id: string; name: string; slug: string; imageUrl: string | null; attractionType: string }[];
  marketplace: { id: string; title: string; imageUrl: string | null; type: string; price: number | null }[];
  rssNews?: { id: string; title: string; slug: string; imageUrl: string | null; sourceName: string | null }[];
  curatedLists?: { id: string; title: string; slug: string; imageUrl: string | null; type: string }[];
  digests?: { id: string; title: string; slug: string; publishedAt: string | null }[];
  locationMatch?: { type: string; name: string; slug: string } | null;
}

type ResultType = "business" | "event" | "article" | "job" | "attraction" | "marketplace" | "rssNews" | "curatedList" | "digest";

interface ResultItem {
  type: ResultType;
  id: string;
  label: string;
  slug: string;
  imageUrl: string | null;
  meta?: string;
  isCreator?: boolean;
  handle?: string | null;
}

function flattenResults(data: QuickSearchResult): ResultItem[] {
  const items: ResultItem[] = [];
  for (const b of data.businesses) {
    const isCreator = !!b.creatorType;
    const metaLabel = isCreator ? `Creator · ${b.creatorType}` : b.presenceType === "organization" ? "Organization" : "Business";
    items.push({ type: "business", id: b.id, label: b.name, slug: b.slug, imageUrl: b.imageUrl, meta: metaLabel, isCreator, handle: b.handle });
  }
  for (const e of data.events) {
    const d = e.startDateTime ? new Date(e.startDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    items.push({ type: "event", id: e.id, label: e.title, slug: e.slug, imageUrl: e.imageUrl, meta: d });
  }
  for (const a of data.articles) {
    items.push({ type: "article", id: a.id, label: a.title, slug: a.slug, imageUrl: a.imageUrl, meta: "Article" });
  }
  for (const j of data.jobs) {
    const meta = [j.employer, j.employmentType].filter(Boolean).join(" · ") || "Job";
    items.push({ type: "job", id: j.id, label: j.title, slug: j.slug, imageUrl: null, meta });
  }
  for (const a of data.attractions) {
    items.push({ type: "attraction", id: a.id, label: a.name, slug: a.slug, imageUrl: a.imageUrl, meta: a.attractionType });
  }
  for (const m of data.marketplace) {
    const meta = m.price ? `$${(m.price / 100).toFixed(0)} · ${m.type}` : m.type;
    items.push({ type: "marketplace", id: m.id, label: m.title, slug: "", imageUrl: m.imageUrl, meta });
  }
  for (const r of (data.rssNews || [])) {
    items.push({ type: "rssNews", id: r.id, label: r.title, slug: r.slug, imageUrl: r.imageUrl, meta: r.sourceName || "News" });
  }
  for (const c of (data.curatedLists || [])) {
    items.push({ type: "curatedList", id: c.id, label: c.title, slug: c.slug, imageUrl: c.imageUrl, meta: c.type });
  }
  for (const d of (data.digests || [])) {
    const pubDate = d.publishedAt ? new Date(d.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    items.push({ type: "digest", id: d.id, label: d.title, slug: d.slug, imageUrl: null, meta: pubDate || "Digest" });
  }
  return items;
}

function typeIcon(type: ResultType) {
  if (type === "business") return <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (type === "event") return <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (type === "article") return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (type === "job") return <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (type === "attraction") return <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (type === "rssNews") return <Newspaper className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (type === "curatedList") return <List className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (type === "digest") return <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function typeColor(type: ResultType) {
  if (type === "business") return "hsl(var(--brand-teal))";
  if (type === "event") return "hsl(var(--brand-coral))";
  if (type === "article") return "hsl(var(--brand-sky))";
  if (type === "job") return "hsl(142, 71%, 45%)";
  if (type === "attraction") return "hsl(280, 67%, 60%)";
  if (type === "rssNews") return "hsl(220, 70%, 55%)";
  if (type === "curatedList") return "hsl(340, 65%, 55%)";
  if (type === "digest") return "hsl(45, 80%, 50%)";
  return "hsl(25, 95%, 53%)";
}

const TYPE_LABELS: Record<ResultType, string> = {
  business: "Businesses",
  event: "Events",
  article: "Articles",
  job: "Jobs",
  attraction: "Attractions",
  marketplace: "Marketplace",
  rssNews: "News",
  curatedList: "Curated Lists",
  digest: "Digests",
};

export function QuickSearch({ citySlug, onClose, initialQuery, hubSlug }: { citySlug: string; onClose?: () => void; initialQuery?: string; hubSlug?: string }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<QuickSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const searchParams = new URLSearchParams({ q });
        if (hubSlug) searchParams.set("hub", hubSlug);
        const res = await fetch(`/api/cities/${citySlug}/quick-search?${searchParams}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setActiveIndex(-1);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, citySlug]);

  const items = results ? flattenResults(results) : [];
  const hasResults = items.length > 0;
  const showDropdown = query.trim().length >= 2;

  const logSearch = useCallback((q: string) => {
    const loc = results?.locationMatch;
    fetch("/api/log/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        citySlug,
        query: q.substring(0, 200),
        locationDetected: !!loc,
        locationName: loc?.name || null,
        locationType: loc?.type || null,
      }),
    }).catch(() => {});
  }, [citySlug, results]);

  const navigateTo = useCallback((item: ResultItem) => {
    logSearch(query.trim());
    let path: string;
    if (item.type === "business") {
      if (item.isCreator && item.handle) {
        path = `/${citySlug}/creators`;
      } else {
        path = `/${citySlug}/directory/${item.slug}`;
      }
    } else if (item.type === "event") {
      path = `/${citySlug}/events/${item.slug}`;
    } else if (item.type === "article") {
      path = `/${citySlug}/articles/${item.slug}`;
    } else if (item.type === "job") {
      path = `/${citySlug}/jobs`;
    } else if (item.type === "attraction") {
      path = `/${citySlug}/attractions`;
    } else if (item.type === "rssNews") {
      path = item.slug ? `/${citySlug}/news/${item.slug}` : `/${citySlug}/news`;
    } else if (item.type === "curatedList") {
      path = `/${citySlug}/lists/${item.slug}`;
    } else if (item.type === "digest") {
      path = `/${citySlug}/digest/${item.slug}`;
    } else {
      path = `/${citySlug}/marketplace`;
    }
    navigate(path);
    onClose?.();
  }, [citySlug, navigate, onClose, logSearch, query]);

  const handleViewAll = useCallback(() => {
    logSearch(query.trim());
    navigate(`/${citySlug}/directory?q=${encodeURIComponent(query.trim())}`);
    onClose?.();
  }, [citySlug, query, navigate, onClose, logSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose?.();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        navigateTo(items[activeIndex]);
      } else if (query.trim()) {
        handleViewAll();
      }
    }
  }, [activeIndex, items, navigateTo, handleViewAll, query, onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const groups: { type: ResultType; label: string; items: ResultItem[]; offset: number }[] = [];
  if (results) {
    let offset = 0;
    const typeOrder: ResultType[] = ["business", "event", "article", "job", "attraction", "marketplace", "rssNews", "curatedList", "digest"];
    for (const t of typeOrder) {
      const typeItems = items.filter((i) => i.type === t);
      if (typeItems.length > 0) {
        groups.push({ type: t, label: TYPE_LABELS[t], items: typeItems, offset });
        offset += typeItems.length;
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-lg" data-testid="quick-search-container">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder")}
          className="pl-9 pr-10 text-sm bg-white dark:bg-background border-border/80 shadow-sm"
          data-testid="input-quick-search"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            onClick={() => { setQuery(""); setResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            data-testid="button-quick-search-clear"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-xl z-50 max-h-[60vh] overflow-y-auto" data-testid="quick-search-dropdown">
          {results?.locationMatch && (
            <div className="px-3 py-1.5 flex items-center gap-1.5 text-xs text-muted-foreground border-b border-border bg-accent/30" data-testid="quick-search-location-hint">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>Searching in <span className="font-medium text-foreground">{results.locationMatch.name}</span></span>
            </div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground" data-testid="quick-search-no-results">
              No results found for "{query}"
            </div>
          )}
          {hasResults && (
            <div className="py-1">
              {groups.map((group) => (
                <div key={group.type}>
                  <div className="px-3 pt-2 pb-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: typeColor(group.type) }}
                      data-testid={`quick-search-group-${group.type}`}
                    >
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((item, i) => {
                    const globalIdx = group.offset + i;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateTo(item)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                          globalIdx === activeIndex ? "bg-accent" : ""
                        }`}
                        data-testid={`quick-search-result-${item.type}-${item.id}`}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.src = mainLogo; }} />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                            {item.isCreator ? <Sparkles className="h-4 w-4 shrink-0 text-purple-400" /> : typeIcon(item.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="block truncate font-medium">{item.label}</span>
                          {item.meta && (
                            <span className="block text-xs text-muted-foreground truncate">{item.meta}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              <button
                onClick={handleViewAll}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-primary border-t border-border transition-colors"
                data-testid="quick-search-view-all"
              >
                View all results
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
