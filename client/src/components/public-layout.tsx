import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { useCity } from "@/hooks/use-city";
import { Search, Bookmark, Calendar, Home, Mail, Moon, Sun, Globe, ChevronDown, Menu, User, LogOut, Building2, Shield, Sparkles, X, Coffee, UtensilsCrossed, Music, Landmark, Send, PenLine, Briefcase, Gamepad2, MapPin, Lock, Rss, Podcast, LayoutGrid, Radio, PawPrint, Heart, Users, ShoppingBag, Store, Newspaper, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { mainLogo } from "@/lib/logos";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useHubContext } from "@/hooks/use-hub-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth, UserHub, type ProfileType } from "@/hooks/use-auth";
import type { User as AuthUser } from "@/hooks/use-auth";
import { isModuleVisibleForActiveType } from "@shared/profile-types";
import { AuthDialog } from "@/components/auth-dialog";
import { HubSetupDialog } from "@/components/hub-setup-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { QuickSearch } from "@/components/quick-search";
import { AdminEditProvider } from "@/hooks/use-admin-edit";
import { AdminEditFab } from "@/components/admin-edit-button";
import cosmicBg from "@assets/ChatGPT_Image_Feb_22,_2026,_11_51_29_AM_1771794828800.png";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import cltNavLogo from "@assets/CLT_Charlotte_Skyline_Transparent_1773270853281.png";

export interface CharlottePageContext {
  page: string;
  step?: string;
  presenceType?: string;
  selectedTier?: string;
  businessName?: string;
  flowType?: string;
  flowSessionId?: string;
  businessId?: string;
  activeHubFilter?: string;
  activeFeedContext?: string;
}

const CharlotteContextValue = createContext<{
  context: CharlottePageContext | undefined;
  setContext: (ctx: CharlottePageContext | undefined) => void;
}>({ context: undefined, setContext: () => {} });

export function useCharlotteContext() {
  return useContext(CharlotteContextValue);
}

function SoftLaunchBanner({ citySlug }: { citySlug: string }) {
  const STORAGE_KEY = "cch_soft_launch_dismissed";
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  if (dismissed || citySlug !== "charlotte") return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  const handleTellCharlotte = () => {
    window.dispatchEvent(new CustomEvent("open-charlotte-chat"));
  };

  return (
    <div className="relative z-[51] bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 border-b border-purple-700/50 text-white" data-testid="soft-launch-banner">
      <div className="mx-auto px-4 lg:px-8 py-2 flex items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-purple-100 leading-snug flex-1 text-center">
          <Sparkles className="inline h-3.5 w-3.5 mr-1.5 text-amber-400" />
          Welcome to the CLT Metro Hub soft launch! We're actively building and improving — if you spot something off,{" "}
          <button
            onClick={handleTellCharlotte}
            className="underline underline-offset-2 text-amber-300 hover:text-amber-200 transition-colors font-medium"
            data-testid="button-tell-charlotte-banner"
          >
            tell Charlotte
          </button>.
        </p>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-purple-300 hover:text-white"
          aria-label="Dismiss banner"
          data-testid="button-dismiss-soft-launch"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MobileBottomNav({ citySlug, isComingSoon = false }: { citySlug: string; isComingSoon?: boolean }) {
  const [location] = useLocation();
  const { t } = useI18n();
  const { toast } = useToast();

  const tabs = [
    { icon: Rss, label: t("nav.feed"), key: "feed", path: `/${citySlug}/pulse` },
    { icon: LayoutGrid, label: t("nav.hubs"), key: "hubs", path: `/${citySlug}/neighborhoods` },
    { icon: Search, label: t("nav.search"), key: "search", path: "" },
    { icon: Map, label: t("nav.map"), key: "map", path: `/${citySlug}/map` },
    { icon: Radio, label: t("nav.live"), key: "live", path: `/${citySlug}/live` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 lg:hidden" data-testid="mobile-bottom-nav">
      <div className="flex items-center justify-around py-1">
        {tabs.map((tab) => {
          const isSearch = tab.key === "search";
          const isFeed = tab.key === "feed";
          const feedActive = isFeed && location.startsWith(`/${citySlug}/pulse`);
          const isActive = isFeed ? feedActive : !isSearch && (location === tab.path || location === tab.path + "/" || location.startsWith(tab.path.split("?")[0]));
          const tabButton = (
            <button
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground"
              } ${isComingSoon && !isFeed && !isSearch ? "opacity-50" : ""}`}
              onClick={
                isSearch
                  ? () => window.dispatchEvent(new CustomEvent("open-quick-search"))
                  : isComingSoon && !isFeed
                    ? () => toast({ title: t("layout.comingSoonTitle"), description: t("layout.comingSoonDesc") })
                    : undefined
              }
              data-testid={`nav-${tab.key}`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
          if (isSearch || (isComingSoon && !isFeed && !isSearch)) {
            return <span key={tab.key}>{tabButton}</span>;
          }
          return (
            <Link key={tab.key} href={tab.path}>
              {tabButton}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function detectPageContext(location: string, citySlug: string): CharlottePageContext | undefined {
  const path = location.replace(`/${citySlug}`, "");
  if (path.startsWith("/activate")) return { page: "activate" };
  if (path.startsWith("/neighborhoods")) return { page: "neighborhoods" };
  if (path.startsWith("/events")) return { page: "events" };
  if (path.startsWith("/articles")) return { page: "articles" };
  if (path.startsWith("/pulse")) return { page: "feed" };
  if (path.startsWith("/explore/commerce") || path === "/commerce") return { page: "commerce" };
  if (path.startsWith("/explore/") || path === "/food" || path === "/arts-entertainment" || path === "/senior" || path === "/seniors" || path === "/family" || path === "/families" || path === "/pets") return { page: "explore" };

  if (path.startsWith("/presence/")) return { page: "microsite" };
  if (path.startsWith("/owner")) return { page: "owner-dashboard" };
  if (path.startsWith("/coming-soon")) return { page: "home" };
  if (path === "" || path === "/") {
    return { page: "home" };
  }
  return { page: "general" };
}

function CharlotteGuidePanel({ citySlug, open, onClose, activateContext }: { citySlug: string; open: boolean; onClose: () => void; activateContext?: CharlottePageContext }) {
  const { t, locale } = useI18n();
  const { data: city } = useCity(citySlug);
  const guideName = city?.aiGuideName || "Charlotte";
  const cityId = city?.id;
  const [currentLocation] = useLocation();

  const pageContext = activateContext || detectPageContext(currentLocation, citySlug);
  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem("charlotte_chat_session");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("charlotte_chat_session", id);
    return id;
  });
  const messagesEndRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: "smooth" });
  }, []);

  const { data: config } = useQuery({
    queryKey: ["/api/charlotte-public/config", cityId, locale],
    queryFn: async () => {
      const res = await fetch(`/api/charlotte-public/config/${cityId}?locale=${locale}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!cityId && open,
  });

  useEffect(() => {
    if (!open || !sessionId) return;
    fetch(`/api/charlotte-public/history/${sessionId}`)
      .then((r) => r.json())
      .then((data: { role: string; content: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data.map((m) => ({ role: m.role, content: m.content })));
        }
      })
      .catch(() => {});
  }, [open, sessionId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !cityId) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/charlotte-public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, sessionId, cityId, pageContext: pageContextRef.current, locale }),
      });

      if (!res.ok) throw new Error("Failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              assistantContent += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("charlotte.errorResponse") }]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, cityId, sessionId]);

  if (!open) return null;

  const greeting = config?.greetingMessage || t("charlotte.defaultGreeting");

  return (
    <>
      <div className="fixed inset-0 z-[39] bg-black/20" onClick={onClose} data-testid="charlotte-backdrop" />
      <div className="fixed top-[56px] left-4 z-40 md:left-6 animate-in fade-in slide-in-from-top-2 duration-200" data-testid="charlotte-guide-panel">
        <Card className="w-[calc(100vw-2rem)] max-w-[340px] shadow-xl border-2 flex flex-col" style={{ borderColor: "hsl(273 66% 34% / 0.3)", maxHeight: "70vh" }}>
        <div className="p-3 border-b flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <img src={charlotteAvatar} alt={guideName} className="h-9 w-9 rounded-full object-cover shrink-0 ring-2 ring-[#5B1D8F]/30" />
            <div>
              <span className="font-semibold text-sm">{guideName}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {t("charlotte.aiCityGuide")}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-guide-close" className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]" style={{ maxHeight: "calc(70vh - 120px)" }}>
          <div className="flex gap-2">
            <img src={charlotteAvatar} alt="" className="h-6 w-6 rounded-full object-cover shrink-0 mt-0.5" />
            <div className="rounded-xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed max-w-[85%]" style={{ background: "hsl(273 66% 34% / 0.08)" }}>
              {greeting}
            </div>
          </div>

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" && (
                <img src={charlotteAvatar} alt="" className="h-6 w-6 rounded-full object-cover shrink-0 mt-0.5" />
              )}
              <div
                className={`rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[85%] ${
                  msg.role === "user"
                    ? "rounded-tr-sm text-white"
                    : "rounded-tl-sm"
                }`}
                style={
                  msg.role === "user"
                    ? { background: "hsl(273 66% 34%)" }
                    : { background: "hsl(273 66% 34% / 0.08)" }
                }
              >
                {msg.content || (isStreaming && i === messages.length - 1 ? "..." : "")}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-2 border-t shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-1.5"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("charlotte.askAnything")}
              className="text-sm h-9"
              disabled={isStreaming}
              data-testid="input-charlotte-chat"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="h-9 w-9 shrink-0"
              style={{ background: "hsl(273 66% 34%)" }}
              data-testid="button-charlotte-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
    </>
  );
}

const HUB_ICONS: Record<string, typeof Home> = { HOME: Home, WORK: Briefcase, PLAY: Gamepad2 };

function HubSwitcher({ user, activeHub }: { user: { hubs?: UserHub[]; activeHubType?: string }; activeHub?: UserHub }) {
  const { t } = useI18n();
  const hubs = user.hubs || [];
  if (hubs.length === 0) return null;

  const switchHubMutation = useMutation({
    mutationFn: async (hubType: string) => {
      await apiRequest("POST", "/api/auth/switch-hub", { hubType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const activeCity = activeHub?.city || hubs[0]?.city || "Hub";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-white/80 text-xs" data-testid="button-hub-switcher">
          <MapPin className="h-3.5 w-3.5" style={{ color: "#F2C230" }} />
          <span className="max-w-[80px] truncate hidden sm:inline">{activeCity}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {hubs.map((hub) => {
          const Icon = HUB_ICONS[hub.hubType] || MapPin;
          const isActive = hub.hubType === user.activeHubType;
          return (
            <DropdownMenuItem
              key={hub.hubType}
              onClick={() => switchHubMutation.mutate(hub.hubType)}
              className={`cursor-pointer gap-2 ${isActive ? "font-bold" : ""}`}
              data-testid={`hub-switch-${hub.hubType.toLowerCase()}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{hub.city}</span>
              {isActive && <span className="ml-auto text-xs text-muted-foreground">{t("layout.active")}</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AnonymousHubPopover() {
  const { t } = useI18n();
  const [anonCity, setAnonCity] = useState(() => localStorage.getItem("hub_home") || "");
  const [anonZip, setAnonZip] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleSave = () => {
    if (anonCity.trim()) {
      localStorage.setItem("hub_home", anonCity.trim());
      localStorage.setItem("hub_active", "HOME");
      if (anonZip.trim()) localStorage.setItem("hub_home_zip", anonZip.trim());
    }
    setPopoverOpen(false);
  };

  const savedCity = localStorage.getItem("hub_home");

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-white/80 text-xs" data-testid="button-anon-hub">
          <MapPin className="h-3.5 w-3.5" style={{ color: "#F2C230" }} />
          <span className="hidden sm:inline max-w-[80px] truncate">{savedCity || t("layout.setHub")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-3">
        <p className="text-sm font-medium">{t("layout.setYourLocation")}</p>
        <div className="space-y-2">
          <Input
            placeholder={t("layout.cityPlaceholder")}
            value={anonCity}
            onChange={(e) => setAnonCity(e.target.value)}
            data-testid="input-anon-hub-city"
          />
          <Input
            placeholder={t("layout.zipPlaceholder")}
            value={anonZip}
            onChange={(e) => setAnonZip(e.target.value)}
            data-testid="input-anon-hub-zip"
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={handleSave}
          disabled={!anonCity.trim()}
          style={{ background: "#5B1D8F" }}
          data-testid="button-anon-hub-save"
        >
          {t("layout.save")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

const NAV_SLUG_MODULE_MAP: Record<string, string> = {
  jobs: "jobs",
  marketplace: "marketplace",
  commerce: "directory_listing",
  events: "events",
};

function isNavVisibleForActiveType(activeType: ProfileType, navSlug: string): boolean {
  const moduleKey = NAV_SLUG_MODULE_MAP[navSlug];
  if (!moduleKey) return true;
  return isModuleVisibleForActiveType(activeType, moduleKey);
}

const navIconMap: Record<string, typeof UtensilsCrossed> = {
  feed: Rss,
  neighborhoods: LayoutGrid,
  events: Calendar,
  articles: Newspaper,
  food: UtensilsCrossed,
  music: Music,
  "arts-entertainment": Landmark,
  pets: PawPrint,
  senior: Heart,
  family: Users,
  jobs: Briefcase,
  live: Radio,
  marketplace: ShoppingBag,
  relocation: MapPin,
  commerce: Store,
  map: Map,
};

function SiteHeader({ citySlug, cityName, isHomepage, isComingSoon = false }: { citySlug: string; cityName: string; isHomepage: boolean; isComingSoon?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const [, navigate] = useLocation();
  const { user, isLoggedIn, isAdmin, logout, activeHub } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [hubSetupOpen, setHubSetupOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);

  useEffect(() => {
    const handler = () => setGuideOpen(true);
    window.addEventListener("open-charlotte-chat", handler);
    return () => window.removeEventListener("open-charlotte-chat", handler);
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState("");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSearchInitialQuery(detail?.query || "");
      setSearchOpen(true);
    };
    window.addEventListener("open-quick-search", handler);
    return () => window.removeEventListener("open-quick-search", handler);
  }, []);
  const { toast } = useToast();
  const { context: charlotteContext } = useCharlotteContext();

  const homeHub = user?.hubs?.find((h) => h.hubType === (user?.activeHubType || "HOME"));
  const homeHubZip = homeHub?.zip || "";

  const { data: myHubZoneData } = useQuery({
    queryKey: ["/api/zones/resolve", homeHubZip, citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/zones/resolve?zip=${homeHubZip}&citySlug=${citySlug}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!homeHubZip && isLoggedIn,
  });

  const myHubZoneSlug = myHubZoneData?.zones?.[0]?.slug || null;

  const handleMyHubClick = useCallback(() => {
    if (!isLoggedIn) return;
    const hasHubs = user?.hubs && user.hubs.length > 0;
    if (!hasHubs) {
      setHubSetupOpen(true);
      return;
    }
    if (myHubZoneSlug) {
      navigate(`/${citySlug}/neighborhoods/${myHubZoneSlug}`);
    } else {
      navigate(`/${citySlug}/neighborhoods`);
    }
  }, [isLoggedIn, user, myHubZoneSlug, citySlug, navigate]);

  const comingSoonToast = () => {
    toast({ title: t("layout.comingSoonTitle"), description: t("layout.comingSoonDesc") });
  };

  const coreNav: { slug: string; label?: string; labelKey?: TranslationKey; path: string; color: string; authOnly?: boolean; onClick?: () => void }[] = [
    { slug: "home", labelKey: "nav.home", path: `/${citySlug}`, color: "hsl(var(--brand-cream))" },
    ...(isLoggedIn ? [{ slug: "myhub", labelKey: "nav.myHub" as TranslationKey, path: myHubZoneSlug ? `/${citySlug}/neighborhoods/${myHubZoneSlug}` : `/${citySlug}/neighborhoods`, color: "hsl(var(--brand-gold))", authOnly: true as const, onClick: handleMyHubClick }] : []),
    { slug: "feed", labelKey: "nav.feed" as TranslationKey, path: `/${citySlug}/pulse`, color: "hsl(270 70% 55%)" },
    { slug: "neighborhoods", labelKey: "nav.topLists" as TranslationKey, path: `/${citySlug}/neighborhoods`, color: "hsl(152 72% 50%)" },
    { slug: "events", labelKey: "nav.events" as TranslationKey, path: `/${citySlug}/events/browse`, color: "hsl(var(--brand-coral))" },
    { slug: "articles", labelKey: "nav.articles" as TranslationKey, path: `/${citySlug}/articles`, color: "hsl(var(--brand-sky))" },
    { slug: "map", labelKey: "nav.map", path: `/${citySlug}/map`, color: "hsl(152 72% 50%)" },
  ];
  const activeType: ProfileType = ((user as AuthUser)?.activeProfileType) || "resident";
  const allExploreNav: { slug: string; label?: string; labelKey?: TranslationKey; path: string; color: string; topicFilter?: string }[] = [
    { slug: "food", labelKey: "layout.food", path: `/${citySlug}/explore/food`, color: "hsl(14 90% 58%)", topicFilter: "food" },
    { slug: "arts-entertainment", label: "Arts", path: `/${citySlug}/explore/arts-entertainment`, color: "hsl(271 76% 53%)", topicFilter: "music" },
    { slug: "pets", labelKey: "layout.pets", path: `/${citySlug}/explore/pets`, color: "hsl(152 70% 45%)", topicFilter: "pets" },
    { slug: "senior", labelKey: "layout.senior", path: `/${citySlug}/explore/senior`, color: "hsl(46 95% 55%)", topicFilter: "senior" },
    { slug: "family", labelKey: "layout.family", path: `/${citySlug}/explore/family`, color: "hsl(324 85% 60%)", topicFilter: "family" },
    { slug: "jobs", labelKey: "nav.jobs", path: `/${citySlug}/jobs/browse`, color: "hsl(210 70% 50%)" },
    { slug: "live", labelKey: "nav.live", path: `/${citySlug}/live`, color: "hsl(0 85% 55%)" },
    { slug: "marketplace", labelKey: "layout.marketplace", path: `/${citySlug}/marketplace`, color: "hsl(38 92% 50%)" },
    { slug: "commerce", labelKey: "layout.commerce", path: `/${citySlug}/explore/commerce`, color: "hsl(var(--brand-teal))" },
    { slug: "relocation", labelKey: "nav.relocation", path: `/${citySlug}/explore/relocation`, color: "hsl(160 60% 45%)" },
  ];
  const exploreNav = isLoggedIn
    ? allExploreNav.filter((item) => isNavVisibleForActiveType(activeType, item.slug))
    : allExploreNav;
  const filteredCoreNav = isLoggedIn
    ? coreNav.filter((item) => isNavVisibleForActiveType(activeType, item.slug))
    : coreNav;
  const mainNav = [...filteredCoreNav, ...exploreNav];

  const headerBg = isHomepage
    ? "linear-gradient(135deg, hsl(273 73% 23% / 0.85), hsl(273 66% 34% / 0.8), hsl(273 73% 23% / 0.85))"
    : "linear-gradient(135deg, hsl(273 73% 23%), hsl(273 66% 34%), hsl(273 73% 23%))";

  return (
    <>
    <header
      className={`sticky top-0 z-50 border-b border-white/10 ${isHomepage ? "backdrop-blur-md" : ""}`}
      style={{ background: headerBg }}
    >
      <div className="mx-auto flex items-center justify-between gap-1.5 sm:gap-3 px-3 sm:px-4 lg:px-8 py-2 max-w-full">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Link href={`/${citySlug}`}>
            <img
              src={cltNavLogo}
              alt="CLT Charlotte"
              className="h-7 sm:h-8 w-auto cursor-pointer drop-shadow-md"
              data-testid="nav-clt-logo"
            />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGuideOpen(!guideOpen)}
            className="gap-1.5 text-white/90 shrink-0 charlotte-guide-btn"
            style={{ background: guideOpen ? "hsl(273 66% 34% / 0.6)" : "transparent" }}
            data-testid="button-charlotte-guide"
          >
            <img src={charlotteAvatar} alt="Charlotte" className="h-6 w-6 rounded-full object-cover ring-1 ring-white/40" />
            <span className="hidden md:inline text-xs font-medium">Charlotte</span>
          </Button>
        </div>

        <DropdownMenu open={mobileExploreOpen} onOpenChange={setMobileExploreOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden gap-1.5 text-white border-white/30" data-testid="button-mobile-categories">
              <Menu className="h-4 w-4" />
              {t("layout.explore")}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            {coreNav.filter(item => !["feed", "neighborhoods", "map"].includes(item.slug)).map((item) => (
              <DropdownMenuItem
                key={item.slug}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else if (isComingSoon && item.slug !== "marketplace" && item.slug !== "live" && item.slug !== "home") {
                    comingSoonToast();
                  } else if (item.slug === "home" && isComingSoon) {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    navigate(item.path);
                  }
                }}
                className={`cursor-pointer gap-2 ${isComingSoon && item.slug !== "marketplace" && item.slug !== "live" && item.slug !== "home" ? "opacity-60" : ""}`}
                data-testid={`nav-mobile-${item.slug}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                {item.labelKey ? t(item.labelKey) : item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="grid grid-cols-3 gap-1 px-1 py-1">
              {exploreNav.filter(item => item.slug !== "live").map((item) => {
                const IconComponent = navIconMap[item.slug];
                return (
                  <button
                    key={item.slug}
                    onClick={() => {
                      setMobileExploreOpen(false);
                      if (isComingSoon && item.slug !== "marketplace") {
                        comingSoonToast();
                      } else {
                        navigate(item.path);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-1 rounded-md p-2 text-center transition-colors hover:bg-accent active:bg-accent/80 ${isComingSoon && item.slug !== "marketplace" ? "opacity-60" : ""}`}
                    data-testid={`nav-mobile-${item.slug}`}
                  >
                    {IconComponent && <IconComponent className="h-5 w-5" style={{ color: item.color }} />}
                    <span className="text-[10px] font-medium leading-tight text-foreground">
                      {item.labelKey ? t(item.labelKey) : item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 flex-1 justify-center min-w-0 overflow-x-auto scrollbar-none ml-3" data-testid="nav-main-bar">
          {coreNav.filter(item => item.slug === "home" || item.slug === "myhub").map((item) => {
            const navPill = (
              <span
                className={`inline-block rounded-full px-2 xl:px-2.5 py-1 text-[10px] xl:text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all duration-200 border hover:brightness-125 ${isComingSoon && item.slug !== "marketplace" && item.slug !== "live" ? "opacity-60" : ""}`}
                style={{
                  backgroundColor: `color-mix(in srgb, ${item.color} 35%, transparent)`,
                  color: "white",
                  borderColor: `color-mix(in srgb, ${item.color} 70%, transparent)`,
                  boxShadow: `0 0 10px color-mix(in srgb, ${item.color} 50%, transparent), 0 0 20px color-mix(in srgb, ${item.color} 25%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)`,
                  textShadow: `0 0 8px color-mix(in srgb, ${item.color} 80%, transparent)`,
                }}
                data-testid={`nav-${item.slug}`}
              >
                {item.labelKey ? t(item.labelKey) : item.label}
              </span>
            );
            if (item.onClick) {
              return <span key={item.slug} onClick={item.onClick} className="cursor-pointer">{navPill}</span>;
            }
            if (isComingSoon) {
              if (item.slug === "home") {
                return <span key={item.slug} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{navPill}</span>;
              }
              return <span key={item.slug} onClick={comingSoonToast}>{navPill}</span>;
            }
            return <Link key={item.slug} href={item.path}>{navPill}</Link>;
          })}

          <span className="w-px h-4 bg-white/20 mx-0.5" aria-hidden="true" />

          {[...coreNav.filter(item => item.slug !== "home" && item.slug !== "myhub"), ...exploreNav].map((item) => {
            const IconComponent = navIconMap[item.slug];
            if (!IconComponent) return null;
            const label = item.labelKey ? t(item.labelKey) : (item.label || item.slug);
            const isDisabled = isComingSoon && item.slug !== "marketplace" && item.slug !== "live";

            const handleClick = () => {
              if (isDisabled) {
                comingSoonToast();
                return;
              }
              if ((item as any).onClick) {
                (item as any).onClick();
                return;
              }
              navigate(item.path);
            };

            return (
              <Tooltip key={item.slug}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleClick}
                    className={`relative flex items-center justify-center w-8 h-8 xl:w-9 xl:h-9 rounded-full border transition-all duration-200 hover:brightness-125 shrink-0 ${isDisabled ? "opacity-60" : ""}`}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${item.color} 30%, transparent)`,
                      borderColor: `color-mix(in srgb, ${item.color} 60%, transparent)`,
                      boxShadow: `0 0 8px color-mix(in srgb, ${item.color} 40%, transparent)`,
                    }}
                    data-testid={`nav-${item.slug}`}
                  >
                    <IconComponent className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-white" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => isComingSoon ? comingSoonToast() : setSearchOpen(!searchOpen)}
            className={`text-white/80 ${isComingSoon ? "opacity-60" : ""}`}
            data-testid="button-quick-search-toggle"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLocale(locale === "en" ? "es" : "en")}
            className="gap-1 text-xs font-medium text-white/80"
            data-testid="button-language-toggle"
          >
            <Globe className="h-3.5 w-3.5" />
            {locale === "en" ? "ES" : "EN"}
          </Button>
          <Button size="icon" variant="ghost" onClick={toggleTheme} className="hidden sm:inline-flex text-white/80" data-testid="button-theme-toggle">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-white border-white/30" data-testid="button-user-menu">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[100px] truncate text-xs">{user?.displayName}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/${citySlug}/saved`)} className="cursor-pointer gap-2" data-testid="menu-saved">
                  <Bookmark className="h-4 w-4" />
                  {t("layout.savedItems")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/${citySlug}/my-listings`)} className="cursor-pointer gap-2" data-testid="menu-my-listings">
                  <Building2 className="h-4 w-4" />
                  {t("layout.myListings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/${citySlug}/account/security`)} className="cursor-pointer gap-2" data-testid="menu-account-security">
                  <Lock className="h-4 w-4" />
                  {t("layout.accountSecurity")}
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer gap-2" data-testid="menu-admin-panel">
                      <Shield className="h-4 w-4" />
                      {t("layout.adminPanel")}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer gap-2 text-destructive" data-testid="menu-logout">
                  <LogOut className="h-4 w-4" />
                  {t("layout.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              onClick={() => setAuthDialogOpen(true)}
              className="gap-1.5"
              style={{ background: "hsl(var(--brand-gold))", color: "hsl(273 73% 23%)" }}
              data-testid="button-create-account"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">{t("layout.createAccount")}</span>
              <span className="sm:hidden text-xs font-medium">{t("layout.join")}</span>
            </Button>
          )}
        </div>

        <AuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          onSuccess={(options) => {
            if (options?.needsHubSetup) {
              setHubSetupOpen(true);
            }
          }}
        />
        <HubSetupDialog open={hubSetupOpen} onOpenChange={setHubSetupOpen} />
      </div>
    </header>
    <CharlotteGuidePanel citySlug={citySlug} open={guideOpen} onClose={() => setGuideOpen(false)} activateContext={charlotteContext} />
    {searchOpen && (
      <div className="fixed inset-0 z-40 flex items-start justify-center pt-16" data-testid="quick-search-overlay">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setSearchOpen(false); setSearchInitialQuery(""); }} />
        <div className="relative z-50 w-full max-w-lg mx-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <QuickSearch citySlug={citySlug} onClose={() => { setSearchOpen(false); setSearchInitialQuery(""); }} initialQuery={searchInitialQuery} hubSlug={(() => { const h = typeof window !== "undefined" ? localStorage.getItem("clt_hub_preference") : null; return h && h !== "__metro__" ? h : undefined; })()} />
        </div>
      </div>
    )}
    </>
  );
}

export function PublicLayout({ children, citySlug, forceComingSoon }: { children: React.ReactNode; citySlug: string; forceComingSoon?: boolean }) {
  const [charlotteCtx, setCharlotteCtx] = useState<CharlottePageContext | undefined>(undefined);
  const { data: city } = useCity(citySlug);

  const cityName = city?.brandName || city?.name || "CityMetroHub";
  const { t } = useI18n();
  const [location] = useLocation();

  const isHomepage = location === `/${citySlug}` || location === `/${citySlug}/`;
  const discoveryPaths = [
    `/${citySlug}/pulse`,
    `/${citySlug}/neighborhoods`,
    `/${citySlug}/events`,
    `/${citySlug}/articles`,
    `/${citySlug}/directory`,
    `/${citySlug}/jobs`,
    `/${citySlug}/live`,
    `/${citySlug}/marketplace`,
    `/${citySlug}/map`,
  ];
  const { isAdmin: layoutIsAdmin } = useAuth();
  const isComingSoon = forceComingSoon || (!layoutIsAdmin && !city?.isLive && (location === `/${citySlug}` || location === `/${citySlug}/` || location === `/${citySlug}/coming-soon`));
  const isDiscoveryPage = discoveryPaths.some((p) => location === p || location === `${p}/` || location.startsWith(`${p}?`));
  const isMapPage = location === `/${citySlug}/map` || location === `/${citySlug}/map/` || location.startsWith(`/${citySlug}/map?`);
  const isPulsePage = location === `/${citySlug}/pulse` || location === `/${citySlug}/pulse/` || location.startsWith(`/${citySlug}/pulse?`);
  const isAppStyle = isPulsePage;

  useEffect(() => {
    const rssLinkId = "rss-auto-discovery";
    let link = document.getElementById(rssLinkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = rssLinkId;
      link.rel = "alternate";
      link.type = "application/rss+xml";
      document.head.appendChild(link);
    }
    const hubMatch = location.match(new RegExp(`^/${citySlug}/neighborhoods/([^/]+)`));
    const hubCode = hubMatch ? hubMatch[1] : null;
    if (hubCode) {
      link.title = `${hubCode.toUpperCase()} — ${cityName} Metro Hub RSS`;
      link.href = `/api/cities/${citySlug}/hubs/${hubCode}/rss`;
    } else {
      link.title = `${cityName} Metro Hub RSS Feed`;
      link.href = `/api/cities/${citySlug}/rss`;
    }
    return () => { link?.remove(); };
  }, [citySlug, cityName, location]);

  const footerNavMain: { slug: string; label?: string; labelKey?: TranslationKey; path: string; color: string }[] = [
    { slug: "neighborhoods", labelKey: "nav.topLists", path: `/${citySlug}/neighborhoods`, color: "hsl(152 72% 50%)" },
    { slug: "events", labelKey: "nav.events", path: `/${citySlug}/events/browse`, color: "hsl(var(--brand-coral))" },
    { slug: "articles", labelKey: "nav.articles", path: `/${citySlug}/articles`, color: "hsl(var(--brand-sky))" },
    { slug: "jobs", labelKey: "nav.jobs", path: `/${citySlug}/jobs/browse`, color: "hsl(210 70% 50%)" },
    { slug: "relocation", labelKey: "nav.relocation", path: `/${citySlug}/explore/relocation`, color: "hsl(160 60% 45%)" },
  ];
  const footerNavVerticals: { slug: string; labelKey: TranslationKey; path: string; color: string }[] = [
    { slug: "food", labelKey: "layout.food", path: `/${citySlug}/explore/food`, color: "hsl(var(--brand-coral))" },
    { slug: "arts-entertainment", labelKey: "layout.music", path: `/${citySlug}/explore/arts-entertainment`, color: "hsl(var(--brand-sky))" },
    { slug: "pets", labelKey: "layout.pets", path: `/${citySlug}/explore/pets`, color: "hsl(152 70% 45%)" },
    { slug: "senior", labelKey: "layout.senior", path: `/${citySlug}/explore/senior`, color: "hsl(var(--brand-gold))" },
    { slug: "family", labelKey: "layout.family", path: `/${citySlug}/explore/family`, color: "hsl(var(--brand-pink-edge))" },
    { slug: "commerce", labelKey: "layout.commerce", path: `/${citySlug}/explore/commerce`, color: "hsl(var(--brand-teal))" },
  ];

  const hubContext = useHubContext(citySlug);
  const isOnHubPage = location.includes("/hub/") || location.includes("/neighborhoods/");
  const showLocalHubBanner = !isOnHubPage && !isHomepage && hubContext.detectedZone?.hubSlug && hubContext.detectedZone?.hubName && !hubContext.dismissed;

  return (
    <AdminEditProvider>
    <CharlotteContextValue.Provider value={{ context: charlotteCtx, setContext: setCharlotteCtx }}>
    <div className={`dark min-h-screen bg-gray-950 relative overflow-x-hidden ${isAppStyle ? "flex flex-col h-screen overflow-hidden" : ""}`}>
      <div
        className="fixed inset-0 opacity-20 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${cosmicBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="relative z-10 flex flex-col min-h-screen">
      {!isMapPage && <SoftLaunchBanner citySlug={citySlug} />}
      {!isMapPage && <SiteHeader citySlug={citySlug} cityName={cityName} isHomepage={isHomepage} isComingSoon={isComingSoon} />}
      {!isMapPage && showLocalHubBanner && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800" data-testid="local-hub-banner">
          <div className="mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-purple-900 dark:text-purple-100">
                You're near <strong>{hubContext.detectedZone.hubName}</strong>
              </span>
              <Link href={`/${citySlug}/hub/${hubContext.detectedZone.hubSlug}`}>
                <Button variant="link" size="sm" className="text-purple-700 dark:text-purple-300 h-auto p-0 text-sm font-medium" data-testid="link-visit-local-hub">
                  View local hub →
                </Button>
              </Link>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-purple-400" onClick={hubContext.dismissBanner} data-testid="button-dismiss-hub-banner">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {isAppStyle ? (
        <div className="flex-1 overflow-hidden">{children}</div>
      ) : (
        <main className={`${isHomepage || isMapPage ? "" : "mx-auto px-4 sm:px-6 lg:px-8 py-6"} ${isMapPage ? "" : "lg:pb-0 pb-20"}`}>
          {children}
        </main>
      )}
      {!isMapPage && <MobileBottomNav citySlug={citySlug} isComingSoon={isComingSoon} />}
      {!isAppStyle && !isMapPage && (
      <footer
        className={`relative overflow-hidden py-10 lg:pb-10 pb-24`}
        data-testid="site-footer"
      >
        <img
          src={cosmicBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/75" aria-hidden="true" />
        <div className="relative mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12">
            <div className="md:w-1/4 flex flex-col items-start gap-3">
              <img src={mainLogo} alt={cityName} className="h-20 w-auto object-contain" />
              <p className="text-sm text-white/80 max-w-xs text-left">
                {t("footer.tagline")}
              </p>
            </div>
            <div className="md:w-3/4 grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-12">
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-white/50 mb-2 block">{t("layout.explore")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {footerNavMain.map((item) => (
                      <Link key={item.slug} href={item.path}>
                        <span
                          className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border hover:brightness-125"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${item.color} 30%, transparent)`,
                            color: "white",
                            borderColor: `color-mix(in srgb, ${item.color} 60%, transparent)`,
                            boxShadow: `0 0 8px color-mix(in srgb, ${item.color} 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)`,
                            textShadow: "0 0 6px rgba(255,255,255,0.3)",
                          }}
                          data-testid={`footer-link-${item.slug}`}
                        >
                          {item.labelKey ? t(item.labelKey) : item.label}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-white/50 mb-2 block">{t("layout.discover")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {footerNavVerticals.map((item) => (
                      <Link key={item.slug} href={item.path}>
                        <span
                          className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border hover:brightness-125"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${item.color} 30%, transparent)`,
                            color: "white",
                            borderColor: `color-mix(in srgb, ${item.color} 60%, transparent)`,
                            boxShadow: `0 0 8px color-mix(in srgb, ${item.color} 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)`,
                            textShadow: "0 0 6px rgba(255,255,255,0.3)",
                          }}
                          data-testid={`footer-link-${item.slug}`}
                        >
                          {t(item.labelKey)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-xs uppercase tracking-wider font-semibold text-white/50 mb-1">{t("layout.getInvolved")}</span>
                <Link href={`/${citySlug}/submit`}>
                  <span
                    className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border hover:brightness-125"
                    style={{
                      backgroundColor: "color-mix(in srgb, hsl(var(--brand-teal)) 30%, transparent)",
                      color: "white",
                      borderColor: "color-mix(in srgb, hsl(var(--brand-teal)) 60%, transparent)",
                      boxShadow: "0 0 8px color-mix(in srgb, hsl(var(--brand-teal)) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)",
                      textShadow: "0 0 6px rgba(255,255,255,0.3)",
                    }}
                    data-testid="footer-btn-submit-hub"
                  >
                    {t("layout.submitToHub")}
                  </span>
                </Link>
                <Link href={`/${citySlug}/confirm`}>
                  <span
                    className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border hover:brightness-125"
                    style={{
                      backgroundColor: "color-mix(in srgb, hsl(var(--brand-gold)) 30%, transparent)",
                      color: "white",
                      borderColor: "color-mix(in srgb, hsl(var(--brand-gold)) 60%, transparent)",
                      boxShadow: "0 0 8px color-mix(in srgb, hsl(var(--brand-gold)) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)",
                      textShadow: "0 0 6px rgba(255,255,255,0.3)",
                    }}
                    data-testid="footer-btn-claim"
                  >
                    {t("layout.claimYourBusiness")}
                  </span>
                </Link>
                <Link href={`/${citySlug}/coming-soon`}>
                  <span
                    className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border hover:brightness-125"
                    style={{
                      backgroundColor: "color-mix(in srgb, hsl(280 70% 55%) 30%, transparent)",
                      color: "white",
                      borderColor: "color-mix(in srgb, hsl(280 70% 55%) 60%, transparent)",
                      boxShadow: "0 0 8px color-mix(in srgb, hsl(280 70% 55%) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)",
                      textShadow: "0 0 6px rgba(255,255,255,0.3)",
                    }}
                    data-testid="footer-btn-coming-soon"
                  >
                    {t("layout.comingSoon")}
                  </span>
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/15 pt-4 flex items-center justify-between">
            <Link href="/citymetrohub">
              <span className="text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer" data-testid="footer-link-citymetrohub">
                {t("footer.poweredBy")}
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <a href={`/api/podcast/${citySlug}/feed.xml`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-white/50 hover:text-purple-400 transition-colors" data-testid="footer-link-podcast">
                <Podcast className="h-3.5 w-3.5" />
                <span>Podcast</span>
              </a>
              <a href={`/api/cities/${citySlug}/rss`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-white/50 hover:text-orange-400 transition-colors" data-testid="footer-link-rss">
                <Rss className="h-3.5 w-3.5" />
                <span>RSS</span>
              </a>
              <Link href={`/${citySlug}/legal`}>
                <span className="text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer" data-testid="footer-link-legal">
                  {t("footer.legal")}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
      )}
      </div>
    </div>
    </CharlotteContextValue.Provider>
    <AdminEditFab />
    </AdminEditProvider>
  );
}
