import { useState, useCallback, useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MapPin, ArrowLeft, Tag, Hash } from "lucide-react";
import { FeedCard, FeedCardSkeleton, type FeedCardItem } from "@/components/feed/feed-card";
import { FeedDetail } from "@/components/feed/feed-detail";
import { TagChips } from "@/components/feed/tag-chips";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";

interface TagMetadata {
  tag: {
    id: string;
    slug: string;
    label: string;
    type: string;
    icon: string | null;
    parent: { slug: string; label: string; type: string } | null;
  };
  counts: Record<string, number>;
  children: { slug: string; label: string; type: string; icon: string | null }[];
}

interface FeedResponse {
  items: FeedCardItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface TagPageProps {
  citySlug: string;
  cityId: string;
  tagSlug: string;
  topicSlug?: string;
}

export default function TagPage({ citySlug, cityId, tagSlug, topicSlug }: TagPageProps) {
  const [, setLocation] = useLocation();
  const [selectedItem, setSelectedItem] = useState<FeedCardItem | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data: tagData } = useQuery<TagMetadata>({
    queryKey: ["/api/tags", tagSlug],
    queryFn: async () => {
      const res = await fetch(`/api/tags/${tagSlug}`);
      return res.json();
    },
  });

  const topicTagData = useQuery<TagMetadata>({
    queryKey: ["/api/tags", topicSlug],
    queryFn: async () => {
      const res = await fetch(`/api/tags/${topicSlug}`);
      return res.json();
    },
    enabled: !!topicSlug,
  });

  const primaryTagType = tagData?.tag?.type;
  const geoTag = topicSlug
    ? tagSlug
    : (primaryTagType === "location" ? tagSlug : undefined);
  const topicTag = topicSlug
    ? topicSlug
    : (primaryTagType === "topic" || primaryTagType === "entity" || primaryTagType === "status" ? tagSlug : undefined);

  const pageTitle = topicSlug
    ? `${topicTagData.data?.tag?.label || topicSlug} in ${tagData?.tag?.label || tagSlug}`
    : tagData?.tag?.label || tagSlug;

  usePageMeta({
    title: `${pageTitle} — CLT Metro Hub`,
    description: `Discover ${pageTitle.toLowerCase()} in the Charlotte metro area. Local events, businesses, articles, and more.`,
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: ["/api/feed", citySlug, geoTag, topicTag, primaryTagType],
    queryFn: async ({ pageParam }) => {
      const p = new URLSearchParams({ citySlug, page: String(pageParam), limit: "20" });
      if (geoTag) p.set("geoTag", geoTag);
      if (topicTag) p.set("topicTag", topicTag);
      const res = await fetch(`/api/feed?${p}`);
      return res.json();
    },
    initialPageParam: 1,
    enabled: !!primaryTagType || !!topicSlug,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.hasMore) return (lastPageParam as number) + 1;
      return undefined;
    },
  });

  const allItems = data?.pages.flatMap(p => p.items) || [];

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage();
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleTagClick = useCallback((tag: { slug: string; label: string; type?: string }) => {
    if (tag.type === "location") {
      setLocation(`/${citySlug}/t/${tag.slug}`);
    } else {
      const base = geoTag || citySlug;
      setLocation(`/${citySlug}/t/${base}/${tag.slug}`);
    }
  }, [citySlug, geoTag, setLocation]);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setLocation(`/${citySlug}`)}
              className="rounded-full p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              data-testid="tag-page-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-1.5" data-testid="tag-page-title">
                <Hash className="h-4 w-4 text-purple-400" />
                {pageTitle}
              </h1>
              {tagData?.counts && (
                <p className="text-[10px] text-white/50">
                  {tagData.counts.total} items
                </p>
              )}
            </div>
          </div>

          {tagData?.tag?.type === "location" && (
            <TagChips
              citySlug={citySlug}
              geoTag={tagSlug}
              activeTopicTag={topicTag}
              onTagSelect={(slug) => {
                if (slug) {
                  setLocation(`/${citySlug}/t/${tagSlug}/${slug}`);
                } else {
                  setLocation(`/${citySlug}/t/${tagSlug}`);
                }
              }}
            />
          )}
        </div>

        {tagData?.children && tagData.children.length > 0 && (
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 font-semibold">Related</p>
            <div className="flex flex-wrap gap-1.5">
              {tagData.children.map((child) => (
                <a
                  key={child.slug}
                  href={`/${citySlug}/t/${child.slug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  data-testid={`related-tag-${child.slug}`}
                >
                  {child.type === "location" ? <MapPin className="h-2.5 w-2.5" /> : <Tag className="h-2.5 w-2.5" />}
                  {child.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {tagData?.tag?.parent && (
          <div className="px-4 py-2 border-b border-white/5">
            <a
              href={`/${citySlug}/t/${tagData.tag.parent.slug}`}
              className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              data-testid="tag-parent-link"
            >
              <ArrowLeft className="h-3 w-3" />
              {tagData.tag.parent.label}
            </a>
          </div>
        )}

        <main className="px-3 py-4 pb-24">
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <FeedCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isLoading && allItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-purple-600/20 p-4 mb-4">
                <Hash className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No content for #{pageTitle}</h3>
              <p className="text-sm text-white/60 max-w-xs mb-4">
                Content is being added to this area. Check back soon or try a broader tag.
              </p>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => setLocation(`/${citySlug}`)}
              >
                Back to Feed
              </Button>
            </div>
          )}

          {!isLoading && allItems.length > 0 && (
            <div className="space-y-4">
              {allItems.map((item, idx) => (
                <FeedCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  onTagClick={handleTagClick}
                  onCardClick={setSelectedItem}
                />
              ))}
            </div>
          )}

          {isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          )}

          <div ref={loadMoreRef} className="h-1" />
        </main>
      </div>

      {selectedItem && (
        <FeedDetail
          item={selectedItem}
          citySlug={citySlug}
          onClose={() => setSelectedItem(null)}
          onTagClick={handleTagClick}
        />
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: pageTitle,
            description: `${pageTitle} in the Charlotte metro area`,
            url: `${window.location.origin}/${citySlug}/t/${tagSlug}${topicSlug ? `/${topicSlug}` : ""}`,
            numberOfItems: allItems.length,
            itemListElement: allItems.slice(0, 10).map((item, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              name: item.title,
              url: `${window.location.origin}${item.url}`,
            })),
          }),
        }}
      />
    </div>
  );
}
