import { useLocation } from "wouter";
import { Search } from "lucide-react";
import type { FeedCardItem } from "./feed-card";
import { generateRelatedSearches } from "@/lib/search-suggestions";

interface RelatedSearchesProps {
  item: FeedCardItem;
  citySlug: string;
  cityName?: string;
}

export function RelatedSearches({ item, citySlug, cityName }: RelatedSearchesProps) {
  const [, setLocation] = useLocation();
  const suggestions = generateRelatedSearches(item, cityName);

  if (suggestions.length === 0) return null;

  const handleTap = (query: string) => {
    setLocation(`/${citySlug}/directory?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="px-1 pt-1 pb-0.5" data-testid={`related-searches-${item.id}`}>
      <div className="flex items-center gap-1 mb-1">
        <Search className="h-2.5 w-2.5 text-white/30" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Related searches</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions.map((query) => (
          <button
            key={query}
            onClick={() => handleTap(query)}
            className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-white/50 font-medium transition-colors active:bg-white/15 active:text-white/80"
            data-testid={`related-search-chip-${query.replace(/\s+/g, "-").toLowerCase()}`}
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  );
}
