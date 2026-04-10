import { useQuery } from "@tanstack/react-query";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { BizImage } from "@/components/biz-image";
import { Link } from "wouter";
import { MapPin, Building2, Calendar, FileText, ChevronRight, Loader2, Users, Leaf, Star, Briefcase, ShoppingBag, DollarSign, Newspaper, Compass, List, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HubTvWidget } from "@/components/tv/hub-tv-widget";
import { usePageMeta } from "@/hooks/use-page-meta";
import { FARM_CATEGORY_SLUG } from "@shared/schema";
import { useState, useMemo } from "react";

interface MicroHubPageProps {
  citySlug: string;
  hubSlug: string;
}

export default function MicroHubPage({ citySlug, hubSlug }: MicroHubPageProps) {
  useRegisterAdminEdit("hub-management", hubSlug, "Edit Hub");

  const { data: hubData, isLoading: hubLoading } = useQuery<any>({
    queryKey: [`/api/hub/${hubSlug}`],
  });

  const { data: feedData, isLoading: feedLoading } = useQuery<any>({
    queryKey: [`/api/hub/${hubSlug}/feed`],
    enabled: !!hubData,
  });

  const isFarmHub = hubData?.isFarmHub || false;
  const hub = hubData?.hub;
  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  const allBusinesses = feedData?.businesses || [];

  const featuredBusinesses = useMemo(() => {
    if (!isFarmHub) return [];
    return allBusinesses.filter((b: any) => b.isFeatured || b.listingTier === "PREMIUM" || b.listingTier === "FEATURED").slice(0, 6);
  }, [allBusinesses, isFarmHub]);

  const businesses = useMemo(() => {
    if (!activeCategoryFilter) return allBusinesses;
    return allBusinesses.filter((b: any) =>
      b.categoryIds?.includes(activeCategoryFilter) || b.categorySlug === activeCategoryFilter
    );
  }, [allBusinesses, activeCategoryFilter]);

  usePageMeta({
    title: hub
      ? (isFarmHub ? `${hub.name} — Local Farm & Food Hub | ${cityName} Hub` : `${hub.name} | ${cityName} Hub`)
      : "Loading Hub...",
    description: hub?.description || `Explore local businesses, events, and community in the ${cityName} area.`,
    canonical: `${window.location.origin}/${citySlug}/hub/${hubSlug}`,
  });

  if (hubLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="hub-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hubData) {
    return (
      <div className="text-center py-20" data-testid="hub-not-found">
        <h1 className="text-2xl font-bold mb-2">Hub Not Found</h1>
        <p className="text-muted-foreground mb-4">The micro hub you're looking for doesn't exist.</p>
        <Link href={`/${citySlug}/neighborhoods`}>
          <Button variant="outline" data-testid="link-browse-neighborhoods">Browse Neighborhoods</Button>
        </Link>
      </div>
    );
  }

  const { parent, zipCodes, businessCount, nearbyHubs } = hubData;
  const events = feedData?.events || [];
  const articles = feedData?.articles || [];
  const rssNews = feedData?.rssNews || [];
  const jobs = feedData?.jobs || [];
  const marketplace = feedData?.marketplace || [];
  const attractions = feedData?.attractions || [];
  const curatedLists = feedData?.curatedLists || [];
  const digestsList = feedData?.digests || [];
  const popularCategories = feedData?.popularCategories || [];

  const feedScope = feedData?.scope as Record<string, string> | undefined;

  const ScopeLabel = ({ module }: { module: string }) => {
    const scope = feedScope?.[module];
    if (!scope || scope === "hub") return null;
    const label = scope === "county" ? `Includes nearby ${parent?.name || "county"} results` : "Includes metro-wide results";
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3" data-testid={`scope-label-${module}`}>
        <MapPin className="h-3 w-3" />
        <span>{label}</span>
      </div>
    );
  };

  const hubZipParam = zipCodes.length > 0 ? zipCodes.join(",") : "";
  const jobsViewAllUrl = hubZipParam ? `/${citySlug}/jobs?zip=${hubZipParam}` : `/${citySlug}/jobs`;
  const marketplaceViewAllUrl = hub?.name ? `/${citySlug}/marketplace?neighborhood=${encodeURIComponent(hub.name)}` : `/${citySlug}/marketplace`;

  return (
    <div className="space-y-8" data-testid="micro-hub-page">
      <div className={`relative rounded-xl overflow-hidden p-8 md:p-12 ${isFarmHub ? "bg-gradient-to-br from-green-900 via-green-800 to-emerald-900" : "bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900"}`} data-testid="hub-hero">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10">
          <div className={`flex items-center gap-2 text-sm mb-2 ${isFarmHub ? "text-green-200" : "text-purple-200"}`}>
            <Link href={`/${citySlug}`} className="hover:text-white">
              {citySlug.charAt(0).toUpperCase() + citySlug.slice(1)}
            </Link>
            <ChevronRight className="h-3 w-3" />
            {isFarmHub && (
              <>
                <Link href={`/${citySlug}/${FARM_CATEGORY_SLUG}`} className="hover:text-white">Local Farms & Food</Link>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            {parent && !isFarmHub && (
              <>
                <span>{parent.name}</span>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-white">{hub.name}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" data-testid="text-hub-name">
            {hub.name}
          </h1>
          {hub.description && (
            <p className="text-purple-100 text-lg max-w-2xl mb-4">{hub.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-purple-200 text-sm">
            <span className="flex items-center gap-1.5" data-testid="text-hub-business-count">
              <Building2 className="h-4 w-4" />
              {businessCount} Businesses
            </span>
            {zipCodes.length > 0 && (
              <span className="flex items-center gap-1.5" data-testid="text-hub-zips">
                <MapPin className="h-4 w-4" />
                ZIP: {zipCodes.slice(0, 5).join(", ")}{zipCodes.length > 5 ? ` +${zipCodes.length - 5} more` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {popularCategories.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="hub-categories">
          {isFarmHub && (
            <Badge
              variant={activeCategoryFilter === null ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-sm"
              data-testid="badge-category-all"
              onClick={() => setActiveCategoryFilter(null)}
            >
              All
            </Badge>
          )}
          {popularCategories.map((cat: any) => (
            isFarmHub ? (
              <Badge
                key={cat.id}
                variant={activeCategoryFilter === cat.id ? "default" : "secondary"}
                className="cursor-pointer px-3 py-1.5 text-sm"
                data-testid={`badge-category-${cat.slug}`}
                onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat.id ? null : cat.id)}
              >
                {cat.name} ({cat.count})
              </Badge>
            ) : (
              <Link key={cat.id} href={`/${citySlug}/neighborhoods/${hub.code || hubSlug}/${cat.slug}`}>
                <Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm" data-testid={`badge-category-${cat.slug}`}>
                  {cat.name} ({cat.count})
                </Badge>
              </Link>
            )
          ))}
        </div>
      )}

      {isFarmHub && featuredBusinesses.length > 0 && (
        <div data-testid="farm-featured-listings">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" /> Featured Farms & Producers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredBusinesses.map((biz: any) => (
              <Link key={biz.id} href={`/${citySlug}/${biz.categorySlug || "business"}/${biz.slug}`}>
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md border-green-200 dark:border-green-800" data-testid={`card-featured-${biz.id}`}>
                  <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                    <BizImage src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover" />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Featured</span>
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1" data-testid={`text-featured-name-${biz.id}`}>{biz.name}</h3>
                    {biz.tagline && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{biz.tagline}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue={rssNews.length > 0 ? "news" : "businesses"} className="w-full">
        <TabsList className="w-full justify-start" data-testid="hub-tabs">
          {rssNews.length > 0 && (
            <TabsTrigger value="news" data-testid="tab-news">
              <Newspaper className="h-4 w-4 mr-1.5" /> News ({rssNews.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="businesses" data-testid="tab-businesses">
            <Building2 className="h-4 w-4 mr-1.5" /> Businesses ({businesses.length})
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">
            <Calendar className="h-4 w-4 mr-1.5" /> Events ({events.length})
          </TabsTrigger>
          <TabsTrigger value="articles" data-testid="tab-articles">
            <FileText className="h-4 w-4 mr-1.5" /> Articles ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Briefcase className="h-4 w-4 mr-1.5" /> Jobs ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">
            <ShoppingBag className="h-4 w-4 mr-1.5" /> Marketplace ({marketplace.length})
          </TabsTrigger>
          {attractions.length > 0 && (
            <TabsTrigger value="attractions" data-testid="tab-attractions">
              <Compass className="h-4 w-4 mr-1.5" /> Attractions ({attractions.length})
            </TabsTrigger>
          )}
          {curatedLists.length > 0 && (
            <TabsTrigger value="curated" data-testid="tab-curated-lists">
              <List className="h-4 w-4 mr-1.5" /> Lists ({curatedLists.length})
            </TabsTrigger>
          )}
          {digestsList.length > 0 && (
            <TabsTrigger value="digests" data-testid="tab-digests">
              <BookOpen className="h-4 w-4 mr-1.5" /> Digests ({digestsList.length})
            </TabsTrigger>
          )}
        </TabsList>

        {rssNews.length > 0 && (
          <TabsContent value="news" className="mt-4">
            {feedLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="hub-news-grid">
                  {rssNews.map((item: any) => {
                    const newsUrl = item.localArticleSlug
                      ? `/${citySlug}/news/${item.localArticleSlug}`
                      : `/${citySlug}/news/${item.id}`;
                    return (
                      <Link key={item.id} href={newsUrl}>
                        <Card className="cursor-pointer transition-shadow hover:shadow-md h-full" data-testid={`card-news-${item.id}`}>
                          {item.imageUrl && (
                            <div className="aspect-video overflow-hidden rounded-t-lg">
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-sm line-clamp-2" data-testid={`text-news-title-${item.id}`}>{item.title}</h3>
                            {item.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.summary}</p>}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span className="font-medium">{hub.name} CLT Hub</span>
                              {item.publishedAt && (
                                <span>
                                  {new Date(item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
                <div className="mt-4 text-center">
                  <Link href={`/${citySlug}/pulse?geo=${hub.code || hubSlug}`}>
                    <Button variant="outline" size="sm" className="gap-1" data-testid="link-view-all-stories">
                      View All Stories <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="businesses" className="mt-4">
          {feedLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : businesses.length === 0 ? (
            <p className="text-center text-muted-foreground py-10" data-testid="text-no-businesses">No businesses listed in this hub yet.</p>
          ) : (
            <>
            <ScopeLabel module="businesses" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="hub-businesses-grid">
              {businesses.map((biz: any) => (
                <Link key={biz.id} href={`/${citySlug}/${biz.categorySlug || "business"}/${biz.slug}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-md" data-testid={`card-business-${biz.id}`}>
                    <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                      <BizImage src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover" />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-1" data-testid={`text-business-name-${biz.id}`}>{biz.name}</h3>
                      {biz.tagline && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{biz.tagline}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {biz.listingTier && biz.listingTier !== "FREE" && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-tier-${biz.id}`}>{biz.listingTier}</Badge>
                        )}
                        {biz.zip && <span className="text-xs text-muted-foreground">{biz.zip}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          {feedLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground py-10" data-testid="text-no-events">No upcoming events in this hub.</p>
          ) : (
            <>
            <ScopeLabel module="events" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="hub-events-grid">
              {events.map((evt: any) => (
                <Card key={evt.id} data-testid={`card-event-${evt.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{evt.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {evt.startDateTime ? new Date(evt.startDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
                    </div>
                    {evt.locationName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {evt.locationName}
                      </div>
                    )}
                    {evt.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{evt.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="articles" className="mt-4">
          {feedLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : articles.length === 0 ? (
            <p className="text-center text-muted-foreground py-10" data-testid="text-no-articles">No articles for this hub yet.</p>
          ) : (
            <>
            <ScopeLabel module="articles" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="hub-articles-grid">
              {articles.map((art: any) => (
                <Link key={art.id} href={`/${citySlug}/articles/${art.slug}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md" data-testid={`card-article-${art.id}`}>
                    {art.imageUrl && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img src={art.imageUrl} alt={art.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-2">{art.title}</h3>
                      {art.excerpt && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{art.excerpt}</p>}
                      {art.publishedAt && (
                        <span className="text-xs text-muted-foreground mt-2 block">
                          {new Date(art.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          {feedLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-10" data-testid="text-no-jobs">
              <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No jobs listed in this hub yet.</p>
              <Link href={jobsViewAllUrl}>
                <Button variant="outline" size="sm" className="mt-3 gap-1" data-testid="link-browse-all-jobs">
                  Browse All Jobs <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <ScopeLabel module="jobs" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="hub-jobs-grid">
                {jobs.map((job: any) => (
                  <Card key={job.id} className="transition-shadow hover:shadow-md" data-testid={`card-job-${job.id}`}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-1" data-testid={`text-job-title-${job.id}`}>{job.title}</h3>
                      {job.employer && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Building2 className="h-3 w-3" />
                          <span>{job.employer}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 flex-wrap mt-2">
                        {job.employmentType && (
                          <Badge variant="secondary" className="text-xs">{job.employmentType.replace(/_/g, " ")}</Badge>
                        )}
                        {job.locationText && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {job.locationText}
                          </span>
                        )}
                        {(job.payMin != null || job.payMax != null) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            {job.payMin != null && job.payMax != null ? `$${job.payMin}–$${job.payMax}` : job.payMin != null ? `From $${job.payMin}` : `Up to $${job.payMax}`}
                            {job.payUnit ? `/${job.payUnit}` : ""}
                          </span>
                        )}
                      </div>
                      {job.postedAt && (
                        <span className="text-xs text-muted-foreground mt-2 block">
                          Posted {new Date(job.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link href={jobsViewAllUrl}>
                  <Button variant="outline" size="sm" className="gap-1" data-testid="link-view-all-jobs">
                    View All Jobs <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="marketplace" className="mt-4">
          {feedLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : marketplace.length === 0 ? (
            <div className="text-center py-10" data-testid="text-no-marketplace">
              <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No marketplace listings in this hub yet.</p>
              <Link href={marketplaceViewAllUrl}>
                <Button variant="outline" size="sm" className="mt-3 gap-1" data-testid="link-browse-all-marketplace">
                  Browse Marketplace <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <ScopeLabel module="marketplace" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="hub-marketplace-grid">
                {marketplace.map((item: any) => (
                  <Card key={item.id} className="transition-shadow hover:shadow-md" data-testid={`card-marketplace-${item.id}`}>
                    {item.imageUrls?.[0] && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img src={item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-1" data-testid={`text-marketplace-title-${item.id}`}>{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        {item.type && (
                          <Badge variant="secondary" className="text-xs">{item.type.replace(/_/g, " ")}</Badge>
                        )}
                        {item.price != null && (
                          <span className="text-sm font-medium text-foreground">${Number(item.price).toLocaleString()}</span>
                        )}
                      </div>
                      {item.neighborhood && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <MapPin className="h-3 w-3" />
                          {item.neighborhood}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link href={marketplaceViewAllUrl}>
                  <Button variant="outline" size="sm" className="gap-1" data-testid="link-view-all-marketplace">
                    View All Marketplace <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </TabsContent>

        {attractions.length > 0 && (
          <TabsContent value="attractions" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="hub-attractions-grid">
              {attractions.map((attr: any) => (
                <Link key={attr.id} href={`/${citySlug}/attractions/${attr.slug || attr.id}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-md" data-testid={`card-attraction-${attr.id}`}>
                    {attr.imageUrl && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img src={attr.imageUrl} alt={attr.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-1" data-testid={`text-attraction-name-${attr.id}`}>{attr.name}</h3>
                      {attr.attractionType && (
                        <Badge variant="secondary" className="text-xs mt-1">{attr.attractionType}</Badge>
                      )}
                      {attr.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{attr.description}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        )}

        {curatedLists.length > 0 && (
          <TabsContent value="curated" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="hub-curated-lists-grid">
              {curatedLists.map((list: any) => (
                <Link key={list.id} href={`/${citySlug}/lists/${list.slug || list.id}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-md" data-testid={`card-curated-${list.id}`}>
                    {list.imageUrl && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img src={list.imageUrl} alt={list.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-2" data-testid={`text-curated-title-${list.id}`}>{list.title}</h3>
                      {list.type && (
                        <Badge variant="secondary" className="text-xs mt-1">{list.type}</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        )}

        {digestsList.length > 0 && (
          <TabsContent value="digests" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="hub-digests-grid">
              {digestsList.map((digest: any) => (
                <Link key={digest.id} href={`/${citySlug}/digest/${digest.slug || digest.id}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-md" data-testid={`card-digest-${digest.id}`}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-2" data-testid={`text-digest-title-${digest.id}`}>{digest.title}</h3>
                      {digest.publishedAt && (
                        <span className="text-xs text-muted-foreground mt-1 block">
                          {new Date(digest.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      {digest.topic && (
                        <Badge variant="secondary" className="text-xs mt-2">{digest.topic}</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <HubTvWidget citySlug={citySlug} hubSlug={hubSlug} hubName={hub.name} />

      {isFarmHub && nearbyHubs && nearbyHubs.length > 0 && (
        <div data-testid="related-farm-hubs">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-500" /> Related Farm & Food Hubs
          </h2>
          <div className="flex flex-wrap gap-2">
            {nearbyHubs.map((h: any) => (
              <Link key={h.id} href={`/${citySlug}/hub/${h.slug}`}>
                <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm border-green-500/30 text-green-300 hover:bg-green-500/10" data-testid={`link-farm-hub-${h.slug}`}>
                  {h.name}
                </Badge>
              </Link>
            ))}
            <Link href={`/${citySlug}/${FARM_CATEGORY_SLUG}`}>
              <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm border-green-500/30 text-green-300 hover:bg-green-500/10" data-testid="link-all-farms">
                All Local Farms & Food
              </Badge>
            </Link>
          </div>
        </div>
      )}

      {nearbyHubs && nearbyHubs.length > 0 && !isFarmHub && (
        <div data-testid="nearby-hubs">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5" /> Nearby Hubs
          </h2>
          <div className="flex flex-wrap gap-2">
            {nearbyHubs.map((h: any) => (
              <Link key={h.id} href={`/${citySlug}/hub/${h.slug}`}>
                <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm" data-testid={`link-nearby-hub-${h.slug}`}>
                  {h.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
