import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { BizImage } from "@/components/biz-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UtensilsCrossed, Palette, Briefcase, Heart, Users, PawPrint,
  MapPin, Calendar, Building2, FileText, ChevronRight, ArrowRight,
  Star, TrendingUp, Sparkles, Home, Mic, Newspaper,
} from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { DarkPageShell } from "@/components/dark-page-shell";

interface FaqItem {
  question: string;
  answer: string;
}


interface VerticalMeta {
  label: string;
  tagline: string;
  icon: typeof UtensilsCrossed;
  gradient: string;
  accentColor: string;
  highlights: { icon: typeof Star; title: string; desc: string }[];
  seoDescription: string;
  faq: FaqItem[];
}

const VERTICAL_META: Record<string, VerticalMeta> = {
  food: {
    label: "Food & Dining",
    tagline: "From craft breweries to James Beard-nominated kitchens, explore the flavors defining Charlotte's culinary identity.",
    icon: UtensilsCrossed,
    gradient: "from-orange-900 via-red-900 to-amber-900",
    accentColor: "hsl(14 90% 58%)",
    seoDescription: "Discover Charlotte's best restaurants, cafes, breweries, and food trucks. Explore local dining, brunch spots, and culinary events across the metro.",
    highlights: [
      { icon: Star, title: "Award-Winning Kitchens", desc: "Charlotte's dining scene spans James Beard nominees, iconic BBQ joints, and a booming craft brewery corridor." },
      { icon: TrendingUp, title: "Growing Food Scene", desc: "New restaurant openings, food halls, and pop-up markets are reshaping neighborhoods across the metro." },
      { icon: Sparkles, title: "Diverse Flavors", desc: "International cuisines, Southern comfort, farm-to-table, and fusion — the Queen City's plate is full." },
    ],
    faq: [
      { question: "What types of restaurants are listed on CLT Hub?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) features all dining categories including fine dining, casual restaurants, cafes, food trucks, breweries, bakeries, and specialty food shops across the Charlotte metro." },
      { question: "How do I find restaurants near me on CLT Hub?", answer: "Use the CLT Hub neighborhood filter to browse restaurants in specific Charlotte areas, or explore by hub to see dining options in your local community." },
      { question: "Are food events included on CLT Hub?", answer: "Yes — food festivals, pop-up dinners, cooking classes, brewery tours, and culinary events are featured alongside restaurant listings on CLT Hub (CLT Metro Hub)." },
    ],
  },
  commerce: {
    label: "Commerce & Business",
    tagline: "Connect with local shops, professional services, and the businesses building Charlotte's economy.",
    icon: Briefcase,
    gradient: "from-slate-900 via-blue-900 to-cyan-900",
    accentColor: "hsl(210 70% 50%)",
    seoDescription: "Find local businesses, professional services, retail shops, and commercial services in the Charlotte metro area.",
    highlights: [
      { icon: Star, title: "Business Hub", desc: "The second-largest banking center in the US, Charlotte is home to Fortune 500 headquarters and a thriving startup ecosystem." },
      { icon: TrendingUp, title: "Small Business Growth", desc: "Local boutiques, professional firms, and service providers are the backbone of Charlotte's neighborhoods." },
      { icon: Sparkles, title: "Innovation Corridor", desc: "Tech incubators, coworking spaces, and maker labs are driving the next wave of Charlotte commerce." },
    ],
    faq: [
      { question: "What types of businesses are listed on CLT Hub Commerce?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) lists retail shops, professional services, law firms, accounting practices, real estate agencies, tech companies, consulting firms, and all commercial businesses in the Charlotte metro." },
      { question: "How can I list my business on CLT Hub?", answer: "Claim your free listing on CLT Hub, then upgrade to Verified or Enhanced for additional features including a microsite, gallery, priority ranking, and more." },
      { question: "Are coworking and office spaces included on CLT Hub?", answer: "Yes — coworking spaces, shared offices, business incubators, and commercial real estate are all part of the CLT Hub (Charlotte Metro Hub) Commerce vertical." },
    ],
  },
  family: {
    label: "Family & Kids",
    tagline: "Kid-friendly activities, top-rated schools, camps, and family fun across the Charlotte metro.",
    icon: Users,
    gradient: "from-pink-900 via-rose-900 to-red-900",
    accentColor: "hsl(324 85% 60%)",
    seoDescription: "Discover family-friendly activities, schools, daycares, camps, and kid-friendly events in Charlotte, NC.",
    highlights: [
      { icon: Star, title: "Top-Rated Schools", desc: "Charlotte-Mecklenburg Schools, acclaimed charter options, and private academies across the region." },
      { icon: TrendingUp, title: "Endless Activities", desc: "Discovery Place, Carowinds, splash pads, playgrounds, sports leagues, and seasonal festivals year-round." },
      { icon: Sparkles, title: "Community Programs", desc: "Libraries, recreation centers, summer camps, and youth organizations in every neighborhood." },
    ],
    faq: [
      { question: "What family activities are listed on CLT Hub?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) features kid-friendly attractions, playgrounds, museums, sports leagues, camps, after-school programs, and seasonal family events throughout the Charlotte metro." },
      { question: "Can I find schools and daycares?", answer: "Yes — public schools, charter schools, private academies, preschools, and daycare centers are listed with details about programs and enrollment." },
      { question: "Are there family-friendly events?", answer: "Absolutely — festivals, story times, outdoor adventures, sports clinics, and community gatherings for families are featured in our events section." },
    ],
  },
  "arts-entertainment": {
    label: "Arts & Entertainment",
    tagline: "Live music, galleries, theater, and the creative pulse of Charlotte's arts community.",
    icon: Palette,
    gradient: "from-purple-900 via-violet-900 to-fuchsia-900",
    accentColor: "hsl(270 80% 60%)",
    seoDescription: "Explore Charlotte's arts and entertainment scene — galleries, live music venues, theaters, museums, and cultural events across the metro.",
    highlights: [
      { icon: Star, title: "Thriving Arts District", desc: "NoDa, South End, and Camp North End anchor Charlotte's visual arts, mural trails, and gallery walks." },
      { icon: TrendingUp, title: "Live Music Capital", desc: "From PNC Music Pavilion to intimate stages at Neighborhood Theatre — Charlotte's live music scene keeps growing." },
      { icon: Sparkles, title: "Cultural Institutions", desc: "Blumenthal Arts, Mint Museum, Harvey B. Gantt Center, and Discovery Place anchor the cultural landscape." },
    ],
    faq: [
      { question: "What types of arts and entertainment are listed on CLT Hub?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) features galleries, live music venues, theaters, comedy clubs, museums, cultural centers, dance studios, and creative spaces across the Charlotte metro." },
      { question: "Are live event listings included?", answer: "Yes — concerts, gallery openings, theater performances, comedy shows, film screenings, and arts festivals are all featured in our events section." },
      { question: "How can I find entertainment near me?", answer: "Use the neighborhood filter to browse venues and events in specific Charlotte areas, or explore by hub to discover entertainment in your local community." },
    ],
  },
  senior: {
    label: "Senior Living & Services",
    tagline: "Resources, communities, and services supporting Charlotte's active senior population.",
    icon: Heart,
    gradient: "from-teal-900 via-emerald-900 to-green-900",
    accentColor: "hsl(160 70% 45%)",
    seoDescription: "Find senior living communities, healthcare services, activities, and resources for older adults in the Charlotte metro area.",
    highlights: [
      { icon: Star, title: "Quality Communities", desc: "Independent living, assisted living, memory care, and continuing care retirement communities across the metro." },
      { icon: TrendingUp, title: "Active Lifestyle", desc: "Senior centers, fitness programs, social clubs, and volunteer opportunities keep Charlotte's seniors engaged." },
      { icon: Sparkles, title: "Support Services", desc: "Healthcare providers, home care, transportation, legal services, and financial planning tailored for seniors." },
    ],
    faq: [
      { question: "What senior services are listed on CLT Hub?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) features senior living communities, healthcare providers, home care services, senior centers, transportation services, legal and financial advisors, and organizations serving older adults." },
      { question: "Are senior events and activities included?", answer: "Yes — fitness classes, social gatherings, educational programs, volunteer opportunities, and community events for seniors are featured in our events section." },
      { question: "How do I find senior resources near me?", answer: "Use the neighborhood filter to browse services in specific Charlotte areas, or explore by hub to find senior resources in your local community." },
    ],
  },
  pets: {
    label: "Pets & Animals",
    tagline: "Vets, groomers, dog parks, pet-friendly spots, and everything for Charlotte's pet community.",
    icon: PawPrint,
    gradient: "from-lime-900 via-green-900 to-emerald-900",
    accentColor: "hsl(90 65% 50%)",
    seoDescription: "Discover pet-friendly businesses, veterinarians, groomers, dog parks, pet stores, and animal services in the Charlotte metro area.",
    highlights: [
      { icon: Star, title: "Pet-Friendly City", desc: "Charlotte boasts dog parks, pet-friendly patios, breweries that welcome four-legged friends, and a growing pet services industry." },
      { icon: TrendingUp, title: "Top-Notch Care", desc: "Veterinary clinics, specialty animal hospitals, groomers, trainers, and pet sitters across every neighborhood." },
      { icon: Sparkles, title: "Community & Events", desc: "Adoption events, dog walks, pet expos, and breed meetups bring Charlotte's pet community together." },
    ],
    faq: [
      { question: "What pet services are listed on CLT Hub?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) features veterinary clinics, groomers, pet stores, dog parks, pet-friendly restaurants, boarding facilities, trainers, and animal rescue organizations across the Charlotte metro." },
      { question: "Can I find pet-friendly businesses?", answer: "Yes — restaurants, breweries, shops, and venues that welcome pets are tagged and searchable in our directory." },
      { question: "Are pet events included?", answer: "Absolutely — adoption events, dog walks, pet expos, training workshops, and community gatherings for pet owners are featured in our events section." },
    ],
  },
  relocation: {
    label: "Relocation & Moving",
    tagline: "Neighborhood guides, real estate services, movers, and everything newcomers need to make Charlotte home.",
    icon: Home,
    gradient: "from-sky-900 via-blue-900 to-indigo-900",
    accentColor: "hsl(200 70% 50%)",
    seoDescription: "Moving to Charlotte? Find neighborhood guides, real estate agents, moving companies, utilities setup, and relocation resources for the Charlotte metro area.",
    highlights: [
      { icon: Star, title: "Neighborhood Guides", desc: "Detailed profiles of Charlotte's best neighborhoods — from South End's urban energy to Ballantyne's suburban charm." },
      { icon: TrendingUp, title: "Top Relocation Market", desc: "Charlotte consistently ranks among the top US cities for relocation, with affordable housing and strong job growth." },
      { icon: Sparkles, title: "Newcomer Resources", desc: "Moving companies, utility setup, school enrollment, DMV guides, and local tips from residents who've been there." },
    ],
    faq: [
      { question: "What relocation resources are available on CLT Hub?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) provides neighborhood guides, real estate agent listings, moving company directories, utility setup checklists, school information, and local orientation resources for newcomers to Charlotte." },
      { question: "How do I choose the right neighborhood?", answer: "Our neighborhood guides cover commute times, cost of living, school ratings, walkability, dining options, and community character to help you find the perfect fit." },
      { question: "Are there resources for corporate relocations?", answer: "Yes — we list corporate relocation services, temporary housing, area orientation tours, and spouse/partner career assistance programs." },
    ],
  },
  speakers: {
    label: "Speakers & Experts",
    tagline: "Find Charlotte's top keynote speakers, panelists, thought leaders, and subject matter experts for your next event.",
    icon: Mic,
    gradient: "from-violet-900 via-purple-900 to-fuchsia-900",
    accentColor: "hsl(280 70% 55%)",
    seoDescription: "Find local speakers, keynote presenters, panelists, and thought leaders in Charlotte, NC. Book experts for conferences, corporate events, and community programs.",
    highlights: [
      { icon: Star, title: "Local Thought Leaders", desc: "CEOs, entrepreneurs, authors, academics, and community leaders available for speaking engagements across the Charlotte metro." },
      { icon: TrendingUp, title: "Diverse Expertise", desc: "Technology, finance, healthcare, DEI, leadership, marketing, real estate, and dozens of other specialties represented." },
      { icon: Sparkles, title: "Event-Ready", desc: "Keynotes, panel discussions, fireside chats, workshops, and podcast interviews — Charlotte's speakers are ready for any format." },
    ],
    faq: [
      { question: "How do I find a speaker on CLT Hub?", answer: "Browse the CLT Hub speaker directory by topic, expertise area, or neighborhood. Each profile includes speaking topics, past engagements, and contact information." },
      { question: "What types of speakers are listed on CLT Hub?", answer: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) features keynote speakers, panelists, workshop facilitators, moderators, podcast guests, and subject matter experts across business, tech, healthcare, education, and community topics." },
      { question: "Can I list myself as a speaker?", answer: "Yes — create a profile and highlight your speaking topics, availability, and past engagements to connect with event organizers across Charlotte." },
    ],
  },
  sources: {
    label: "Local Sources",
    tagline: "Connect journalists and content creators with Charlotte's expert voices, community leaders, and local professionals.",
    icon: Newspaper,
    gradient: "from-amber-900 via-orange-900 to-yellow-900",
    accentColor: "hsl(35 80% 50%)",
    seoDescription: "Find expert sources in Charlotte, NC for media interviews, news stories, and content creation. Connect with local professionals, community leaders, and subject matter experts.",
    highlights: [
      { icon: Star, title: "Expert Voices", desc: "Doctors, lawyers, engineers, educators, business owners, and nonprofit leaders ready to share their expertise with media." },
      { icon: TrendingUp, title: "Local Perspective", desc: "Authentic Charlotte voices providing context, commentary, and insight on local issues, trends, and developments." },
      { icon: Sparkles, title: "Quick Connect", desc: "Find the right source fast — filter by topic, neighborhood, and availability for deadline-driven journalism." },
    ],
    faq: [
      { question: "Who can be listed as a local source on CLT Hub?", answer: "Any Charlotte-area professional, community leader, academic, or expert willing to speak with journalists, podcasters, and content creators about their area of expertise can be listed on CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub)." },
      { question: "How do journalists use this directory?", answer: "Search by topic, expertise area, or neighborhood to find local experts for interviews, background information, quotes, and on-camera commentary." },
      { question: "Is this like HARO (Help a Reporter Out)?", answer: "Similar concept, but hyper-local to Charlotte. We connect local media, bloggers, and content creators directly with neighborhood-level experts and community voices." },
    ],
  },
};

const VERTICAL_KEYS = ["food", "arts-entertainment", "commerce", "senior", "family", "pets", "relocation", "speakers", "sources"] as const;

interface LandingBusiness {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  imageUrl: string | null;
  listingTier: string | null;
  zip: string | null;
  categorySlug: string | null;
}

interface LandingEvent {
  id: string;
  title: string;
  startDateTime: string | null;
  locationName: string | null;
}

interface LandingArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
}

interface LandingCategory {
  id: string;
  name: string;
  slug: string;
}

interface LandingHub {
  name: string;
  slug: string;
  code: string;
}

interface VerticalLandingData {
  verticalKey: string;
  cityName: string;
  totalBusinesses: number;
  totalEvents: number;
  featuredBusinesses: LandingBusiness[];
  upcomingEvents: LandingEvent[];
  recentArticles: LandingArticle[];
  matchedCategories: LandingCategory[];
  hubs: LandingHub[];
  hub: { name: string; code: string; description: string | null } | null;
}

interface VerticalLandingProps {
  citySlug: string;
  verticalKey: string;
  hubSlug?: string;
  bare?: boolean;
}

export default function VerticalLanding({ citySlug, verticalKey, hubSlug, bare }: VerticalLandingProps) {
  const meta = VERTICAL_META[verticalKey];

  const queryKey = hubSlug
    ? `/api/cities/${citySlug}/verticals/${verticalKey}/landing?hub=${hubSlug}`
    : `/api/cities/${citySlug}/verticals/${verticalKey}/landing`;

  const { data, isLoading } = useQuery<VerticalLandingData>({
    queryKey: [queryKey],
  });

  const cityName = data?.cityName || citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const hubName = data?.hub?.name || (hubSlug ? hubSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null);
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "category") : null;

  usePageMeta({
    title: meta
      ? `${meta.label}${hubName ? ` in ${hubName}` : ""} — ${cityName} ${brand?.titleSuffix || "| CLT Metro Hub"}`
      : (brand?.ogSiteName || "CLT Metro Hub"),
    description: meta?.seoDescription || "",
    canonical: `${window.location.origin}/${citySlug}${hubSlug ? `/${hubSlug}` : ""}/${verticalKey}`,
    ogType: "website",
    ogSiteName: brand?.ogSiteName,
    keywords: meta ? `${meta.label}, ${cityName}, local businesses, events, ${verticalKey}, CLT Hub` : "",
  });

  if (!meta) {
    const notFoundContent = (
      <Card className="p-12 text-center bg-white/5 border-white/10">
        <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-vertical-not-found">Page not found</h3>
        <Link href={`/${citySlug}`}>
          <Button variant="outline" className="gap-2 border-white/20 text-white" data-testid="link-back-home">
            Back to Home
          </Button>
        </Link>
      </Card>
    );
    if (bare) return <div className="max-w-6xl mx-auto px-4 py-6">{notFoundContent}</div>;
    return <DarkPageShell maxWidth="wide">{notFoundContent}</DarkPageShell>;
  }

  const Icon = meta.icon;
  const Shell = bare ? ({ children }: { children: ReactNode }) => <div className="max-w-6xl mx-auto px-4 py-6">{children}</div> : ({ children }: { children: ReactNode }) => <DarkPageShell maxWidth="wide">{children}</DarkPageShell>;

  return (
    <Shell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${meta.label}${hubName ? ` in ${hubName}` : ""} — ${cityName}`,
        description: meta.seoDescription,
        url: `${window.location.origin}/${citySlug}${hubSlug ? `/${hubSlug}` : ""}/${verticalKey}`,
        isPartOf: {
          "@type": "WebSite",
          name: brand?.jsonLdName || "CLT Metro Hub",
          alternateName: branding?.brandVariants || [],
          ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
        },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: meta.faq.map(f => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }} />

      <section className="mb-10" data-testid="section-hero">
        <div className={`rounded-xl bg-gradient-to-br ${meta.gradient} p-8 md:p-12`}>
          <div className="flex items-center gap-3 mb-4">
            <Icon className="h-8 w-8" style={{ color: meta.accentColor }} />
            <h1 className="text-3xl md:text-4xl font-bold text-white" data-testid="text-vertical-title">
              {meta.label}{hubName ? ` in ${hubName}` : ""}
            </h1>
          </div>
          <p className="text-lg text-white/70 max-w-2xl" data-testid="text-vertical-tagline">{meta.tagline}</p>
          {data && (
            <div className="flex items-center gap-4 mt-6 text-sm text-white/50">
              <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {data.totalBusinesses} businesses</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {data.totalEvents} events</span>
            </div>
          )}
        </div>
      </section>

      <section className="mb-10" data-testid="section-highlights">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {meta.highlights.map((h, i) => {
            const HIcon = h.icon;
            return (
              <Card key={i} className="bg-white/5 border-white/10" data-testid={`card-highlight-${i}`}>
                <CardContent className="p-5">
                  <HIcon className="h-5 w-5 mb-2" style={{ color: meta.accentColor }} />
                  <h3 className="font-semibold text-sm text-white mb-1">{h.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{h.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {isLoading && (
        <div className="space-y-4" data-testid="skeleton-loading">
          <Skeleton className="h-8 w-48 bg-white/10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 bg-white/10 rounded-lg" />)}
          </div>
        </div>
      )}

      {data && (
        <>
          {data.featuredBusinesses.length > 0 && (
            <section className="mb-10" data-testid="section-featured-businesses">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5" style={{ color: meta.accentColor }} />
                  Featured {meta.label} Businesses
                </h2>
                <Link href={`/${citySlug}/directory`}>
                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 gap-1" data-testid="link-view-all-businesses">
                    View All <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.featuredBusinesses.map((biz) => (
                  <Link key={biz.id} href={`/${citySlug}/${biz.categorySlug || "directory"}/${biz.slug}`}>
                    <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg bg-white/5 border-white/10" data-testid={`card-business-${biz.id}`}>
                      <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                        <BizImage src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover" />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm text-white line-clamp-1" data-testid={`text-biz-name-${biz.id}`}>{biz.name}</h3>
                        {biz.tagline && <p className="text-xs text-white/50 line-clamp-2 mt-1">{biz.tagline}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          {biz.listingTier && biz.listingTier !== "FREE" && (
                            <Badge variant="outline" className="text-xs border-white/20 text-white/70" data-testid={`badge-tier-${biz.id}`}>{biz.listingTier}</Badge>
                          )}
                          {biz.zip && <span className="text-xs text-white/40">{biz.zip}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.upcomingEvents.length > 0 && (
            <section className="mb-10" data-testid="section-upcoming-events">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5" style={{ color: meta.accentColor }} />
                  Upcoming Events
                </h2>
                <Link href={`/${citySlug}/events`}>
                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 gap-1" data-testid="link-view-all-events">
                    All Events <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.upcomingEvents.map((evt) => (
                  <Card key={evt.id} className="bg-white/5 border-white/10" data-testid={`card-event-${evt.id}`}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm text-white line-clamp-2">{evt.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-white/50 mt-2">
                        <Calendar className="h-3 w-3" />
                        {evt.startDateTime
                          ? new Date(evt.startDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "TBD"}
                      </div>
                      {evt.locationName && (
                        <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="line-clamp-1">{evt.locationName}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {data.recentArticles.length > 0 && (
            <section className="mb-10" data-testid="section-recent-articles">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" style={{ color: meta.accentColor }} />
                  Latest Articles
                </h2>
                <Link href={`/${citySlug}/articles`}>
                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 gap-1" data-testid="link-view-all-articles">
                    All Articles <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.recentArticles.map((art) => (
                  <Link key={art.id} href={`/${citySlug}/articles/${art.slug}`}>
                    <Card className="cursor-pointer transition-shadow hover:shadow-lg bg-white/5 border-white/10 h-full" data-testid={`card-article-${art.id}`}>
                      {art.imageUrl && (
                        <div className="aspect-video overflow-hidden rounded-t-lg">
                          <img src={art.imageUrl} alt={art.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm text-white line-clamp-2">{art.title}</h3>
                        {art.excerpt && <p className="text-xs text-white/50 line-clamp-2 mt-1">{art.excerpt}</p>}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.matchedCategories.length > 0 && (
            <section className="mb-10" data-testid="section-categories">
              <h2 className="text-lg font-bold text-white mb-3">Browse by Category</h2>
              <div className="flex flex-wrap gap-2">
                {data.matchedCategories.map((cat) => (
                  <Link key={cat.id} href={`/${citySlug}/${cat.slug}`}>
                    <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm border-white/20 text-white/70 hover:bg-white/10" data-testid={`badge-cat-${cat.slug}`}>
                      {cat.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!hubSlug && data.hubs.length > 0 && (
            <section className="mb-10" data-testid="section-explore-by-hub">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <MapPin className="h-5 w-5" style={{ color: meta.accentColor }} />
                Explore by Neighborhood
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.hubs.map((hub) => (
                  <Link key={hub.code} href={`/${citySlug}/${hub.slug}/${verticalKey}`}>
                    <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm border-white/20 text-white/70 hover:bg-white/10" data-testid={`badge-hub-${hub.slug}`}>
                      {hub.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {verticalKey === "speakers" && (
            <section className="mb-10" data-testid="section-speakers-cta">
              <Card className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-white/10 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white mb-1">Browse the Full Speaker Directory</h3>
                    <p className="text-white/60 text-sm">Search by topic, availability, and location in our interactive directory.</p>
                  </div>
                  <Link href={`/${citySlug}/speakers/directory`}>
                    <Button className="gap-2 bg-white/10 text-white border border-white/20 hover:bg-white/20" data-testid="button-speakers-directory">
                      <ArrowRight className="h-4 w-4" /> Speaker Directory
                    </Button>
                  </Link>
                </div>
              </Card>
            </section>
          )}

          {verticalKey === "sources" && (
            <section className="mb-10" data-testid="section-sources-cta">
              <Card className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border-white/10 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white mb-1">Active Source Requests</h3>
                    <p className="text-white/60 text-sm">See what journalists and creators are looking for right now.</p>
                  </div>
                  <Link href={`/${citySlug}/source-requests`}>
                    <Button className="gap-2 bg-white/10 text-white border border-white/20 hover:bg-white/20" data-testid="button-source-requests">
                      <ArrowRight className="h-4 w-4" /> View Requests
                    </Button>
                  </Link>
                </div>
              </Card>
            </section>
          )}

          {verticalKey === "relocation" && (
            <div className="space-y-4 mb-10">
              <section data-testid="section-housing-cta">
                <Link href={`/${citySlug}/relocation/housing`}>
                  <Card className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-emerald-500/20 p-6 cursor-pointer transition-colors hover:border-emerald-500/40">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div>
                          <h3 className="font-semibold text-white mb-1">Housing & Real Estate Directory</h3>
                          <p className="text-white/60 text-sm">Apartment communities, realtors, and property managers across the Charlotte metro</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-emerald-400 shrink-0 hidden sm:block" />
                    </div>
                  </Card>
                </Link>
              </section>
              <section data-testid="section-relocation-cta">
                <Card className="bg-gradient-to-r from-sky-900/40 to-blue-900/40 border-white/10 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-white mb-1">Moving to Charlotte Guide</h3>
                      <p className="text-white/60 text-sm">Comprehensive relocation guide with neighborhood profiles, cost of living, and newcomer tips.</p>
                    </div>
                    <Link href={`/${citySlug}/moving-to-charlotte`}>
                      <Button className="gap-2 bg-white/10 text-white border border-white/20" data-testid="button-moving-guide">
                        <ArrowRight className="h-4 w-4" /> Read Guide
                      </Button>
                    </Link>
                  </div>
                </Card>
              </section>
            </div>
          )}

          <section className="mb-10" data-testid="section-faq">
            <h2 className="text-lg font-bold text-white mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {meta.faq.map((f, i) => (
                <Card key={i} className="bg-white/5 border-white/10" data-testid={`card-faq-${i}`}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm text-white mb-1.5">{f.question}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{f.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {!hubSlug && (
            <section className="mb-10" data-testid="section-explore-other-verticals">
              <h2 className="text-lg font-bold text-white mb-3">Explore More</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {VERTICAL_KEYS.filter(k => k !== verticalKey).map(k => {
                  const vm = VERTICAL_META[k];
                  if (!vm) return null;
                  const VIcon = vm.icon;
                  return (
                    <Link key={k} href={`/${citySlug}/${k}`}>
                      <Card className="cursor-pointer transition-shadow hover:shadow-lg bg-white/5 border-white/10 text-center p-4" data-testid={`card-vertical-${k}`}>
                        <VIcon className="h-6 w-6 mx-auto mb-2" style={{ color: vm.accentColor }} />
                        <span className="text-sm font-medium text-white">{vm.label}</span>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
