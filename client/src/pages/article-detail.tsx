import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Bookmark, Info, Tag, Clock, Store, Heart, Newspaper } from "lucide-react";
import { BizImage } from "@/components/biz-image";
import { useAuth } from "@/hooks/use-auth";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { useSmartBack } from "@/hooks/use-smart-back";
import { AuthDialog } from "@/components/auth-dialog";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { getDeviceId } from "@/lib/device";
import type { Article, Business } from "@shared/schema";
import { PenTool, Star } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { useI18n, localized } from "@/lib/i18n";
import { getBusinessUrl } from "@/lib/business-url";
import { ShareMenu } from "@/components/share-menu";
import { trackLeadEvent } from "@/lib/lead-tracking";
import { InlineAd } from "@/components/ad-banner";
import { DarkPageShell } from "@/components/dark-page-shell";
import { NeighborhoodContext, useNearbyData, buildNearbyJsonLd } from "@/components/neighborhood-context";

interface SampleArticleMention {
  name: string;
  slug: string;
  type: "commerce" | "organization";
}

interface SampleArticleData {
  title: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  imageUrl: string;
  author: { name: string; roleTitle: string };
  category: string;
  readTime: string;
  tags: string[];
  isFeatured: boolean;
  mentions: SampleArticleMention[];
}

const ARTICLE_CATEGORY_COLORS: Record<string, string> = {
  "Neighborhoods": "bg-teal-600",
  "Arts & Culture": "bg-purple-600",
  "Food & Drink": "bg-orange-600",
  "Community": "bg-pink-600",
  "Real Estate": "bg-blue-600",
};

const SAMPLE_ARTICLES: Record<string, SampleArticleData> = {
  "10-hidden-gems-south-end": {
    title: "10 Hidden Gems in South End You Need to Visit This Season",
    excerpt: "Beyond the bustling breweries and well-known brunch spots, South End harbors a treasure trove of under-the-radar destinations that reward the curious explorer.",
    content: "South End has become one of Charlotte's most dynamic neighborhoods, but even locals who frequent the area regularly might be surprised by what's tucked away in its less-traveled corners. We spent a week tracking down the best-kept secrets along the Rail Trail corridor — and the results might surprise even lifelong Charlotteans.\n\nFrom a speakeasy tucked behind a barbershop on South Boulevard to a tiny gallery showcasing only Charlotte-born artists in a converted shipping container, these spots represent the creative underbelly of a neighborhood that's often reduced to its brewery scene. One standout is a family-run empanada shop that's been quietly serving the best pastries in the city for over a decade — no signage, no social media, just word of mouth and a line out the door every Saturday morning.\n\nWhat makes South End special isn't just the big-name developments and the Rail Trail — it's the people who've been here long before the cranes arrived. The neighborhood's hidden gems are a testament to the resilience and creativity of small business owners who've carved out their own corners of Charlotte's most rapidly changing zip code. Whether you're a weekend visitor or a daily commuter, take a detour from your usual route — you might just discover your new favorite spot.",
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    imageUrl: "/images/seed/south-end.png",
    author: { name: "Maya Chen", roleTitle: "Community Reporter" },
    category: "Neighborhoods",
    readTime: "5 min read",
    tags: ["South End", "Local Guides", "Hidden Gems"],
    isFeatured: true,
    mentions: [
      { name: "Queen City Roasters", slug: "queen-city-roasters", type: "commerce" },
    ],
  },
  "noda-charlottes-creative-capital": {
    title: "How NoDa Became Charlotte's Creative Capital",
    excerpt: "The North Davidson arts district's transformation from a forgotten mill village to one of the South's most vibrant cultural hubs is a story of grassroots creativity, community resilience, and a little bit of luck.",
    content: "In the early 1990s, North Davidson Street was a forgotten stretch of crumbling mill houses and empty storefronts. The textile industry that had sustained the neighborhood for decades was gone, and what remained was a quiet pocket of Charlotte that most residents drove past without a second glance. But a handful of artists saw something different — affordable space, good bones, and a community that was ready for reinvention.\n\nThe first wave of creatives moved into abandoned warehouses along 36th Street, converting loading docks into studios and break rooms into galleries. NoDa Brewing Company was among the early anchors, transforming a forgotten industrial space into what would become one of Charlotte's most beloved taprooms. Meanwhile, the Charlotte Arts Foundation began running grant programs specifically targeting NoDa-based artists, funding everything from public murals to experimental theater productions in parking lots.\n\nToday, NoDa is home to more than 50 working artist studios, a dozen galleries, multiple live music venues, and a thriving maker economy. The monthly First Friday Art Walk draws thousands of visitors, and the neighborhood has become a model for how grassroots creative placemaking can transform a community without erasing its character. The key, longtime residents say, was that artists didn't just move in — they invested in the neighborhood, supported each other, and built institutions that could weather the inevitable pressures of gentrification.",
    publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    imageUrl: "/images/seed/noda-art.png",
    author: { name: "James Porter", roleTitle: "Arts & Culture Editor" },
    category: "Arts & Culture",
    readTime: "7 min read",
    tags: ["NoDa", "Arts", "History"],
    isFeatured: false,
    mentions: [
      { name: "NoDa Brewing Company", slug: "noda-brewing-company", type: "commerce" },
      { name: "Charlotte Arts Foundation", slug: "charlotte-arts-foundation", type: "organization" },
    ],
  },
  "charlotte-food-truck-guide": {
    title: "The Ultimate Guide to Charlotte's Food Truck Scene",
    excerpt: "From gourmet Korean-Mexican fusion in South End to authentic Venezuelan arepas in Plaza Midwood, Charlotte's food truck scene has exploded into one of the most diverse and exciting in the Southeast.",
    content: "Charlotte's food truck revolution didn't happen overnight. A decade ago, the city had a handful of trucks serving standard fare at construction sites and office parks. Today, there are more than 200 licensed mobile food vendors crisscrossing the metro, serving everything from Laotian street food to smoked brisket to artisan gelato — and the scene shows no signs of slowing down.\n\nThe epicenter of Charlotte's truck culture is the weekly Food Truck Friday gatherings that pop up across multiple neighborhoods. South End's Atherton Mill hosts the largest, regularly drawing 25+ trucks and thousands of hungry Charlotteans. But the real magic happens at the smaller, neighborhood-specific rallies — Plaza Midwood's Tuesday night lineup, Camp North End's rotating weekend roster, and the monthly gatherings in University City that are quietly building one of the most diverse food scenes in the metro.\n\nWhat sets Charlotte's food truck scene apart from other cities is the pipeline between trucks and brick-and-mortar restaurants. Many of the city's most celebrated restaurants — from Leah & Louise to Papi Queso — started as food trucks, using the lower overhead to test concepts and build followings before committing to permanent locations. That entrepreneurial spirit continues to drive innovation, with new trucks launching every month and pushing the boundaries of what mobile food can be.",
    publishedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    imageUrl: "/images/seed/food-truck.png",
    author: { name: "Sofia Martinez", roleTitle: "Food Editor" },
    category: "Food & Drink",
    readTime: "6 min read",
    tags: ["Food Trucks", "Dining Guide", "Local Food"],
    isFeatured: false,
    mentions: [],
  },
  "community-spotlight-clt-tutoring": {
    title: "Community Spotlight: Meet the Volunteers Behind CLT's Free Tutoring Program",
    excerpt: "Every weekday afternoon, a quiet revolution happens in community centers across Charlotte. Volunteers from all walks of life gather to offer free academic support to kids who need it most.",
    content: "It started with a single table in a West Charlotte community center. Maria Gonzalez, a retired math teacher, set up shop with a stack of worksheets and a hand-written sign: \"Free Homework Help, 3-5 PM.\" That was six years ago. Today, the CLT Free Tutoring Program operates in 14 community centers across the metro, with a rotating roster of more than 200 volunteers serving over 500 students every week.\n\nThe program's growth has been entirely organic — no major grants, no corporate sponsors, just a network of dedicated volunteers who believe that every child in Charlotte deserves academic support regardless of their zip code. College students from UNC Charlotte and Johnson C. Smith University make up the largest volunteer cohort, but the program also draws retired professionals, working parents who carve out time on their lunch breaks, and high school students earning community service hours.\n\nThe Charlotte Arts Foundation has been a quiet but crucial partner, integrating arts-based learning into the tutoring sessions. Their teaching artists visit participating community centers weekly, using creative projects to reinforce math and reading skills. 'When a kid who's struggling with fractions suddenly gets it because they're dividing a canvas into sections for a painting — that's the magic,' says program coordinator David Kim. 'We're not replacing traditional tutoring. We're meeting kids where they are and showing them that learning can look like anything.'",
    publishedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    imageUrl: "/images/seed/south-end.png",
    author: { name: "David Kim", roleTitle: "Community Editor" },
    category: "Community",
    readTime: "4 min read",
    tags: ["Volunteers", "Education", "Community Impact"],
    isFeatured: false,
    mentions: [
      { name: "Charlotte Arts Foundation", slug: "charlotte-arts-foundation", type: "organization" },
    ],
  },
  "charlotte-apartment-boom": {
    title: "Charlotte's Apartment Boom: Where New Communities Are Changing the Skyline",
    excerpt: "From luxury high-rises in Uptown to mixed-use developments along the Blue Line, Charlotte is adding thousands of new apartment units every year.",
    content: "Charlotte is in the middle of an apartment construction boom unlike anything the city has seen before. Over the past three years, more than 15,000 new units have been delivered across the metro, with another 12,000 currently under construction. The skyline is changing faster than most residents can keep up with — and the developments are reshaping not just where people live, but how entire neighborhoods function.\n\nThe Blue Line corridor has been the biggest beneficiary of this surge. South End alone has added more than 4,000 units since 2020, with developments like The Line at South End and Novel South End creating small villages of their own — complete with ground-floor retail, co-working spaces, and curated community programming. Further north, NoDa and the 36th Street station area are seeing similar density, with projects that blend residential living with arts and entertainment spaces.\n\nBut the apartment boom isn't limited to the urban core. Ballantyne, Steele Creek, and University City are all seeing significant multifamily development, often as part of larger mixed-use projects that combine apartments with retail, dining, and office space. These suburban developments are increasingly transit-oriented, positioning themselves near planned Blue Line and Silver Line extensions.\n\nFor renters, the market is a mixed bag. While the influx of new supply has slowed rent growth in some areas, luxury developments continue to push average rents higher. The real opportunity, local real estate experts say, is in the emerging neighborhoods — places like Camp North End, Wesley Heights, and the emerging FreeMoreWest district — where new communities are being built with an eye toward affordability and inclusion.",
    publishedAt: new Date(Date.now() - 22 * 86400000).toISOString(),
    imageUrl: "/images/seed/south-end.png",
    author: { name: "Taylor Brooks", roleTitle: "Real Estate Reporter" },
    category: "Real Estate",
    readTime: "5 min read",
    tags: ["Apartments", "Development", "Housing"],
    isFeatured: false,
    mentions: [],
  },
};

function InlineBusinessCard({ biz, citySlug, allCategories }: { biz: Business; citySlug: string; allCategories: { id: string; name: string; slug: string }[] }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!cardRef.current || trackedRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !trackedRef.current) {
          trackedRef.current = true;
          trackLeadEvent(citySlug, biz.slug, "ARTICLE_MENTION_VIEW");
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [citySlug, biz.slug]);

  const bizUrl = getBusinessUrl(citySlug, biz.slug, biz.categoryIds || [], allCategories || []);
  const catNames = (biz.categoryIds || [])
    .map((id: string) => allCategories?.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .slice(0, 2);

  return (
    <div ref={cardRef} className="my-4">
      <Link
        href={bizUrl}
        onClick={() => trackLeadEvent(citySlug, biz.slug, "ARTICLE_MENTION_CLICK")}
      >
        <Card className="p-3 flex items-center gap-3 cursor-pointer hover-elevate" data-testid={`card-inline-mention-${biz.slug}`}>
          <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
            <BizImage src={biz.imageUrl} alt={biz.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{biz.name}</p>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Newspaper className="h-2.5 w-2.5" /> Mentioned
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {biz.googleRating && (
                <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{biz.googleRating}</span>
                </div>
              )}
              {catNames.length > 0 && (
                <span className="text-xs text-muted-foreground">{catNames.join(", ")}</span>
              )}
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}

export default function ArticleDetail({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { locale } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const smartBack = useSmartBack(`/${citySlug}`);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [saved, setSaved] = useState(false);

  const sampleData = SAMPLE_ARTICLES[slug];

  const { data: article, isLoading } = useQuery<Article & { author?: { name: string; slug: string; photoUrl: string | null; roleTitle: string | null; bio: string | null } | null }>({
    queryKey: ["/api/cities", citySlug, "articles", slug],
    enabled: !sampleData,
  });

  useRegisterAdminEdit("articles", article?.id || sampleData?.id, "Edit Article");

  const { data: relatedBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/cities", citySlug, "articles", slug, "related-businesses"],
    enabled: !!slug && !sampleData,
  });

  const { data: mentionedBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/cities", citySlug, "articles", slug, "mentioned-businesses"],
    enabled: !!slug && !sampleData,
  });

  const { data: allCategories } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["/api/categories"],
    enabled: !!slug && !sampleData,
  });

  const artTitleEs = (article as any)?.titleEs;
  const artExcerptEs = (article as any)?.excerptEs;
  const artContentEs = (article as any)?.contentEs;
  const detailLocale = (locale === "es" && artTitleEs && artExcerptEs && artContentEs) ? "es" : "en";
  const resolvedTitle = sampleData?.title || (article ? (detailLocale === "es" ? artTitleEs : article.title) : undefined);
  const resolvedExcerpt = sampleData?.excerpt || (article ? (detailLocale === "es" ? artExcerptEs : article.excerpt) : undefined);
  const resolvedContent = sampleData?.content || (article ? (detailLocale === "es" ? artContentEs : article.content) : undefined);
  const resolvedImageUrl = sampleData?.imageUrl || article?.imageUrl;
  const resolvedPublishedAt = sampleData?.publishedAt || article?.publishedAt;
  const resolvedIsFeatured = sampleData?.isFeatured || article?.isFeatured;

  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "article") : null;

  usePageMeta({
    title: resolvedTitle ? `${resolvedTitle} ${brand?.titleSuffix || "| CLT Hub"}` : `Article ${brand?.titleSuffix || "| CLT Hub"}`,
    description: resolvedExcerpt?.slice(0, 160) || `Local article on ${brand?.descriptionBrand || "CLT Hub"}.`,
    canonical: `${window.location.origin}/${citySlug}/articles/${slug}`,
    ogImage: `${window.location.origin}/api/og-image/article/${slug}`,
    ogSiteName: brand?.ogSiteName,
  });

  const handleSave = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    if (sampleData) {
      toast({ title: "This is a sample article — saving is disabled during preview." });
      return;
    }
    try {
      await apiRequest("POST", `/api/cities/${citySlug}/saved`, {
        deviceId: getDeviceId(),
        itemType: "ARTICLE",
        itemId: article?.id,
      });
      setSaved(true);
      toast({ title: "Saved!" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const { data: nearbyData } = useNearbyData(
    citySlug,
    (article as Record<string, unknown>)?.latitude,
    (article as Record<string, unknown>)?.longitude,
    "article"
  );

  if (!sampleData && isLoading) {
    return (
      <DarkPageShell maxWidth="narrow">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="aspect-[2/1] w-full rounded-md" />
          <Skeleton className="h-20 w-full" />
        </div>
      </DarkPageShell>
    );
  }

  if (!sampleData && !article) {
    return (
      <DarkPageShell maxWidth="narrow">
        <Card className="p-12 text-center">
          <h3 className="font-semibold text-lg mb-1">Article not found</h3>
          <Link href={`/${citySlug}/articles`}>
            <Button variant="ghost" className="mt-2">Back to articles</Button>
          </Link>
        </Card>
      </DarkPageShell>
    );
  }

  const backHref = sampleData ? `/${citySlug}` : `/${citySlug}/articles`;
  const catColor = sampleData?.category ? (ARTICLE_CATEGORY_COLORS[sampleData.category] || "bg-gray-600") : "";

  return (
    <DarkPageShell maxWidth="narrow">
    <div className="space-y-6">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: resolvedTitle,
        url: `${window.location.origin}/${citySlug}/articles/${slug}`,
        ...(resolvedExcerpt && { description: resolvedExcerpt }),
        ...(resolvedImageUrl && { image: resolvedImageUrl }),
        ...(resolvedPublishedAt && { datePublished: resolvedPublishedAt }),
        publisher: {
          "@type": "Organization",
          name: brand?.jsonLdName || "CLT Hub",
          alternateName: branding?.brandVariants || [],
          ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
        },
        ...(() => {
          const lat = parseFloat(String((article as Record<string, unknown>)?.latitude ?? ""));
          const lng = parseFloat(String((article as Record<string, unknown>)?.longitude ?? ""));
          return Number.isFinite(lat) && Number.isFinite(lng) ? {
            contentLocation: { "@type": "Place", geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } },
          } : {};
        })(),
        isPartOf: {
          "@type": "WebSite",
          name: brand?.jsonLdName || "CLT Hub",
          alternateName: branding?.brandVariants || [],
          ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
        },
      }} />
      {nearbyData && nearbyData.groups.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Nearby points of interest around ${resolvedTitle}`,
          itemListElement: buildNearbyJsonLd(nearbyData).map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item,
          })),
        }} />
      )}

      {sampleData && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2" data-testid="banner-sample-disclaimer">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">PREVIEW ONLY</span> — This is a sample article created to preview the Pulse editorial experience. None of this content is published or sourced from real authors.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 text-purple-300" onClick={smartBack} data-testid="link-back-pulse">
          <ArrowLeft className="h-4 w-4" /> Back to Feed
        </Button>
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-1 text-white/50" data-testid="link-back-articles">
            {sampleData ? "Home" : "Stories"}
          </Button>
        </Link>
      </div>

      {resolvedImageUrl && (
        <div className="aspect-[2/1] overflow-hidden rounded-md">
          <img src={resolvedImageUrl} alt={resolvedTitle || ""} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold md:text-3xl text-white" data-testid="text-article-title">{resolvedTitle}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {resolvedPublishedAt && (
              <span className="text-sm text-muted-foreground">
                {format(new Date(resolvedPublishedAt), "MMMM d, yyyy")}
              </span>
            )}
            {resolvedIsFeatured && <Badge>Featured</Badge>}
            {sampleData?.category && (
              <Badge className={`${catColor} text-white border-0`} data-testid="badge-article-category">
                {sampleData.category}
              </Badge>
            )}
            {sampleData?.readTime && (
              <Badge variant="outline" className="gap-1" data-testid="badge-read-time">
                <Clock className="h-3 w-3" />{sampleData.readTime}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleSave} data-testid="button-save-article">
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </Button>
          <ShareMenu title={resolvedTitle || ""} type="article" slug={slug} />
        </div>
      </div>

      {sampleData ? (
        <div className="flex items-center gap-3 border-l-2 border-purple-500 pl-4 py-2" data-testid="text-article-author">
          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
            <PenTool className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <p className="font-medium text-sm text-white">{sampleData.author.name}</p>
            <p className="text-xs text-white/50">{sampleData.author.roleTitle}</p>
          </div>
        </div>
      ) : article?.author ? (
        <Link href={`/${citySlug}/authors/${article.author.slug}`}>
          <div className="flex items-center gap-3 border-l-2 border-purple-500 pl-4 cursor-pointer hover:bg-white/5 rounded-r-lg py-2 transition-colors" data-testid="text-article-author">
            {article.author.photoUrl ? (
              <img src={article.author.photoUrl} alt={article.author.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                <PenTool className="h-4 w-4 text-purple-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-sm text-white hover:underline">{article.author.name}</p>
              {article.author.roleTitle && (
                <p className="text-xs text-white/50">{article.author.roleTitle}</p>
              )}
            </div>
          </div>
        </Link>
      ) : null}

      {resolvedExcerpt && (
        <p className="text-lg text-muted-foreground italic">{resolvedExcerpt}</p>
      )}

      {resolvedContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {(() => {
            const paragraphs = resolvedContent.split(/\n\n+/);
            const bizCards = mentionedBusinesses || [];
            const insertAfter = paragraphs.length > 2 ? Math.floor(paragraphs.length / 2) : paragraphs.length;
            return paragraphs.map((para, idx) => (
              <div key={idx}>
                <div dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, "<br/>") }} />
                {idx === insertAfter - 1 && bizCards.length > 0 && (
                  <div className="not-prose" data-testid="section-inline-mentions">
                    {bizCards.map((biz) => (
                      <InlineBusinessCard
                        key={biz.id}
                        biz={biz}
                        citySlug={citySlug}
                        allCategories={allCategories || []}
                      />
                    ))}
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      )}

      {sampleData?.tags && sampleData.tags.length > 0 && (
        <Card className="p-5" data-testid="section-article-tags">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase flex items-center gap-1">
            <Tag className="h-3 w-3" /> Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {sampleData.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs" data-testid={`badge-tag-${tag}`}>
                {tag}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {sampleData?.mentions && sampleData.mentions.length > 0 && (
        <Card className="p-5" data-testid="section-article-mentions">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Mentioned in this article</h3>
          <div className="flex flex-wrap gap-2">
            {sampleData.mentions.map((mention) => (
              <Link key={mention.slug} href={`/${citySlug}/presence/${mention.slug}`}>
                <Badge variant="outline" className="cursor-pointer gap-1.5" data-testid={`link-mention-${mention.slug}`}>
                  {mention.type === "commerce" ? (
                    <Store className="h-3 w-3 text-amber-500" />
                  ) : (
                    <Heart className="h-3 w-3 text-pink-500" />
                  )}
                  {mention.name}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}


      <InlineAd citySlug={citySlug} page="article-detail" />

      {relatedBusinesses && relatedBusinesses.length > 0 && (
        <Card className="p-5" data-testid="section-related-businesses">
          <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase flex items-center gap-1">
            <Store className="h-3 w-3" /> Related Businesses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedBusinesses.map((biz) => {
              const bizUrl = getBusinessUrl(citySlug, biz.slug, biz.categoryIds || [], allCategories || []);
              return (
                <Link key={biz.id} href={bizUrl}>
                  <Card className="p-3 flex items-center gap-3 cursor-pointer hover-elevate" data-testid={`link-related-biz-${biz.slug}`}>
                    <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      <BizImage src={biz.imageUrl} alt={biz.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{biz.name}</p>
                      {biz.googleRating && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{biz.googleRating}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
      <NeighborhoodContext
        citySlug={citySlug}
        lat={(article as Record<string, unknown>)?.latitude}
        lng={(article as Record<string, unknown>)?.longitude}
        sourceType="article"
      />
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        defaultTab="register"
      />
    </div>
    </DarkPageShell>
  );
}
