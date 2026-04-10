import { useQuery } from "@tanstack/react-query";
import { useCityZones } from "@/hooks/use-city";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ZoneSelect } from "@/components/zone-select";
import { FileText, X, Search, Tag } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import type { Article } from "@shared/schema";

type StoryItem = Article & { _type?: string; _rssItemId?: string; sourceName?: string; titleEs?: string | null; excerptEs?: string | null };
import { usePageMeta } from "@/hooks/use-page-meta";
import { SidebarAd } from "@/components/ad-banner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { ScrollWallOverlay } from "@/components/scroll-wall";
import { DarkPageShell } from "@/components/dark-page-shell";

interface TopicOption {
  slug: string;
  name: string;
  icon: string | null;
}

export default function ArticlesList({ citySlug }: { citySlug: string }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { data: zones } = useCityZones(citySlug);

  usePageMeta({
    title: "Stories — CLT Metro Hub",
    description: "Read the latest articles and stories from Charlotte, NC.",
    canonical: `${window.location.origin}/${citySlug}/articles`,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const { data: topics } = useQuery<TopicOption[]>({
    queryKey: ["/api/cities", citySlug, "topics"],
  });

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("q", searchQuery);
  if (selectedZone && selectedZone !== "all") queryParams.set("zone", selectedZone);
  if (selectedTopic) queryParams.set("topic", selectedTopic);

  const { data: articles, isLoading } = useQuery<StoryItem[]>({
    queryKey: ["/api/cities", citySlug, "articles", `?${queryParams.toString()}`],
  });

  const hasFilters = searchQuery || (selectedZone && selectedZone !== "all") || selectedTopic;

  const clearAll = () => {
    setSearchQuery("");
    setSelectedZone("");
    setSelectedTopic("");
  };

  const PREVIEW_COUNT = 4;
  const gatedArticles = !user && articles && articles.length > PREVIEW_COUNT ? articles.slice(0, PREVIEW_COUNT) : articles;
  const showWall = !user && articles && articles.length > PREVIEW_COUNT;


  return (
    <DarkPageShell fillHeight>
      <div className="space-y-6">
        <div className="border-b-2 border-white/20 pb-2" data-testid="section-articles-masthead">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }} data-testid="text-articles-title">
            {t("articles.title")}
          </h1>
          <p className="text-white/50 text-sm mt-1" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}>
            {t("articles.subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="h-9 pl-9 pr-10 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-purple-500/40"
                data-testid="input-articles-search"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" data-testid="button-clear-article-search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <ZoneSelect zones={zones || []} value={selectedZone} onValueChange={setSelectedZone} triggerClassName="w-full sm:w-[160px] bg-white/5 border-white/10 text-white" testId="select-zone-filter" />
            </div>
          </div>

          {topics && topics.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="section-topic-filters">
              <Tag className="h-3.5 w-3.5 text-white/40 shrink-0" />
              <button
                onClick={() => setSelectedTopic("")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedTopic
                    ? "bg-purple-500/30 text-purple-200 border border-purple-400/40"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
                }`}
                data-testid="button-topic-all"
              >
                All Topics
              </button>
              {topics.map((topic) => (
                <button
                  key={topic.slug}
                  onClick={() => setSelectedTopic(selectedTopic === topic.slug ? "" : topic.slug)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTopic === topic.slug
                      ? "bg-purple-500/30 text-purple-200 border border-purple-400/40"
                      : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
                  }`}
                  data-testid={`button-topic-${topic.slug}`}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          )}

          {hasFilters && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">Active filters:</span>
              {searchQuery && <Badge variant="secondary" className="text-xs">"{searchQuery}"</Badge>}
              {selectedZone && selectedZone !== "all" && (
                <Badge variant="secondary" className="text-xs">{zones?.find(z => z.slug === selectedZone)?.name}</Badge>
              )}
              {selectedTopic && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-active-topic">
                  {topics?.find(t => t.slug === selectedTopic)?.name || selectedTopic}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-white/60" data-testid="button-clear-filters">
                <X className="h-3 w-3 mr-1" /> {t("directory.clear")}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 w-full rounded-lg bg-white/10" />
            <Skeleton className="h-64 w-full rounded-lg bg-white/10" />
            <Skeleton className="h-64 w-full rounded-lg bg-white/10" />
          </div>
        ) : gatedArticles && gatedArticles.length > 0 ? (
          <>
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gatedArticles.map((art) => {
                  const href = art._type === "rss"
                    ? `/${citySlug}/news/${art._rssItemId || art.id}`
                    : `/${citySlug}/articles/${art.slug}`;
                  const cardLocale = (locale === "es" && art.titleEs && art.excerptEs) ? "es" : "en";
                  const displayTitle = cardLocale === "es" ? art.titleEs! : art.title;
                  const displayExcerpt = cardLocale === "es" ? art.excerptEs! : art.excerpt;
                  return (
                  <Link key={art.id} href={href}>
                    <article className="group cursor-pointer rounded-lg border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-colors" data-testid={`card-article-${art.id}`}>
                      {art.imageUrl && (
                        <div className="aspect-[3/2] overflow-hidden">
                          <img src={art.imageUrl} alt={displayTitle} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                        </div>
                      )}
                      <div className="p-4">
                        {art.publishedAt && (
                          <span className="text-[11px] text-white/40 block mb-2" style={{ fontFamily: "Georgia, serif" }}>
                            {format(new Date(art.publishedAt), "MMMM d, yyyy")}
                          </span>
                        )}
                        <h3 className="font-bold leading-snug text-white group-hover:text-purple-300 transition-colors line-clamp-2" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                          {displayTitle}
                        </h3>
                        {displayExcerpt && (
                          <p className="mt-2 text-sm text-white/50 line-clamp-3" style={{ fontFamily: "Georgia, serif" }}>
                            {displayExcerpt}
                          </p>
                        )}
                        {art.sourceName && (
                          <span className="text-[10px] text-white/30 mt-2 block">{art.sourceName}</span>
                        )}
                      </div>
                    </article>
                  </Link>
                  );
                })}
              </div>
            </div>

            <aside className="hidden lg:block w-[200px] shrink-0 space-y-4">
              <SidebarAd citySlug={citySlug} />
            </aside>
          </div>
          {showWall && <ScrollWallOverlay />}
          </>
        ) : (
          <div className="rounded-md bg-white/5 border border-white/10 p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-white/20 mb-4" />
            <h3 className="font-semibold text-lg mb-1 text-white" style={{ fontFamily: "Georgia, serif" }}>{t("articles.noResults")}</h3>
            <p className="text-white/50 text-sm">{t("articles.noResultsHint")}</p>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
