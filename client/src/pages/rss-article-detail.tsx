import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, ExternalLink, Calendar, User, Share2, Newspaper, MapPin, Clock, Ticket } from "lucide-react";
import { DarkPageShell } from "@/components/dark-page-shell";
import { ShareMenu } from "@/components/share-menu";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n, localized } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { sanitizeArticleBody } from "@/lib/article-sanitizer";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";

function formatDate(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "es" ? "es-US" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function RssArticleDetail() {
  const { citySlug, itemId } = useParams<{ citySlug: string; itemId: string }>();
  const [, setLocation] = useLocation();
  const { locale } = useI18n();

  const { data: article, isLoading, error } = useQuery<any>({
    queryKey: ["/api/feed/item", itemId],
    enabled: !!itemId,
  });

  useRegisterAdminEdit("cms-library", article?.id, "Edit Article");

  const hasLocalArticle = !!article?.localArticleBody;
  const esBody = hasLocalArticle ? article?.localArticleBodyEs : article?.rewrittenSummaryEs;
  const detailLocale = (locale === "es" && article?.titleEs && esBody) ? "es" : "en";
  const displayTitle = article ? localized(detailLocale, article.title, article.titleEs) : "";
  const rawBody = !article
    ? ""
    : hasLocalArticle
      ? localized(detailLocale, article.localArticleBody, article.localArticleBodyEs)
      : localized(detailLocale, article.rewrittenSummary || article.summary, article.rewrittenSummaryEs);
  const displayBody = useMemo(() => sanitizeArticleBody(rawBody), [rawBody]);

  const articleSlug = article?.localArticleSlug || itemId;
  const canonicalUrl = article
    ? `${window.location.origin}/${citySlug}/news/${articleSlug}`
    : "";

  const hubAttribution = article?.hubName ? `CLT Hub — ${article.hubName}` : "CLT Hub";

  usePageMeta({
    title: article ? `${displayTitle} | ${hubAttribution}` : "Loading... | CLT Hub",
    description: (displayBody || "").substring(0, 160),
    canonical: canonicalUrl,
    ogTitle: displayTitle,
    ogDescription: (displayBody || "").substring(0, 160),
    ogImage: article?.imageUrl || "",
    ogUrl: canonicalUrl,
    ogType: "article",
    keywords: article?.sourceName
      ? `Charlotte, ${article.sourceName}, local news, CLT Hub`
      : "Charlotte news, CLT Hub, local news",
  });

  useEffect(() => {
    if (!article) return;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: displayTitle,
      description: (displayBody || "").substring(0, 160),
      image: article.imageUrl || undefined,
      datePublished: article.publishedAt || article.createdAt,
      dateModified: article.updatedAt || article.publishedAt || article.createdAt,
      author: {
        "@type": "Organization",
        name: "CLT Hub",
        url: window.location.origin,
      },
      publisher: {
        "@type": "Organization",
        name: "CLT Hub",
        url: window.location.origin,
      },
      isBasedOn: {
        "@type": "NewsArticle",
        url: article.url,
        publisher: {
          "@type": "Organization",
          name: article.sourceName,
        },
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
    };

    let script = document.querySelector('script[data-jsonld="rss-article"]') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-jsonld", "rss-article");
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      script?.remove();
    };
  }, [article, displayTitle, displayBody, canonicalUrl]);

  if (isLoading) {
    return (
      <DarkPageShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-24 bg-white/10" />
          <Skeleton className="h-64 w-full rounded-xl bg-white/10" />
          <Skeleton className="h-6 w-48 bg-white/10" />
          <Skeleton className="h-10 w-full bg-white/10" />
          <Skeleton className="h-32 w-full bg-white/10" />
        </div>
      </DarkPageShell>
    );
  }

  if (error || !article) {
    return (
      <DarkPageShell>
        <div className="text-center py-16">
          <p className="text-white/60 text-lg mb-4" data-testid="text-article-not-found">Article not found</p>
          <Button
            onClick={() => setLocation(`/${citySlug}`)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
            data-testid="button-back-to-feed"
          >
            Back to Feed
          </Button>
        </div>
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell>
      <article>
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => {
              if (article?.hubSlug) {
                setLocation(`/${citySlug}/hub/${article.hubSlug}`);
              } else {
                setLocation(`/${citySlug}`);
              }
            }}
            className="flex items-center gap-1 text-purple-300 text-sm transition-colors"
            data-testid="link-back-pulse"
          >
            <ArrowLeft className="h-4 w-4" />
            {article?.hubName ? `Back to ${article.hubName} Hub` : "Back to Feed"}
          </button>
        </div>

        {article.imageUrl && (
          <div className="w-full aspect-[2/1] rounded-xl overflow-hidden mb-5">
            <img
              src={article.imageUrl}
              alt={displayTitle}
              className="w-full h-full object-cover"
              loading="eager"
              data-testid="img-article-hero"
            />
          </div>
        )}

        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4" data-testid="text-attribution">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              C
            </div>
            <div className="min-w-0">
              <p className="text-white/90 text-sm font-semibold truncate">
                CLT Hub{article.hubName ? ` — ${article.hubName}` : ""}
              </p>
              <div className="flex items-center gap-2 text-white/50 text-xs">
                {article.publishedAt && (
                  <time dateTime={new Date(article.publishedAt).toISOString()} className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(article.publishedAt, locale)}
                  </time>
                )}
              </div>
            </div>
          </div>

          <h1
            className="text-2xl md:text-3xl font-bold text-white leading-tight font-serif"
            data-testid="text-article-title"
          >
            {displayTitle}
          </h1>
        </header>

        <div
          className="text-white/80 text-base leading-relaxed whitespace-pre-line mb-8"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          data-testid="text-article-body"
        >
          {displayBody}
        </div>

        {article.isEventSource && (
          <div className="rounded-xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 p-5 mb-6" data-testid="section-event-info">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-purple-400" />
              <span className="text-xs uppercase tracking-wider text-purple-400 font-semibold">Event Information</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/70 mb-3">
              {article.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-purple-400" />
                  {new Date(article.publishedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-purple-400" />
                {article.sourceName}
              </span>
              {article.url && (
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-purple-300 hover:text-purple-200 transition-colors">
                  <Ticket className="h-3.5 w-3.5" />
                  View at {article.sourceName}
                </a>
              )}
            </div>
            <Link href={`/${citySlug}/events/browse`}>
              <Badge className="cursor-pointer bg-purple-600/30 text-purple-200 border-purple-500/30 hover:bg-purple-600/50 transition-colors" data-testid="link-browse-events">
                <Ticket className="h-3 w-3 mr-1" /> Browse All Events
              </Badge>
            </Link>
          </div>
        )}

        <div className="border-t border-white/10 pt-5 mb-6">
          <div className="rounded-lg bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper className="h-4 w-4 text-amber-400" />
              <p className="text-white/60 text-xs uppercase tracking-wider font-medium">
                Source
              </p>
            </div>
            <p className="text-white/70 text-sm mb-3">
              Originally reported by <span className="text-white font-medium">{article.sourceName}</span>
              {article.author && <span> ({article.author})</span>}
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition-colors"
              data-testid="link-original-source"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View original at {article.sourceName}
            </a>
          </div>
        </div>

        <footer className="space-y-4">
          <div className="flex items-center justify-center gap-6 py-3">
            <div onClick={(e) => e.stopPropagation()}>
              <ShareMenu
                title={displayTitle}
                url={canonicalUrl}
                type="article"
                slug={articleSlug}
                trigger={
                  <button
                    className="flex items-center gap-2 text-white/50 text-sm"
                    data-testid="button-share"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                }
              />
            </div>
          </div>
        </footer>
      </article>

      {article.related && article.related.length > 0 && (
        <section className="mt-8 border-t border-white/10 pt-6">
          <h2 className="text-lg font-bold text-white mb-4" data-testid="text-related-heading">
            More from {hubAttribution}
          </h2>
          <div className="grid gap-3">
            {article.related.map((rel: any) => {
              const relTitle = localized(locale, rel.title, rel.titleEs);
              const relLink = rel.localArticleSlug
                ? `/${citySlug}/news/${rel.localArticleSlug}`
                : `/${citySlug}/news/${rel.id}`;
              return (
                <a
                  key={rel.id}
                  href={relLink}
                  onClick={(e) => {
                    e.preventDefault();
                    setLocation(relLink);
                  }}
                  className="flex gap-3 p-3 rounded-lg bg-white/5 transition-colors group"
                  data-testid={`card-related-${rel.id}`}
                >
                  {rel.imageUrl && (
                    <div className="w-20 h-14 rounded-md overflow-hidden flex-shrink-0">
                      <img
                        src={rel.imageUrl}
                        alt={relTitle}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white/90 text-sm font-semibold line-clamp-2 leading-tight">
                      {relTitle}
                    </p>
                    <p className="text-white/40 text-xs mt-1 truncate">
                      CLT Hub {rel.publishedAt ? `· ${formatDate(rel.publishedAt, locale)}` : ""}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </DarkPageShell>
  );
}
