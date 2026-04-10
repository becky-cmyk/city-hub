import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import {
  ShoppingBag, Briefcase, Home, Building2, MapPin, DollarSign,
  Send, Check, Eye, Tag, ExternalLink, Palette, Camera, Music, BookOpen, Hammer, GraduationCap, Image, Gift, AlertTriangle, Heart,
  Plus, Search, Wrench, SlidersHorizontal, ChevronDown, Clock, Sparkles
} from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { MarketplaceListing } from "@shared/schema";
import { LeaderboardAd, MarketplaceTileAd, useMarketplaceTileAds } from "@/components/ad-banner";
import { DarkPageShell } from "@/components/dark-page-shell";

const SAMPLE_LISTINGS = [
  {
    id: "sample-1", type: "JOB" as const, title: "Line Cook — Full Time",
    description: "Fast-paced scratch kitchen seeking experienced line cook. Benefits include meal credits and flexible scheduling.",
    category: "Food & Drink", price: null, contactName: "Stoke Charlotte",
    neighborhood: "South End", salary: "$18–22/hr", tags: ["Full-Time", "Food & Drink"],
  },
  {
    id: "sample-2", type: "JOB" as const, title: "Marketing Coordinator",
    description: "Join a growing Charlotte tech company. You'll manage social media, email campaigns, and local event sponsorships.",
    category: "Tech", price: null, contactName: "QueenTech Solutions",
    neighborhood: "Uptown", salary: "$50–60K", tags: ["Full-Time", "Tech"],
  },
  {
    id: "sample-3", type: "JOB" as const, title: "Part-Time Barista",
    description: "Community-focused coffee shop in NoDa's arts district. Flexible hours, free coffee, and a creative atmosphere.",
    category: "Food & Drink", price: null, contactName: "Smelly Cat Coffeehouse",
    neighborhood: "NoDa", salary: "$14/hr + tips", tags: ["Part-Time", "Food & Drink"],
  },
  {
    id: "sample-4", type: "JOB" as const, title: "Property Manager",
    description: "Manage a portfolio of 200+ apartment units. Real estate license preferred. Excellent benefits package.",
    category: "Real Estate", price: null, contactName: "Greystone Management",
    neighborhood: "Ballantyne", salary: "$55–70K", tags: ["Full-Time", "Real Estate"],
  },
  {
    id: "sample-5", type: "CLASSIFIED" as const, title: "1BR Loft at The Vue",
    description: "Stunning 18th-floor loft with floor-to-ceiling windows, city views, in-unit W/D, rooftop pool, and 24/7 concierge.",
    category: "For Rent", price: 1850, contactName: "The Vue Charlotte",
    neighborhood: "Uptown", salary: "$1,850/mo", tags: ["1 Bed", "Luxury"],
  },
  {
    id: "sample-6", type: "CLASSIFIED" as const, title: "2BR at Novel NoDa",
    description: "Modern 2-bedroom steps from the LYNX Blue Line. Open floor plan, quartz counters, dog park, and coworking lounge.",
    category: "For Rent", price: 1650, contactName: "Novel NoDa",
    neighborhood: "NoDa", salary: "$1,650/mo", tags: ["2 Bed", "Transit-Friendly"],
  },
  {
    id: "sample-7", type: "CLASSIFIED" as const, title: "Studio at Camden South End",
    description: "Walkable studio on the Rail Trail. Fitness center, resort-style pool, and pet-friendly community with bark park.",
    category: "For Rent", price: 1350, contactName: "Camden South End",
    neighborhood: "South End", salary: "$1,350/mo", tags: ["Studio", "Pet-Friendly"],
  },
  {
    id: "sample-8", type: "CLASSIFIED" as const, title: "3BR Townhome — Ballantyne",
    description: "Spacious 3-bed/2.5-bath townhome with attached garage, private patio, and access to community pool and trails.",
    category: "For Rent", price: 2400, contactName: "Ballantyne Village",
    neighborhood: "Ballantyne", salary: "$2,400/mo", tags: ["3 Bed", "Townhome"],
  },
];

const SAMPLE_CREATOR_LISTINGS = [
  {
    id: "creator-1", type: "CREATOR_ART" as const, title: "Original Cityscape — Uptown at Dusk",
    description: "Mixed media on canvas, 24x36. Captures the Charlotte skyline from Romare Bearden Park at golden hour.",
    category: "Art", price: 350, contactName: "Studio Mara",
    neighborhood: "NoDa", tags: ["Original", "Mixed Media"],
  },
  {
    id: "creator-2", type: "CREATOR_PRINTS" as const, title: "CLT Neighborhood Map Print",
    description: "Hand-illustrated watercolor map of Charlotte's 15 most iconic neighborhoods. Archival giclée, 18x24.",
    category: "Prints", price: 45, contactName: "QueenCity Prints Co",
    neighborhood: "Plaza Midwood", tags: ["Print", "Map Art"],
  },
  {
    id: "creator-3", type: "CREATOR_PHOTOGRAPHY" as const, title: "Panthers Stadium Night Shot — Digital Download",
    description: "High-resolution digital download of Bank of America Stadium under lights. Commercial license included.",
    category: "Photography", price: 25, contactName: "704 Lens",
    neighborhood: "Uptown", tags: ["Digital", "Sports"],
  },
  {
    id: "creator-4", type: "CREATOR_HANDMADE" as const, title: "Hand-Poured Soy Candle — Carolina Pine",
    description: "12oz hand-poured soy candle with notes of pine, cedarwood, and campfire. Made in small batches in Charlotte.",
    category: "Handmade", price: 28, contactName: "Wicks & Wick",
    neighborhood: "South End", tags: ["Candle", "Home"],
  },
  {
    id: "creator-5", type: "CREATOR_MUSIC" as const, title: "CLT Sessions Vol. 1 — Digital Album",
    description: "10-track compilation featuring 10 Charlotte indie artists. Curated live recordings from local venues.",
    category: "Music", price: 12, contactName: "704 Sound Collective",
    neighborhood: "NoDa", tags: ["Album", "Indie"],
  },
  {
    id: "creator-6", type: "CREATOR_CLASSES" as const, title: "Intro to Pottery — Weekend Workshop",
    description: "Hands-on wheel throwing class for beginners. All materials included. Saturday 10am–1pm.",
    category: "Classes", price: 85, contactName: "CLT Clay Studio",
    neighborhood: "LoSo", tags: ["Workshop", "Pottery"],
  },
];

type FilterType = "ALL" | "JOB" | "CLASSIFIED" | "CREATOR" | "WISHLIST" | "SERVICE" | "FOR_SALE" | "HOUSING" | "COMMUNITY" | "WANTED" | "HOUSING_SUPPLY" | "HOUSING_DEMAND" | "COMMERCIAL_PROPERTY";

const CREATOR_TYPE_KEYS: Record<string, { labelKey: TranslationKey; icon: typeof Palette }> = {
  CREATOR_ART: { labelKey: "marketplace.creatorArt", icon: Palette },
  CREATOR_PRINTS: { labelKey: "marketplace.creatorPrints", icon: Image },
  CREATOR_PHOTOGRAPHY: { labelKey: "marketplace.creatorPhotography", icon: Camera },
  CREATOR_HANDMADE: { labelKey: "marketplace.creatorHandmade", icon: Hammer },
  CREATOR_DIGITAL: { labelKey: "marketplace.creatorDigital", icon: BookOpen },
  CREATOR_MUSIC: { labelKey: "marketplace.creatorMusic", icon: Music },
  CREATOR_CLASSES: { labelKey: "marketplace.creatorClasses", icon: GraduationCap },
};

const CONDITION_LABELS: Record<string, string> = { NEW: "New", LIKE_NEW: "Like New", GOOD: "Good", FAIR: "Fair" };
const CONDITION_COLORS: Record<string, string> = { NEW: "bg-emerald-500", LIKE_NEW: "bg-blue-500", GOOD: "bg-amber-500", FAIR: "bg-orange-500" };

function timeAgo(date: string | Date) {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function Marketplace({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const initialNeighborhood = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("neighborhood") || "" : "";
  const [neighborhood, setNeighborhood] = useState(initialNeighborhood);
  const [sortBy, setSortBy] = useState("newest");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [subtype, setSubtype] = useState("");
  const [leaseOrSale, setLeaseOrSale] = useState("");
  const [inquiry, setInquiry] = useState({ name: "", email: "", _hp_field: "" });
  const [submitted, setSubmitted] = useState(false);
  const [formLoadedAt] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 24;

  usePageMeta({
    title: `${t("marketplace.title")} — CLT Metro Hub`,
    description: t("marketplace.subtitle"),
    canonical: `${window.location.origin}/${citySlug}/marketplace`,
  });

  const queryParams = new URLSearchParams();
  if (filter !== "ALL" && !["CREATOR", "WISHLIST", "CLASSIFIED"].includes(filter)) queryParams.set("type", filter);
  if (searchQuery) queryParams.set("q", searchQuery);
  if (category) queryParams.set("category", category);
  if (subcategory) queryParams.set("subcategory", subcategory);
  if (subtype) queryParams.set("subtype", subtype);
  if (leaseOrSale) queryParams.set("leaseOrSale", leaseOrSale);
  if (neighborhood) queryParams.set("neighborhood", neighborhood);
  if (priceMin) queryParams.set("priceMin", priceMin);
  if (priceMax) queryParams.set("priceMax", priceMax);
  if (sortBy === "price_asc") queryParams.set("sort", "price_asc");
  if (sortBy === "price_desc") queryParams.set("sort", "price_desc");
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(page * PAGE_SIZE));

  const { data: listings, isLoading, isFetching } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/cities", citySlug, "marketplace", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/marketplace/listings?${queryParams.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  const [allLoadedItems, setAllLoadedItems] = useState<MarketplaceListing[]>([]);
  const [prevListingsKey, setPrevListingsKey] = useState("");

  const listingsKey = JSON.stringify(listings?.map((l) => l.id) || []);
  useEffect(() => {
    if (listingsKey !== prevListingsKey) {
      setPrevListingsKey(listingsKey);
      if (page === 0) {
        setAllLoadedItems(listings || []);
      } else if (listings && listings.length > 0) {
        setAllLoadedItems(prev => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = listings.filter((l) => !existingIds.has(l.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [listingsKey, prevListingsKey, page, listings]);
  const hasMore = listings && listings.length >= PAGE_SIZE;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (inquiry._hp_field) return;
      await apiRequest("POST", `/api/cities/${citySlug}/marketplace-inquiry`, {
        name: inquiry.name,
        email: inquiry.email,
        _hp_field: inquiry._hp_field,
        _form_loaded_at: formLoadedAt,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: t("marketplace.gotIt"), description: t("marketplace.gotItDesc") });
    },
    onError: () => {
      toast({ title: t("marketplace.error"), description: t("marketplace.errorDesc"), variant: "destructive" });
    },
  });

  const marketplaceTileAds = useMarketplaceTileAds(citySlug, "marketplace");

  const hasRealListings = allLoadedItems.length > 0;
  const isCreatorType = (type: string) => type.startsWith("CREATOR_");
  const isWishlistType = (type: string) => type === "wishlist" || type === "WISHLIST";
  const allItems = hasRealListings ? allLoadedItems : [...SAMPLE_LISTINGS, ...SAMPLE_CREATOR_LISTINGS];
  const isSampleData = !hasRealListings;

  const filtered = allItems.filter((item: MarketplaceListing & Record<string, unknown>) => {
    if (filter === "ALL") return true;
    if (filter === "CREATOR") return isCreatorType(item.type);
    if (filter === "WISHLIST") return isWishlistType(item.type);
    return item.type === filter;
  });

  const formatPrice = (item: MarketplaceListing) => {
    if (item.pricingType === "FREE") return "Free";
    if (item.pricingType === "CONTACT") return "Contact";
    if (item.salary) return item.salary;
    if (item.price) {
      const formatted = `$${item.price.toLocaleString()}`;
      if (item.pricingType === "HOURLY") return `${formatted}/hr`;
      return formatted;
    }
    return null;
  };

  const FILTER_OPTIONS: [FilterType, string, React.ComponentType<{ className?: string }>?][] = [
    ["ALL", t("marketplace.all")],
    ["HOUSING_SUPPLY", "Housing Supply", Home],
    ["HOUSING_DEMAND", "Housing Wanted", Search],
    ["COMMERCIAL_PROPERTY", "Commercial", Building2],
    ["SERVICE", "Services", Wrench],
    ["FOR_SALE", "For Sale", Tag],
    ["HOUSING", "Housing", Home],
    ["JOB", t("marketplace.jobs"), Briefcase],
    ["COMMUNITY", "Community", Heart],
    ["WANTED", "Wanted", Search],
    ["CLASSIFIED", t("marketplace.rentals"), Home],
    ["CREATOR", t("marketplace.creatorShop"), Palette],
    ["WISHLIST", "Wishlist", Gift],
  ];

  const handlePostClick = () => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    window.location.href = `/${citySlug}/marketplace/post`;
  };

  const isNewType = (type: string) => ["SERVICE", "FOR_SALE", "HOUSING", "COMMUNITY", "WANTED"].includes(type);
  const getListingLink = (item: MarketplaceListing & Record<string, unknown>) => {
    if (item.id.startsWith("sample-") || item.id.startsWith("creator-") || item.id.startsWith("wishlist-")) return null;
    return `/${citySlug}/marketplace/${item.id}`;
  };

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="space-y-6">

        <div className="rounded-xl bg-white/10 border border-white/10 p-6 md:p-8" data-testid="section-marketplace-header">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <ShoppingBag className="h-6 w-6 text-amber-400" />
                <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-marketplace-title">
                  {t("marketplace.title")}
                </h1>
              </div>
              <p className="text-sm text-white/50 max-w-xl">
                {t("marketplace.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/${citySlug}/marketplace/my`}>
                <Button variant="outline" size="sm" className="border-white/20 text-white/70 hover:bg-white/10 text-xs" data-testid="link-my-marketplace">
                  My Listings
                </Button>
              </Link>
              <Button
                onClick={handlePostClick}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-1.5"
                data-testid="button-post-listing"
              >
                <Plus className="h-4 w-4" /> Post Listing
              </Button>
            </div>
          </div>
        </div>

        {isSampleData && (
          <div className="rounded-lg border border-amber-600/40 bg-amber-950/60 px-4 py-2.5 text-xs leading-relaxed text-amber-100/90" data-testid="disclaimer-marketplace">
            <span className="mr-1.5 font-bold uppercase tracking-wide text-amber-300">{t("marketplace.preview")}</span>
            {t("marketplace.previewDesc")}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" data-testid="marketplace-filters">
            {FILTER_OPTIONS.map(([val, label, icon]) => {
              const Icon = icon;
              return (
                <button
                  key={val}
                  onClick={() => { setFilter(val); setPage(0); }}
                  aria-pressed={filter === val}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    filter === val
                      ? "bg-amber-500 text-black shadow-md"
                      : "bg-white/10 text-white/60 border border-white/10 hover:bg-white/15"
                  }`}
                  data-testid={`marketplace-filter-${val.toLowerCase()}`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                placeholder="Search listings..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
                className="pl-9 h-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-xs"
                data-testid="input-search"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-white/60 hover:bg-white/10 gap-1 text-xs"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </Button>
          </div>

          {showFilters && (
            <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10" data-testid="marketplace-adv-filters">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Category</label>
                <Select value={category || "_all"} onValueChange={(v) => { setCategory(v === "_all" ? "" : v); setSubcategory(""); setPage(0); }}>
                  <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white" data-testid="select-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Categories</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Vehicles">Vehicles</SelectItem>
                    <SelectItem value="Home & Garden">Home & Garden</SelectItem>
                    <SelectItem value="Clothing">Clothing</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Home Services">Home Services</SelectItem>
                    <SelectItem value="Creative">Creative</SelectItem>
                    <SelectItem value="Apartment">Apartment</SelectItem>
                    <SelectItem value="Room">Room</SelectItem>
                    <SelectItem value="House">House</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Subcategory</label>
                <Input placeholder="Any" value={subcategory} onChange={e => { setSubcategory(e.target.value); setPage(0); }} className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-subcategory" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Neighborhood</label>
                <Input placeholder="Any" value={neighborhood} onChange={e => { setNeighborhood(e.target.value); setPage(0); }} className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-neighborhood" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Min Price</label>
                <Input type="number" placeholder="$0" value={priceMin} onChange={e => { setPriceMin(e.target.value); setPage(0); }} className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-price-min" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Max Price</label>
                <Input type="number" placeholder="Any" value={priceMax} onChange={e => { setPriceMax(e.target.value); setPage(0); }} className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-price-max" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Sort By</label>
                <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
                  <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white" data-testid="select-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price_asc">Price: Low → High</SelectItem>
                    <SelectItem value="price_desc">Price: High → Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            </div>
          )}
        </div>

        <LeaderboardAd citySlug={citySlug} page="marketplace" />

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
                <div className="aspect-[4/3] bg-white/10" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4 bg-white/10" />
                  <Skeleton className="h-3 w-1/2 bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white/10 border border-white/10 p-8 text-center">
            <ShoppingBag className="h-8 w-8 mx-auto mb-3 text-white/20" />
            <h3 className="font-semibold text-lg text-white" data-testid="text-no-listings">{t("marketplace.noListings")}</h3>
            <p className="text-sm text-white/50 mt-1 mb-4">{t("marketplace.noListingsHint")}</p>
            <Button onClick={handlePostClick} className="bg-amber-500 text-black font-bold gap-1.5" data-testid="button-post-first">
              <Plus className="h-4 w-4" /> Post a Listing
            </Button>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((item, idx: number) => {
              const adIndex = Math.floor((idx + 1) / 6);
              const showAd = (idx + 1) % 6 === 0 && adIndex - 1 < marketplaceTileAds.length;
              const tileAd = showAd ? marketplaceTileAds[adIndex - 1] : null;
              const listingLink = getListingLink(item);
              const imageUrl = item.imageUrl || (item.galleryImages?.length ? item.galleryImages[0] : null);
              const hasImage = !!imageUrl;

              const cardContent = (
                <div
                  className="group rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"
                  data-testid={`marketplace-item-${item.id}`}
                  onClick={() => {
                    if (!listingLink && item.externalUrl) window.open(item.externalUrl, "_blank");
                  }}
                >
                  <div className="relative aspect-[4/3] bg-white/5 overflow-hidden">
                    {hasImage ? (
                      <img src={imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02]">
                        {(() => {
                          if (isWishlistType(item.type)) return <Gift className="h-10 w-10 text-rose-400/30" />;
                          const creatorInfo = CREATOR_TYPE_KEYS[item.type];
                          if (creatorInfo) { const CIcon = creatorInfo.icon; return <CIcon className="h-10 w-10 text-purple-400/30" />; }
                          if (item.type === "JOB") return <Briefcase className="h-10 w-10 text-blue-400/30" />;
                          if (item.type === "SERVICE") return <Wrench className="h-10 w-10 text-purple-400/30" />;
                          if (item.type === "HOUSING" || item.type === "HOUSING_SUPPLY") return <Home className="h-10 w-10 text-blue-400/30" />;
                          if (item.type === "HOUSING_DEMAND") return <Search className="h-10 w-10 text-cyan-400/30" />;
                          if (item.type === "COMMERCIAL_PROPERTY") return <Building2 className="h-10 w-10 text-indigo-400/30" />;
                          return <ShoppingBag className="h-10 w-10 text-white/10" />;
                        })()}
                      </div>
                    )}
                    {isSampleData && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className="text-[8px] border-amber-500/30 text-amber-400 gap-0.5 bg-black/60">
                          <Eye className="h-2 w-2" /> {t("marketplace.sample")}
                        </Badge>
                      </div>
                    )}
                    {formatPrice(item) && (
                      <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-lg">
                        {item.type === "JOB" && <DollarSign className="h-3 w-3 inline" />}
                        {formatPrice(item)}
                      </div>
                    )}
                    {item.condition && CONDITION_LABELS[item.condition] && (
                      <div className="absolute top-2 left-2">
                        <Badge className={`text-[9px] border-0 text-white ${CONDITION_COLORS[item.condition]}`}>
                          {CONDITION_LABELS[item.condition]}
                        </Badge>
                      </div>
                    )}
                    {item.featuredFlag && (
                      <div className={`absolute top-2 ${item.condition ? "left-16" : "left-2"}`}>
                        <Badge className="text-[9px] border-0 text-black bg-amber-400" data-testid={`badge-featured-${item.id}`}>
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" />Featured
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="flex items-start gap-1.5 mb-1">
                      {(() => {
                        if (isWishlistType(item.type)) {
                          return <Badge className="text-[8px] border-0 bg-rose-500 text-white shrink-0"><Gift className="h-2 w-2 mr-0.5" />Needed</Badge>;
                        }
                        const creatorInfo = CREATOR_TYPE_KEYS[item.type];
                        if (creatorInfo) {
                          const CIcon = creatorInfo.icon;
                          return <Badge className="text-[8px] border-0 bg-purple-500 text-white shrink-0"><CIcon className="h-2 w-2 mr-0.5" />{t(creatorInfo.labelKey)}</Badge>;
                        }
                        if (item.type === "SERVICE") return <Badge className="text-[8px] border-0 bg-purple-600 text-white shrink-0"><Wrench className="h-2 w-2 mr-0.5" />Service</Badge>;
                        if (item.type === "FOR_SALE") return <Badge className="text-[8px] border-0 bg-emerald-600 text-white shrink-0"><Tag className="h-2 w-2 mr-0.5" />For Sale</Badge>;
                        if (item.type === "HOUSING") return <Badge className="text-[8px] border-0 bg-blue-600 text-white shrink-0"><Home className="h-2 w-2 mr-0.5" />Housing</Badge>;
                        if (item.type === "HOUSING_SUPPLY") return <Badge className="text-[8px] border-0 bg-teal-600 text-white shrink-0"><Home className="h-2 w-2 mr-0.5" />For Rent/Sale</Badge>;
                        if (item.type === "HOUSING_DEMAND") return <Badge className="text-[8px] border-0 bg-cyan-600 text-white shrink-0"><Search className="h-2 w-2 mr-0.5" />Housing Wanted</Badge>;
                        if (item.type === "COMMERCIAL_PROPERTY") return <Badge className="text-[8px] border-0 bg-indigo-600 text-white shrink-0"><Building2 className="h-2 w-2 mr-0.5" />Commercial</Badge>;
                        if (item.type === "COMMUNITY") return <Badge className="text-[8px] border-0 bg-rose-600 text-white shrink-0"><Heart className="h-2 w-2 mr-0.5" />Community</Badge>;
                        if (item.type === "WANTED") return <Badge className="text-[8px] border-0 bg-orange-600 text-white shrink-0"><Tag className="h-2 w-2 mr-0.5" />Wanted</Badge>;
                        return (
                          <Badge className={`text-[8px] border-0 shrink-0 ${item.type === "JOB" ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"}`}>
                            {item.type === "JOB" ? <Briefcase className="h-2 w-2 mr-0.5" /> : <Home className="h-2 w-2 mr-0.5" />}
                            {item.type === "JOB" ? t("marketplace.job") : t("marketplace.rental")}
                          </Badge>
                        );
                      })()}
                      {isWishlistType(item.type) && item.urgency && (
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full ${
                          item.urgency === "high" ? "bg-red-500/20 text-red-400" :
                          item.urgency === "medium" ? "bg-amber-500/20 text-amber-400" :
                          "bg-green-500/20 text-green-400"
                        }`}>
                          <AlertTriangle className="h-2 w-2 inline mr-0.5" />
                          {item.urgency.charAt(0).toUpperCase() + item.urgency.slice(1)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold leading-tight text-white line-clamp-2" data-testid={`text-listing-title-${item.id}`}>
                      {item.title}
                    </h3>
                    {item.tagline && <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{item.tagline}</p>}
                    <p className="text-[10px] text-white/50 mt-1 flex items-center gap-1">
                      <Building2 className="h-2.5 w-2.5" />{item.contactName || item.category}
                    </p>

                    {(item.type === "HOUSING" || item.type === "HOUSING_SUPPLY" || item.type === "COMMERCIAL_PROPERTY") && (
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
                        {item.bedrooms != null && <span>{item.bedrooms} bed</span>}
                        {item.bathrooms != null && <span>{item.bathrooms} bath</span>}
                        {item.squareFeet != null && <span>{item.squareFeet.toLocaleString()} sqft</span>}
                        {item.leaseOrSale && <span className="font-medium text-amber-400/70">{item.leaseOrSale === "SALE" ? "For Sale" : "For Lease"}</span>}
                      </div>
                    )}

                    {item.type === "SERVICE" && (
                      <div className="mt-1 flex items-center gap-2" data-testid={`service-card-info-${item.id}`}>
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[8px] font-bold text-white">
                          {(item.contactName || "S").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-white/50 truncate max-w-[80px]">{item.contactName || "Seller"}</span>
                        {(item.startingPrice != null || item.price != null) && (
                          <span className="text-[10px] font-bold text-emerald-400 ml-auto">
                            From ${(item.startingPrice || item.price || 0).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {item.type === "FOR_SALE" && item.itemCondition && (
                      <div className="mt-1 text-[10px] text-white/40" data-testid={`forsale-card-info-${item.id}`}>
                        <span className="capitalize">{item.itemCondition.replace(/_/g, " ")}</span>
                        {item.pickupOnly && <span className="ml-2">Pickup only</span>}
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/30">
                      {item.neighborhood && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />{item.neighborhood}
                        </span>
                      )}
                      {item.createdAt && !isSampleData && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{timeAgo(item.createdAt)}
                        </span>
                      )}
                    </div>

                    {isWishlistType(item.type) && item.quantityNeeded && (
                      <p className="text-[10px] text-white/50 mt-1 font-medium">Qty needed: {item.quantityNeeded}</p>
                    )}

                    {(item.tags || []).length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        {(item.tags || []).slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[7px] px-1 py-0 border-white/10 text-white/50">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <>{tileAd && <MarketplaceTileAd key={`ad-${tileAd.id}`} ad={tileAd} citySlug={citySlug} />}
                {listingLink ? (
                  <Link key={item.id} href={listingLink}>{cardContent}</Link>
                ) : (
                  <div key={item.id}>{cardContent}</div>
                )}</>
              );
            })}
          </div>

          {hasRealListings && hasMore && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => setPage(p => p + 1)}
                disabled={isFetching}
                data-testid="button-load-more"
              >
                {isFetching ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
          </>
        )}

        <div className="rounded-xl bg-white/10 border border-white/10 p-5 md:p-6" data-testid="marketplace-inquiry">
          <h3 className="text-sm font-bold mb-1 flex items-center gap-2 text-white" data-testid="text-inquiry-title">
            <Send className="h-4 w-4 text-amber-400" />
            {t("marketplace.inquiryTitle")}
          </h3>
          <p className="text-xs text-white/50 mb-3">{t("marketplace.inquiryDesc")}</p>
          {submitted ? (
            <div className="text-center py-3">
              <Check className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-sm text-white" data-testid="text-inquiry-success">{t("marketplace.inquirySuccess")}</p>
            </div>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!inquiry.name || !inquiry.email) {
                toast({ title: t("marketplace.fillRequired"), variant: "destructive" });
                return;
              }
              submitMutation.mutate();
            }} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                <input
                  type="text"
                  name="website"
                  autoComplete="off"
                  value={inquiry._hp_field}
                  onChange={e => setInquiry(p => ({ ...p, _hp_field: e.target.value }))}
                  tabIndex={-1}
                />
              </div>
              <Input
                placeholder={t("marketplace.yourName")}
                value={inquiry.name}
                onChange={e => setInquiry(p => ({ ...p, name: e.target.value }))}
                className="text-xs h-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                data-testid="marketplace-inquiry-name"
              />
              <Input
                placeholder={t("marketplace.emailAddress")}
                type="email"
                value={inquiry.email}
                onChange={e => setInquiry(p => ({ ...p, email: e.target.value }))}
                className="text-xs h-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                data-testid="marketplace-inquiry-email"
              />
              <Button
                type="submit"
                size="sm"
                disabled={submitMutation.isPending}
                className="bg-amber-500 text-black font-bold text-xs h-9"
                data-testid="marketplace-inquiry-submit"
              >
                {submitMutation.isPending ? t("marketplace.sending") : <><Send className="h-3 w-3 mr-1" /> {t("marketplace.notifyMe")}</>}
              </Button>
            </form>
          )}
        </div>

      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </DarkPageShell>
  );
}
