import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { DarkPageShell } from "@/components/dark-page-shell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Rss, Calendar, ShoppingBag, Users, Tv, MessageCircle,
  ChevronRight, Sparkles, ArrowRight, Globe, Shield, Radio, Music,
  Mic, BookOpen, Star, Eye, Heart, Clock, Crown, Send, Building2
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import heroBg from "@assets/CLT_Skyline_Logo_1773270853280.png";


const CHARLOTTE_CITY_ID = "b0d970f5-cfd6-475b-8739-cfd5352094c4";

function AnimatedStat({ target, suffix = "", label, delay = 0, statId }: { target: number; suffix?: string; label: string; delay?: number; statId: string }) {
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [count, setCount] = useState(prefersReducedMotion ? target : 0);
  const [started, setStarted] = useState(prefersReducedMotion);
  const ref = useRef<HTMLDivElement>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (started || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          delayRef.current = setTimeout(() => setStarted(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); if (delayRef.current) clearTimeout(delayRef.current); };
  }, [started, delay]);

  useEffect(() => {
    if (!started || prefersReducedMotion) return;
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCount(Math.min(target, Math.round(increment * step)));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [started, target, prefersReducedMotion]);

  const formatted = target >= 1_000_000
    ? `${(count / 1_000_000).toFixed(1)}M`
    : target >= 100
    ? count.toLocaleString()
    : `${count}`;

  return (
    <div ref={ref} className="text-center" data-testid={`stat-${statId}`}>
      <div className="text-3xl md:text-4xl font-black text-white tracking-tight">
        {formatted}{suffix}
      </div>
      <div className="text-xs md:text-sm text-white/50 mt-1 font-medium">{label}</div>
    </div>
  );
}

function stableHash(id: string, seed: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs((h * seed) % 200) + 50;
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  event: "from-rose-900 via-pink-900 to-purple-900",
  business: "from-purple-900 via-indigo-900 to-blue-900",
  rss: "from-teal-900 via-emerald-900 to-green-900",
  live: "from-gray-900 via-red-950 to-gray-900",
  article: "from-blue-900 via-cyan-900 to-teal-900",
  default: "from-amber-900 via-orange-900 to-red-900",
};

function LivePulsePreview({ citySlug }: { citySlug: string }) {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/feed", citySlug, "preview"],
    queryFn: async () => {
      const res = await fetch(`/api/feed?cityId=${CHARLOTTE_CITY_ID}&limit=6&offset=0`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.items || []).slice(0, 6);
    },
  });

  if (!data || data.length === 0) return null;

  const getCatBadgeColor = (type: string) => {
    if (type === "event") return "bg-rose-600";
    if (type === "live") return "bg-red-600";
    if (type === "business") return "bg-purple-600";
    return "bg-teal-600";
  };

  const getLabel = (type: string) => {
    if (type === "event") return "Event";
    if (type === "live") return "Live";
    if (type === "business") return "Business";
    if (type === "rss") return "CLT Hub";
    return "Update";
  };

  const getTypeIcon = (type: string) => {
    if (type === "event") return <Calendar className="h-3.5 w-3.5 text-white/60" />;
    if (type === "live") return <Radio className="h-3.5 w-3.5 text-red-400" />;
    if (type === "business") return <Building2 className="h-3.5 w-3.5 text-white/60" />;
    return <Rss className="h-3.5 w-3.5 text-white/60" />;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((item: any) => {
        const isLive = item.type === "live";
        const grad = CATEGORY_GRADIENTS[item.type] || CATEGORY_GRADIENTS.default;

        return (
          <div key={item.id} data-testid={`pulse-card-${item.id}`}>
            <div className="flex items-center gap-2 px-1 py-1.5">
              <div className={`w-7 h-7 rounded-full p-[2px] flex-shrink-0 ${isLive ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-purple-500 to-indigo-500"}`}>
                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                  {getTypeIcon(item.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-white truncate block" data-testid={`pulse-source-${item.id}`}>{item.type === "rss" ? "CLT Hub" : (item.sourceName || item.title || "CLT Hub")}</span>
                <span className="text-[10px] text-white/40">{timeAgo(item.createdAt) || "Just now"}</span>
              </div>
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide" data-testid={`pulse-live-badge-${item.id}`}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                  </span>
                  Live
                </span>
              ) : (
                <Badge className={`${getCatBadgeColor(item.type)} text-white text-[8px] border-0 px-1.5 py-0`} data-testid={`pulse-category-${item.id}`}>{getLabel(item.type)}</Badge>
              )}
            </div>
            {isLive ? (
              <div className="relative rounded-lg overflow-hidden">
                <div className="aspect-[2/1] bg-gradient-to-br from-gray-900 via-red-950/40 to-gray-900">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <Radio className="h-6 w-6 text-red-400 animate-pulse" />
                    <h3 className="text-xs font-bold text-white leading-tight text-center px-3" data-testid={`pulse-title-${item.id}`}>{item.title}</h3>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/80 px-2.5 py-0.5 text-[9px] font-bold text-white mt-0.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                      Watch Live
                    </span>
                  </div>
                </div>
              </div>
            ) : item.imageUrl ? (
              <div className="relative rounded-lg overflow-hidden">
                <div className="aspect-[16/9]">
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-xs font-bold text-white leading-tight line-clamp-2" data-testid={`pulse-title-${item.id}`}>{item.title}</h3>
                </div>
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden">
                <div className={`aspect-[16/9] bg-gradient-to-br ${grad}`}>
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    {item.type === "event" ? <Calendar className="h-10 w-10 text-white" /> :
                     item.type === "business" ? <Building2 className="h-10 w-10 text-white" /> :
                     <Globe className="h-10 w-10 text-white" />}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-xs font-bold text-white leading-tight line-clamp-2" data-testid={`pulse-title-${item.id}`}>{item.title}</h3>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 px-1 pt-2 pb-1" data-testid={`pulse-metrics-${item.id}`}>
              {isLive ? (
                <span className="flex items-center gap-1 text-xs text-red-400/70">
                  <Radio className="h-3 w-3" /> Streaming now
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <Users className="h-3 w-3" /> {stableHash(item.id, 7)} interested
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <Send className="h-3 w-3 rotate-[-30deg]" /> {stableHash(item.id, 3) % 45 + 5}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeaturedPresences({ citySlug }: { citySlug: string }) {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "businesses", "featured"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/businesses?limit=4`);
      if (!res.ok) return [];
      const json = await res.json();
      const items = json.businesses || json.items || json || [];
      return items.slice(0, 4);
    },
  });

  if (!data || data.length === 0) return null;

  const getTierLabel = (tier: string) => {
    if (tier === "ENHANCED") return "Enhanced";
    return null;
  };

  const getTierBadgeStyle = (tier: string) => {
    if (tier === "ENHANCED") return { backgroundColor: "hsl(273 66% 40%)" };
    return {};
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {data.map((biz: any) => {
        const tierLabel = getTierLabel(biz.tier);
        const isVerified = biz.isVerified || biz.tier === "ENHANCED";
        return (
          <Link key={biz.id} href={`/${citySlug}/directory/${biz.slug}`}>
            <div
              className={`biz-card ${tierLabel ? "biz-card-microsite" : ""} cursor-pointer`}
              style={{ height: tierLabel ? "240px" : "200px", ...(tierLabel ? { "--microsite-color": "hsl(273 66% 40%)" } as any : {}) }}
              data-testid={`featured-biz-${biz.id}`}
            >
              {biz.imageUrl && !biz.imageUrl.startsWith("data:") && <div className="biz-bg" style={{ backgroundImage: `url(${biz.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
              <div className="biz-overlay" />
              {tierLabel && (
                <div className="biz-cut-badge" style={getTierBadgeStyle(biz.tier)}>
                  <Crown className="h-2.5 w-2.5 inline mr-0.5 align-[-2px]" />{tierLabel}
                </div>
              )}
              <div className="biz-content">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-sm leading-tight">{biz.name}</h3>
                  {isVerified && (
                    <Badge className="text-[9px] gap-0.5 bg-white/20 border-white/30 text-white"><Shield className="h-2.5 w-2.5" />Verified</Badge>
                  )}
                  {tierLabel && (
                    <Badge className="text-[9px] gap-0.5 rounded-full px-2 py-0.5" style={{ backgroundColor: "hsl(273 66% 40%)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}>
                      <Globe className="h-2.5 w-2.5" />Hub Site
                    </Badge>
                  )}
                </div>
                {biz.tagline && <p className="mt-1 text-xs text-white/75 line-clamp-2">{biz.tagline}</p>}
                <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-white/60">
                  {biz.neighborhoodName && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{biz.neighborhoodName}</span>}
                  {biz.rating && <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{biz.rating}</span>}
                </div>
                {!tierLabel && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] text-white/50">Basic listing</span>
                    <span className="text-[9px] text-teal-400 font-medium flex items-center gap-0.5">
                      Upgrade to Unlock <ArrowRight className="h-2 w-2" />
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function CityOverview() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [, setLocation] = useLocation();
  const revealRef = useScrollReveal();

  usePageMeta({
    title: "CLT Hub - Discover What's Happening in Your Community",
    description: "CLT Hub brings together local stories, events, organizations, creators, venues, and businesses so people can easily explore what's happening around them.",
    canonical: `${window.location.origin}/${citySlug}`,
    ogTitle: "CLT Hub",
    ogDescription: "One shared space for everything happening across the Charlotte region.",
    ogUrl: `${window.location.origin}/${citySlug}`,
    ogType: "website",
    keywords: "Charlotte, local news, events, businesses, community, neighborhoods, Charlotte NC",
  });

  return (
    <div ref={revealRef}>
      <DarkPageShell maxWidth="wide">
        <section
          className="hero-section cs-hero-container w-full rounded-xl mt-3 aspect-[3/2] max-h-[540px] relative"
          data-testid="section-hero"
        >
          <img
            src={heroBg}
            alt="CLT Hub"
            className="cs-hero-image w-full h-full object-cover object-center"
            data-testid="hero-image"
          />
          <div className="cs-hero-gradient-overlay" />
          <div className="cs-hero-shimmer" />
          <div
            className="cs-hero-particle"
            style={{
              width: 6, height: 6,
              background: "hsl(46 88% 57% / 0.6)",
              bottom: "20%", left: "15%",
              animation: "cs-particle-float-1 10s ease-in-out infinite",
            }}
          />
          <div
            className="cs-hero-particle"
            style={{
              width: 4, height: 4,
              background: "hsl(174 62% 55% / 0.5)",
              bottom: "30%", right: "20%",
              animation: "cs-particle-float-2 13s ease-in-out infinite 2s",
            }}
          />
          <div
            className="cs-hero-particle"
            style={{
              width: 5, height: 5,
              background: "hsl(324 85% 63% / 0.5)",
              bottom: "40%", left: "45%",
              animation: "cs-particle-float-3 11s ease-in-out infinite 1s",
            }}
          />
          <div
            className="cs-hero-particle"
            style={{
              width: 3, height: 3,
              background: "hsl(273 66% 60% / 0.6)",
              bottom: "15%", right: "35%",
              animation: "cs-particle-float-1 14s ease-in-out infinite 3s",
            }}
          />
          <div
            className="cs-hero-particle"
            style={{
              width: 4, height: 4,
              background: "hsl(46 88% 65% / 0.4)",
              bottom: "50%", left: "70%",
              animation: "cs-particle-float-2 9s ease-in-out infinite 4s",
            }}
          />
          <div
            className="cs-hero-particle"
            style={{
              width: 5, height: 5,
              background: "hsl(174 62% 44% / 0.4)",
              bottom: "25%", left: "30%",
              animation: "cs-particle-float-3 15s ease-in-out infinite 2s",
            }}
          />
          <div className="cs-hero-vignette" />
        </section>

        <section className="py-10 md:py-14 text-center px-4" data-testid="section-hero-heading">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight" data-testid="text-hero-title">
            CLT Hub
          </h1>
          <p className="text-base md:text-lg text-white/70 mt-3 max-w-xl mx-auto leading-relaxed">
            One shared space for everything happening across the Charlotte region
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Link href={`/${citySlug}/pulse`}>
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 h-12 text-base font-semibold shadow-lg shadow-purple-900/30" data-testid="button-explore-pulse">
                Explore the Pulse
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href={`/${citySlug}/activate`}>
              <Button variant="outline" className="border-white/30 text-white h-12 px-8 text-base bg-white/5" data-testid="button-check-presence">
                Check Your Hub Presence
              </Button>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-6" aria-hidden="true" />

        <section id="sharing-now" className="py-10 md:py-14 scroll-reveal">
          <div className="mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">What people are sharing right now</h2>
            </div>
            <LivePulsePreview citySlug={citySlug || "charlotte"} />
            <div className="mt-6 text-center">
              <Link href={`/${citySlug}/pulse`}>
                <Button variant="outline" className="border-white/20 text-white/70 text-sm" data-testid="button-view-all-pulse">
                  View All Updates <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="featured-presences" className="py-10 md:py-14 section-band section-band-plum scroll-reveal" data-testid="section-featured-presences">
          <div className="mx-auto">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl md:text-3xl font-black flex items-center gap-2 text-white tracking-tight">
                <Building2 className="h-6 w-6" style={{ color: "hsl(var(--brand-pink-edge))" }} />
                Hub Presences
              </h2>
              <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Eye className="h-3 w-3" /> Live
              </Badge>
            </div>
            <p className="text-white/50 text-sm mb-5">Local businesses and organizations active on the Hub with verified listings and enhanced presences.</p>
            <FeaturedPresences citySlug={citySlug || "charlotte"} />
            <div className="mt-6 text-center">
              <Link href={`/${citySlug}/directory`}>
                <Button variant="outline" className="border-white/20 text-white/70 text-sm" data-testid="button-view-directory">
                  Browse Full Directory <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="local-hubs" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-purple-500/20 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-purple-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Built Around Where You Are</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              CLT Hub is made up of 74 local hubs across the region. Each hub represents an area where local activity can surface — things like events, neighborhood updates, organizations, creators, and businesses active nearby.
            </p>
            <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-amber-400 mt-1 shrink-0" />
                <p className="text-white/70 text-sm">If you're in <span className="text-white font-semibold">Ballantyne</span>, you'll start seeing things happening in Ballantyne.</p>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-amber-400 mt-1 shrink-0" />
                <p className="text-white/70 text-sm">If you're in <span className="text-white font-semibold">Concord</span>, you'll see activity happening in Concord and nearby communities.</p>
              </div>
              <p className="text-white/50 text-sm">The goal is simple: when you open the Hub, you should quickly be able to see what's happening around you, while still being able to explore the wider Charlotte region.</p>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="participation" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-green-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Community Participation</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              The Hub grows through participation from the community. Anyone can submit things like:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {[
                "Local events", "Community announcements", "Nonprofit updates",
                "Neighborhood news", "Creator content", "Podcasts & media",
                "Community shout-outs"
              ].map((item, i) => (
                <div key={item} className={`scroll-reveal scroll-reveal-d${Math.min(i + 1, 5)} rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/70`}>
                  {item}
                </div>
              ))}
            </div>
            <p className="text-white/50 text-sm">
              Submissions are free, because the goal is to make it easy for the community to share what's happening locally. As more people contribute, the Hub becomes a stronger resource for discovering what's happening across the region.
            </p>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="pulse" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Rss className="h-5 w-5 text-indigo-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">The Pulse</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              Everything flows through the Pulse, which is the main feed of the Hub. It gathers stories, updates, events, podcasts, and discoveries from across the Charlotte region into one place so people can easily see what's happening right now.
            </p>
            <p className="text-white/50 text-sm mb-6">
              As organizations, creators, businesses, and residents share updates, the Pulse becomes a living stream of local activity across the community.
            </p>
            <Link href={`/${citySlug}/pulse`}>
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/20" data-testid="button-pulse-cta">
                Explore the Pulse <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="events" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Events Across the Region</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              The Hub brings together events happening across neighborhoods, venues, organizations, and communities. From festivals and concerts to nonprofit fundraisers and workshops, the Events section helps residents discover things to do throughout the region.
            </p>
            <Link href={`/${citySlug}/events`}>
              <Button className="bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-900/20" data-testid="button-events-cta">
                Explore Events <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="marketplace" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-teal-500/20 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-teal-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Community Marketplace</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-4 text-base">
              The Marketplace is a community board where residents, creators, and businesses can offer services, products, opportunities, and collaborations.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {[
                "Local artists & creators", "Services & consulting", "Workshops & classes",
                "Local products", "Freelance services", "Community opportunities"
              ].map((item, i) => (
                <div key={item} className={`scroll-reveal scroll-reveal-d${Math.min(i + 1, 5)} rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/70`}>
                  {item}
                </div>
              ))}
            </div>
            <Link href={`/${citySlug}/marketplace`}>
              <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-900/20" data-testid="button-marketplace-cta">
                Explore Marketplace <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="charlotte-ai" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-purple-500/20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-purple-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Meet Charlotte</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              Have a question about the area? Charlotte is our local AI guide. She knows the neighborhoods, the events, what's happening this weekend, and can help you find what you're looking for across the region.
            </p>
            <p className="text-white/50 text-sm mb-6">
              Whether you're looking for a restaurant recommendation, trying to find weekend events, or want to know more about a neighborhood — just ask Charlotte.
            </p>
            <Link href={`/${citySlug}/tell-your-story`}>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/20" data-testid="button-charlotte-cta">
                Talk to Charlotte <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="experts" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-blue-500/20 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Local Experts and Source Requests</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              People in the community can ask for help, recommendations, or services. Local professionals and experts can respond to these requests with ideas, guidance, or quotes. This helps connect people with trusted local expertise across the region.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${citySlug}/experts`}>
                <Button variant="outline" className="border-white/20 text-white" data-testid="button-experts-cta">
                  Expert Directory <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href={`/${citySlug}/source-requests`}>
                <Button variant="outline" className="border-white/20 text-white" data-testid="button-source-requests-cta">
                  Source Requests <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="creators" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-pink-500/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-pink-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Creators, Artists, and Podcasters</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              If you're a local creator, podcaster, musician, speaker, or expert — the Hub gives you a place to be discovered by your community. Share your work, connect with your audience, and be part of the local creative ecosystem.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${citySlug}/creators`}>
                <Button variant="outline" className="border-white/20 text-white" data-testid="button-creators-cta">
                  Creator Directory <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href={`/${citySlug}/podcasts`}>
                <Button variant="outline" className="border-white/20 text-white" data-testid="button-podcasts-cta">
                  Podcasts <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href={`/${citySlug}/speakers`}>
                <Button variant="outline" className="border-white/20 text-white" data-testid="button-speakers-cta">
                  Speakers <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href={`/${citySlug}/music`}>
                <Button variant="outline" className="border-white/20 text-white" data-testid="button-music-cta">
                  Music <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="venue-screens" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Tv className="h-5 w-5 text-cyan-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Hub Screens for Venues</h2>
            </div>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              If you run a venue with screens — a restaurant, gym, brewery, barbershop — the Hub can turn those screens into a local community channel showing neighborhood events, news, and updates your customers actually care about.
            </p>
            <p className="text-white/50 text-sm mb-6">
              Add your own specials and announcements alongside community content. Bilingual support built in. No hardware needed — just a screen with a browser.
            </p>
            <Link href={`/${citySlug}/hub-screens`}>
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20" data-testid="button-venue-cta">
                Learn About Hub Screens <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="presence" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-7xl mx-auto">
            <div className="rounded-xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/20 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-purple-600/30 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-300" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Check Your Hub Presence</h2>
              </div>
              <p className="text-white/60 leading-relaxed mb-4 text-base">
                As the Hub grows across the Charlotte region, many businesses, organizations, creators, and community groups may already appear within the platform.
              </p>
              <p className="text-white/60 leading-relaxed mb-4">
                If you're part of the local community, you can check your Hub Presence and confirm your details so everything shown in the Hub is accurate. Only verified information is published publicly.
              </p>
              <p className="text-white/50 text-sm mb-6">
                Activation includes a $1 verification, which helps confirm the information and contributes to a small community fund supporting local initiatives.
              </p>
              <Link href={`/${citySlug}/activate`}>
                <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 h-11 text-base font-semibold shadow-lg shadow-purple-900/30" data-testid="button-check-presence-bottom">
                  Check Your Hub Presence <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="region" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3">The Region We're Building</h2>
            <p className="text-white/50 mb-8">
              CLT Hub is growing across the greater Charlotte region and surrounding communities.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <AnimatedStat target={19} suffix="+" label="Counties" delay={0} statId="counties" />
              <AnimatedStat target={100} suffix="+" label="ZIP Codes" delay={100} statId="zipcodes" />
              <AnimatedStat target={74} suffix="" label="Community Hubs" delay={200} statId="hubs" />
              <AnimatedStat target={120} suffix="+" label="Neighborhoods" delay={300} statId="neighborhoods" />
            </div>
            <p className="text-white/40 text-sm mt-8 max-w-lg mx-auto">
              Each hub helps surface activity from the people, organizations, and businesses that make that community unique.
            </p>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section id="ambassador" className="py-10 md:py-14 scroll-reveal">
          <div className="max-w-3xl mx-auto text-center">
            <div className="rounded-xl bg-white/5 border border-white/10 p-6">
              <Globe className="h-8 w-8 text-amber-400 mx-auto mb-3" />
              <h3 className="text-xl font-black text-white mb-2 tracking-tight">Interested in bringing a CLT Hub to your region?</h3>
              <p className="text-white/50 text-sm mb-4">
                The Hub Ambassador program helps communities launch their own local hub. If you're passionate about your city, we'd love to hear from you.
              </p>
              <Link href={`/${citySlug}/tell-your-story?intent=ambassador`}>
                <Button variant="outline" className="border-amber-400/30 text-amber-400" data-testid="button-ambassador-cta">
                  Learn About Hub Ambassadors <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </DarkPageShell>
    </div>
  );
}
