import { useQuery } from "@tanstack/react-query";
import { useCategories } from "@/hooks/use-city";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import ReviewSection from "@/components/review-section";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  MapPin,
  Phone,
  Globe,
  Mail,
  Star,
  Clock,
  Image,
  Calendar,
  MessageSquare,
  Newspaper,
  FileText,
  List,
  ExternalLink,
  CheckCircle,
  ArrowLeft,
  Instagram,
  Facebook,
  LinkIcon,
  Building2,
  Heart,
  Languages,
  Crown,
  Store,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Award,
  ShieldCheck,
  HelpCircle,
  Menu,
  X,
  Medal,
  Sparkles,
  Mic,
  CalendarCheck,
  Users,
  HeartHandshake,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { Business, MicrositeBlock } from "@shared/schema";
import { TransitBadgeFromId } from "@/components/transit-badge";
import { JsonLd } from "@/components/json-ld";
import { useCityZones } from "@/hooks/use-city";
import { BlockRenderer } from "@/components/microsite/block-renderer";
import { getTemplateStyle, getTemplateVars } from "@/components/microsite/templates";

interface PresenceServiceItem {
  id: string;
  presenceId: string;
  serviceName: string;
  isPrimary: boolean;
  parentServiceId: string | null;
  sortOrder: number;
}

interface ShoppingCenterItem {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  cityId: string | null;
  zoneId: string | null;
}

interface ContentJournalItem {
  id: string;
  contentType: string;
  title: string;
  snippet: string | null;
  externalUrl: string | null;
  sourceLabel: string | null;
  hubLabel: string | null;
  nicheLabel: string | null;
  batchTag: string | null;
  publishedAt: string | null;
}

interface SupporterItem {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  listingTier: string;
  tagline: string;
}

interface MicroTagItem {
  id: string;
  name: string;
  slug: string;
}

interface BusinessFaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

interface MicrositeData {
  business: Business & { tierConfig: any; effectiveTier?: string };
  externalLinks: any[];
  contentLinks: any[];
  events: any[];
  reviews: any[];
  services: PresenceServiceItem[];
  shoppingCenter: ShoppingCenterItem | null;
  contentJournal: ContentJournalItem[];
  domain: any;
  coverage: any[];
  supporters?: SupporterItem[];
  articles?: { id: string; title: string; slug: string; author: string; category: string; publishedAt: string }[];
  microTags?: MicroTagItem[];
  volunteerOpportunities?: { id: string; title: string; description: string; schedule_commitment: string; skills_helpful: string; contact_url: string; location_text: string }[];
  wishlistItems?: { id: number; title: string; description: string; quantityNeeded: number | null; urgency: string | null; externalUrl: string | null; imageUrl: string | null }[];
  profileBadges?: string[];
  businessFaqs?: BusinessFaqItem[];
  moduleAccess?: Record<string, boolean>;
  isAdmin?: boolean;
}

const REVIEW_SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  google: { label: "Google", color: "bg-blue-600" },
  yelp: { label: "Yelp", color: "bg-red-600" },
  facebook: { label: "Facebook", color: "bg-indigo-600" },
  internal: { label: "Hub Review", color: "bg-teal-600" },
};

function SampleReviewsDisplay({ reviews, businessName, googleRating, googleReviewCount }: { reviews: any[]; businessName: string; googleRating?: string; googleReviewCount?: number }) {
  const hubAvg = reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length : 0;
  const hubCount = reviews.length;
  const gRating = googleRating ? parseFloat(googleRating) : 0;
  const gCount = googleReviewCount || 0;
  const totalCount = gCount + hubCount;
  const combinedAvg = totalCount > 0 ? (gRating * gCount + hubAvg * hubCount) / totalCount : 0;

  return (
    <div className="space-y-4" data-testid="section-sample-reviews">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold" data-testid="text-combined-rating">{combinedAvg.toFixed(1)}</div>
          <div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-4 w-4 ${s <= Math.round(combinedAvg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-review-source-breakdown">
              Based on{gCount > 0 ? ` ${gCount} Google review${gCount === 1 ? "" : "s"}` : ""}
              {gCount > 0 && hubCount > 0 ? " and" : ""}
              {hubCount > 0 ? ` ${hubCount} Hub review${hubCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {googleRating && (
            <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-google-source">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {googleRating} Google ({gCount.toLocaleString()})
            </Badge>
          )}
          {hubCount > 0 && (
            <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-hub-source">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {hubAvg.toFixed(1)} Hub ({hubCount})
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {reviews.map((review: any) => {
          const sourceInfo = REVIEW_SOURCE_LABELS[review.source] || REVIEW_SOURCE_LABELS.internal;
          const reviewDate = review.createdAt ? format(new Date(review.createdAt), "MMM d, yyyy") : "";
          return (
            <Card key={review.id} className="p-4" data-testid={`review-${review.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {(review.displayName || "A")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{review.displayName}</span>
                      <Badge className={`${sourceInfo.color} text-white text-[9px] border-0`}>{sourceInfo.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3 w-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{reviewDate}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{review.text}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const SAMPLE_MICROSITES: Record<string, MicrositeData> = {
  "queen-city-roasters": {
    business: {
      id: "sample-qcr", cityId: "clt", zoneId: "south-end", name: "Queen City Roasters",
      slug: "queen-city-roasters", phone: "(704) 555-0123", ownerEmail: "hello@queencityroasters.com",
      websiteUrl: "https://queencityroasters.com", description: "Queen City Roasters is Charlotte's premier artisanal coffee roastery, nestled in the heart of South End. We source single-origin beans from farms across Latin America, East Africa, and Southeast Asia, roasting them in small batches to bring out each bean's unique character.\n\nOur South End location features a full espresso bar, pour-over station, and a curated selection of pastries from local bakeries. We also offer coffee education classes, private tastings, and wholesale programs for local restaurants and cafes.\n\nWhether you're a casual coffee lover or a dedicated aficionado, Queen City Roasters is your neighborhood home for exceptional coffee.",
      address: "2100 South Blvd", city: "Charlotte", state: "NC", zip: "28203",
      imageUrl: "/images/seed/coffee-shop.png", listingTier: "ENHANCED", isVerified: true,
      micrositeTagline: "Roasted locally, served with love — artisanal single-origin coffee in South End",
      micrositeThemeColor: "#C45D1A",
      categoryIds: ["cat-food-drink"], galleryImages: ["/images/seed/coffee-shop.png", "/images/seed/south-end.png"] as any,
      socialLinks: { instagram: "https://instagram.com/queencityroasters", facebook: "https://facebook.com/queencityroasters" } as any,
      hoursOfOperation: { monday: "6:00 AM - 7:00 PM", tuesday: "6:00 AM - 7:00 PM", wednesday: "6:00 AM - 7:00 PM", thursday: "6:00 AM - 8:00 PM", friday: "6:00 AM - 8:00 PM", saturday: "7:00 AM - 8:00 PM", sunday: "7:00 AM - 5:00 PM" } as any,
      micrositeServices: ["Espresso Bar", "Pour-Over Station", "Coffee Education", "Wholesale Program", "Private Tastings", "Event Catering"] as any,
      presenceType: "commerce", googleRating: "4.8", googleReviewCount: 247,
      languagesSpoken: ["English", "Spanish"],
      tierConfig: { hasMicrosite: true, maxGalleryPhotos: 50, canCustomizeTheme: true, canVideoEmbed: true, canExternalReviews: true, canInternalReviews: true },
    } as any,
    externalLinks: [], contentLinks: [],
    events: [
      { id: "evt-qcr-1", title: "Latte Art Championship", slug: "latte-art-championship", startDateTime: new Date(Date.now() + 14 * 86400000).toISOString(), locationName: "Queen City Roasters - South End" },
      { id: "sample-evt-2", title: "South End Food Truck Friday", slug: "south-end-food-truck-friday", startDateTime: new Date(Date.now() + 10 * 86400000).toISOString(), locationName: "Atherton Mill & Market" },
    ],
    reviews: [
      { id: "rev-qcr-1", rating: 5, text: "Best coffee in Charlotte, hands down! The pour-over is incredible.", displayName: "Sarah M.", source: "internal", createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: "rev-qcr-2", rating: 5, text: "Incredible single-origin beans. The baristas really know their craft. A must-visit in South End.", displayName: "David L.", source: "google", createdAt: new Date(Date.now() - 12 * 86400000).toISOString() },
      { id: "rev-qcr-3", rating: 4, text: "Great coffee and lovely atmosphere. Gets busy on weekends but worth the wait.", displayName: "Jennifer K.", source: "yelp", createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
      { id: "rev-qcr-4", rating: 5, text: "My go-to coffee spot! The cold brew on tap is perfection. Staff is always friendly.", displayName: "Marcus T.", source: "google", createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
      { id: "rev-qcr-5", rating: 4, text: "Love the wholesale program. We serve their beans at our restaurant and guests rave about the coffee.", displayName: "Elena R.", source: "facebook", createdAt: new Date(Date.now() - 45 * 86400000).toISOString() },
    ],
    services: [{ id: "svc-1", presenceId: "sample-qcr", serviceName: "Specialty Coffee", isPrimary: true, parentServiceId: null, sortOrder: 0 }, { id: "svc-2", presenceId: "sample-qcr", serviceName: "Pastries & Light Bites", isPrimary: false, parentServiceId: null, sortOrder: 1 }],
    shoppingCenter: null, contentJournal: [], domain: null, coverage: [],
    articles: [
      { id: "art-qcr-1", title: "10 Hidden Gems in South End You Need to Visit This Season", slug: "10-hidden-gems-south-end", author: "Maya Chen", category: "Neighborhoods", publishedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    ],
  },
  "charlotte-arts-foundation": {
    business: {
      id: "sample-caf", cityId: "clt", zoneId: "uptown", name: "Charlotte Arts Foundation",
      slug: "charlotte-arts-foundation", phone: "(704) 555-0456", ownerEmail: "info@charlotteartsfoundation.org",
      websiteUrl: "https://charlotteartsfoundation.org", description: "The Charlotte Arts Foundation is dedicated to making art accessible to every community in the Charlotte metro. Through grants, exhibitions, workshops, and public installations, we support emerging and established artists while bringing creative experiences to neighborhoods across the city.\n\nOur programs include the annual Charlotte Arts Festival, neighborhood mural projects, youth arts scholarships, and our Artist-in-Residence program. We partner with schools, community centers, and local businesses to ensure every resident has access to the transformative power of art.",
      address: "345 N College St", city: "Charlotte", state: "NC", zip: "28202",
      imageUrl: "/images/seed/arts-foundation.jpg", listingTier: "ENHANCED", isVerified: true,
      micrositeTagline: "Making art accessible to every community in the Charlotte metro",
      micrositeThemeColor: "#5B1D8F",
      categoryIds: ["cat-arts-culture"], galleryImages: ["/images/seed/arts-foundation.jpg", "/images/seed/noda-art.png"] as any,
      socialLinks: { instagram: "https://instagram.com/cltartsfound" } as any,
      hoursOfOperation: { monday: "9:00 AM - 5:00 PM", tuesday: "9:00 AM - 5:00 PM", wednesday: "9:00 AM - 5:00 PM", thursday: "9:00 AM - 7:00 PM", friday: "9:00 AM - 5:00 PM" } as any,
      micrositeServices: [] as any, presenceType: "organization",
      missionStatement: "To make art accessible to every community in the Charlotte metro through grants, exhibitions, workshops, and public installations.",
      causeTags: ["Arts Education", "Community Development", "Youth Programs"] as any,
      donateUrl: "https://charlotteartsfoundation.org/donate",
      languagesSpoken: ["English", "Spanish"],
      tierConfig: { hasMicrosite: true, maxGalleryPhotos: 50, canCustomizeTheme: true, canVideoEmbed: true, canExternalReviews: true, canInternalReviews: true },
    } as any,
    supporters: [
      { id: "sup-1", name: "Queen City Roasters", slug: "queen-city-roasters", imageUrl: "/images/seed/coffee-shop.png", listingTier: "ENHANCED", tagline: "Artisanal coffee roastery" },
      { id: "sup-2", name: "NoDa Brewing Company", slug: "noda-brewing-company", imageUrl: "/images/seed/brewery.png", listingTier: "ENHANCED", tagline: "Award-winning craft brewery" },
      { id: "sup-3", name: "Uptown Tech Hub", slug: "uptown-tech-hub", imageUrl: "/images/seed/coworking.png", listingTier: "VERIFIED", tagline: "Coworking & innovation center" },
    ],
    externalLinks: [], contentLinks: [],
    events: [
      { id: "evt-caf-1", title: "Annual Charlotte Arts Festival", slug: "annual-charlotte-arts-festival", startDateTime: new Date(Date.now() + 30 * 86400000).toISOString(), locationName: "Romare Bearden Park" },
      { id: "evt-caf-2", title: "Youth Art Showcase", slug: "youth-art-showcase", startDateTime: new Date(Date.now() + 45 * 86400000).toISOString(), locationName: "Charlotte Arts Foundation Gallery" },
      { id: "sample-evt-2", title: "South End Food Truck Friday", slug: "south-end-food-truck-friday", startDateTime: new Date(Date.now() + 10 * 86400000).toISOString(), locationName: "Atherton Mill & Market" },
    ],
    reviews: [
      { id: "rev-caf-1", rating: 5, text: "This organization does incredible work for Charlotte's art scene. The youth programs are life-changing!", displayName: "Amanda W.", source: "internal", createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
      { id: "rev-caf-2", rating: 5, text: "The arts festival was amazing. So grateful this foundation exists to bring art to every neighborhood.", displayName: "Carlos G.", source: "google", createdAt: new Date(Date.now() - 25 * 86400000).toISOString() },
    ],
    services: [], shoppingCenter: null, contentJournal: [], domain: null, coverage: [],
    articles: [
      { id: "art-caf-1", title: "How NoDa Became Charlotte's Creative Capital", slug: "noda-charlottes-creative-capital", author: "James Porter", category: "Arts & Culture", publishedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
      { id: "art-caf-2", title: "Community Spotlight: Meet the Volunteers Behind CLT's Free Tutoring Program", slug: "community-spotlight-clt-tutoring", author: "David Kim", category: "Community", publishedAt: new Date(Date.now() - 18 * 86400000).toISOString() },
    ],
  },
  "noda-brewing-company": {
    business: {
      id: "sample-nbc", cityId: "clt", zoneId: "noda", name: "NoDa Brewing Company",
      slug: "noda-brewing-company", phone: "(704) 555-0789", ownerEmail: "info@nodabrewing.com",
      websiteUrl: "https://nodabrewing.com", description: "NoDa Brewing Company is an award-winning craft brewery in the heart of the NoDa arts district. We've been brewing bold, flavorful beers since 2012, earning recognition at the Great American Beer Festival, World Beer Cup, and beyond.\n\nOur taproom features 20+ rotating taps, a dog-friendly patio, and live music every Friday. From our flagship Hop, Drop 'n Roll IPA to seasonal small-batch releases, there's always something new to discover.",
      address: "2921 N Tryon St", city: "Charlotte", state: "NC", zip: "28206",
      imageUrl: "/images/seed/brewery.png", listingTier: "ENHANCED", isVerified: true,
      micrositeTagline: "Award-winning craft beer in the NoDa arts district",
      categoryIds: ["cat-food-drink"], galleryImages: ["/images/seed/brewery.png"] as any,
      socialLinks: { instagram: "https://instagram.com/nodabrewing" } as any,
      hoursOfOperation: { monday: "Closed", tuesday: "3:00 PM - 9:00 PM", wednesday: "3:00 PM - 9:00 PM", thursday: "3:00 PM - 10:00 PM", friday: "12:00 PM - 11:00 PM", saturday: "12:00 PM - 11:00 PM", sunday: "12:00 PM - 8:00 PM" } as any,
      micrositeServices: ["Craft Beer", "Taproom", "Live Music", "Private Events", "Brewery Tours"] as any,
      presenceType: "commerce", googleRating: "4.6", googleReviewCount: 1832,
      languagesSpoken: ["English"],
      tierConfig: { hasMicrosite: true, maxGalleryPhotos: 10, canCustomizeTheme: false, canVideoEmbed: false, canExternalReviews: true, canInternalReviews: true },
    } as any,
    externalLinks: [], contentLinks: [],
    events: [
      { id: "evt-nbc-1", title: "Friday Night Live Music", slug: "friday-night-live-music", startDateTime: new Date(Date.now() + 5 * 86400000).toISOString(), locationName: "NoDa Brewing Taproom" },
      { id: "sample-evt-1", title: "NoDa First Friday Art Walk", slug: "noda-first-friday-art-walk", startDateTime: new Date(Date.now() + 7 * 86400000).toISOString(), locationName: "NoDa Arts District" },
    ],
    reviews: [
      { id: "rev-nbc-1", rating: 5, text: "Amazing beer selection and great vibes! Hop, Drop 'n Roll is a classic.", displayName: "Mike T.", source: "internal", createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: "rev-nbc-2", rating: 4, text: "Love the dog-friendly patio. The seasonal brews are always creative.", displayName: "Rachel P.", source: "google", createdAt: new Date(Date.now() - 18 * 86400000).toISOString() },
      { id: "rev-nbc-3", rating: 5, text: "Best brewery in Charlotte, no contest. Friday night live music is the move.", displayName: "Jason D.", source: "yelp", createdAt: new Date(Date.now() - 35 * 86400000).toISOString() },
    ],
    services: [], shoppingCenter: null, contentJournal: [], domain: null, coverage: [],
    articles: [
      { id: "art-nbc-1", title: "How NoDa Became Charlotte's Creative Capital", slug: "noda-charlottes-creative-capital", author: "James Porter", category: "Arts & Culture", publishedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
    ],
  },
  "uptown-tech-hub": {
    business: {
      id: "sample-uth", cityId: "clt", zoneId: "uptown", name: "Uptown Tech Hub",
      slug: "uptown-tech-hub", phone: "(704) 555-0321", ownerEmail: "hello@uptowntechhub.com",
      websiteUrl: "https://uptowntechhub.com", description: "Uptown Tech Hub is Charlotte's premier coworking space and innovation center, located in the heart of Uptown. We offer hot desks, dedicated desks, private offices, and meeting rooms — all with gigabit fiber internet and 24/7 access.",
      address: "100 N Tryon St, Suite 500", city: "Charlotte", state: "NC", zip: "28202",
      imageUrl: "/images/seed/coworking.png", listingTier: "VERIFIED", isVerified: true,
      categoryIds: ["cat-professional-services"],
      presenceType: "commerce", priceRange: 3,
      languagesSpoken: ["English"],
      tierConfig: { hasMicrosite: false, maxGalleryPhotos: 1, canCustomizeTheme: false },
    } as any,
    externalLinks: [], contentLinks: [], events: [], reviews: [],
    services: [], shoppingCenter: null, contentJournal: [], domain: null, coverage: [],
  },
};

const BLOCK_LABEL_MAP: Record<string, { en: string; es: string }> = {
  hero: { en: "Home", es: "Inicio" },
  about: { en: "About", es: "Nosotros" },
  services: { en: "Services", es: "Servicios" },
  gallery: { en: "Gallery", es: "Galería" },
  testimonials: { en: "Testimonials", es: "Testimonios" },
  cta: { en: "Get Started", es: "Comenzar" },
  faq: { en: "FAQ", es: "Preguntas" },
  team: { en: "Team", es: "Equipo" },
  hours: { en: "Hours", es: "Horario" },
  events: { en: "Events", es: "Eventos" },
  reviews: { en: "Reviews", es: "Reseñas" },
  contact: { en: "Contact", es: "Contacto" },
};

type SiteLocale = "en" | "es";

function MicrositeNavbar({
  business,
  blocks,
  accentColor,
  templateId,
  locale,
  onLocaleChange,
}: {
  business: Business;
  blocks: MicrositeBlock[];
  accentColor: string;
  templateId: string;
  locale: SiteLocale;
  onLocaleChange: (l: SiteLocale) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const templateStyle = getTemplateStyle(templateId);
  const logoUrl = (business as any).micrositeLogo;
  const enabledBlocks = blocks.filter((b) => b.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const navBlocks = enabledBlocks.filter((b) => b.type !== "hero" && b.type !== "cta");
  const ctaBlock = enabledBlocks.find((b) => b.type === "cta" || b.type === "contact");

  const scrollTo = useCallback((id: string) => {
    const el = document.querySelector(`[data-block-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileOpen(false);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b ${templateStyle.navStyle}`}
      data-testid="microsite-navbar"
    >
      <div className="mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between gap-4 h-14">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            {logoUrl && (
              <div className="h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0" data-testid="img-nav-logo">
                <img src={logoUrl} alt={`${business.name} logo`} className="h-full w-full object-cover" />
              </div>
            )}
            <span
              className="font-semibold text-sm md:text-base truncate"
              style={{ fontFamily: templateStyle.fontHeading }}
              data-testid="text-nav-business-name"
            >
              {business.name}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 flex-wrap">
            {navBlocks.map((block) => (
              <button
                key={block.id}
                onClick={() => scrollTo(block.id)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md"
                data-testid={`nav-link-${block.type}`}
              >
                {BLOCK_LABEL_MAP[block.type]?.[locale] || block.type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onLocaleChange(locale === "en" ? "es" : "en")}
              className="px-2 py-1 text-xs font-medium border rounded-md hover:bg-muted transition-colors"
              data-testid="button-locale-toggle"
              title={locale === "en" ? "Cambiar a Español" : "Switch to English"}
            >
              {locale === "en" ? "ES" : "EN"}
            </button>
            {ctaBlock && (
              <Button
                size="sm"
                onClick={() => scrollTo(ctaBlock.id)}
                style={{ backgroundColor: accentColor, borderColor: accentColor }}
                className="hidden sm:inline-flex text-white border"
                data-testid="button-nav-cta"
              >
                {(ctaBlock.content?.ctaText as any)?.[locale] || (ctaBlock.content?.ctaText as any)?.en || (locale === "es" ? "Contáctenos" : "Contact Us")}
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t pb-3 pt-2 space-y-1" data-testid="mobile-nav-menu">
            {navBlocks.map((block) => (
              <button
                key={block.id}
                onClick={() => scrollTo(block.id)}
                className="block w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                data-testid={`mobile-nav-link-${block.type}`}
              >
                {BLOCK_LABEL_MAP[block.type]?.[locale] || block.type}
              </button>
            ))}
            {ctaBlock && (
              <button
                onClick={() => scrollTo(ctaBlock.id)}
                className="block w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors"
                style={{ color: accentColor }}
                data-testid="mobile-nav-cta"
              >
                {(ctaBlock.content?.ctaText as any)?.[locale] || (ctaBlock.content?.ctaText as any)?.en || (locale === "es" ? "Contáctenos" : "Contact Us")}
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

function MicrositeFooter({
  business,
  accentColor,
  citySlug,
}: {
  business: Business;
  accentColor: string;
  citySlug: string;
}) {
  const socialLinks: Record<string, string> = (business as any).socialLinks || {};
  const fullAddress = [business.address, (business as any).city, (business as any).state, business.zip].filter(Boolean).join(", ");

  return (
    <footer
      className="border-t bg-muted/30 dark:bg-muted/10"
      data-testid="microsite-footer"
    >
      <div className="mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <h3 className="font-semibold text-lg" data-testid="footer-business-name">{business.name}</h3>
            {business.micrositeTagline && (
              <p className="text-sm text-muted-foreground">{business.micrositeTagline}</p>
            )}
          </div>

          <div className="space-y-2">
            {fullAddress && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{fullAddress}</span>
              </div>
            )}
            {business.phone && (
              <a href={`tel:${business.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="footer-phone">
                <Phone className="h-4 w-4 shrink-0" /> {business.phone}
              </a>
            )}
            {business.ownerEmail && (
              <a href={`mailto:${business.ownerEmail}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="footer-email">
                <Mail className="h-4 w-4 shrink-0" /> {business.ownerEmail}
              </a>
            )}
            {business.websiteUrl && (
              <a href={business.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="footer-website">
                <Globe className="h-4 w-4 shrink-0" /> Website
              </a>
            )}
          </div>

          <div className="space-y-2">
            {Object.entries(socialLinks).map(([key, url]) => (
              url ? (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground capitalize"
                  data-testid={`footer-social-${key}`}
                >
                  {key === "instagram" ? <Instagram className="h-4 w-4" /> :
                   key === "facebook" ? <Facebook className="h-4 w-4" /> :
                   <Globe className="h-4 w-4" />}
                  {key}
                </a>
              ) : null
            ))}
          </div>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-muted-foreground" data-testid="footer-powered-by">
            Powered by{" "}
            <Link href={`/${citySlug}`}>
              <span className="hover:text-foreground cursor-pointer font-medium">CityMetro Hub</span>
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {business.name}
          </p>
        </div>
      </div>
    </footer>
  );
}

function MicrositeCredentialsSection({
  business,
  accentColor,
  templateId,
  profileBadges,
}: {
  business: Business & { tierConfig: any };
  accentColor: string;
  templateId: string;
  profileBadges: string[];
}) {
  const templateStyle = getTemplateStyle(templateId);
  const biz = business as any;
  const licensesAndCerts: string[] = biz.licensesAndCerts || [];
  const awardsAndHonors: string[] = biz.awardsAndHonors || [];
  const googleRating = business.googleRating ? parseFloat(business.googleRating) : 0;
  const googleReviewCount = business.googleReviewCount || 0;

  const hasBadges = profileBadges.length > 0;
  const hasCredentials = licensesAndCerts.length > 0 || awardsAndHonors.length > 0;
  const hasRating = googleRating > 0 && googleReviewCount > 0;
  const hasVerified = business.isVerified;

  if (!hasBadges && !hasCredentials && !hasRating && !hasVerified) return null;

  const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    LOCAL_EXPERT: Medal,
    CREATOR: Sparkles,
    SPEAKER: Mic,
    EVENT_HOST: CalendarCheck,
    COMMUNITY_LEADER: Users,
    NONPROFIT: HeartHandshake,
    PRESS_SOURCE: Newspaper,
  };

  const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
    LOCAL_EXPERT: { label: "Local Expert", color: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300" },
    CREATOR: { label: "Creator", color: "bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300" },
    SPEAKER: { label: "Speaker", color: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300" },
    EVENT_HOST: { label: "Event Organizer", color: "bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-900/20 dark:border-cyan-700 dark:text-cyan-300" },
    COMMUNITY_LEADER: { label: "Community Leader", color: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300" },
    NONPROFIT: { label: "Nonprofit", color: "bg-pink-50 border-pink-200 text-pink-800 dark:bg-pink-900/20 dark:border-pink-700 dark:text-pink-300" },
    PRESS_SOURCE: { label: "Press Source", color: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300" },
  };

  const headingClass = `${templateStyle.headingWeight} ${templateStyle.headingCase === "uppercase" ? "uppercase" : ""}`;

  return (
    <section className={`${templateStyle.sectionSpacing} px-6 md:px-8 bg-muted/30`} data-testid="section-credentials">
      <div className="max-w-5xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: templateStyle.fontHeading, color: accentColor }}
          data-testid="text-credentials-headline"
        >
          Credentials & Recognition
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hasVerified && (
            <div className="rounded-lg border bg-card p-6 space-y-3" data-testid="card-credential-verified">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
                  <CheckCircle className="h-5 w-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <p className="font-semibold text-sm">Verified Business</p>
                  <p className="text-xs text-muted-foreground">Identity confirmed</p>
                </div>
              </div>
            </div>
          )}

          {hasRating && (
            <div className="rounded-lg border bg-card p-6 space-y-3" data-testid="card-credential-rating">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-amber-50 dark:bg-amber-900/20">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{googleRating.toFixed(1)} Google Rating</p>
                  <p className="text-xs text-muted-foreground">{googleReviewCount.toLocaleString()} reviews</p>
                </div>
              </div>
            </div>
          )}

          {profileBadges.map((badgeType) => {
            const cfg = BADGE_CONFIG[badgeType];
            const BadgeIcon = BADGE_ICONS[badgeType];
            if (!cfg || !BadgeIcon) return null;
            return (
              <div key={badgeType} className={`rounded-lg border p-6 space-y-3 ${cfg.color}`} data-testid={`card-credential-badge-${badgeType.toLowerCase()}`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-white/10">
                    <BadgeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{cfg.label}</p>
                    <p className="text-xs opacity-70">Profile Badge</p>
                  </div>
                </div>
              </div>
            );
          })}

          {licensesAndCerts.map((cert) => (
            <div key={cert} className="rounded-lg border bg-card p-6" data-testid={`card-credential-cert-${cert.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-green-50 dark:bg-green-900/20">
                  <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{cert}</p>
                  <p className="text-xs text-muted-foreground">License / Certification</p>
                </div>
              </div>
            </div>
          ))}

          {awardsAndHonors.map((award) => (
            <div key={award} className="rounded-lg border bg-card p-6" data-testid={`card-credential-award-${award.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-amber-50 dark:bg-amber-900/20">
                  <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{award}</p>
                  <p className="text-xs text-muted-foreground">Award / Honor</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MicrositeStandaloneFaqSection({
  businessFaqs,
  businessName,
  accentColor,
  templateId,
}: {
  businessFaqs: { id: string; question: string; answer: string; sortOrder: number }[];
  businessName: string;
  accentColor: string;
  templateId: string;
}) {
  const templateStyle = getTemplateStyle(templateId);
  const validFaqs = businessFaqs.filter((faq) => faq.question?.trim() && faq.answer?.trim());
  if (validFaqs.length === 0) return null;

  const headingClass = `${templateStyle.headingWeight} ${templateStyle.headingCase === "uppercase" ? "uppercase" : ""}`;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question.trim(),
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer.trim(),
      },
    })),
  };

  return (
    <section className={`${templateStyle.sectionSpacing} px-6 md:px-8`} data-testid="section-standalone-faq">
      <div className="max-w-3xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: templateStyle.fontHeading, color: accentColor }}
          data-testid="text-standalone-faq-headline"
        >
          Common Questions About {businessName}
        </h2>
        <div className="space-y-0 divide-y">
          {validFaqs.map((faq, i) => (
            <FaqAccordionItem key={faq.id} question={faq.question.trim()} answer={faq.answer.trim()} index={i} templateStyle={templateStyle} />
          ))}
        </div>
      </div>
      <JsonLd data={faqJsonLd} />
    </section>
  );
}

function FaqAccordionItem({ question, answer, index, templateStyle }: { question: string; answer: string; index: number; templateStyle: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={`standalone-faq-item-${index}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-left font-medium hover:text-primary transition-colors"
        style={{ fontFamily: templateStyle.fontHeading }}
        data-testid={`button-standalone-faq-${index}`}
      >
        <span className="text-base">{question}</span>
        {open ? <ChevronUp className="h-5 w-5 shrink-0 ml-3 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 shrink-0 ml-3 text-muted-foreground" />}
      </button>
      {open && (
        <p className="text-muted-foreground leading-relaxed pb-5 pr-8" style={{ fontFamily: templateStyle.fontBody }}>
          {answer}
        </p>
      )}
    </div>
  );
}

function MicrositeFullPage({
  business,
  blocks,
  templateId,
  accentColor,
  citySlug,
  resolvedData,
}: {
  business: Business & { tierConfig: any };
  blocks: MicrositeBlock[];
  templateId: string;
  accentColor: string;
  citySlug: string;
  resolvedData: MicrositeData;
}) {
  const [locale, setLocale] = useState<SiteLocale>("en");
  const galleryImages: string[] = (business as any).galleryImages || [];
  const hoursOfOperation: Record<string, string> = (business as any).hoursOfOperation || {};
  const coverImage = business.imageUrl || galleryImages[0] || null;
  const events = resolvedData?.events || [];
  const reviews = resolvedData?.reviews || [];
  const templateVars = getTemplateVars(templateId, accentColor);
  const profileBadges = resolvedData?.profileBadges || [];
  const businessFaqs = resolvedData?.businessFaqs || [];
  const hasFaqBlock = blocks.some((b) => b.type === "faq" && b.enabled);

  return (
    <div
      className="-mx-4 md:-mx-6 lg:-mx-8 -mt-4 min-h-screen flex flex-col"
      style={templateVars as any}
      data-testid="microsite-fullpage"
    >
      <MicrositeNavbar
        business={business}
        blocks={blocks}
        accentColor={accentColor}
        templateId={templateId}
        locale={locale}
        onLocaleChange={setLocale}
      />

      <main className="flex-1">
        <BlockRenderer
          blocks={blocks}
          template={templateId}
          accentColor={accentColor}
          locale={locale}
          context={{
            businessName: business.name,
            coverImage,
            galleryImages,
            hoursOfOperation,
            address: business.address || null,
            phone: business.phone || null,
            email: business.ownerEmail || null,
            website: business.websiteUrl || null,
            events: events.map((e: any) => ({
              id: e.id,
              title: e.title,
              slug: e.slug,
              startDateTime: e.startDateTime,
              locationName: e.locationName,
            })),
            reviews: reviews.map((r: any) => ({
              id: r.id,
              rating: r.rating,
              text: r.text,
              displayName: r.displayName,
              source: r.source,
              createdAt: r.createdAt,
            })),
            googleRating: business.googleRating || undefined,
            googleReviewCount: business.googleReviewCount || undefined,
            citySlug,
            businessSlug: business.slug,
            businessId: business.id,
            menuUrl: (business as any).menuUrl || null,
            orderingLinks: (business as any).orderingLinks || null,
            reservationUrl: business.reservationUrl || null,
            latitude: business.latitude ? Number(business.latitude) : null,
            longitude: business.longitude ? Number(business.longitude) : null,
            volunteerOpportunities: resolvedData?.volunteerOpportunities || [],
            wishlistItems: resolvedData?.wishlistItems || [],
            businessFaqs,
          }}
        />

        <MicrositeCredentialsSection
          business={business}
          accentColor={accentColor}
          templateId={templateId}
          profileBadges={profileBadges}
        />

        {!hasFaqBlock && businessFaqs.length > 0 && (
          <MicrositeStandaloneFaqSection
            businessFaqs={businessFaqs}
            businessName={business.name}
            accentColor={accentColor}
            templateId={templateId}
          />
        )}
      </main>

      <MicrositeFooter
        business={business}
        accentColor={accentColor}
        citySlug={citySlug}
      />
    </div>
  );
}

export default function Microsite({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const sampleSlug = SAMPLE_MICROSITES[slug] ? slug : null;
  const smartBack = useSmartBack(sampleSlug ? `/${citySlug}/coming-soon` : `/${citySlug}/directory`);
  const { data: categories } = useCategories();
  const { user: authUser, isLoggedIn } = useAuth();

  const sampleData = SAMPLE_MICROSITES[slug];

  const { data: microsite, isLoading } = useQuery<MicrositeData>({
    queryKey: ["/api/cities", citySlug, "presence", slug, "microsite"],
    enabled: !sampleData,
  });

  const resolvedData = sampleData || microsite;
  const business = resolvedData?.business;
  const tierConfig = business?.tierConfig || {};
  const rawTier = business?.effectiveTier || business?.listingTier || "VERIFIED";
  const isEnhanced = rawTier === "ENHANCED" || rawTier === "CHARTER";
  const isVerified = rawTier === "VERIFIED";
  const isOrganization = (business as any)?.presenceType === "organization";

  const micrositeBlocks: MicrositeBlock[] | undefined = business?.micrositeBlocks as MicrositeBlock[] | undefined;
  const hasBlocks = micrositeBlocks && micrositeBlocks.length > 0 && micrositeBlocks.some((b) => b.enabled);
  const templateId = (business as any)?.micrositeTemplate || "modern";

  const { data: underwriters } = useQuery<{ businessName: string; businessSlug: string }[]>({
    queryKey: ["/api/cities", citySlug, "presence", slug, "underwriters"],
    enabled: isOrganization && !sampleData,
  });

  const { data: supportedOrgs } = useQuery<{ orgName: string; orgSlug: string }[]>({
    queryKey: ["/api/cities", citySlug, "presence", slug, "supporting"],
    enabled: !isOrganization && !!business && !sampleData,
  });

  const { data: editorialMentions } = useQuery<{ id: string; title: string; slug: string; excerpt: string | null; publishedAt: string | null }[]>({
    queryKey: ["/api/cities", citySlug, "business", slug, "editorial-mentions"],
    enabled: !!business && !sampleData,
  });

  const moduleAccess = resolvedData?.moduleAccess;
  const viewerIsAdmin = resolvedData?.isAdmin ?? false;
  const effectiveTier = business?.effectiveTier || business?.listingTier || "VERIFIED";
  const tierKey = effectiveTier;
  const isEffectivelyEnhanced = tierKey === "ENHANCED" || tierKey === "CHARTER" || viewerIsAdmin;
  const canShowFaq = (moduleAccess ? moduleAccess.faq : isEffectivelyEnhanced) || isEffectivelyEnhanced;
  const canShowQa = (moduleAccess ? moduleAccess.expert_qa : isEffectivelyEnhanced) || isEffectivelyEnhanced;
  const canShowGallery = (moduleAccess ? moduleAccess.gallery : isEffectivelyEnhanced) || isEffectivelyEnhanced;
  const canShowEvents = (moduleAccess ? moduleAccess.events : isEffectivelyEnhanced) || isEffectivelyEnhanced;
  const canShowVideoEmbed = (moduleAccess ? moduleAccess.video_embed : isEffectivelyEnhanced) || isEffectivelyEnhanced;
  const canShowReviews = (moduleAccess ? (moduleAccess.external_reviews || moduleAccess.internal_reviews) : isEffectivelyEnhanced) || isEffectivelyEnhanced;

  const { data: faqs } = useQuery<{ id: string; question: string; answer: string; sortOrder: number }[]>({
    queryKey: ["/api/cities", citySlug, "presence", slug, "faqs"],
    enabled: canShowFaq && !sampleData,
  });

  const { data: expertQa } = useQuery<{ id: string; question: string; answer: string | null; askedByName: string | null; sortOrder: number }[]>({
    queryKey: ["/api/cities", citySlug, "presence", slug, "qa"],
    enabled: canShowQa && !sampleData,
  });

  const { data: zones } = useCityZones(citySlug);
  const zone = zones?.find((z) => z.id === business?.zoneId || z.slug === business?.zoneId);
  const zoneName = zone?.name || "";
  const zoneSlug = zone?.slug || "";

  const baseDescription = business?.micrositeTagline || business?.description?.slice(0, 160) || "Local business presence on CLT Metro Hub.";

  usePageMeta({
    title: business
      ? `${business.name}${zoneName ? ` — ${zoneName}` : ""} | CLT Metro Hub`
      : "Presence | CLT Metro Hub",
    description: zoneName ? `${baseDescription} in ${zoneName}` : baseDescription,
    canonical: `${window.location.origin}/${citySlug}/presence/${slug}`,
    ogImage: `${window.location.origin}/api/og-image/business/${slug}`,
  });

  if (isLoading && !sampleData) {
    return (
      <div className="space-y-4">
        <Skeleton className="aspect-[3/1] w-full rounded-md" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!business) {
    return (
      <Card className="p-12 text-center">
        <h3 className="font-semibold text-lg mb-1" data-testid="text-not-found">Presence not found</h3>
        <Link href={`/${citySlug}/directory`}>
          <Button variant="ghost" className="mt-2" data-testid="link-back-directory">Back to Directory</Button>
        </Link>
      </Card>
    );
  }

  const isMicrositeEligible = (moduleAccess ? moduleAccess.microsite : isEffectivelyEnhanced) || isEffectivelyEnhanced;

  if (hasBlocks && resolvedData && !isMicrositeEligible && !sampleData) {
    return (
      <div className="space-y-4">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3" aria-label="Breadcrumb" data-testid="nav-breadcrumb-upgrade">
          <Link href={`/${citySlug}`}><span className="hover:text-primary cursor-pointer">Home</span></Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/${citySlug}/directory`}><span className="hover:text-primary cursor-pointer">Directory</span></Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium truncate">{business.name}</span>
        </nav>
        <Card className="p-8 text-center space-y-4" data-testid="microsite-upgrade-cta">
          <Crown className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold" data-testid="text-upgrade-title">Upgrade to Unlock Full Microsite</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {business.name} has a microsite ready to go live. Upgrade to Enhanced ($99/yr) to make it publicly visible.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href={`/${citySlug}/presence/${slug}/pricing`}>
              <Button className="gap-2" data-testid="button-view-pricing">
                <Crown className="h-4 w-4" /> View Pricing Plans
              </Button>
            </Link>
            <Link href={`/${citySlug}/directory`}>
              <Button variant="outline" data-testid="button-back-directory">Back to Directory</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (hasBlocks && resolvedData && (isMicrositeEligible || sampleData)) {
    const draftMeta = (business as any).micrositeDraftMeta as Record<string, any> | null;
    const crawledBrandColor = draftMeta?.brandColors?.[0] || null;
    const accentColor = business.micrositeThemeColor || crawledBrandColor || "#5B1D8F";
    return (
      <MicrositeFullPage
        business={business}
        blocks={micrositeBlocks!}
        templateId={templateId}
        accentColor={accentColor}
        citySlug={citySlug}
        resolvedData={resolvedData}
      />
    );
  }

  const matchedCategories = categories?.filter((c) => business.categoryIds.includes(c.id)) || [];
  const catNames = matchedCategories.map((c) => c.name);
  const galleryImages: string[] = (business as any).galleryImages || [];
  const socialLinks: Record<string, string> = (business as any).socialLinks || {};
  const hoursOfOperation: Record<string, string> = (business as any).hoursOfOperation || {};
  const micrositeServices: string[] = (business as any).micrositeServices || [];
  const coverImage = business.imageUrl || galleryImages[0] || null;
  const draftMetaFallback = (business as any).micrositeDraftMeta as Record<string, any> | null;
  const crawledBrandFallback = draftMetaFallback?.brandColors?.[0] || null;
  const accentColor = isEnhanced && (business.micrositeThemeColor || crawledBrandFallback) ? (business.micrositeThemeColor || crawledBrandFallback) : "#5B1D8F";
  const events = resolvedData?.events || [];
  const contentLinks = resolvedData?.contentLinks || [];
  const externalLinks = resolvedData?.externalLinks || [];
  const presenceServices = resolvedData?.services || [];
  const sampleArticles = resolvedData?.articles || [];
  const contentJournal = resolvedData?.contentJournal || [];
  const shoppingCenter = resolvedData?.shoppingCenter || null;
  const languagesSpoken: string[] = (business as any).languagesSpoken || [];
  const microTags = resolvedData?.microTags || [];
  const sampleReviews = sampleData?.reviews || [];
  const sampleSupportersRaw = sampleData?.supporters || [];
  const sampleSupporters = useMemo(() => {
    const arr = [...sampleSupportersRaw];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [sampleSupportersRaw]);

  return (
    <div className="space-y-0">
      {sampleData && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2" data-testid="disclaimer-sample-microsite">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">PREVIEW ONLY</span> — This is a fictional sample showing how a {isEnhanced ? "Enhanced" : isVerified ? "Verified" : "Free"} {isOrganization ? "organization" : "commerce"} presence appears on CLT Metro Hub. This is not a real {isOrganization ? "organization" : "commerce"}.
          </p>
        </div>
      )}
      {sampleData ? (
        <Button variant="ghost" size="sm" className="gap-1 mb-3" onClick={smartBack} data-testid="link-back-directory">
          <ArrowLeft className="h-4 w-4" /> Back to Coming Soon
        </Button>
      ) : (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3" aria-label="Breadcrumb" data-testid="nav-breadcrumb">
          <Link href={`/${citySlug}`}><span className="hover:text-primary cursor-pointer">Home</span></Link>
          <ChevronRight className="h-3 w-3" />
          {zoneName && (<><Link href={`/${citySlug}/directory?zone=${zoneSlug}`}><span className="hover:text-primary cursor-pointer">{zoneName}</span></Link><ChevronRight className="h-3 w-3" /></>)}
          {catNames[0] && (<><span className="hover:text-primary cursor-pointer">{catNames[0]}</span><ChevronRight className="h-3 w-3" /></>)}
          <span className="text-foreground font-medium truncate">{business.name}</span>
        </nav>
      )}

      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${window.location.origin}/${citySlug}` },
          ...(zoneName ? [{ "@type": "ListItem", "position": 2, "name": zoneName, "item": `${window.location.origin}/${citySlug}/directory?zone=${zoneSlug}` }] : []),
          ...(catNames[0] ? [{ "@type": "ListItem", "position": zoneName ? 3 : 2, "name": catNames[0] }] : []),
          { "@type": "ListItem", "position": (zoneName ? 3 : 2) + (catNames[0] ? 1 : 0), "name": business.name, "item": `${window.location.origin}/${citySlug}/presence/${slug}` },
        ],
      }} />

      {(() => {
        const serviceNames = [
          ...microTags.map(t => t.name),
          ...micrositeServices,
          ...presenceServices.map(s => s.serviceName),
        ];
        const gRating = business.googleRating ? parseFloat(business.googleRating) : 0;
        const gCount = business.googleReviewCount || 0;
        const hubAvg = sampleReviews.length > 0 ? sampleReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / sampleReviews.length : 0;
        const hubCount = sampleReviews.length;
        const totalReviewCount = gCount + hubCount;
        const combinedRatingAvg = totalReviewCount > 0 ? (gRating * gCount + hubAvg * hubCount) / totalReviewCount : 0;

        const bizJsonLd: any = {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": business.name,
          "url": `${window.location.origin}/${citySlug}/presence/${slug}`,
        };
        if (totalReviewCount > 0) {
          bizJsonLd.aggregateRating = {
            "@type": "AggregateRating",
            "ratingValue": Number(combinedRatingAvg.toFixed(1)),
            "reviewCount": totalReviewCount,
          };
        }
        if (serviceNames.length > 0) {
          bizJsonLd.hasOfferCatalog = {
            "@type": "OfferCatalog",
            "name": `${business.name} Services`,
            "itemListElement": serviceNames.map(name => ({
              "@type": "OfferCatalog",
              "name": name,
              "itemListElement": [{
                "@type": "Offer",
                "itemOffered": {
                  "@type": "Service",
                  "name": name,
                },
              }],
            })),
          };
        }
        if (!bizJsonLd.hasOfferCatalog && !bizJsonLd.aggregateRating) return null;
        return <JsonLd data={bizJsonLd} />;
      })()}

      <HeroHeader
        business={business}
        coverImage={coverImage}
        catNames={catNames}
        catSlugs={matchedCategories.map((c) => c.slug)}
        accentColor={accentColor}
        citySlug={citySlug}
        isEnhanced={isEnhanced}
      />

      {isVerified ? (
        <FreeOverview
          business={business}
          catNames={catNames}
          socialLinks={socialLinks}
          hoursOfOperation={hoursOfOperation}
          micrositeServices={micrositeServices}
          citySlug={citySlug}
          shoppingCenter={shoppingCenter}
        />
      ) : isEnhanced ? (
        <EnhancedLayout
          business={business}
          accentColor={accentColor}
          socialLinks={socialLinks}
          hoursOfOperation={hoursOfOperation}
          micrositeServices={micrositeServices}
          presenceServices={presenceServices}
          shoppingCenter={shoppingCenter}
          citySlug={citySlug}
          isOrganization={isOrganization}
          sampleSupporters={sampleSupporters}
          faqs={faqs || []}
          expertQa={expertQa || []}
          canShowFaq={canShowFaq}
          canShowQa={canShowQa}
          canShowGallery={canShowGallery}
          canShowEvents={canShowEvents}
          canShowReviews={canShowReviews}
          galleryImages={galleryImages}
          tierConfig={tierConfig}
          events={events}
          sampleData={sampleData}
          sampleReviews={sampleReviews}
          contentLinks={contentLinks}
          contentJournal={contentJournal}
          sampleArticles={sampleArticles}
          externalLinks={externalLinks}
          isLoggedIn={isLoggedIn}
          languagesSpoken={languagesSpoken}
          underwriters={underwriters}
          supportedOrgs={supportedOrgs}
          microTags={microTags}
          editorialMentions={editorialMentions}
        />
      ) : (
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap" data-testid="tabs-microsite">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            {canShowGallery && <TabsTrigger value="gallery" data-testid="tab-gallery">Gallery</TabsTrigger>}
            {canShowEvents && <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>}
            {canShowReviews && <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>}
            <TabsTrigger value="hub" data-testid="tab-hub">In the Hub</TabsTrigger>
            <TabsTrigger value="news" data-testid="tab-news">Other News</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {isOrganization && sampleSupporters.length > 0 && (
              <div className="mb-6" data-testid="section-supporters">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <h2 className="font-semibold">Commerce Supporters</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {sampleSupporters.map((s: SupporterItem) => (
                    <Link key={s.id} href={`/${citySlug}/presence/${s.slug}`}>
                      <Card className="p-3 flex items-center gap-3 cursor-pointer hover-elevate" data-testid={`supporter-${s.id}`}>
                        <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
                          ) : (
                            <Store className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.tagline}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[9px]">{s.listingTier}</Badge>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <OverviewTab
              business={business}
              socialLinks={socialLinks}
              hoursOfOperation={hoursOfOperation}
              micrositeServices={micrositeServices}
              presenceServices={presenceServices}
              shoppingCenter={shoppingCenter}
              citySlug={citySlug}
            />

            {microTags.length > 0 && (
              <Card className="p-5 mt-4" data-testid="section-enhanced-micro-tags">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Services & Specialties
                </h2>
                <div className="flex flex-wrap gap-2">
                  {microTags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" data-testid={`badge-micro-tag-${tag.id}`}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            <TrustAndCommerceSections
              business={business}
              faqs={faqs || []}
              expertQa={expertQa || []}
              canShowFaq={canShowFaq}
              canShowQa={canShowQa}
            />

            {isOrganization && (
              <div className="mt-6 space-y-4" data-testid="section-org-details">
                {(business as any).missionStatement && (
                  <Card className="p-5" data-testid="card-mission">
                    <h2 className="font-semibold mb-2">Mission</h2>
                    <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-mission-statement">
                      {(business as any).missionStatement}
                    </p>
                  </Card>
                )}

                {(business as any).donateUrl && (
                  <a
                    href={(business as any).donateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-donate"
                  >
                    <Button className="gap-2">
                      <Heart className="h-4 w-4" /> Donate
                    </Button>
                  </a>
                )}

                {(business as any).causeTags?.length > 0 && (
                  <Card className="p-5" data-testid="card-cause-tags">
                    <h2 className="font-semibold mb-3">Causes</h2>
                    <div className="flex flex-wrap gap-2">
                      {(business as any).causeTags.map((tag: string) => (
                        <Badge key={tag} variant="outline" data-testid={`badge-cause-${tag}`}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {canShowGallery && (
            <TabsContent value="gallery">
              <GalleryTab
                galleryImages={galleryImages}
                businessName={business.name}
                tierConfig={tierConfig}
              />
            </TabsContent>
          )}

          {canShowEvents && (
            <TabsContent value="events">
              <EventsTab events={events} citySlug={citySlug} businessName={business.name} />
            </TabsContent>
          )}

          {canShowReviews && (
            <TabsContent value="reviews">
              {sampleData && sampleReviews.length > 0 ? (
                <SampleReviewsDisplay reviews={sampleReviews} businessName={business.name} googleRating={business.googleRating || undefined} googleReviewCount={business.googleReviewCount || undefined} />
              ) : (
                <ReviewSection
                  citySlug={citySlug}
                  businessSlug={business.slug}
                  businessId={business.id}
                  businessName={business.name}
                  listingTier={business.listingTier}
                  googleRating={business.googleRating || undefined}
                  googleReviewCount={business.googleReviewCount || undefined}
                />
              )}
            </TabsContent>
          )}

          <TabsContent value="hub">
            <HubTab contentLinks={contentLinks} contentJournal={contentJournal} businessName={business.name} articles={sampleArticles} citySlug={citySlug} editorialMentions={editorialMentions} />
          </TabsContent>

          <TabsContent value="news">
            <NewsTab externalLinks={externalLinks} isLoggedIn={isLoggedIn} citySlug={citySlug} />
          </TabsContent>
        </Tabs>
      )}

      {!isEnhanced && languagesSpoken.length > 0 && (
        <Card className="p-5 mt-6" data-testid="section-languages">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Languages Spoken</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {languagesSpoken.map((lang: string) => (
              <Badge key={lang} variant="secondary" data-testid={`badge-language-${lang}`}>
                {lang}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {!isEnhanced && isOrganization && underwriters && underwriters.length > 0 && (
        <Card className="p-5 mt-6" data-testid="section-underwriters">
          <h2 className="font-semibold mb-3">Supported in the Hub by</h2>
          <div className="flex flex-wrap gap-2">
            {underwriters.map((uw) => (
              <Link key={uw.businessSlug} href={`/${citySlug}/presence/${uw.businessSlug}`}>
                <Badge variant="outline" className="cursor-pointer" data-testid={`link-underwriter-${uw.businessSlug}`}>
                  {uw.businessName}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {!isEnhanced && !isOrganization && supportedOrgs && supportedOrgs.length > 0 && (
        <Card className="p-5 mt-6" data-testid="section-supported-orgs">
          <h2 className="font-semibold mb-3">Support in the Hub</h2>
          <div className="flex flex-wrap gap-2">
            {supportedOrgs.map((org) => (
              <Link key={org.orgSlug} href={`/${citySlug}/presence/${org.orgSlug}`}>
                <Badge variant="outline" className="cursor-pointer" data-testid={`link-supported-org-${org.orgSlug}`}>
                  {org.orgName}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

interface EnhancedSectionDef {
  id: string;
  label: string;
  icon: typeof Info;
  hasContent: boolean;
}

function EnhancedStickyNav({
  sections,
  activeSection,
  accentColor,
}: {
  sections: EnhancedSectionDef[];
  activeSection: string;
  accentColor: string;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const visible = sections.filter((s) => s.hasContent);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div
      ref={navRef}
      className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b h-12 flex items-center overflow-x-auto scrollbar-hide"
      data-testid="nav-enhanced-sticky"
    >
      <div className="mx-auto px-4 flex items-center gap-1 w-full">
        {visible.map((s) => {
          const isActive = activeSection === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              style={isActive ? { backgroundColor: accentColor } : undefined}
              data-testid={`nav-pill-${s.id}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EnhancedSectionWrapper({
  id,
  index,
  accentColor,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  index: number;
  accentColor: string;
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  const isEven = index % 2 === 1;
  return (
    <section
      id={id}
      className={`py-10 md:py-14 ${isEven ? "bg-muted/40 dark:bg-muted/20" : "bg-background"}`}
      data-testid={`enhanced-section-${id}`}
    >
      <div className="mx-auto px-4">
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="h-8 w-1 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function EnhancedLayout({
  business,
  accentColor,
  socialLinks,
  hoursOfOperation,
  micrositeServices,
  presenceServices,
  shoppingCenter,
  citySlug,
  isOrganization,
  sampleSupporters,
  faqs,
  expertQa,
  canShowFaq,
  canShowQa,
  canShowGallery = true,
  canShowEvents = true,
  canShowReviews = true,
  galleryImages,
  tierConfig,
  events,
  sampleData,
  sampleReviews,
  contentLinks,
  contentJournal,
  sampleArticles,
  externalLinks,
  isLoggedIn,
  languagesSpoken,
  underwriters,
  supportedOrgs,
  microTags,
  editorialMentions,
}: {
  business: Business & { tierConfig: any };
  accentColor: string;
  socialLinks: Record<string, string>;
  hoursOfOperation: Record<string, string>;
  micrositeServices: string[];
  presenceServices: PresenceServiceItem[];
  shoppingCenter: ShoppingCenterItem | null;
  citySlug: string;
  isOrganization: boolean;
  sampleSupporters: SupporterItem[];
  faqs: { id: string; question: string; answer: string; sortOrder: number }[];
  expertQa: { id: string; question: string; answer: string | null; askedByName: string | null; sortOrder: number }[];
  canShowFaq: boolean;
  canShowQa: boolean;
  canShowGallery?: boolean;
  canShowEvents?: boolean;
  canShowReviews?: boolean;
  galleryImages: string[];
  tierConfig: any;
  events: any[];
  sampleData: any;
  sampleReviews: any[];
  contentLinks: any[];
  contentJournal: ContentJournalItem[];
  sampleArticles: any[];
  externalLinks: any[];
  isLoggedIn: boolean;
  languagesSpoken: string[];
  underwriters?: { businessName: string; businessSlug: string }[];
  supportedOrgs?: { orgName: string; orgSlug: string }[];
  microTags?: MicroTagItem[];
  editorialMentions?: { id: string; title: string; slug: string; excerpt: string | null; publishedAt: string | null }[];
}) {
  const [activeSection, setActiveSection] = useState("section-about");
  const customFont = (business as any).micrositeFont;

  useEffect(() => {
    if (customFont) {
      const family = customFont.replace(/\s+/g, "+");
      const linkId = "enhanced-font-link";
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;600;700&display=swap`;
        document.head.appendChild(link);
      }
    }
    return () => {
      const existing = document.getElementById("enhanced-font-link");
      if (existing) existing.remove();
    };
  }, [customFont]);

  const biz = business as any;
  const licensesAndCerts: string[] = biz.licensesAndCerts || [];
  const awardsAndHonors: string[] = biz.awardsAndHonors || [];
  const hasTrustSignals = licensesAndCerts.length > 0 || awardsAndHonors.length > 0;
  const hasFaqContent = (canShowFaq && faqs.length > 0) || (canShowQa && expertQa.length > 0) || hasTrustSignals;
  const hasHubContent = contentLinks.length > 0 || contentJournal.length > 0 || sampleArticles.length > 0 || (editorialMentions && editorialMentions.length > 0);
  const hasNewsContent = externalLinks.length > 0;
  const fullAddress = [business.address, business.city, business.state, business.zip].filter(Boolean).join(", ");
  const primaryService = presenceServices.find((s) => s.isPrimary);
  const subServices = presenceServices.filter((s) => !s.isPrimary);
  const resolvedMicroTags = microTags || [];
  const hasServices = micrositeServices.length > 0 || presenceServices.length > 0 || resolvedMicroTags.length > 0;

  const sectionKey = `${hasServices}-${hasFaqContent}-${canShowGallery && galleryImages.length > 0}-${canShowEvents && events.length > 0}-${canShowReviews}-${hasHubContent || hasNewsContent}-${resolvedMicroTags.length}`;

  const sections: EnhancedSectionDef[] = useMemo(() => [
    { id: "section-about", label: "About", icon: Info, hasContent: true },
    { id: "section-services", label: "Services", icon: List, hasContent: hasServices },
    { id: "section-trust", label: "Trust & FAQ", icon: ShieldCheck, hasContent: hasFaqContent },
    { id: "section-gallery", label: "Gallery", icon: Image, hasContent: canShowGallery && galleryImages.length > 0 },
    { id: "section-events", label: "Events", icon: Calendar, hasContent: canShowEvents && events.length > 0 },
    { id: "section-reviews", label: "Reviews", icon: Star, hasContent: canShowReviews },
    { id: "section-hub", label: "In the Hub", icon: Newspaper, hasContent: hasHubContent || hasNewsContent },
  ], [sectionKey]);

  useEffect(() => {
    const observerOptions: IntersectionObserverInit = {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      }
    }, observerOptions);

    const visibleIds = sections.filter((s) => s.hasContent).map((s) => s.id);
    const timer = setTimeout(() => {
      const elements = visibleIds.map((id) => document.getElementById(id)).filter(Boolean);
      elements.forEach((el) => observer.observe(el!));
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [sections]);

  const fontStyle = customFont ? { fontFamily: `'${customFont}', sans-serif` } : undefined;
  let sectionIndex = 0;

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      <div className="h-px w-full" style={{ backgroundColor: accentColor }} />

      <EnhancedStickyNav
        sections={sections}
        activeSection={activeSection}
        accentColor={accentColor}
      />

      <EnhancedSectionWrapper
        id="section-about"
        index={sectionIndex++}
        accentColor={accentColor}
        icon={Info}
        title="About"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" style={fontStyle}>
          <div className="lg:col-span-2 space-y-4">
            {business.description && (
              <div data-testid="card-description">
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{business.description}</p>
              </div>
            )}

            {isOrganization && biz.missionStatement && (
              <div className="border-l-2 pl-4 mt-4" style={{ borderColor: accentColor }} data-testid="card-mission">
                <p className="text-sm font-medium mb-1">Mission</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{biz.missionStatement}</p>
              </div>
            )}

            {isOrganization && sampleSupporters.length > 0 && (
              <div className="mt-4" data-testid="section-supporters">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold text-sm">Commerce Supporters</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sampleSupporters.map((s: SupporterItem) => (
                    <Link key={s.id} href={`/${citySlug}/presence/${s.slug}`}>
                      <Card className="p-3 flex items-center gap-3 cursor-pointer hover-elevate" data-testid={`supporter-${s.id}`}>
                        <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
                          ) : (
                            <Store className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.tagline}</p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {shoppingCenter && (
              <div className="flex items-center gap-2 text-sm mt-2" data-testid="card-shopping-center">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Located in </span>
                <Link href={`/${citySlug}/shopping-centers/${shoppingCenter.slug}`}>
                  <span className="text-primary hover:underline cursor-pointer" data-testid="link-shopping-center">
                    {shoppingCenter.name}
                  </span>
                </Link>
              </div>
            )}

            {Object.keys(hoursOfOperation).length > 0 && (
              <div className="mt-4" data-testid="card-hours">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Hours of Operation
                </h3>
                <div className="space-y-1">
                  {Object.entries(hoursOfOperation).map(([day, hours]) => (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="font-medium capitalize">{day}</span>
                      <span className="text-muted-foreground">{hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {languagesSpoken.length > 0 && (
              <div className="mt-4" data-testid="section-languages">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Languages className="h-4 w-4" /> Languages Spoken
                </h3>
                <div className="flex flex-wrap gap-2">
                  {languagesSpoken.map((lang: string) => (
                    <Badge key={lang} variant="secondary" data-testid={`badge-language-${lang}`}>
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-5 space-y-3" data-testid="card-contact">
              <h3 className="font-semibold">Contact</h3>
              {business.phone && (
                <a href={`tel:${business.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-phone">
                  <Phone className="h-4 w-4 shrink-0" /> {business.phone}
                </a>
              )}
              {business.websiteUrl && (
                <a href={business.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-website">
                  <Globe className="h-4 w-4 shrink-0" /> Visit Website
                </a>
              )}
              {business.ownerEmail && (
                <a href={`mailto:${business.ownerEmail}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-email">
                  <Mail className="h-4 w-4 shrink-0" /> {business.ownerEmail}
                </a>
              )}
              {isOrganization && biz.donateUrl && (
                <a href={biz.donateUrl} target="_blank" rel="noopener noreferrer" data-testid="link-donate">
                  <Button size="sm" className="gap-2 w-full mt-1">
                    <Heart className="h-4 w-4" /> Donate
                  </Button>
                </a>
              )}
            </Card>

            {business.address && (
              <Card className="p-5 space-y-3" data-testid="card-location">
                <h3 className="font-semibold">Location</h3>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{fullAddress}</span>
                </div>
              </Card>
            )}

            {Object.keys(socialLinks).length > 0 && (
              <Card className="p-5 space-y-2" data-testid="card-social-links">
                <h3 className="font-semibold mb-1">Social Media</h3>
                <SocialLinksList socialLinks={socialLinks} />
              </Card>
            )}

            {isOrganization && biz.causeTags?.length > 0 && (
              <Card className="p-5" data-testid="card-cause-tags">
                <h3 className="font-semibold mb-3">Causes</h3>
                <div className="flex flex-wrap gap-2">
                  {biz.causeTags.map((tag: string) => (
                    <Badge key={tag} variant="outline" data-testid={`badge-cause-${tag}`}>{tag}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {isOrganization && underwriters && underwriters.length > 0 && (
              <Card className="p-5" data-testid="section-underwriters">
                <h3 className="font-semibold mb-3">Supported in the Hub by</h3>
                <div className="flex flex-wrap gap-2">
                  {underwriters.map((uw) => (
                    <Link key={uw.businessSlug} href={`/${citySlug}/presence/${uw.businessSlug}`}>
                      <Badge variant="outline" className="cursor-pointer" data-testid={`link-underwriter-${uw.businessSlug}`}>
                        {uw.businessName}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {!isOrganization && supportedOrgs && supportedOrgs.length > 0 && (
              <Card className="p-5" data-testid="section-supported-orgs">
                <h3 className="font-semibold mb-3">Support in the Hub</h3>
                <div className="flex flex-wrap gap-2">
                  {supportedOrgs.map((org) => (
                    <Link key={org.orgSlug} href={`/${citySlug}/presence/${org.orgSlug}`}>
                      <Badge variant="outline" className="cursor-pointer" data-testid={`link-supported-org-${org.orgSlug}`}>
                        {org.orgName}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </EnhancedSectionWrapper>

      {hasServices && (
        <EnhancedSectionWrapper
          id="section-services"
          index={sectionIndex++}
          accentColor={accentColor}
          icon={List}
          title="Services"
        >
          {resolvedMicroTags.length > 0 && (
            <div className="mb-6" data-testid="section-micro-tags">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Services & Specialties</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resolvedMicroTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2.5 rounded-md border p-3"
                    data-testid={`card-micro-tag-${tag.id}`}
                  >
                    <CheckCircle className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
                    <span className="text-sm font-medium">{tag.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(primaryService || subServices.length > 0) && (
            <div className="mb-4" data-testid="card-micro-services">
              {primaryService && (
                <div className="mb-3">
                  <Badge variant="default" className="text-sm" data-testid="badge-primary-service">
                    {primaryService.serviceName}
                  </Badge>
                </div>
              )}
              {subServices.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subServices.map((service) => (
                    <Badge key={service.id} variant="outline" data-testid={`badge-sub-service-${service.id}`}>
                      {service.serviceName}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {micrositeServices.length > 0 && presenceServices.length === 0 && (
            <div className="flex flex-wrap gap-2" data-testid="card-services">
              {micrositeServices.map((service) => (
                <Badge key={service} variant="outline" data-testid={`badge-service-${service}`}>
                  {service}
                </Badge>
              ))}
            </div>
          )}
        </EnhancedSectionWrapper>
      )}

      {hasFaqContent && (
        <EnhancedSectionWrapper
          id="section-trust"
          index={sectionIndex++}
          accentColor={accentColor}
          icon={ShieldCheck}
          title="Trust & FAQ"
        >
          <div className="space-y-6">
            {hasTrustSignals && (
              <div data-testid="card-credentials">
                {licensesAndCerts.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Licenses & Certifications</p>
                    <div className="flex flex-wrap gap-2">
                      {licensesAndCerts.map((item) => (
                        <Badge key={item} variant="outline" className="gap-1" data-testid={`badge-cert-${item}`}>
                          <ShieldCheck className="h-3 w-3" /> {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {awardsAndHonors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Awards & Honors</p>
                    <div className="flex flex-wrap gap-2">
                      {awardsAndHonors.map((item) => (
                        <Badge key={item} variant="outline" className="gap-1 border-amber-300 text-amber-700 dark:text-amber-400" data-testid={`badge-award-${item}`}>
                          <Award className="h-3 w-3" /> {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {canShowFaq && faqs.length > 0 && (
              <div data-testid="card-faq">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" /> Frequently Asked Questions
                </h3>
                <div>
                  {faqs.map((faq) => (
                    <FaqItem key={faq.id} question={faq.question} answer={faq.answer} />
                  ))}
                </div>
              </div>
            )}

            {canShowQa && expertQa.length > 0 && (
              <div data-testid="card-expert-qa">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Expert Q&A
                </h3>
                <div className="space-y-4">
                  {expertQa.map((qa) => (
                    <div key={qa.id} className="border-l-2 pl-3" style={{ borderColor: `${accentColor}4d` }} data-testid={`qa-item-${qa.id}`}>
                      <p className="text-sm font-medium">{qa.question}</p>
                      {qa.askedByName && (
                        <p className="text-xs text-muted-foreground mt-0.5">Asked by {qa.askedByName}</p>
                      )}
                      {qa.answer && (
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{qa.answer}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </EnhancedSectionWrapper>
      )}

      {canShowGallery && galleryImages.length > 0 && (
        <EnhancedSectionWrapper
          id="section-gallery"
          index={sectionIndex++}
          accentColor={accentColor}
          icon={Image}
          title="Gallery"
        >
          <GalleryTab galleryImages={galleryImages} businessName={business.name} tierConfig={tierConfig} />
        </EnhancedSectionWrapper>
      )}

      {canShowEvents && events.length > 0 && (
        <EnhancedSectionWrapper
          id="section-events"
          index={sectionIndex++}
          accentColor={accentColor}
          icon={Calendar}
          title="Events"
        >
          <EventsTab events={events} citySlug={citySlug} businessName={business.name} />
        </EnhancedSectionWrapper>
      )}

      {canShowReviews && (
        <EnhancedSectionWrapper
          id="section-reviews"
          index={sectionIndex++}
          accentColor={accentColor}
          icon={Star}
          title="Reviews"
        >
          {sampleData && sampleReviews.length > 0 ? (
            <SampleReviewsDisplay reviews={sampleReviews} businessName={business.name} googleRating={business.googleRating || undefined} googleReviewCount={business.googleReviewCount || undefined} />
          ) : (
            <ReviewSection
              citySlug={citySlug}
              businessSlug={business.slug}
              businessId={business.id}
              businessName={business.name}
              listingTier={business.listingTier}
              googleRating={business.googleRating || undefined}
              googleReviewCount={business.googleReviewCount || undefined}
            />
          )}
        </EnhancedSectionWrapper>
      )}

      {(hasHubContent || hasNewsContent) && (
        <EnhancedSectionWrapper
          id="section-hub"
          index={sectionIndex++}
          accentColor={accentColor}
          icon={Newspaper}
          title="In the Hub"
        >
          {hasHubContent && (
            <HubTab contentLinks={contentLinks} contentJournal={contentJournal} businessName={business.name} articles={sampleArticles} citySlug={citySlug} editorialMentions={editorialMentions} />
          )}
          {hasNewsContent && (
            <div className={hasHubContent ? "mt-8" : ""}>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> External Coverage
              </h3>
              <NewsTab externalLinks={externalLinks} isLoggedIn={isLoggedIn} citySlug={citySlug} />
            </div>
          )}
        </EnhancedSectionWrapper>
      )}
    </div>
  );
}

function HeroHeader({
  business,
  coverImage,
  catNames,
  catSlugs,
  accentColor,
  citySlug,
  isEnhanced = false,
}: {
  business: Business & { tierConfig: any };
  coverImage: string | null;
  catNames: string[];
  catSlugs?: string[];
  accentColor: string;
  citySlug: string;
  isEnhanced?: boolean;
}) {
  const logoUrl = isEnhanced ? (business as any).micrositeLogo : null;

  const gradientOverlay = isEnhanced && accentColor !== "#5B1D8F"
    ? `linear-gradient(to top, ${accentColor}cc, ${accentColor}66 40%, transparent)`
    : "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.4) 40%, transparent)";

  return (
    <div className={`relative overflow-hidden ${isEnhanced ? 'rounded-t-md' : 'rounded-md'}`} data-testid="section-hero">
      {coverImage ? (
        <div className={isEnhanced ? "aspect-[2.5/1] min-h-[220px] max-h-[400px]" : "aspect-[3/1] min-h-[180px] max-h-[320px]"}>
          <img
            src={coverImage}
            alt={business.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: gradientOverlay }} />
        </div>
      ) : (
        <div
          className={isEnhanced ? "aspect-[2.5/1] min-h-[220px] max-h-[400px]" : "aspect-[3/1] min-h-[180px] max-h-[320px]"}
          style={{ background: `linear-gradient(135deg, ${accentColor}, #1a1a2e)` }}
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
        <div className="flex items-end gap-4">
          {isEnhanced && logoUrl && (
            <div className="shrink-0 h-16 w-16 md:h-20 md:w-20 rounded-full border-2 border-white/40 overflow-hidden bg-white shadow-lg" data-testid="img-business-logo">
              <img src={logoUrl} alt={`${business.name} logo`} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {business.isVerified && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-verified">
                  <CheckCircle className="mr-1 h-3 w-3" /> Verified
                </Badge>
              )}
              {catNames.map((name, i) => {
                const catSlug = catSlugs?.[i];
                const badge = (
                  <Badge key={name} variant="outline" className="bg-white/10 text-white border-white/20 text-xs" data-testid={`badge-category-${name.toLowerCase().replace(/\s+/g, '-')}`}>
                    {name}
                  </Badge>
                );
                return catSlug ? (
                  <Link key={name} href={`/${citySlug}/${catSlug}`}>{badge}</Link>
                ) : badge;
              })}
            </div>
            <h1
              className="text-2xl md:text-4xl font-bold text-white drop-shadow-md"
              data-testid="text-business-name"
            >
              {business.name}
            </h1>
            {business.micrositeTagline && (
              <p className="mt-1 text-white/90 text-sm md:text-base max-w-xl" data-testid="text-tagline">
                {business.micrositeTagline}
              </p>
            )}
            {business.nearestTransitStopId && (
              <div className="mt-2">
                <TransitBadgeFromId stopId={business.nearestTransitStopId} citySlug={citySlug} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0" data-testid={`faq-item-${question.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 px-1 text-left text-sm font-medium hover:text-primary transition-colors"
        data-testid="button-faq-toggle"
      >
        <span>{question}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 shrink-0 ml-2" />}
      </button>
      {open && (
        <p className="text-sm text-muted-foreground px-1 pb-3 whitespace-pre-line">{answer}</p>
      )}
    </div>
  );
}

function TrustAndCommerceSections({
  business,
  faqs,
  expertQa,
  canShowFaq,
  canShowQa,
}: {
  business: Business;
  faqs: { id: string; question: string; answer: string; sortOrder: number }[];
  expertQa: { id: string; question: string; answer: string | null; askedByName: string | null; sortOrder: number }[];
  canShowFaq: boolean;
  canShowQa: boolean;
}) {
  const biz = business as any;
  const languagesSpoken: string[] = biz.languagesSpoken || [];
  const licensesAndCerts: string[] = biz.licensesAndCerts || [];
  const awardsAndHonors: string[] = biz.awardsAndHonors || [];
  const hasTrustSignals = licensesAndCerts.length > 0 || awardsAndHonors.length > 0;

  return (
    <div className="mt-6 space-y-4">
      {languagesSpoken.length > 0 && (
        <Card className="p-5" data-testid="card-languages">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Languages className="h-4 w-4" /> Languages Spoken
          </h2>
          <div className="flex flex-wrap gap-2">
            {languagesSpoken.map((lang) => (
              <Badge key={lang} variant="secondary" data-testid={`badge-lang-${lang}`}>
                {lang}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {hasTrustSignals && (
        <Card className="p-5" data-testid="card-credentials">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Trust & Credentials
          </h2>
          {licensesAndCerts.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Licenses & Certifications</p>
              <div className="flex flex-wrap gap-2">
                {licensesAndCerts.map((item) => (
                  <Badge key={item} variant="outline" className="gap-1" data-testid={`badge-cert-${item}`}>
                    <ShieldCheck className="h-3 w-3" /> {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {awardsAndHonors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Awards & Honors</p>
              <div className="flex flex-wrap gap-2">
                {awardsAndHonors.map((item) => (
                  <Badge key={item} variant="outline" className="gap-1 border-amber-300 text-amber-700 dark:text-amber-400" data-testid={`badge-award-${item}`}>
                    <Award className="h-3 w-3" /> {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {canShowFaq && faqs.length > 0 && (
        <Card className="p-5" data-testid="card-faq">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> Frequently Asked Questions
          </h2>
          <div>
            {faqs.map((faq) => (
              <FaqItem key={faq.id} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </Card>
      )}

      {canShowQa && expertQa.length > 0 && (
        <Card className="p-5" data-testid="card-expert-qa">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Expert Q&A
          </h2>
          <div className="space-y-4">
            {expertQa.map((qa) => (
              <div key={qa.id} className="border-l-2 border-primary/30 pl-3" data-testid={`qa-item-${qa.id}`}>
                <p className="text-sm font-medium">{qa.question}</p>
                {qa.askedByName && (
                  <p className="text-xs text-muted-foreground mt-0.5">Asked by {qa.askedByName}</p>
                )}
                {qa.answer && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{qa.answer}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function OverviewTab({
  business,
  socialLinks,
  hoursOfOperation,
  micrositeServices,
  presenceServices = [],
  shoppingCenter = null,
  citySlug,
}: {
  business: Business;
  socialLinks: Record<string, string>;
  hoursOfOperation: Record<string, string>;
  micrositeServices: string[];
  presenceServices?: PresenceServiceItem[];
  shoppingCenter?: ShoppingCenterItem | null;
  citySlug: string;
}) {
  const fullAddress = [business.address, business.city, business.state, business.zip].filter(Boolean).join(", ");
  const primaryService = presenceServices.find(s => s.isPrimary);
  const subServices = presenceServices.filter(s => !s.isPrimary);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mt-4">
      <div className="lg:col-span-2 space-y-4">
        {business.description && (
          <Card className="p-5" data-testid="card-description">
            <h2 className="font-semibold mb-2">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{business.description}</p>
          </Card>
        )}

        {shoppingCenter && (
          <Card className="p-5" data-testid="card-shopping-center">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Located In
            </h2>
            <Link href={`/${citySlug}/shopping-centers/${shoppingCenter.slug}`}>
              <span className="text-sm text-primary hover:underline cursor-pointer" data-testid="link-shopping-center">
                {shoppingCenter.name}
              </span>
            </Link>
            {shoppingCenter.address && (
              <p className="text-xs text-muted-foreground mt-1">{shoppingCenter.address}</p>
            )}
          </Card>
        )}

        {(primaryService || subServices.length > 0) && (
          <Card className="p-5" data-testid="card-micro-services">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <List className="h-4 w-4" /> Services
            </h2>
            {primaryService && (
              <div className="mb-3">
                <Badge variant="default" className="text-sm" data-testid="badge-primary-service">
                  {primaryService.serviceName}
                </Badge>
              </div>
            )}
            {subServices.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {subServices.map((service) => (
                  <Badge key={service.id} variant="outline" data-testid={`badge-sub-service-${service.id}`}>
                    {service.serviceName}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        )}

        {micrositeServices.length > 0 && presenceServices.length === 0 && (
          <Card className="p-5" data-testid="card-services">
            <h2 className="font-semibold mb-3">Services</h2>
            <div className="flex flex-wrap gap-2">
              {micrositeServices.map((service) => (
                <Badge key={service} variant="outline" data-testid={`badge-service-${service}`}>
                  {service}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {Object.keys(hoursOfOperation).length > 0 && (
          <Card className="p-5" data-testid="card-hours">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Hours of Operation
            </h2>
            <div className="space-y-1">
              {Object.entries(hoursOfOperation).map(([day, hours]) => (
                <div key={day} className="flex justify-between text-sm">
                  <span className="font-medium capitalize">{day}</span>
                  <span className="text-muted-foreground">{hours}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card className="p-5 space-y-3" data-testid="card-contact">
          <h3 className="font-semibold">Contact</h3>
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-phone"
            >
              <Phone className="h-4 w-4 shrink-0" /> {business.phone}
            </a>
          )}
          {business.websiteUrl && (
            <a
              href={business.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-website"
            >
              <Globe className="h-4 w-4 shrink-0" /> Visit Website
            </a>
          )}
          {business.ownerEmail && (
            <a
              href={`mailto:${business.ownerEmail}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-email"
            >
              <Mail className="h-4 w-4 shrink-0" /> {business.ownerEmail}
            </a>
          )}
        </Card>

        {business.address && (
          <Card className="p-5 space-y-3" data-testid="card-location">
            <h3 className="font-semibold">Location</h3>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>{fullAddress}</span>
            </div>
          </Card>
        )}

        {Object.keys(socialLinks).length > 0 && (
          <Card className="p-5 space-y-2" data-testid="card-social-links">
            <h3 className="font-semibold mb-1">Social Media</h3>
            <SocialLinksList socialLinks={socialLinks} />
          </Card>
        )}
      </div>
    </div>
  );
}

function FreeOverview({
  business,
  catNames,
  socialLinks,
  hoursOfOperation,
  micrositeServices,
  citySlug,
  shoppingCenter = null,
}: {
  business: Business;
  catNames: string[];
  socialLinks: Record<string, string>;
  hoursOfOperation: Record<string, string>;
  micrositeServices: string[];
  citySlug: string;
  shoppingCenter?: ShoppingCenterItem | null;
}) {
  return (
    <div className="mt-6 space-y-6">
      <OverviewTab
        business={business}
        socialLinks={socialLinks}
        hoursOfOperation={hoursOfOperation}
        micrositeServices={micrositeServices}
        shoppingCenter={shoppingCenter}
        citySlug={citySlug}
      />
      <Card className="p-6 text-center border-dashed" data-testid="card-upgrade-cta">
        <h3 className="font-semibold text-lg mb-2">Unlock Your Full Presence</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Upgrade to a paid plan to unlock gallery photos, event listings, reviews, hub features, and more.
        </p>
        <Link href={`/${citySlug}/activate`}>
          <Button data-testid="button-upgrade">Upgrade Now</Button>
        </Link>
      </Card>
    </div>
  );
}

function GalleryTab({
  galleryImages,
  businessName,
  tierConfig,
}: {
  galleryImages: string[];
  businessName: string;
  tierConfig: any;
}) {
  const maxPhotos = tierConfig?.maxGalleryPhotos;
  const visibleImages = maxPhotos ? galleryImages.slice(0, maxPhotos) : galleryImages;

  if (galleryImages.length === 0) {
    return (
      <Card className="p-12 text-center mt-4" data-testid="card-gallery-empty">
        <Image className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold mb-1">Gallery coming soon</h3>
        <p className="text-sm text-muted-foreground">Photos will appear here once uploaded.</p>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {maxPhotos && galleryImages.length > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="text-gallery-count">
          Showing {visibleImages.length} of {galleryImages.length} photos
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {visibleImages.map((img, i) => (
          <div
            key={i}
            className="aspect-square rounded-md overflow-hidden"
            data-testid={`gallery-image-${i}`}
          >
            <img
              src={img}
              alt={`${businessName} photo ${i + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsTab({
  events,
  citySlug,
  businessName,
}: {
  events: any[];
  citySlug: string;
  businessName: string;
}) {
  if (events.length === 0) {
    return (
      <Card className="p-12 text-center mt-4" data-testid="card-events-empty">
        <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold mb-1">No upcoming events</h3>
        <p className="text-sm text-muted-foreground mb-4">Events hosted by {businessName} will appear here.</p>
        <Link href={`/${citySlug}/submit/event`}>
          <Button variant="outline" data-testid="link-submit-event">Submit an Event</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {events.map((event) => (
        <Card key={event.id} className="p-4" data-testid={`card-event-${event.id}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <h3 className="font-semibold" data-testid={`text-event-title-${event.id}`}>{event.title}</h3>
              {event.startDateTime && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(event.startDateTime), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
              {event.locationName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {event.locationName}
                </p>
              )}
              {event.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
              )}
            </div>
            {event.slug && (
              <Link href={`/${citySlug}/events/${event.slug}`}>
                <Button variant="outline" size="sm" data-testid={`link-event-detail-${event.id}`}>
                  Details
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function HubTab({
  contentLinks,
  contentJournal,
  businessName,
  articles = [],
  citySlug,
  editorialMentions = [],
}: {
  contentLinks: any[];
  contentJournal: ContentJournalItem[];
  businessName: string;
  articles?: { id: string; title: string; slug: string; author: string; category: string; publishedAt: string }[];
  citySlug?: string;
  editorialMentions?: { id: string; title: string; slug: string; excerpt: string | null; publishedAt: string | null }[];
}) {
  const allItems = [
    ...contentLinks.map((link: any) => ({
      id: link.id,
      title: link.title || link.label,
      type: link.type || "article",
      hubLabel: link.hubName,
      nicheLabel: link.nicheName,
      snippet: null as string | null,
      externalUrl: null as string | null,
      batchTag: null as string | null,
      sourceLabel: null as string | null,
    })),
    ...contentJournal.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.contentType.toLowerCase(),
      hubLabel: item.hubLabel,
      nicheLabel: item.nicheLabel,
      snippet: item.snippet,
      externalUrl: item.externalUrl,
      batchTag: item.batchTag,
      sourceLabel: item.sourceLabel,
    })),
  ];

  if (allItems.length === 0 && articles.length === 0 && editorialMentions.length === 0) {
    return (
      <Card className="p-12 text-center mt-4" data-testid="card-hub-empty">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold mb-1">Hub Archive</h3>
        <p className="text-sm text-muted-foreground">
          Content archive will grow as {businessName} is featured across the hub.
        </p>
      </Card>
    );
  }

  const typeIcons: Record<string, typeof FileText> = {
    article: FileText,
    event: Calendar,
    list: List,
    mention: FileText,
    list_inclusion: List,
    event_recap: Calendar,
    community_post: FileText,
  };

  return (
    <div className="mt-4 space-y-4">
      {editorialMentions.length > 0 && (
        <div className="space-y-3" data-testid="section-editorial-mentions">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5" /> Editorial Mentions
          </h3>
          {editorialMentions.map((mention) => (
            <Link key={mention.id} href={citySlug ? `/${citySlug}/articles/${mention.slug}` : `#`}>
              <Card className="p-4 cursor-pointer hover-elevate" data-testid={`card-editorial-mention-${mention.id}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Newspaper className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-semibold text-sm">{mention.title}</h3>
                    {mention.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{mention.excerpt}</p>
                    )}
                    {mention.publishedAt && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(mention.publishedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {articles.length > 0 && (
        <div className="space-y-3" data-testid="section-hub-articles">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5" /> In the Pulse
          </h3>
          {articles.map((article) => (
            <Link key={article.id} href={citySlug ? `/${citySlug}/articles/${article.slug}` : `#`}>
              <Card className="p-4 cursor-pointer hover-elevate" data-testid={`card-hub-article-${article.id}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <FileText className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-semibold text-sm">{article.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{article.category}</Badge>
                      <span className="text-xs text-muted-foreground">by {article.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(article.publishedAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {allItems.length > 0 && (
        <div className="space-y-3">
          {articles.length > 0 && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5 mt-2">
              <FileText className="h-3.5 w-3.5" /> Hub Archive
            </h3>
          )}
          {allItems.map((item, i) => {
            const TypeIcon = typeIcons[item.type] || FileText;
            return (
              <Card key={item.id || i} className="p-4" data-testid={`card-hub-item-${item.id || i}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-semibold text-sm" data-testid={`text-hub-title-${item.id || i}`}>
                      {item.externalUrl ? (
                        <a href={item.externalUrl} target="_blank" rel="noopener" className="hover:underline">
                          {item.title}
                        </a>
                      ) : item.title}
                    </h3>
                    {item.snippet && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.snippet}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {item.hubLabel && (
                        <Badge variant="outline" className="text-xs">{item.hubLabel}</Badge>
                      )}
                      {item.nicheLabel && (
                        <Badge variant="outline" className="text-xs">{item.nicheLabel}</Badge>
                      )}
                      {item.batchTag && (
                        <Badge variant="secondary" className="text-xs">{item.batchTag}</Badge>
                      )}
                      {item.sourceLabel && (
                        <span className="text-xs text-muted-foreground">{item.sourceLabel}</span>
                      )}
                      {item.type && (
                        <span className="text-xs text-muted-foreground capitalize">{item.type.replace(/_/g, " ")}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewsTab({
  externalLinks,
  isLoggedIn,
  citySlug,
}: {
  externalLinks: any[];
  isLoggedIn: boolean;
  citySlug: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      {isLoggedIn && (
        <div className="flex justify-end">
          <Link href={`/${citySlug}/submit/article`}>
            <Button variant="outline" size="sm" data-testid="button-submit-link">
              <LinkIcon className="h-4 w-4 mr-1" /> Submit a Link
            </Button>
          </Link>
        </div>
      )}

      {externalLinks.length === 0 ? (
        <Card className="p-12 text-center" data-testid="card-news-empty">
          <Newspaper className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">No external mentions yet</h3>
          <p className="text-sm text-muted-foreground">
            Press coverage and external links will be displayed here.
          </p>
        </Card>
      ) : (
        externalLinks.map((link, i) => (
          <Card key={link.id || i} className="p-4" data-testid={`card-news-item-${link.id || i}`}>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm" data-testid={`text-news-title-${link.id || i}`}>
                {link.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {link.sourceName && <span>{link.sourceName}</span>}
                {link.date && <span>{format(new Date(link.date), "MMM d, yyyy")}</span>}
              </div>
              {link.snippet && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{link.snippet}</p>
              )}
              {link.url && (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium mt-2 hover:underline text-primary"
                  data-testid={`link-news-readmore-${link.id || i}`}
                >
                  Read More <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function SocialLinksList({ socialLinks }: { socialLinks: Record<string, string> }) {
  const platforms: { key: string; label: string; icon: typeof Globe }[] = [
    { key: "instagram", label: "Instagram", icon: Instagram },
    { key: "facebook", label: "Facebook", icon: Facebook },
    { key: "twitter", label: "X / Twitter", icon: Globe },
    { key: "linkedin", label: "LinkedIn", icon: Globe },
    { key: "tiktok", label: "TikTok", icon: Globe },
    { key: "yelp", label: "Yelp", icon: Globe },
    { key: "youtube", label: "YouTube", icon: Globe },
  ];

  return (
    <>
      {platforms.map(({ key, label, icon: Icon }) =>
        socialLinks[key] ? (
          <a
            key={key}
            href={socialLinks[key]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            data-testid={`link-social-${key}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </a>
        ) : null
      )}
    </>
  );
}
