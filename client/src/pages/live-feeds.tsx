import { useState, useEffect } from "react";
import { Radio, Mail, ExternalLink } from "lucide-react";
import { LIVE_FEEDS, LIVE_FEED_CATEGORIES, getFeaturedFeed, type LiveFeedCategory } from "@/data/live-feeds";
import { LiveFeedCard } from "@/components/feed/live-feed-card";
import { DarkPageShell } from "@/components/dark-page-shell";

export default function LiveFeeds({ citySlug }: { citySlug: string }) {
  const [activeCategory, setActiveCategory] = useState<LiveFeedCategory | "All">("All");
  const featured = getFeaturedFeed();

  useEffect(() => {
    document.title = "Live Feeds — CLT Metro Hub";
  }, []);

  const filteredFeeds = activeCategory === "All"
    ? LIVE_FEEDS
    : LIVE_FEEDS.filter(f => f.category === activeCategory);

  const categoryCounts = LIVE_FEED_CATEGORIES.map(cat => ({
    category: cat,
    count: LIVE_FEEDS.filter(f => f.category === cat).length,
  }));

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="text-live-feeds-title">
            Live Feeds
          </h1>
        </div>
        <Radio className="h-5 w-5 text-red-400" />
      </div>

      <p className="text-white/50 text-sm mb-6" data-testid="text-live-disclaimer">
        Streams are hosted by their original sources. Availability may change.
      </p>

      <div className="mb-8" data-testid="live-featured-player">
        <LiveFeedCard feed={featured} size="featured" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6" data-testid="live-category-tabs">
        <button
          onClick={() => setActiveCategory("All")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeCategory === "All"
              ? "bg-purple-500 text-white"
              : "bg-white/10 text-white/70"
          }`}
          data-testid="button-category-all"
        >
          All ({LIVE_FEEDS.length})
        </button>
        {categoryCounts.map(({ category, count }) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeCategory === category
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-white/70"
            }`}
            data-testid={`button-category-${category.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
          >
            {category} ({count})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="live-feeds-grid">
        {filteredFeeds
          .filter(f => f.id !== featured.id || activeCategory !== "All")
          .map(feed => (
            <LiveFeedCard key={feed.id} feed={feed} />
          ))}
      </div>

      {filteredFeeds.length === 0 && (
        <div className="text-center py-16">
          <Radio className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No feeds in this category yet.</p>
        </div>
      )}

      <div className="mt-12 text-center border-t border-white/10 pt-8 pb-4">
        <p className="text-white/40 text-sm mb-3">Know a great live cam or stream we should add?</p>
        <a
          href="mailto:info@cltmetrohub.com?subject=Live Feed Suggestion for CLT Metro Hub"
          className="inline-flex items-center gap-2 rounded-full bg-purple-600/80 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          data-testid="link-suggest-feed"
        >
          <Mail className="h-4 w-4" />
          Suggest a Feed
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </DarkPageShell>
  );
}
