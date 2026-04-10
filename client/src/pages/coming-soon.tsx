import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import {
  MapPin, Building2, Calendar, FileText, Users, Crown,
  Sparkles, Star, ArrowRight, Clock,
  Shield, Globe, Store, MapPinned,
  Eye, Rss, UserPlus,
  Languages, Megaphone, HandHeart, Heart,
  Image, Check, Tag, User, Ticket, BookOpen, Timer, Palette, Music, Utensils,
  Briefcase, DollarSign, Home, ShoppingBag, Send, ChevronDown, X,
} from "lucide-react";
import { Link } from "wouter";
import heroBg from "@assets/CLT_Hub_Hero_Neighborhood_1771812466592.png";
import cosmicBg from "@assets/General_Backgroun_CLT_colors_1771643702572.png";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import { DarkPageShell } from "@/components/dark-page-shell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { useGeoHub } from "@/hooks/use-geo-hub";
import { REGION_STATS } from "@shared/region-stats";

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

function SampleDisclaimer({ variant }: { variant: "presences" | "events" | "articles" | "marketplace" }) {
  const { t } = useI18n();
  const keys: Record<string, "cs.disclaimerPresences" | "cs.disclaimerEvents" | "cs.disclaimerArticles" | "cs.disclaimerMarketplace"> = {
    presences: "cs.disclaimerPresences",
    events: "cs.disclaimerEvents",
    articles: "cs.disclaimerArticles",
    marketplace: "cs.disclaimerMarketplace",
  };
  return (
    <div className="mb-4 rounded-lg border border-amber-600/40 bg-amber-950/60 px-4 py-2.5 text-xs leading-relaxed text-amber-100/90" data-testid={`disclaimer-${variant}`}>
      <span className="mr-1.5 font-bold uppercase tracking-wide text-amber-300">{t("cs.disclaimerLabel")}</span>
      {t(keys[variant])}
    </div>
  );
}

const SAMPLE_EVENTS_DATA = [
  {
    id: "sample-evt-1", slug: "noda-first-friday-art-walk",
    titleKey: "cs.evtNodaTitle" as const, descKey: "cs.evtNodaDesc" as const,
    startDateTime: new Date(Date.now() + 7 * 86400000).toISOString(),
    endDateTime: new Date(Date.now() + 7 * 86400000 + 4 * 3600000).toISOString(),
    locationKey: "cs.evtLocNoda" as const, locationAddress: "3000 N Davidson St, Charlotte, NC",
    costKey: "cs.evtCostFree" as const, categoryKey: "cs.evtCatArts" as const,
    organizerKey: "cs.evtOrgNoda" as const, neighborhood: "NoDa",
    tagKeys: ["cs.evtTagFamilyFriendly", "cs.evtTagOutdoor", "cs.evtTagFree", "cs.evtTagMonthly"] as const,
    featured: true,
  },
  {
    id: "sample-evt-2", slug: "south-end-food-truck-friday",
    titleKey: "cs.evtFoodTruckTitle" as const, descKey: "cs.evtFoodTruckDesc" as const,
    startDateTime: new Date(Date.now() + 10 * 86400000).toISOString(),
    endDateTime: new Date(Date.now() + 10 * 86400000 + 5 * 3600000).toISOString(),
    locationKey: "cs.evtLocAtherton" as const, locationAddress: "2104 South Blvd, Charlotte, NC",
    costKey: "cs.evtCostFreeEntry" as const, categoryKey: "cs.evtCatFood" as const,
    organizerKey: "cs.evtOrgSouthEnd" as const, neighborhood: "South End",
    tagKeys: ["cs.evtTagFamilyFriendly", "cs.evtTagOutdoor", "cs.evtTagFood", "cs.evtTagWeekly"] as const,
    featured: false,
  },
  {
    id: "sample-evt-3", slug: "queen-city-startup-pitch-night",
    titleKey: "cs.evtPitchTitle" as const, descKey: "cs.evtPitchDesc" as const,
    startDateTime: new Date(Date.now() + 14 * 86400000).toISOString(),
    endDateTime: new Date(Date.now() + 14 * 86400000 + 3 * 3600000).toISOString(),
    locationKey: "cs.evtLocPackard" as const, locationAddress: "222 S Church St, Charlotte, NC",
    costKey: "cs.evtCost15" as const, categoryKey: "cs.evtCatTech" as const,
    organizerKey: "cs.evtOrgTech" as const, neighborhood: "Uptown",
    tagKeys: ["cs.evtTagNetworking", "cs.evtTagStartups", "cs.evtTagIndoor"] as const,
    featured: false,
  },
  {
    id: "sample-evt-4", slug: "camp-north-end-night-market",
    titleKey: "cs.evtMarketTitle" as const, descKey: "cs.evtMarketDesc" as const,
    startDateTime: new Date(Date.now() + 21 * 86400000).toISOString(),
    endDateTime: new Date(Date.now() + 21 * 86400000 + 5 * 3600000).toISOString(),
    locationKey: "cs.evtLocCamp" as const, locationAddress: "1824 Statesville Ave, Charlotte, NC",
    costKey: "cs.evtCostFree" as const, categoryKey: "cs.evtCatMusic" as const,
    organizerKey: "cs.evtOrgCamp" as const, neighborhood: "Camp North End",
    tagKeys: ["cs.evtTagOutdoor", "cs.evtTagFree", "cs.evtTagNightlife", "cs.evtTagShopping"] as const,
    featured: false,
  },
];

const SAMPLE_ARTICLES_DATA = [
  {
    id: "sample-art-1", slug: "10-hidden-gems-south-end",
    titleKey: "cs.artHiddenGemsTitle" as const, excerptKey: "cs.artHiddenGemsExcerpt" as const,
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    author: "Maya Chen", authorRoleKey: "cs.artRoleCommunityReporter" as const,
    categoryKey: "cs.artCatNeighborhoods" as const, readMin: "5",
    tagKeys: ["cs.artTagSouthEnd", "cs.artTagLocalGuides", "cs.artTagHiddenGems"] as const,
    featured: true,
  },
  {
    id: "sample-art-2", slug: "noda-charlottes-creative-capital",
    titleKey: "cs.artNodaTitle" as const, excerptKey: "cs.artNodaExcerpt" as const,
    publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    author: "James Porter", authorRoleKey: "cs.artRoleArtsCultureEditor" as const,
    categoryKey: "cs.artCatArts" as const, readMin: "7",
    tagKeys: ["cs.artTagNoDa", "cs.artTagArts", "cs.artTagHistory"] as const,
    featured: false,
  },
  {
    id: "sample-art-3", slug: "charlotte-food-truck-guide",
    titleKey: "cs.artFoodTruckTitle" as const, excerptKey: "cs.artFoodTruckExcerpt" as const,
    publishedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    author: "Sofia Martinez", authorRoleKey: "cs.artRoleFoodEditor" as const,
    categoryKey: "cs.artCatFood" as const, readMin: "6",
    tagKeys: ["cs.artTagFoodTrucks", "cs.artTagDiningGuide", "cs.artTagLocalFood"] as const,
    featured: false,
  },
  {
    id: "sample-art-4", slug: "community-spotlight-clt-tutoring",
    titleKey: "cs.artTutoringTitle" as const, excerptKey: "cs.artTutoringExcerpt" as const,
    publishedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    author: "David Kim", authorRoleKey: "cs.artRoleCommunityEditor" as const,
    categoryKey: "cs.artCatCommunity" as const, readMin: "4",
    tagKeys: ["cs.artTagVolunteers", "cs.artTagEducation", "cs.artTagCommunityImpact"] as const,
    featured: false,
  },
  {
    id: "sample-art-5", slug: "charlotte-apartment-boom",
    titleKey: "cs.artApartmentTitle" as const, excerptKey: "cs.artApartmentExcerpt" as const,
    publishedAt: new Date(Date.now() - 22 * 86400000).toISOString(),
    author: "Taylor Brooks", authorRoleKey: "cs.artRoleRealEstateReporter" as const,
    categoryKey: "cs.artCatRealEstate" as const, readMin: "5",
    tagKeys: ["cs.artTagApartments", "cs.artTagDevelopment", "cs.artTagHousing"] as const,
    featured: false,
  },
];

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  "cs.evtCatArts": "bg-purple-600",
  "cs.evtCatFood": "bg-orange-600",
  "cs.evtCatTech": "bg-blue-600",
  "cs.evtCatMusic": "bg-pink-600",
};

const ARTICLE_CATEGORY_COLORS: Record<string, string> = {
  "cs.artCatNeighborhoods": "bg-teal-600",
  "cs.artCatArts": "bg-purple-600",
  "cs.artCatFood": "bg-orange-600",
  "cs.artCatCommunity": "bg-pink-600",
  "cs.artCatRealEstate": "bg-blue-600",
};

const SAMPLE_MARKETPLACE_DATA = [
  {
    id: "mkt-1", type: "JOB" as const,
    titleKey: "cs.mktLineCookTitle" as const, descKey: "cs.mktLineCookDesc" as const,
    companyKey: "cs.mktLineCookCompany" as const,
    location: "South End", neighborhood: "South End",
    salary: "$18–22/hr",
    tagKeys: ["cs.mktTagFullTime", "cs.mktTagFoodDrink"] as const,
  },
  {
    id: "mkt-2", type: "JOB" as const,
    titleKey: "cs.mktMarketingTitle" as const, descKey: "cs.mktMarketingDesc" as const,
    companyKey: "cs.mktMarketingCompany" as const,
    location: "Uptown", neighborhood: "Uptown",
    salary: "$50–60K",
    tagKeys: ["cs.mktTagFullTime", "cs.mktTagTech"] as const,
  },
  {
    id: "mkt-3", type: "JOB" as const,
    titleKey: "cs.mktBaristaTitle" as const, descKey: "cs.mktBaristaDesc" as const,
    companyKey: "cs.mktBaristaCompany" as const,
    location: "NoDa", neighborhood: "NoDa",
    salary: "$14/hr + tips",
    tagKeys: ["cs.mktTagPartTime", "cs.mktTagFoodDrink"] as const,
  },
  {
    id: "mkt-4", type: "JOB" as const,
    titleKey: "cs.mktPropertyTitle" as const, descKey: "cs.mktPropertyDesc" as const,
    companyKey: "cs.mktPropertyCompany" as const,
    location: "Ballantyne", neighborhood: "Ballantyne",
    salary: "$55–70K",
    tagKeys: ["cs.mktTagFullTime", "cs.mktTagRealEstate"] as const,
  },
  {
    id: "mkt-5", type: "FOR_RENT" as const,
    titleKey: "cs.mktVueTitle" as const, descKey: "cs.mktVueDesc" as const,
    companyKey: "cs.mktVueCompany" as const,
    location: "Uptown", neighborhood: "Uptown",
    salary: "$1,850/mo",
    tagKeys: ["cs.mktTag1Bed", "cs.mktTagLuxury"] as const,
  },
  {
    id: "mkt-6", type: "FOR_RENT" as const,
    titleKey: "cs.mktNovelTitle" as const, descKey: "cs.mktNovelDesc" as const,
    companyKey: "cs.mktNovelCompany" as const,
    location: "NoDa", neighborhood: "NoDa",
    salary: "$1,650/mo",
    tagKeys: ["cs.mktTag2Bed", "cs.mktTagTransit"] as const,
  },
  {
    id: "mkt-7", type: "FOR_RENT" as const,
    titleKey: "cs.mktCamdenTitle" as const, descKey: "cs.mktCamdenDesc" as const,
    companyKey: "cs.mktCamdenCompany" as const,
    location: "South End", neighborhood: "South End",
    salary: "$1,350/mo",
    tagKeys: ["cs.mktTagStudio", "cs.mktTagPetFriendly"] as const,
  },
  {
    id: "mkt-8", type: "FOR_RENT" as const,
    titleKey: "cs.mktBallantyneTitle" as const, descKey: "cs.mktBallantyneDesc" as const,
    companyKey: "cs.mktBallantyneCompany" as const,
    location: "Ballantyne", neighborhood: "Ballantyne",
    salary: "$2,400/mo",
    tagKeys: ["cs.mktTag3Bed", "cs.mktTagTownhome"] as const,
  },
];

function AmbassadorInterestForm({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", neighborhood: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/cities/${citySlug}/ambassador-inquiries`, formData);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Interest submitted", description: "We'll be in touch soon about the Ambassador Program." });
    },
    onError: () => {
      toast({ title: "Something went wrong", variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="text-center py-4" data-testid="text-ambassador-submitted">
        <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
        <p className="text-white font-semibold">Thanks for your interest!</p>
        <p className="text-sm text-white/60 mt-1">We'll review your submission and reach out soon.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Your name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
          data-testid="input-amb-interest-name"
        />
        <Input
          type="email"
          placeholder="Email address"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
          data-testid="input-amb-interest-email"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Phone (optional)"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
          data-testid="input-amb-interest-phone"
        />
        <Input
          placeholder="Your neighborhood"
          value={formData.neighborhood}
          onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
          data-testid="input-amb-interest-neighborhood"
        />
      </div>
      <Input
        placeholder="Why are you interested? (optional)"
        value={formData.message}
        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
        data-testid="input-amb-interest-message"
      />
      <Button
        onClick={() => mutation.mutate()}
        disabled={!formData.name.trim() || !formData.email.includes("@") || mutation.isPending}
        className="h-10 bg-purple-500 text-white font-semibold w-fit"
        data-testid="button-amb-interest-submit"
      >
        {mutation.isPending ? "Submitting..." : "Learn More"}
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

export default function ComingSoon({ citySlug, onEnterPreview }: { citySlug: string; onEnterPreview?: () => void }) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const revealRef = useScrollReveal();
  const dateFmtLocale = locale === "es" ? "es-ES" : "en-US";
  const [email, setEmail] = useState("");
  const [mktFilter, setMktFilter] = useState<"ALL" | "JOB" | "FOR_RENT">("ALL");
  const [mktInquiry, setMktInquiry] = useState({ name: "", email: "", _hp_field: "" });
  const [mktSubmitted, setMktSubmitted] = useState(false);
  const [mktSubmitting, setMktSubmitting] = useState(false);
  const [mktFormLoadedAt] = useState(() => Date.now());
  const [expandedCounty, setExpandedCounty] = useState<string | null>("Mecklenburg County");
  const [geoBannerDismissed, setGeoBannerDismissed] = useState(false);
  const { nearestHub, county: geoCounty, distanceMiles, isLocating } = useGeoHub(citySlug);

  const { data: coverageData, isLoading: coverageLoading, isError: coverageError } = useQuery<{ counties: any[] }>({
    queryKey: ["/api/cities", citySlug, "coverage"],
    queryFn: async () => {
      const r = await fetch(`/api/cities/${citySlug}/coverage`);
      if (!r.ok) throw new Error("Failed to load coverage data");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (geoCounty && !isLocating && coverageData?.counties) {
      const regions = (coverageData.counties || []).map((c: any) => {
        const sc = c.stateCode === "SC";
        const name = c.county.toLowerCase().includes("county") ? c.county : `${c.county} County`;
        return sc ? `${name}, SC` : name;
      });
      const match = regions.find((r: string) => r.startsWith(geoCounty));
      if (match) setExpandedCounty(match);
    }
  }, [geoCounty, isLocating, coverageData]);

  const getCountyCols = () => {
    if (typeof window === "undefined") return 3;
    const w = window.innerWidth;
    if (w >= 768) return 6;
    if (w >= 640) return 4;
    return 3;
  };
  const [countyCols, setCountyCols] = useState(getCountyCols);
  useEffect(() => {
    const onResize = () => setCountyCols(getCountyCols());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  usePageMeta({
    title: "CLT Hub Preview — Coming Soon",
    description: "Preview of the CLT Hub platform experience.",
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/cities/${citySlug}/subscribers`, { email });
    },
    onSuccess: () => {
      toast({ title: t("cs.welcomeHub"), description: t("cs.welcomeHubDesc") });
      setEmail("");
    },
    onError: () => {
      toast({ title: t("cs.alreadyInHub"), variant: "destructive" });
    },
  });

  return (
    <div ref={revealRef}>
      <DarkPageShell maxWidth="wide">
      {onEnterPreview && (
        <button
          data-testid="button-enter-dev-preview"
          onClick={onEnterPreview}
          className="fixed bottom-20 md:bottom-4 right-4 z-[9999] bg-amber-500 text-black text-xs font-semibold px-4 py-2 rounded-lg shadow-lg"
        >
          Preview Full Site
        </button>
      )}
      <h1 className="sr-only">CLT Hub — Charlotte's Neighborhood-First Platform for Local Businesses, Events & Community</h1>
        <section
          className="hero-section cs-hero-container w-full rounded-xl mt-3 aspect-[3/2] max-h-[540px]"
          data-testid="section-hero-coming-soon"
        >
          <img
            src={heroBg}
            alt="CLT Metro Hub — neighborhood-first platform for local businesses, events, and community across the Charlotte metro area"
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

        {nearestHub && !geoBannerDismissed && (
          <div
            className="relative mx-auto mt-3 rounded-xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-500"
            style={{ background: "linear-gradient(135deg, hsl(273 66% 25%), hsl(273 66% 18%))" }}
            data-testid="banner-geo-welcome"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(242,194,48,0.12),transparent_60%)]" />
            <div className="relative z-10 flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
              <img
                src={charlotteAvatar}
                alt="Charlotte"
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-white/20 shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base text-white/95 leading-snug">
                  Hey! Looks like you're near <span className="font-bold text-amber-300">{nearestHub.name}</span>.
                  {distanceMiles !== null && distanceMiles <= 5 && " Welcome to the neighborhood!"}
                  {distanceMiles !== null && distanceMiles > 5 && distanceMiles <= 20 && " We've got your area covered."}
                  {distanceMiles !== null && distanceMiles > 20 && " Glad you're checking us out."}
                </p>
                <p className="text-xs text-white/50 mt-0.5">{geoCounty}</p>
              </div>
              <button
                onClick={() => setGeoBannerDismissed(true)}
                className="shrink-0 p-1 rounded-full text-white/40 transition-colors"
                aria-label="Dismiss"
                data-testid="button-dismiss-geo-banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <section className="section-band scroll-reveal" data-testid="section-what-we-are">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400 mb-4" data-testid="text-what-we-are-label">{t("cs.whatWeAre")}</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-6" data-testid="text-what-we-are-heading">
              {t("cs.whatWeAreHeadline1")} <span className="text-amber-400">{t("cs.whatWeAreHeadline2")}</span> {t("cs.whatWeAreHeadline3")}
            </h2>
            <p className="text-base text-white/60 leading-relaxed" data-testid="text-what-we-are-body">
              {t("cs.whatWeAreBody")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-sm text-white/80">{t("cs.whatWeAreLive")}</span>
            </div>
          </div>
        </section>

        <section className="section-band scroll-reveal" data-testid="section-why-different">
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-white">{t("cs.whyDifferent")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              { icon: Rss, title: "Your neighborhood has a feed", desc: "Not static search results. A living, breathing stream of what's happening around you right now." },
              { icon: Store, title: "Every business has a social presence", desc: "Not just a listing page. A real profile with posts, offers, events, and engagement — built in." },
              { icon: Sparkles, title: "Charlotte tells your story", desc: "Not a blank bio you write yourself. Your neighborhood, your customers, your community — woven together." },
              { icon: ShoppingBag, title: "Shop, book, and hire without leaving", desc: "Not five different tabs. Everything from discovery to action happens in one scroll." },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                data-testid={`why-different-${i}`}
              >
                <div className="rounded-lg bg-gradient-to-br from-purple-600/30 to-amber-600/30 p-2.5 shrink-0">
                  <item.icon className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section className="section-band section-band-layers" data-testid="section-coming-soon-intro">
          <div className="text-center mb-8 md:mb-10 scroll-reveal">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 px-4 py-1.5 rounded-full text-sm mb-4 border border-amber-500/20">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-white">{t("cs.comingSoon")}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white" data-testid="text-coming-soon-title">
              {t("cs.tagline")}
            </h2>
            <p className="text-sm text-white/50 mt-2 max-w-lg mx-auto">
              {nearestHub
                ? `Discover what's happening near ${nearestHub.name} and across the Charlotte metro.`
                : t("cs.taglineDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {([
              { icon: MapPinned, titleKey: "cs.layerNeighborhoods" as const, descKey: "cs.layerNeighborhoodsDesc" as const, variant: "layer-card-teal" },
              { icon: Crown, titleKey: "cs.layerLeadership" as const, descKey: "cs.layerLeadershipDesc" as const, variant: "layer-card-plum" },
              { icon: Users, titleKey: "cs.layerCommunity" as const, descKey: "cs.layerCommunityDesc" as const, variant: "layer-card-pink" },
              { icon: Store, titleKey: "cs.layerCommerce" as const, descKey: "cs.layerCommerceDesc" as const, variant: "layer-card-gold" },
            ]).map((layer, i) => (
              <Card key={layer.titleKey} className={`layer-card-accent ${layer.variant} p-4 pt-5 space-y-3 scroll-reveal-scale scroll-reveal-d${i + 1}`}>
                <div className="flex items-center gap-2.5">
                  <div className="layer-icon p-2 rounded-lg shrink-0">
                    <layer.icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-sm tracking-tight">{t(layer.titleKey)}</h3>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{t(layer.descKey)}</p>
              </Card>
            ))}
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── WHERE WE ARE — Counties · Cities · Neighborhoods ── */}
        <section className="section-band section-band-sky scroll-reveal" data-testid="section-where-we-are">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <MapPinned className="h-5 w-5" style={{ color: "hsl(var(--brand-teal))" }} />
              {t("cs.whereWeAre")}
            </h2>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Eye className="h-3 w-3" /> {t("cs.preview")}
            </Badge>
          </div>
          <p className="text-sm text-white/50 mb-5 max-w-2xl">
            {t("cs.whereWeAreDesc")}
          </p>

          {(() => {
            const countyImages: Record<string, string> = {
              "Mecklenburg": "/images/counties/mecklenburg.jpg",
              "Cabarrus": "/images/counties/cabarrus.jpg",
              "Union": "/images/counties/union.jpg",
              "Iredell": "/images/counties/iredell.jpg",
              "Gaston": "/images/counties/gaston.jpg",
              "Lancaster": "/images/counties/lancaster.jpg",
              "York": "/images/counties/york.jpg",
              "Lincoln": "/images/counties/lincoln.jpg",
              "Rowan": "/images/counties/rowan.jpg",
              "Stanly": "/images/counties/stanly.jpg",
              "Chester": "/images/counties/chester.jpg",
              "Anson": "/images/counties/anson.jpg",
              "Cleveland": "/images/counties/cleveland.jpg",
              "Catawba": "/images/counties/catawba.jpg",
              "Alexander": "/images/counties/alexander.jpg",
              "Burke": "/images/counties/burke.jpg",
              "Caldwell": "/images/counties/caldwell.jpg",
              "McDowell": "/images/counties/mcdowell.jpg",
              "Chesterfield": "/images/counties/chesterfield.jpg",
            };

            if (coverageLoading) {
              return (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              );
            }

            if (coverageError || !coverageData?.counties?.length) {
              return (
                <p className="text-sm text-white/50 text-center py-6" data-testid="coverage-unavailable">
                  {t("cs.coverageUnavailable")}
                </p>
              );
            }

            const regions = (coverageData?.counties || []).map((c: any) => ({
              county: `${c.county} County${c.stateCode === "SC" ? ", SC" : ""}`,
              img: countyImages[c.county] || "/images/counties/default.jpg",
              cities: c.towns.map((t: any) => ({
                name: t.name,
                neighborhoods: t.neighborhoods.map((n: any) => n.name),
              })),
            }));

            const expandedIdx = expandedCounty ? regions.findIndex(r => r.county === expandedCounty) : -1;
            const rows: typeof regions[] = [];
            for (let i = 0; i < regions.length; i += countyCols) {
              rows.push(regions.slice(i, i + countyCols));
            }

            return (
              <div className="space-y-2">
                {rows.map((row, rowIdx) => {
                  const rowStart = rowIdx * countyCols;
                  const expandedInRow = expandedIdx >= rowStart && expandedIdx < rowStart + row.length;
                  const expandedRegion = expandedInRow ? regions[expandedIdx] : null;
                  const expandedPosInRow = expandedInRow ? expandedIdx - rowStart : -1;

                  return (
                    <div key={rowIdx}>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {row.map((region) => {
                          const isExpanded = expandedCounty === region.county;
                          const totalPlaces = region.cities.reduce((sum: number, c: any) => sum + 1 + c.neighborhoods.length, 0);
                          return (
                            <button
                              key={region.county}
                              className={`county-tile group relative rounded-xl overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-all ${isExpanded ? "ring-2 ring-amber-500 shadow-lg shadow-amber-500/20" : "hover:ring-1 hover:ring-amber-400/50"}`}
                              onClick={() => setExpandedCounty(isExpanded ? null : region.county)}
                              data-testid={`toggle-${region.county.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                            >
                              <div className="aspect-square relative">
                                <div className="absolute inset-0" style={{ backgroundImage: `url(${region.img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                                <div className={`absolute inset-0 transition-colors ${isExpanded ? "bg-black/40" : "bg-black/55 group-hover:bg-black/45"}`} />
                                <div className="relative z-10 flex flex-col items-center justify-center h-full px-2 text-center gap-1">
                                  <Globe className={`h-4 w-4 shrink-0 transition-colors ${isExpanded ? "text-amber-400" : "text-amber-400/70 group-hover:text-amber-400"}`} />
                                  <h3 className="text-[11px] sm:text-xs font-bold text-white leading-tight">{region.county.replace(" County", "").replace(", SC", "")}</h3>
                                  <span className="text-[9px] text-white/60">{totalPlaces} {t("cs.places")}</span>
                                </div>
                                <ChevronDown className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 h-3.5 w-3.5 text-white/50 county-accordion-chevron ${isExpanded ? "rotated" : ""}`} />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className={`county-accordion-body ${expandedRegion ? "expanded" : ""}`}>
                        <div className="county-accordion-inner">
                          {expandedRegion && (
                            <div className="relative mt-3 rounded-xl border border-amber-500/20 bg-white/5 p-4" data-testid={`region-${expandedRegion.county.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                              <div className="absolute -top-2 transition-all" style={{ left: `calc(${(expandedPosInRow + 0.5) / row.length * 100}% - 8px)` }}>
                                <div className="w-4 h-4 rotate-45 bg-white/5 border-l border-t border-amber-500/20" />
                              </div>
                              <div className="flex items-center gap-2 mb-3">
                                <Globe className="h-4 w-4 text-amber-500" />
                                <h3 className="text-sm font-bold">{expandedRegion.county}</h3>
                                <Badge className="text-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">{expandedRegion.cities.length} {expandedRegion.cities.length === 1 ? t("cs.city") : t("cs.cities")}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                                {expandedRegion.cities.map((city: any) => (
                                  <div key={city.name} className="min-w-0">
                                    <button
                                      className="text-xs font-semibold text-white hover:text-amber-400 transition-colors flex items-center gap-1"
                                      onClick={(e) => { e.stopPropagation(); toast({ title: city.name, description: t("cs.comingSoonHub", { name: city.name }) }); }}
                                      data-testid={`city-${city.name.toLowerCase().replace(/\s+/g, "-")}`}
                                    >
                                      <Building2 className="h-3 w-3 text-white/50 shrink-0" />
                                      {city.name}
                                    </button>
                                    <div className="flex flex-wrap gap-1 mt-0.5 ml-4">
                                      {city.neighborhoods.slice(0, 5).map((n: string) => (
                                        <span key={n} className="text-[9px] text-white/40 bg-white/5 rounded-full px-1.5 py-0.5">{n}</span>
                                      ))}
                                      {city.neighborhoods.length > 5 && (
                                        <span className="text-[9px] text-white/30">{t("cs.more", { count: String(city.neighborhoods.length - 5) })}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="mt-6 pt-5 border-t border-white/10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3" data-testid="text-neighborhoods-index-label">
              {t("cs.allNeighborhoods")}
            </h3>
            <p className="text-[11px] text-white/40 leading-relaxed" data-testid="text-neighborhoods-index">
              Uptown Charlotte · South End · NoDa · Plaza Midwood · Dilworth · Myers Park · Elizabeth · Camp North End · Wesley Heights · Seversville · Optimist Park · Steele Creek · Ayrsley · Cotswold · SouthPark · Montford · Providence · Ballantyne · University City · Huntersville · Birkdale · Cornelius · Davidson · Matthews · Mint Hill · Pineville · Concord · Kannapolis · Harrisburg · Gastonia · Belmont · Mount Holly · Rock Hill · Fort Mill · Tega Cay · Lake Wylie · Mooresville · Statesville · Waxhaw · Weddington · Indian Trail · Monroe · Stallings · Salisbury · Albemarle · Chester · Denver · Lincolnton · Troutman · Cramerton · McAdenville · China Grove · Locust · Clover · York · Marvin · Wesley Chapel · Indian Land · Lancaster
            </p>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section className="section-band scroll-reveal" data-testid="section-regional-scale">
          <div className="text-center mb-6">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white" data-testid="text-scale-headline">
              {t("cs.scaleHeadline")}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 py-6">
            <AnimatedStat target={REGION_STATS.hubFootprintPopulation} suffix="+" label={t("cs.scaleResidents")} delay={0} statId="residents" />
            <AnimatedStat target={REGION_STATS.countyCount} label={t("cs.scaleCounties")} delay={150} statId="counties" />
            <AnimatedStat target={REGION_STATS.communityCount} suffix="+" label={t("cs.scaleCommunities")} delay={300} statId="communities" />
            <AnimatedStat target={REGION_STATS.statesCovered.length} label={t("cs.scaleStates")} delay={450} statId="states" />
          </div>
          <p className="text-center text-xs md:text-sm text-white/40 mt-2 max-w-lg mx-auto" data-testid="text-scale-comparable">
            {t("cs.scaleComparable")}
          </p>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── PULSE FEED DEMO (Phone Frame) ── */}
        <section className="section-band scroll-reveal" data-testid="section-pulse-demo">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{t("cs.pulseDemoHeadline1")} <span className="text-amber-400">{t("cs.pulseDemoHeadline2")}</span></h2>
            <p className="text-sm text-white/50 max-w-md mx-auto">{t("cs.pulseDemoDesc")}</p>
          </div>

          <div className="mx-auto max-w-sm">
            <div className="relative rounded-[2rem] border-[3px] border-white/15 bg-gray-950 overflow-hidden shadow-2xl shadow-purple-900/30" data-testid="phone-frame">
              <div className="h-6 bg-gray-950 flex items-center justify-center">
                <div className="w-20 h-4 rounded-full bg-gray-900 border border-white/10" />
              </div>

              <div className="flex gap-3 overflow-hidden px-3 py-2 border-b border-white/5">
                {["Uptown", "NoDa", "South End", "Plaza Midwood", "Dilworth", "Myers Park"].map((hub, i) => (
                  <div key={hub} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full p-[2px] ${i === 0 ? "bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500" : "bg-gradient-to-br from-purple-500/40 via-pink-500/40 to-amber-500/40"}`}>
                      <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                        <span className={`text-xs font-bold ${i === 0 ? "text-white" : "text-white/40"}`}>{hub.charAt(0)}</span>
                      </div>
                    </div>
                    <span className={`text-[8px] w-10 text-center truncate ${i === 0 ? "text-white" : "text-white/40"}`}>{hub}</span>
                  </div>
                ))}
              </div>

              <div
                className="overflow-hidden"
                style={{ height: 420 }}
              >
                <div className="animate-slow-scroll space-y-4 px-3 py-3">
                  {[
                    { author: "Amelie's French Bakery", type: "Business", time: "2h", img: "/images/seed/south-end.png", title: "New spring pastry menu just dropped. Lavender croissants are back.", likes: 47, shares: 12, saves: 8 },
                    { author: "Maya Chen", type: "Article", time: "5h", img: "/images/seed/noda-art.png", title: "10 Hidden Gems in South End You Haven't Found Yet", likes: 134, shares: 28, saves: 52 },
                    { author: "NoDa Art District", type: "Event", time: "1d", img: "/images/seed/art-walk.png", title: "First Friday Art Walk — this weekend. 30+ studios open.", likes: 89, shares: 34, saves: 21 },
                    { author: "Queen City Eats", type: "Post", time: "3h", img: "/images/seed/food-truck.png", title: "Food Truck Friday lineup is here. South Blvd, 5-9pm.", likes: 62, shares: 19, saves: 15 },
                    { author: "CLT Metro Hub", type: "Article", time: "6h", img: "/images/seed/south-end.png", title: "Charlotte's apartment boom: what it means for neighborhoods.", likes: 28, shares: 7, saves: 14 },
                  ].map((card, i) => (
                    <div key={i} data-testid={`demo-card-${i}`}>
                      <div className="flex items-center gap-2 px-1 py-1.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-amber-500 p-[1.5px] flex-shrink-0">
                          <div className="w-full h-full rounded-full bg-gray-900 overflow-hidden">
                            {card.img ? (
                              <img src={card.img} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/40 text-[9px] font-bold">{card.author.charAt(0)}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-semibold text-white truncate block">{card.author}</span>
                          <span className="text-[9px] text-white/30">{card.time}</span>
                        </div>
                        <Badge className="text-[7px] border-0 bg-white/10 text-white/50 px-1.5 py-0">{card.type}</Badge>
                      </div>
                      <div className="rounded-lg overflow-hidden">
                        <div className="relative aspect-[4/3]">
                          <img src={card.img} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-[11px] font-semibold text-white leading-tight">{card.title}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-1 pt-1.5 pb-0.5">
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <Heart className="h-2.5 w-2.5" /> {card.likes}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <Send className="h-2.5 w-2.5 rotate-[-30deg]" /> {card.shares}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <BookOpen className="h-2.5 w-2.5" /> {card.saves}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-5 bg-gray-950 flex items-center justify-center">
                <div className="w-24 h-1 rounded-full bg-white/20" />
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-white/60 mb-4">{t("cs.pulseDemoSubline")}</p>
            <button
              onClick={() => { const el = document.getElementById("subscribe-section"); el?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg"
              data-testid="button-early-access-pulse"
            >
              Get Early Access <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="section-band scroll-reveal" data-testid="section-for-those-who-share">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-6" data-testid="text-for-those-who-share-label">
              {t("cs.forThoseHeadline1")} <span className="text-amber-400">{t("cs.forThoseHeadline2")}</span>
            </h2>
            <p className="text-base text-white/60 leading-relaxed" data-testid="text-for-those-who-share-body">
              {t("cs.forThoseWhoShareBody")}
            </p>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── MARKETPLACE ── */}
        <section id="marketplace" className="section-band marketplace-section-bg rounded-xl scroll-reveal" data-testid="section-marketplace">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <ShoppingBag className="h-5 w-5 text-amber-400" />
              {t("cs.marketplace")}
            </h2>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-300">
              <Eye className="h-3 w-3" /> {t("cs.samplePreview")}
            </Badge>
          </div>
          <SampleDisclaimer variant="marketplace" />
          <div className="flex gap-2 mb-4" data-testid="marketplace-filters">
            {([["ALL", t("cs.all")], ["JOB", t("cs.jobs")], ["FOR_RENT", t("cs.forRent")]] as [string, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setMktFilter(val as "ALL" | "JOB" | "FOR_RENT")}
                aria-pressed={mktFilter === val}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${mktFilter === val ? "bg-amber-500 text-black shadow-md" : "bg-white/10 text-white/70 hover:bg-white/20 border border-white/20"}`}
                data-testid={`marketplace-filter-${val.toLowerCase()}`}
              >
                {val === "JOB" && <Briefcase className="h-3 w-3 inline mr-1" />}
                {val === "FOR_RENT" && <Home className="h-3 w-3 inline mr-1" />}
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SAMPLE_MARKETPLACE_DATA
              .filter(item => mktFilter === "ALL" || item.type === mktFilter)
              .map((item) => (
              <div
                key={item.id}
                className="relative rounded-xl overflow-hidden border border-white/15 bg-white/10 p-4 hover:border-amber-400/50 hover:bg-white/15 transition-all cursor-pointer group"
                data-testid={`marketplace-item-${item.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge className={`text-[9px] border-0 ${item.type === "JOB" ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"}`}>
                    {item.type === "JOB" ? <Briefcase className="h-2.5 w-2.5 mr-0.5" /> : <Home className="h-2.5 w-2.5 mr-0.5" />}
                    {item.type === "JOB" ? t("cs.job") : t("cs.forRent")}
                  </Badge>
                  <span className="text-xs font-bold text-amber-300 whitespace-nowrap">
                    {item.type === "JOB" ? <DollarSign className="h-3 w-3 inline" /> : null}
                    {item.salary}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white leading-tight group-hover:text-amber-300 transition-colors">{t(item.titleKey)}</h3>
                <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5" />{t(item.companyKey)}
                </p>
                <p className="text-xs text-white/75 mt-2 line-clamp-2">{t(item.descKey)}</p>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[8px] border-white/20 text-white/60 px-1.5 py-0">
                    <MapPin className="h-2 w-2 mr-0.5" />{item.neighborhood}
                  </Badge>
                  {item.tagKeys.map(tagKey => (
                    <Badge key={tagKey} variant="outline" className="text-[8px] border-white/20 text-white/60 px-1.5 py-0">{t(tagKey)}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/15 bg-white/10 p-5" data-testid="marketplace-inquiry">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Send className="h-4 w-4 text-amber-400" />
              {t("cs.interestedPosting")}
            </h3>
            <p className="text-xs text-white/65 mb-3">{t("cs.leaveInfo")}</p>
            {mktSubmitted ? (
              <div className="text-center py-3">
                <Check className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-sm text-white/90">{t("cs.thanksInTouch")}</p>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (mktInquiry._hp_field) return;
                if (!mktInquiry.name || !mktInquiry.email) {
                  toast({ title: t("cs.fillNameEmail"), variant: "destructive" });
                  return;
                }
                setMktSubmitting(true);
                try {
                  await apiRequest("POST", `/api/cities/${citySlug}/marketplace-inquiry`, {
                    name: mktInquiry.name,
                    email: mktInquiry.email,
                    _hp_field: mktInquiry._hp_field,
                    _form_loaded_at: mktFormLoadedAt,
                  });
                  setMktSubmitted(true);
                  toast({ title: t("cs.gotIt"), description: t("cs.gotItDesc") });
                } catch {
                  toast({ title: t("cs.somethingWrong"), description: t("cs.tryAgain"), variant: "destructive" });
                } finally {
                  setMktSubmitting(false);
                }
              }} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                  <input
                    type="text"
                    name="website"
                    autoComplete="off"
                    value={mktInquiry._hp_field}
                    onChange={e => setMktInquiry(p => ({ ...p, _hp_field: e.target.value }))}
                    tabIndex={-1}
                  />
                </div>
                <Input
                  placeholder={t("cs.yourName")}
                  value={mktInquiry.name}
                  onChange={e => setMktInquiry(p => ({ ...p, name: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-xs h-9"
                  data-testid="marketplace-inquiry-name"
                />
                <Input
                  placeholder={t("cs.emailPlaceholder")}
                  type="email"
                  value={mktInquiry.email}
                  onChange={e => setMktInquiry(p => ({ ...p, email: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-xs h-9"
                  data-testid="marketplace-inquiry-email"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={mktSubmitting}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-9"
                  data-testid="marketplace-inquiry-submit"
                >
                  {mktSubmitting ? t("cs.sending") : <><Send className="h-3 w-3 mr-1" /> {t("cs.notifyMe")}</>}
                </Button>
              </form>
            )}
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── EVENTS (Social-Style Cards) ── */}
        <section className="section-band scroll-reveal" data-testid="section-sample-events">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5" style={{ color: "hsl(var(--brand-coral))" }} />
              {t("cs.upcomingEvents")}
            </h2>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Eye className="h-3 w-3" /> {t("cs.samplePreview")}
            </Badge>
          </div>
          <SampleDisclaimer variant="events" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {(() => {
              const eventImages = ["/images/seed/art-walk.png", "/images/seed/food-truck.png", "/images/seed/pitch-night.png", "/images/seed/family-day.png"];
              const fakeInterested = [128, 43, 67, 89];
              return SAMPLE_EVENTS_DATA.map((evt, idx) => {
                const startDate = new Date(evt.startDateTime);
                const now = new Date();
                const diffDays = Math.ceil((startDate.getTime() - now.getTime()) / 86400000);
                const whenLabel = diffDays <= 1 ? "Tomorrow" : diffDays <= 7 ? `${startDate.toLocaleDateString(dateFmtLocale, { weekday: "long" })}` : startDate.toLocaleDateString(dateFmtLocale, { month: "short", day: "numeric" });
                const time = startDate.toLocaleTimeString(dateFmtLocale, { hour: "numeric", minute: "2-digit" });
                const catColor = EVENT_CATEGORY_COLORS[evt.categoryKey] || "bg-gray-600";
                return (
                  <div key={evt.id} data-testid={`sample-event-${idx}`}>
                    <div className="flex items-center gap-2.5 px-1 py-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 p-[2px] flex-shrink-0">
                        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                          <Calendar className="h-3.5 w-3.5 text-white/60" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-white truncate block">{t(evt.organizerKey)}</span>
                        <span className="text-[11px] text-white/40">{whenLabel} at {time}</span>
                      </div>
                      <Badge className={`${catColor} text-white text-[8px] border-0 px-1.5 py-0`}>{t(evt.categoryKey)}</Badge>
                    </div>
                    <div className="relative rounded-xl overflow-hidden">
                      <div className="aspect-[4/3]">
                        <img src={eventImages[idx]} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-sm font-bold text-white leading-tight">{t(evt.titleKey)}</h3>
                        <p className="text-xs text-white/70 mt-1 line-clamp-2">{t(evt.descKey)}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                          <MapPin className="h-3 w-3" />
                          <span>{t(evt.locationKey)}</span>
                          {evt.costKey && (
                            <>
                              <span className="text-white/20">·</span>
                              <span>{t(evt.costKey)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-1 pt-2 pb-1">
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Users className="h-3 w-3" /> {fakeInterested[idx]} interested
                      </span>
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Send className="h-3 w-3 rotate-[-30deg]" /> {Math.floor(fakeInterested[idx] / 4)}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── GROW YOUR PRESENCE ── */}
        <section className="section-band scroll-reveal" data-testid="section-grow-your-presence">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4" data-testid="text-grow-heading">
              <span className="text-amber-400">{t("cs.growPresence")}</span>
            </h2>
            <p className="text-base text-white/60 leading-relaxed mb-6">
              {t("cs.growPresenceDesc")}
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <Languages className="h-5 w-5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{t("cs.bilingualSupport")}</p>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">{t("cs.bilingualDesc")}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── HUB PRESENCES — tier-differentiated cards ── */}
        <section className="section-band section-band-plum scroll-reveal" data-testid="section-sample-presences">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Building2 className="h-5 w-5" style={{ color: "hsl(var(--brand-pink-edge))" }} />
              {t("cs.commerceHubPresences")}
            </h2>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Eye className="h-3 w-3" /> {t("cs.samplePreview")}
            </Badge>
          </div>
          <SampleDisclaimer variant="presences" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Enhanced Commerce — Queen City Roasters */}
            <Link href={`/${citySlug}/presence/queen-city-roasters`}>
              <div className="biz-card biz-card-microsite cursor-pointer" style={{ height: "260px", "--microsite-color": "hsl(30 80% 45%)" } as any} data-testid="sample-biz-enhanced">
                <div className="biz-bg" style={{ backgroundImage: "url(/images/seed/coffee-shop.png)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div className="biz-overlay" />
                <div className="biz-cut-badge" style={{ backgroundColor: "hsl(273 66% 40%)" }}>
                  <Crown className="h-2.5 w-2.5 inline mr-0.5 align-[-2px]" />{t("cs.enhanced")}
                </div>
                <div className="biz-content">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm leading-tight">Queen City Roasters</h3>
                    <Badge className="text-[9px] gap-0.5 bg-white/20 border-white/30 text-white"><Shield className="h-2.5 w-2.5" />{t("cs.verified")}</Badge>
                    <Badge className="text-[9px] gap-0.5 rounded-full px-2 py-0.5" style={{ backgroundColor: "hsl(30 80% 45%)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}>
                      <Globe className="h-2.5 w-2.5" />{t("cs.hubSite")}
                    </Badge>
                    <Badge className="text-[9px] gap-0.5 rounded-full px-2 py-0.5 bg-teal-600 text-white border-teal-400/30">
                      <Languages className="h-2.5 w-2.5" />{t("cs.bilingual")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/75 line-clamp-2">{t("cs.bizDescRoasters")}</p>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-white/60">
                    <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />South End</span>
                    <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />4.8</span>
                    <span className="font-semibold text-white/80">$$</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[t("cs.hubSite"), t("cs.featGallery"), t("cs.bilingual"), t("cs.featCustomTheme"), t("cs.featReviews"), t("cs.feat2Locations")].map((f) => (
                      <span key={f} className="inline-flex items-center gap-0.5 rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[9px] text-white/80">
                        <Check className="h-2 w-2 text-green-400" />{f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>

            {/* Enhanced Organization — Charlotte Arts Foundation */}
            <Link href={`/${citySlug}/presence/charlotte-arts-foundation`}>
              <div className="biz-card biz-card-microsite cursor-pointer" style={{ height: "260px", "--microsite-color": "hsl(273 66% 40%)" } as any} data-testid="sample-biz-org">
                <div className="biz-bg" style={{ backgroundImage: "url(/images/seed/arts-foundation.jpg)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div className="biz-overlay" />
                <div className="biz-cut-badge" style={{ backgroundColor: "hsl(273 66% 40%)" }}>
                  <Crown className="h-2.5 w-2.5 inline mr-0.5 align-[-2px]" />{t("cs.enhanced")}
                </div>
                <div className="biz-content">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm leading-tight">Charlotte Arts Foundation</h3>
                    <Badge className="text-[9px] gap-0.5 rounded-full px-2 py-0.5 bg-pink-600 text-white border-pink-400/30">
                      <Heart className="h-2.5 w-2.5" />{t("cs.organization")}
                    </Badge>
                    <Badge className="text-[9px] gap-0.5 rounded-full px-2 py-0.5 bg-teal-600 text-white border-teal-400/30">
                      <Languages className="h-2.5 w-2.5" />{t("cs.bilingual")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/75 line-clamp-2">{t("cs.bizDescArts")}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/60">
                    <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Uptown</span>
                    <span className="flex items-center gap-1 text-amber-300/80">
                      <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />3 {t("cs.supporters")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[t("cs.hubSite"), t("cs.featMissionPage"), t("cs.bilingual"), t("cs.supporters"), t("cs.featEvents")].map((f) => (
                      <span key={f} className="inline-flex items-center gap-0.5 rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[9px] text-white/80">
                        <Check className="h-2 w-2 text-green-400" />{f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>

            <Link href={`/${citySlug}/presence/noda-brewing-company`}>
              <div className="biz-card biz-card-microsite cursor-pointer" style={{ height: "240px", "--microsite-color": "hsl(46 88% 50%)" } as any} data-testid="sample-biz-enhanced-noda">
                <div className="biz-bg" style={{ backgroundImage: "url(/images/seed/brewery.png)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div className="biz-overlay" />
                <div className="biz-cut-badge" style={{ backgroundColor: "hsl(46 88% 45%)", color: "#1a1a1a" }}>
                  <Crown className="h-2.5 w-2.5 inline mr-0.5 align-[-2px]" />{t("cs.enhanced")}
                </div>
                <div className="biz-content">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm leading-tight">NoDa Brewing Company</h3>
                    <Badge className="text-[9px] gap-0.5 bg-white/20 border-white/30 text-white"><Shield className="h-2.5 w-2.5" />{t("cs.verified")}</Badge>
                    <Badge className="text-[9px] gap-0.5 rounded-full px-2 py-0.5 bg-amber-600 text-white border-amber-400/30">
                      <Globe className="h-2.5 w-2.5" />{t("cs.hubSite")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/75 line-clamp-2">{t("cs.bizDescBrewing")}</p>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-white/60">
                    <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />NoDa</span>
                    <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />4.6</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[t("cs.hubSite"), t("cs.featGallery"), t("cs.featReviews"), t("cs.feat1Location")].map((f) => (
                      <span key={f} className="inline-flex items-center gap-0.5 rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[9px] text-white/80">
                        <Check className="h-2 w-2 text-green-400" />{f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>

            {/* Verified — Uptown Tech Hub */}
            <Link href={`/${citySlug}/presence/uptown-tech-hub`}>
              <div className="biz-card cursor-pointer" style={{ height: "200px" }} data-testid="sample-biz-verified">
                <div className="biz-bg" style={{ backgroundImage: "url(/images/seed/coworking.png)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div className="biz-overlay" />
                <div className="biz-content">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm leading-tight">Uptown Tech Hub</h3>
                    <Badge className="text-[9px] gap-0.5 bg-white/20 border-white/30 text-white"><Shield className="h-2.5 w-2.5" />{t("cs.verified")}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/75 line-clamp-2">{t("cs.bizDescTech")}</p>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-white/60">
                    <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Uptown</span>
                    <span className="font-semibold text-white/80">$$$</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] text-white/50">{t("cs.basicListing")}</span>
                    <span
                      className="text-[9px] text-teal-400 font-medium flex items-center gap-0.5 cursor-pointer"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/${citySlug}/activate`; }}
                      data-testid="link-upgrade-cta"
                    >
                      {t("cs.upgradeUnlock")} <ArrowRight className="h-2 w-2" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── CLAIM YOUR PRESENCE (cosmic bg — first use) ── */}
        <section className="section-band scroll-reveal" data-testid="section-claim-verify">
          <Link href={`/${citySlug}/activate`}>
            <div className="relative overflow-hidden rounded-2xl cursor-pointer transition-transform duration-200">
              <img src={cosmicBg} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative z-10 p-6 md:p-10">
                <div className="text-center mb-8 md:mb-10">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white" data-testid="text-claim-heading">{t("cs.claimPresenceHeading")}</h2>
                  <p className="text-sm text-white/70 mt-2 max-w-lg mx-auto">
                    {t("cs.claimPresenceDesc")}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="relative bg-white/10 border border-white/20 rounded-2xl p-6 text-center" data-testid="step-claim">
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">1</div>
                    <img src="/images/icons/icon-claim-3d.png" alt="" className="w-20 h-20 mx-auto mb-4 drop-shadow-lg" />
                    <h3 className="font-bold text-base text-white mb-2">{t("cs.stepClaimTitle")}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {t("cs.stepClaimDesc")}
                    </p>
                  </div>
                  <div className="relative bg-white/10 border border-teal-400/40 rounded-2xl p-6 text-center ring-1 ring-teal-400/20" data-testid="step-verify">
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">2</div>
                    <img src="/images/icons/icon-verify-3d.png" alt="" className="w-20 h-20 mx-auto mb-4 drop-shadow-lg" />
                    <h3 className="font-bold text-base text-white mb-2">{t("cs.stepVerifyTitle")}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {t("cs.stepVerifyDesc")}
                    </p>
                  </div>
                  <div className="relative bg-white/10 border border-white/20 rounded-2xl p-6 text-center" data-testid="step-grow">
                    <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">3</div>
                    <img src="/images/icons/icon-grow-3d.png" alt="" className="w-20 h-20 mx-auto mb-4 drop-shadow-lg" />
                    <h3 className="font-bold text-base text-white mb-2">{t("cs.stepGrowTitle")}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {t("cs.stepGrowDesc")}
                    </p>
                  </div>
                </div>
                <div className="text-center mt-6">
                  <span className="inline-flex items-center gap-2 bg-teal-500/80 text-white font-semibold rounded-full px-6 py-2.5 text-sm shadow-lg" data-testid="button-activate-cta">
                    {t("cs.activatePresence")}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── COMMUNITY FUND ── */}
        <section className="section-band scroll-reveal" data-testid="section-community-fund">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full text-xs mb-6 border border-amber-500/20">
              <HandHeart className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold text-amber-300">{t("cs.communityFundBadge")}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-6" data-testid="text-community-fund-heading">
              {t("cs.communityFundHeading")}
            </h2>
            <p className="text-base text-white/60 leading-relaxed mb-8">
              {t("cs.communityFundDesc")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5" data-testid="fund-stat-proceeds">
                <p className="text-3xl font-bold text-amber-400 mb-1">{t("cs.communityFundStat")}</p>
                <p className="text-sm text-white/60">{t("cs.communityFundStatDesc")}</p>
              </div>
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5 flex items-center gap-3" data-testid="fund-stat-verify">
                <DollarSign className="h-8 w-8 text-teal-400 shrink-0" />
                <p className="text-sm text-white/70 leading-relaxed">{t("cs.communityFundVerify")}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── MEET CHARLOTTE (gradient bg — teal/plum, NO cosmic) ── */}
        <section className="section-band scroll-reveal" data-testid="section-charlotte-ai-overview">
          <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, hsl(174 62% 25%), hsl(273 66% 30%), hsl(211 55% 30%))" }}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(91,29,143,0.3),transparent_60%)]" />
            <div className="relative z-10 p-6 md:p-10">
              <div>
                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
                  <div className="shrink-0">
                    <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-[#5B1D8F]/40 overflow-hidden shadow-xl shadow-purple-900/30 anim-float-slow">
                      <img src={charlotteAvatar} alt="Charlotte" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs mb-3 border border-white/20">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-white/80">{t("cs.alwaysAvailable")}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{t("cs.meetCharlotte")}</h2>
                    <p className="text-white/70 text-sm leading-relaxed mb-3">
                      {t("cs.meetCharlotteDesc")}
                    </p>
                    <p className="text-white/50 text-xs leading-relaxed">
                      {t("cs.meetCharlotteHint")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── GET INVOLVED ── */}
        <section className="section-band scroll-reveal" data-testid="section-get-involved">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{t("cs.getInvolved")}</h2>
            <p className="text-sm text-white/50 mt-2 max-w-lg mx-auto">
              {t("cs.getInvolvedDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="block">
              <Link href={`/${citySlug}/tell-your-story?intent=activate`} className="block">
                <div className="relative overflow-hidden rounded-2xl flex flex-col h-full" style={{ background: "linear-gradient(135deg, hsl(174 62% 30%), hsl(211 55% 40%))" }} data-testid="cta-claim-presence">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
                  <div className="relative z-10 p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Store className="h-5 w-5 text-teal-300" />
                      {t("cs.ctaClaimTitle")}
                    </h3>
                    <p className="text-sm text-white/75 leading-relaxed mt-3 flex-1">
                      {t("cs.ctaClaimDesc")}
                    </p>
                    <div className="mt-3">
                      <span className="w-full flex items-center justify-center gap-2 bg-white/15 border border-white/25 text-white rounded-md px-4 py-2 text-sm font-medium">
                        <Building2 className="h-3.5 w-3.5" />
                        {t("cs.activatePresence")}
                        <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
              <p className="text-xs text-white/40 mt-1.5 text-center" data-testid="cta-claim-form-fallback">
                Prefer a form?{" "}
                <Link href={`/${citySlug}/activate`} className="underline text-white/55 hover:text-white/80 transition-colors">
                  Use our step-by-step wizard
                </Link>
              </p>
            </div>

            <Link href={`/${citySlug}/tell-your-story?intent=event`} className="block">
              <div className="relative overflow-hidden rounded-2xl flex flex-col h-full" style={{ background: "linear-gradient(135deg, hsl(14 77% 40%), hsl(46 88% 50%))" }} data-testid="cta-submit-event">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
                <div className="relative z-10 p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-200" />
                    {t("cs.ctaSubmitEvent")}
                  </h3>
                  <p className="text-sm text-white/75 leading-relaxed mt-3 flex-1">
                    {t("cs.ctaSubmitEventDesc")}
                  </p>
                  <div className="mt-3">
                    <span className="w-full flex items-center justify-center gap-2 bg-white/15 border border-white/25 text-white rounded-md px-4 py-2 text-sm font-medium">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("cs.ctaSubmitEvent")}
                      <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <Link href={`/${citySlug}/tell-your-story`} className="block">
              <div className="relative overflow-hidden rounded-2xl flex flex-col h-full" style={{ background: "linear-gradient(135deg, hsl(211 55% 35%), hsl(273 66% 40%))" }} data-testid="cta-submit-article">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
                <div className="relative z-10 p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-300" />
                    {t("cs.ctaShareStory")}
                  </h3>
                  <p className="text-sm text-white/75 leading-relaxed mt-3 flex-1">
                    {t("cs.ctaShareStoryDesc")}
                  </p>
                  <div className="mt-3">
                    <span className="w-full flex items-center justify-center gap-2 bg-white/15 border border-white/25 text-white rounded-md px-4 py-2 text-sm font-medium">
                      <FileText className="h-3.5 w-3.5" />
                      {t("cs.ctaShareStory")}
                      <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <Link href={`/${citySlug}/activate`} className="block">
              <div className="relative overflow-hidden rounded-2xl flex flex-col h-full" style={{ background: "linear-gradient(135deg, hsl(324 85% 35%), hsl(273 66% 35%))" }} data-testid="cta-submit-org">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
                <div className="relative z-10 p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <HandHeart className="h-5 w-5 text-pink-300" />
                    {t("cs.ctaAddOrg")}
                  </h3>
                  <p className="text-sm text-white/75 leading-relaxed mt-3 flex-1">
                    {t("cs.ctaAddOrgDesc")}
                  </p>
                  <div className="mt-3">
                    <span className="w-full flex items-center justify-center gap-2 bg-white/15 border border-white/25 text-white rounded-md px-4 py-2 text-sm font-medium">
                      <HandHeart className="h-3.5 w-3.5" />
                      {t("cs.ctaAddOrgBtn")}
                      <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <div className="relative overflow-hidden rounded-2xl flex flex-col" style={{ background: "linear-gradient(135deg, hsl(46 88% 40%), hsl(30 80% 45%))" }} data-testid="cta-rss-feed">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
              <div className="relative z-10 p-5 flex flex-col flex-1">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Rss className="h-5 w-5 text-yellow-200" />
                  {t("cs.ctaRss")}
                </h3>
                <p className="text-sm text-white/75 leading-relaxed mt-3 flex-1">
                  {t("cs.ctaRssDesc")}
                </p>
                <div className="mt-3">
                  <Button size="sm" className="w-full bg-white/15 border border-white/25 text-white" data-testid="button-rss-feed" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/cities/${citySlug}/rss`);
                    toast({ title: t("cs.rssCopied") });
                  }}>
                    <Rss className="h-3.5 w-3.5 mr-1.5" />
                    {t("cs.ctaRssBtn")}
                    <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </div>
              </div>
            </div>

            <Link href={`/${citySlug}/tell-your-story?intent=shout-out`} className="block">
              <div className="relative overflow-hidden rounded-2xl flex flex-col h-full" style={{ background: "linear-gradient(135deg, hsl(174 62% 28%), hsl(174 50% 38%))" }} data-testid="cta-hub-shoutout">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
                <div className="relative z-10 p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-cyan-300" />
                    {t("cs.ctaShoutOut")}
                  </h3>
                  <p className="text-sm text-white/75 leading-relaxed mt-3 flex-1">
                    {t("cs.ctaShoutOutDesc")}
                  </p>
                  <div className="mt-3">
                    <span className="w-full flex items-center justify-center gap-2 bg-white/15 border border-white/25 text-white rounded-md px-4 py-2 text-sm font-medium">
                      <Megaphone className="h-3.5 w-3.5" />
                      {t("cs.ctaShoutOutBtn")}
                      <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        <section className="section-band scroll-reveal" data-testid="section-ambassador-interest">
          <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, hsl(270 50% 25%), hsl(270 40% 35%))" }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
            <div className="relative z-10 p-6 md:p-10">
              <div className="flex items-center gap-3 mb-4">
                <HandHeart className="h-6 w-6 text-purple-300" />
                <h2 className="text-xl md:text-2xl font-bold text-white">Become a Hub Ambassador</h2>
              </div>
              <p className="text-sm text-white/70 max-w-xl mb-6 leading-relaxed">
                Know your neighborhood better than anyone? Love connecting people to local businesses? Join our Ambassador Program and earn referral commissions while helping your community grow.
              </p>
              <AmbassadorInterestForm citySlug={citySlug} />
            </div>
          </div>
        </section>

        <div className="gradient-divider shimmer-bar my-4" aria-hidden="true" />

        {/* ── CREATE HUB ACCOUNT (cosmic bg — second and final use) ── */}
        <section id="subscribe-section" className="section-band scroll-reveal" data-testid="section-create-hub-account">
          <div className="relative overflow-hidden rounded-2xl">
            <img src={cosmicBg} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative z-10 p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                {t("cs.createAccount")}
              </h2>
              <p className="text-white/70 max-w-lg mx-auto mb-6 text-sm">
                {t("cs.createAccountDesc")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder={t("cs.enterEmail")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12"
                  data-testid="input-hub-account-email"
                />
                <Button
                  onClick={() => subscribeMutation.mutate()}
                  disabled={!email.includes("@") || subscribeMutation.isPending}
                  className="h-12 px-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold whitespace-nowrap"
                  data-testid="button-create-hub-account"
                >
                  {subscribeMutation.isPending ? "..." : t("cs.joinHub")}
                </Button>
              </div>
            </div>
          </div>
        </section>

      </DarkPageShell>
    </div>
  );
}
