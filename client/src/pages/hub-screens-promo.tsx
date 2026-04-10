import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import {
  Monitor, Calendar, Newspaper, Store, Sparkles, Tv,
  QrCode, Languages, ShieldCheck, DollarSign, Zap,
  ArrowRight, Play, Radio, ChevronDown, Globe,
  UserPlus, Settings, Rss, Gift, HelpCircle, Droplets,
  Sun, Heart, Music, MapPin,
} from "lucide-react";
import { InspirationQuoteBlock } from "@/components/inspiration-quote-block";

const TEMPLATE_CARDS = [
  { icon: Calendar, titleKey: "tv.cardEvents" as const, descKey: "tv.cardEventsDesc" as const, color: "hsl(14 77% 54%)" },
  { icon: Newspaper, titleKey: "tv.cardNews" as const, descKey: "tv.cardNewsDesc" as const, color: "hsl(211 55% 64%)" },
  { icon: Store, titleKey: "tv.cardSpotlight" as const, descKey: "tv.cardSpotlightDesc" as const, color: "hsl(174 62% 44%)" },
  { icon: Sparkles, titleKey: "tv.cardSpecials" as const, descKey: "tv.cardSpecialsDesc" as const, color: "hsl(46 88% 57%)" },
  { icon: Globe, titleKey: "tv.cardDiscovery" as const, descKey: "tv.cardDiscoveryDesc" as const, color: "hsl(273 66% 34%)" },
  { icon: Radio, titleKey: "tv.cardLiveFeeds" as const, descKey: "tv.cardLiveFeedsDesc" as const, color: "hsl(340 75% 55%)" },
] as const;

const STEPS = [
  { num: "1", icon: UserPlus, titleKey: "tv.step1Title" as const, descKey: "tv.step1Desc" as const },
  { num: "2", icon: Settings, titleKey: "tv.step2Title" as const, descKey: "tv.step2Desc" as const },
  { num: "3", icon: Play, titleKey: "tv.step3Title" as const, descKey: "tv.step3Desc" as const },
] as const;

const COMPARE_ITEMS = [
  { labelKey: "tv.compareLocal" as const, hub: true, generic: false },
  { labelKey: "tv.compareBilingual" as const, hub: true, generic: false },
  { labelKey: "tv.compareQr" as const, hub: true, generic: false },
  { labelKey: "tv.compareSpecials" as const, hub: true, generic: false },
  { labelKey: "tv.compareBlock" as const, hub: true, generic: false },
  { labelKey: "tv.compareRevenue" as const, hub: true, generic: false },
  { labelKey: "tv.compareLive" as const, hub: true, generic: false },
] as const;

const VENUE_BENEFITS = [
  { key: "tv.benefitFree" as const },
  { key: "tv.benefitEngage" as const },
  { key: "tv.benefitSpecials" as const },
  { key: "tv.benefitControl" as const },
  { key: "tv.benefitRevenue" as const },
] as const;

const DEMO_SLIDE_COUNT = 11;

function DemoSlidePreview({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="absolute inset-0 flex items-center justify-between px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }} data-testid="demo-slide-weather">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-300/70 text-xs sm:text-sm font-medium">
              <Monitor className="h-3.5 w-3.5" />
              <span>Charlotte, NC</span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl sm:text-7xl font-bold text-white leading-none">72°</span>
              <Sun className="h-8 w-8 sm:h-12 sm:w-12 text-amber-400" />
            </div>
            <p className="text-white/60 text-sm sm:text-base">Partly Cloudy</p>
            <div className="flex gap-4 text-xs sm:text-sm text-white/40 pt-1">
              <span>H: 78°</span>
              <span>L: 61°</span>
              <span className="flex items-center gap-0.5"><Droplets className="h-3 w-3" /> 55%</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center">
              <QrCode className="h-10 w-10 sm:h-14 sm:w-14 text-white/50" />
            </div>
            <span className="text-[10px] sm:text-xs text-white/30">Local Forecast</span>
          </div>
        </div>
      );
    case 1:
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 sm:px-12" style={{ background: "linear-gradient(135deg, #1a0a2e 0%, #2d1b69 50%, #1a0a2e 100%)" }} data-testid="demo-slide-trivia">
          <Badge className="mb-3 bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">History</Badge>
          <h3 className="text-lg sm:text-2xl font-bold text-white text-center mb-4 sm:mb-6">What year was Charlotte founded?</h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-sm sm:max-w-md">
            {["1755", "1768", "1782", "1799"].map((a, i) => (
              <div key={a} className={`rounded-lg px-3 py-2 sm:py-3 text-center text-sm sm:text-base font-medium border ${i === 1 ? "bg-green-500/20 border-green-500/40 text-green-300" : "bg-white/5 border-white/10 text-white/70"}`}>
                {a}
              </div>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-3 sm:mt-4">Scan QR to play along!</p>
        </div>
      );
    case 2:
      return (
        <div className="absolute inset-0 flex items-center justify-between px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #1a1207 0%, #2d1f0a 50%, #1a1207 100%)" }} data-testid="demo-slide-venue">
          <div className="space-y-2 flex-1 max-w-[60%]">
            <p className="text-amber-400/70 text-xs sm:text-sm font-medium tracking-wide uppercase">South End Brewing Co.</p>
            <h3 className="text-xl sm:text-3xl font-bold text-white leading-tight">Happy Hour Special</h3>
            <p className="text-white/50 text-sm sm:text-base leading-relaxed">Craft pint specials & appetizer deals every weekday 4–7 PM</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <Sparkles className="h-7 w-7 sm:h-10 sm:w-10 text-amber-400" />
            </div>
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
              <QrCode className="h-9 w-9 sm:h-11 sm:w-11 text-white/40" />
            </div>
          </div>
        </div>
      );
    case 3:
      return (
        <div className="absolute inset-0 flex items-center gap-6 sm:gap-10 px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a0f2e 50%, #0f0f1a 100%)" }} data-testid="demo-slide-social">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 flex items-center justify-center shrink-0">
            <Rss className="h-10 w-10 sm:h-14 sm:w-14 text-white" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-pink-400 text-xs sm:text-sm font-semibold">@exploreclt</span>
              <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-[10px]">Instagram</Badge>
            </div>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed line-clamp-2">First Friday in NoDa never disappoints! Live music, local art, and the best street food in Charlotte.</p>
            <div className="flex items-center gap-4 text-xs sm:text-sm text-white/40">
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-pink-400" /> 8.7K</span>
              <span>45K views</span>
            </div>
          </div>
        </div>
      );
    case 4:
      return (
        <div className="absolute inset-0 flex items-center justify-between px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0f2044 50%, #0a1628 100%)" }} data-testid="demo-slide-qr">
          <div className="space-y-2 flex-1 max-w-[55%]">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs mb-1">Scan & Go</Badge>
            <h3 className="text-xl sm:text-3xl font-bold text-white leading-tight">Leave Us a Review!</h3>
            <p className="text-white/50 text-sm sm:text-base">Scan to share your experience on Google</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl border-2 border-blue-400/30 bg-white/10 flex items-center justify-center relative">
              <QrCode className="h-14 w-14 sm:h-20 sm:w-20 text-blue-300/70" />
              <div className="absolute inset-0 rounded-xl border-2 border-blue-400/20 animate-pulse" />
            </div>
            <span className="text-blue-300 text-xs sm:text-sm font-medium">Scan Now</span>
          </div>
        </div>
      );
    case 5:
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 sm:px-12" style={{ background: "linear-gradient(135deg, #1a0a1a 0%, #3b0a2e 50%, #1a0a1a 100%)" }} data-testid="demo-slide-countdown">
          <Music className="h-6 w-6 sm:h-8 sm:w-8 text-rose-400 mb-2" />
          <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-1">Live Music Tonight</h3>
          <p className="text-rose-300/60 text-xs sm:text-sm mb-4">The Evening Muse, NoDa</p>
          <div className="flex items-center gap-3 sm:gap-5">
            {[
              { val: "04", label: "HRS" },
              { val: "32", label: "MIN" },
              { val: "15", label: "SEC" },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center">
                <div className="w-12 h-14 sm:w-16 sm:h-[4.5rem] rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-bold text-white font-mono">{t.val}</span>
                </div>
                <span className="text-[10px] sm:text-xs text-white/30 mt-1">{t.label}</span>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs sm:text-sm mt-4">Acoustic set featuring local artists</p>
        </div>
      );
    case 6:
      return (
        <div className="absolute inset-0 bg-black" data-testid="demo-slide-video">
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src="https://videos.pexels.com/video-files/4065924/4065924-sd_640_360_24fps.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
          <div className="absolute top-3 left-3 sm:top-5 sm:left-5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-red-600/90 text-white text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          </div>
          <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 right-4 sm:right-6">
            <p className="text-white font-semibold text-sm sm:text-lg mb-0.5">Community Spotlight Reel</p>
            <p className="text-white/50 text-[10px] sm:text-xs">Hyper-local video content from your neighborhood</p>
          </div>
        </div>
      );
    case 7:
      return (
        <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #0d0d1a 0%, #1a0f2e 40%, #2d1445 100%)" }} data-testid="demo-slide-tonight">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-purple-400" />
            <span className="text-purple-300/70 text-xs sm:text-sm font-medium tracking-wide uppercase">Tonight Around You</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">What's Happening Nearby</h3>
          <p className="text-white/40 text-xs sm:text-sm mb-4">Live events starting soon</p>
          <div className="space-y-2.5">
            {[
              { time: "7:00 PM", title: "Jazz on the Patio", venue: "The Crunkleton, Dilworth", tag: "Live Music", tagColor: "text-rose-300 bg-rose-500/20 border-rose-500/30" },
              { time: "7:30 PM", title: "Trivia Night", venue: "Wooden Robot Brewery, South End", tag: "Free", tagColor: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" },
              { time: "8:00 PM", title: "Open Mic Comedy", venue: "The Comedy Zone, Uptown", tag: "Entertainment", tagColor: "text-amber-300 bg-amber-500/20 border-amber-500/30" },
            ].map((evt) => (
              <div key={evt.title} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className="text-purple-300 text-xs sm:text-sm font-mono font-semibold shrink-0 w-16 text-right">{evt.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{evt.title}</p>
                  <p className="text-white/40 text-xs truncate">{evt.venue}</p>
                </div>
                <Badge className={`${evt.tagColor} text-[10px] shrink-0`}>{evt.tag}</Badge>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
              <QrCode className="h-6 w-6 sm:h-8 sm:w-8 text-white/40" />
            </div>
            <span className="text-white/30 text-[10px] sm:text-xs">Scan for tonight's events</span>
          </div>
        </div>
      );
    case 8:
      return (
        <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0f2044 40%, #162a5a 100%)" }} data-testid="demo-slide-weekend">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-blue-300/70 text-xs sm:text-sm font-medium tracking-wide uppercase">This Weekend</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">Plans Around You</h3>
          <p className="text-white/40 text-xs sm:text-sm mb-4">Curated picks for the weekend</p>
          <div className="space-y-2.5">
            {[
              { day: "FRI", dayColor: "bg-amber-500/80 text-black", time: "6:00 PM", title: "Food Truck Friday", venue: "Camp North End" },
              { day: "SAT", dayColor: "bg-blue-500/80 text-white", time: "10:00 AM", title: "Farmers Market", venue: "Matthews Community Center" },
              { day: "SAT", dayColor: "bg-blue-500/80 text-white", time: "7:00 PM", title: "Outdoor Movie Night", venue: "Romare Bearden Park" },
              { day: "SUN", dayColor: "bg-emerald-500/80 text-white", time: "11:00 AM", title: "Brunch & Live Music", venue: "NoDa Brewing Company" },
            ].map((evt, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className={`${evt.dayColor} text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0`}>{evt.day}</span>
                <span className="text-blue-200/70 text-xs sm:text-sm font-mono font-semibold shrink-0 w-16 text-right">{evt.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{evt.title}</p>
                  <p className="text-white/40 text-xs truncate">{evt.venue}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
              <QrCode className="h-6 w-6 sm:h-8 sm:w-8 text-white/40" />
            </div>
            <span className="text-white/30 text-[10px] sm:text-xs">Scan to explore weekend events</span>
          </div>
        </div>
      );
    case 9:
      return (
        <div className="absolute inset-0 flex items-center gap-6 sm:gap-10 px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #0f0a0f 0%, #1a0a1a 50%, #0f0a0f 100%)" }} data-testid="demo-slide-nonprofit">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Heart className="h-10 w-10 sm:h-14 sm:w-14 text-rose-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px]">Community Partner</Badge>
            </div>
            <h3 className="text-lg sm:text-2xl font-bold text-white leading-tight">Charlotte Arts Foundation</h3>
            <p className="text-white/50 text-xs sm:text-sm leading-relaxed line-clamp-2 italic">&ldquo;Bringing arts education to every neighborhood&rdquo;</p>
            <div className="flex items-center gap-3 text-xs sm:text-sm">
              <span className="text-rose-400 font-semibold">5,000+</span>
              <span className="text-white/40">Students Reached</span>
            </div>
          </div>
        </div>
      );
    case 10:
      return (
        <div className="absolute inset-0 flex items-center justify-between px-8 sm:px-12" style={{ background: "linear-gradient(135deg, #0f0d07 0%, #1a1507 50%, #0f0d07 100%)" }} data-testid="demo-slide-support-local">
          <div className="space-y-2 flex-1 max-w-[60%]">
            <div className="flex items-center gap-2">
              <Store className="h-3.5 w-3.5 text-amber-400" />
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">Support Local</Badge>
            </div>
            <h3 className="text-xl sm:text-3xl font-bold text-white leading-tight">NoDa Pottery Studio</h3>
            <p className="text-white/50 text-sm sm:text-base leading-relaxed">Handcrafted ceramics & pottery classes in the heart of NoDa</p>
            <div className="inline-block px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs sm:text-sm font-semibold">
              Shop Local, Build Community
            </div>
            <p className="text-white/30 text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" /> 12 years in the community
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Store className="h-7 w-7 sm:h-10 sm:w-10 text-amber-400" />
            </div>
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
              <QrCode className="h-9 w-9 sm:h-11 sm:w-11 text-white/40" />
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

const FAQ_ITEMS = [
  { qKey: "tv.faq1Q" as const, aKey: "tv.faq1A" as const },
  { qKey: "tv.faq2Q" as const, aKey: "tv.faq2A" as const },
  { qKey: "tv.faq3Q" as const, aKey: "tv.faq3A" as const },
  { qKey: "tv.faq4Q" as const, aKey: "tv.faq4A" as const },
  { qKey: "tv.faq5Q" as const, aKey: "tv.faq5A" as const },
  { qKey: "tv.faq6Q" as const, aKey: "tv.faq6A" as const },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function HubScreensPromo() {
  const { t, locale, setLocale } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [demoSlideIdx, setDemoSlideIdx] = useState(0);
  const revealRef = useScrollReveal();

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % TEMPLATE_CARDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDemoSlideIdx((prev) => (prev + 1) % DEMO_SLIDE_COUNT);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  usePageMeta({
    title: "Hub Screens — Hyper-Local TV for Your Venue | CityMetroHub",
    description: "Turn your venue screens into a hyper-local community channel. Events, businesses, news, live feeds — all powered by your neighborhood hub. Bilingual EN/ES.",
    canonical: `${window.location.origin}/tv`,
    ogTitle: "Hub Screens — Hyper-Local TV for Your Venue",
    ogDescription: "Turn your venue screens into a hyper-local community channel. Events, businesses, news, live feeds — powered by CityMetroHub.",
    ogType: "website",
    ogUrl: `${window.location.origin}/tv`,
    twitterCard: "summary_large_image",
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={revealRef} className="min-h-screen bg-[#0a0a0f] text-white" data-testid="page-hub-screens-promo">
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/10" : "bg-transparent"}`}
        data-testid="nav-hub-screens"
      >
        <div className="mx-auto flex items-center justify-between gap-4 px-4 lg:px-8 py-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-[hsl(174,62%,44%)]" />
            <span className="font-bold text-lg tracking-tight">Hub Screens</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-sm text-white/70 hover:text-white transition-colors hidden sm:inline"
              data-testid="link-how-it-works"
            >
              {t("tv.navHow")}
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className="text-sm text-white/70 hover:text-white transition-colors hidden sm:inline"
              data-testid="link-features"
            >
              {t("tv.navFeatures")}
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="text-sm text-white/70 hover:text-white transition-colors hidden sm:inline"
              data-testid="link-faq"
            >
              FAQ
            </button>
            <button
              onClick={() => setLocale(locale === "en" ? "es" : "en")}
              className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1"
              data-testid="button-lang-toggle"
            >
              <Languages className="h-3.5 w-3.5" />
              {locale === "en" ? "ES" : "EN"}
            </button>
            <Link href="/tv/get-started">
              <Button size="sm" className="bg-[hsl(174,62%,44%)] hover:bg-[hsl(174,62%,38%)] text-black font-semibold border-[hsl(174,62%,38%)]" data-testid="button-nav-get-started">
                {t("tv.getStarted")}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative pt-28 pb-20 px-4 overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0">
          <div className="absolute inset-0 tv-hero-gradient" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[hsl(273,66%,20%)] opacity-20 blur-[120px] tv-orb-1" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[hsl(174,62%,30%)] opacity-15 blur-[100px] tv-orb-2" />
          <div className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full bg-[hsl(324,85%,35%)] opacity-10 blur-[110px] tv-orb-3" />
          <div className="absolute bottom-1/3 left-1/6 w-64 h-64 rounded-full bg-[hsl(46,88%,40%)] opacity-8 blur-[90px] tv-orb-4" />

          <div className="absolute inset-0 tv-scanline opacity-[0.03]" />

          <div className="absolute inset-0 overflow-hidden">
            <div className="tv-grid-lines absolute inset-0 opacity-[0.04]" />
          </div>

          <div className="absolute inset-0 tv-shimmer opacity-[0.06]" />
        </div>

        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden sm:block">
          <div className="tv-float-icon tv-float-1 absolute text-white/[0.06]">
            <Monitor className="h-8 w-8" />
          </div>
          <div className="tv-float-icon tv-float-2 absolute text-white/[0.05]">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="tv-float-icon tv-float-3 absolute text-white/[0.04]">
            <Radio className="h-7 w-7" />
          </div>
          <div className="tv-float-icon tv-float-4 absolute text-white/[0.05]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="tv-float-icon tv-float-5 absolute text-white/[0.06]">
            <Store className="h-6 w-6" />
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 text-white/70 border-white/20 gap-1.5 no-default-active-elevate tv-badge-glow">
            <Tv className="h-3.5 w-3.5" />
            CityMetroHub.tv
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6" data-testid="text-hero-title">
            {t("tv.heroTitle")}
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-hero-subtitle">
            {t("tv.heroSubtitle")}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/tv/get-started">
              <Button size="lg" className="bg-[hsl(174,62%,44%)] hover:bg-[hsl(174,62%,38%)] text-black font-bold border-[hsl(174,62%,38%)] gap-2" data-testid="button-hero-get-started">
                {t("tv.getYourScreen")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-14 flex items-center justify-center">
            <button onClick={() => scrollToSection("what-shows")} className="text-white/40 hover:text-white/70 transition-colors" data-testid="button-scroll-down">
              <ChevronDown className="h-6 w-6 animate-bounce" />
            </button>
          </div>
        </div>
      </section>

      <section id="what-shows" className="py-16 px-4 relative" data-testid="section-what-shows">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(273,66%,20%)] opacity-[0.06] blur-[150px] anim-pulse-glow" />
        </div>
        <div className="mx-auto relative z-10">
          <div className="text-center mb-12 scroll-reveal">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-what-shows-title">{t("tv.whatShowsTitle")}</h2>
            <p className="text-white/60 max-w-xl mx-auto">{t("tv.whatShowsSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 scroll-reveal-fade">
            {TEMPLATE_CARDS.map((card, i) => (
              <Card
                key={card.titleKey}
                className={`bg-white/5 border-white/10 p-5 space-y-3 transition-all duration-500 ${activeCard === i ? "ring-1 ring-white/20 scale-[1.02]" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0 transition-transform duration-500" style={{ backgroundColor: `${card.color}20`, transform: activeCard === i ? "scale(1.1)" : "scale(1)" }}>
                    <card.icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <h3 className="font-semibold text-white" data-testid={`text-card-title-${card.titleKey}`}>{t(card.titleKey)}</h3>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">{t(card.descKey)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="py-16 px-4 relative" data-testid="section-demo">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-[hsl(174,62%,20%)] opacity-[0.05] blur-[150px]" />
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-10 scroll-reveal">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-demo-title">{t("tv.demoTitle")}</h2>
            <p className="text-white/60 max-w-xl mx-auto">{t("tv.demoSubtitle")}</p>
          </div>
          <div className="scroll-reveal-scale scroll-reveal-d2">
            <div className="relative mx-auto max-w-3xl">
              <div className="rounded-2xl border-[3px] border-white/10 bg-black overflow-hidden shadow-2xl shadow-black/50">
                <div className="bg-white/5 px-4 py-1.5 flex items-center gap-2 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-[10px] text-white/30 ml-2">CityMetroHub.tv — Live Preview</span>
                </div>
                <div className="relative aspect-video overflow-hidden bg-black">
                  <DemoSlidePreview index={demoSlideIdx} />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4">
                {Array.from({ length: DEMO_SLIDE_COUNT }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setDemoSlideIdx(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === demoSlideIdx ? "bg-[hsl(174,62%,44%)] w-6" : "bg-white/20 hover:bg-white/40"}`}
                    data-testid={`button-demo-dot-${i}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <InspirationQuoteBlock pageContext="hub-screens" variant="dark" />

      <section id="how-it-works" className="py-16 px-4" data-testid="section-how-it-works">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 scroll-reveal">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-how-title">{t("tv.howTitle")}</h2>
            <p className="text-white/60 max-w-xl mx-auto">{t("tv.howSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 scroll-reveal-fade">
            {STEPS.map((step, i) => (
              <div key={step.titleKey} className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-[hsl(174,62%,44%)]/15 flex items-center justify-center anim-float" style={{ animationDelay: `${i * 0.5}s` }}>
                  <span className="text-xl font-bold text-[hsl(174,62%,44%)]">{step.num}</span>
                </div>
                <h3 className="font-semibold text-lg text-white" data-testid={`text-step-${step.num}`}>{t(step.titleKey)}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-16 px-4" data-testid="section-why-hub-screens">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 scroll-reveal">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-why-title">{t("tv.whyTitle")}</h2>
            <p className="text-white/60 max-w-xl mx-auto">{t("tv.whySubtitle")}</p>
          </div>
          <div className="overflow-x-auto scroll-reveal-fade">
            <table className="w-full text-left" data-testid="table-comparison">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-3 text-sm text-white/50 font-medium pr-4">{t("tv.compareFeature")}</th>
                  <th className="pb-3 text-sm font-semibold text-[hsl(174,62%,44%)] text-center px-4">Hub Screens</th>
                  <th className="pb-3 text-sm text-white/50 font-medium text-center pl-4">{t("tv.compareGeneric")}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ITEMS.map((item) => (
                  <tr key={item.labelKey} className="border-b border-white/5">
                    <td className="py-3 text-sm text-white/80 pr-4">{t(item.labelKey)}</td>
                    <td className="py-3 text-center px-4">
                      <span className="text-[hsl(174,62%,44%)] font-bold">&#10003;</span>
                    </td>
                    <td className="py-3 text-center pl-4">
                      <span className="text-white/30">&#10007;</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-white/[0.02] relative" data-testid="section-venue-owners">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full bg-[hsl(174,62%,25%)] opacity-[0.05] blur-[120px] anim-pulse-glow" style={{ animationDelay: "1.5s" }} />
        </div>
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-10 scroll-reveal">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-venue-title">{t("tv.venueTitle")}</h2>
            <p className="text-white/60 max-w-xl mx-auto">{t("tv.venueSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto scroll-reveal-fade">
            {VENUE_BENEFITS.map((b, i) => (
              <div key={b.key} className="flex items-start gap-3 p-3">
                <div className="mt-0.5 w-6 h-6 rounded-full bg-[hsl(174,62%,44%)]/15 flex items-center justify-center shrink-0">
                  <Zap className="h-3.5 w-3.5 text-[hsl(174,62%,44%)]" />
                </div>
                <span className="text-sm text-white/80" data-testid={`text-benefit-${i}`}>{t(b.key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="py-16 px-4 relative" data-testid="section-faq">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-[500px] h-[500px] rounded-full bg-[hsl(211,55%,20%)] opacity-[0.04] blur-[140px]" />
        </div>
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-10 scroll-reveal">
            <div className="flex items-center justify-center gap-2 mb-4">
              <HelpCircle className="h-6 w-6 text-[hsl(174,62%,44%)]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-faq-title">{t("tv.faqTitle")}</h2>
            <p className="text-white/60 max-w-xl mx-auto">{t("tv.faqSubtitle")}</p>
          </div>
          <div className="scroll-reveal scroll-reveal-d1">
            <Accordion type="single" collapsible className="space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-white/10 rounded-xl px-5 bg-white/[0.02] data-[state=open]:bg-white/[0.04] transition-colors"
                  data-testid={`accordion-faq-${i}`}
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base font-medium text-white/90 hover:text-white py-4 hover:no-underline">
                    {t(item.qKey)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-white/60 leading-relaxed pb-4">
                    {t(item.aKey)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 relative" data-testid="section-referral">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-[hsl(46,88%,30%)] opacity-[0.04] blur-[120px]" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10 scroll-reveal">
          <div className="p-8 sm:p-12 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Gift className="h-7 w-7 text-[hsl(46,88%,57%)]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-referral-title">{t("tv.referralTitle")}</h2>
            <p className="text-white/60 max-w-lg mx-auto mb-8">{t("tv.referralSubtitle")}</p>
            <Link href="/tv/get-started">
              <Button size="lg" className="bg-[hsl(46,88%,57%)] hover:bg-[hsl(46,88%,50%)] text-black font-bold border-[hsl(46,88%,50%)] gap-2" data-testid="button-referral-cta">
                <Gift className="h-4 w-4" />
                {t("tv.referralCta")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 relative" data-testid="section-cta-footer">
        <div className="absolute inset-0 pointer-events-none anim-gradient-shift" style={{ background: "linear-gradient(135deg, hsl(273,66%,12%) 0%, hsl(174,62%,12%) 50%, hsl(273,66%,12%) 100%)", backgroundSize: "200% 200%", opacity: 0.3 }} />
        <div className="max-w-3xl mx-auto text-center scroll-reveal relative z-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-cta-title">{t("tv.ctaTitle")}</h2>
          <p className="text-white/60 mb-8 max-w-lg mx-auto">{t("tv.ctaSubtitle")}</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/tv/get-started">
              <Button size="lg" className="bg-[hsl(174,62%,44%)] hover:bg-[hsl(174,62%,38%)] text-black font-bold border-[hsl(174,62%,38%)] gap-2" data-testid="button-cta-get-started">
                {t("tv.getStarted")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/40">
            {t("tv.ctaContact")}{" "}
            <a href="mailto:hello@citymetrohub.com" className="underline text-white/60 hover:text-white transition-colors" data-testid="link-contact-email">hello@citymetrohub.com</a>
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 px-4 text-center" data-testid="footer-hub-screens">
        <p className="text-xs text-white/30">
          Powered by CityMetroHub &middot; CityMetroHub.tv
        </p>
      </footer>
    </div>
  );
}
