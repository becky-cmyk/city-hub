import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, ChevronDown, X, Search, Hash } from "lucide-react";

interface TagChip {
  slug: string;
  label: string;
  icon: string | null;
  count: number;
}

interface TagChipsProps {
  citySlug: string;
  geoTag?: string;
  activeTopicTag?: string;
  onTagSelect: (slug: string | undefined) => void;
}

export function TagChips({ citySlug, geoTag, activeTopicTag, onTagSelect }: TagChipsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<{ tags: TagChip[] }>({
    queryKey: ["/api/tags/suggest", citySlug, geoTag],
    queryFn: async () => {
      const params = new URLSearchParams({ citySlug });
      if (geoTag) params.set("geoTag", geoTag);
      const res = await fetch(`/api/tags/suggest?${params}`);
      return res.json();
    },
  });

  const chips = data?.tags || [];
  const activeLabel = activeTopicTag
    ? chips.find(c => c.slug === activeTopicTag)?.label || activeTopicTag
    : null;

  const filtered = search
    ? chips.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : chips;

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick as any);
    document.addEventListener("keydown", handleKeyDown as any);
    return () => {
      document.removeEventListener("mousedown", handleClick as any);
      document.removeEventListener("keydown", handleKeyDown as any);
    };
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="h-9 w-28 animate-pulse rounded-full bg-white/10" data-testid="tag-chips-loading" />
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {activeTopicTag ? (
        <div className="inline-flex items-center gap-1" data-testid="tag-chips">
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 pl-3 pr-2 py-1.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="tag-filter-btn"
          >
            <Hash className="h-3 w-3" />
            {activeLabel}
            <ChevronDown className={`h-3 w-3 ml-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          <button
            className="rounded-full p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => { onTagSelect(undefined); setIsOpen(false); }}
            data-testid="tag-filter-clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="tag-filter-btn"
        >
          <Filter className="h-3 w-3" />
          Topics
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      )}

      {isOpen && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearch(""); }} />
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-white/15 bg-gray-900/95 shadow-2xl overflow-hidden" data-testid="tag-filter-dropdown">
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                placeholder="Search topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-8 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50"
                autoFocus
                data-testid="tag-filter-search"
              />
              {search && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")} data-testid="tag-filter-search-clear">
                  <X className="h-3 w-3 text-white/40 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-64 p-1">
            <button
              className={`w-full text-left rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                !activeTopicTag ? "bg-purple-600/30 text-purple-300" : "text-white/80 hover:bg-white/5"
              }`}
              onClick={() => { onTagSelect(undefined); setIsOpen(false); setSearch(""); }}
              data-testid="tag-chip-all"
            >
              All Topics
            </button>

            {filtered.map((chip) => (
              <button
                key={chip.slug}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                  activeTopicTag === chip.slug ? "bg-purple-600/30 text-purple-300" : "text-white/80 hover:bg-white/5"
                }`}
                onClick={() => {
                  onTagSelect(activeTopicTag === chip.slug ? undefined : chip.slug);
                  setIsOpen(false);
                  setSearch("");
                }}
                data-testid={`tag-chip-topic-${chip.slug}`}
              >
                <span className="flex items-center gap-2">
                  <Hash className="h-3 w-3 text-white/30" />
                  {chip.label}
                </span>
                {chip.count > 0 && (
                  <span className="text-[10px] text-white/40 bg-white/5 rounded-full px-1.5 py-0.5">{chip.count}</span>
                )}
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-white/40">No matching topics</div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
