import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar, MapPin, Bookmark, ArrowLeft, ArrowRight, User, Tag, Info, Sparkles, Ticket, Store, Star, Award, Car, Lock, UserCheck, Globe, ChevronDown, ChevronUp, Send, Navigation, Shield, FileText, Plus, Minus, Download, Clock, MessageCircle, Trophy, Gift } from "lucide-react";
import { BizImage } from "@/components/biz-image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { EventSponsor, EventVendorManaged } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { AuthDialog } from "@/components/auth-dialog";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import { getDeviceId } from "@/lib/device";
import type { Event as EventType, Business } from "@shared/schema";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { useI18n, localized } from "@/lib/i18n";
import { getBusinessUrl } from "@/lib/business-url";
import { ShareMenu } from "@/components/share-menu";
import { SidebarAd, EventSponsorAdSlot } from "@/components/ad-banner";
import { usePlatformAffiliates } from "@/hooks/use-platform-affiliates";
import { buildUberRideLink, buildLyftRideLink, getAffiliateId } from "@/lib/affiliate-links";
import { trackIntelligenceEvent } from "@/lib/intelligence-tracker";
import { DarkPageShell } from "@/components/dark-page-shell";
import { NeighborhoodContext, useNearbyData, buildNearbyJsonLd } from "@/components/neighborhood-context";

interface EventPartner {
  businessName: string;
  businessSlug: string;
  imageUrl?: string;
  isHost?: boolean;
}

interface SampleEventData {
  event: Partial<EventType> & {
    organizer?: string;
    neighborhood?: string;
    category?: string;
    tags?: string[];
  };
  partners: EventPartner[];
}

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  "Arts & Culture": "bg-purple-600",
  "Food & Drink": "bg-orange-600",
  "Tech & Innovation": "bg-blue-600",
  "Music & Entertainment": "bg-pink-600",
  "Community": "bg-teal-600",
};

const SAMPLE_EVENTS: Record<string, SampleEventData> = {
  "noda-first-friday-art-walk": {
    event: {
      id: "sample-evt-1",
      title: "NoDa First Friday Art Walk",
      description: "Experience Charlotte's most vibrant arts scene at the monthly First Friday Art Walk. Explore 20+ galleries showcasing local and national artists, enjoy live music from Charlotte musicians, browse handmade goods from local artisans, and savor bites from neighborhood food vendors.\n\nArtist meet-and-greets, live painting demonstrations, and interactive installations make this a can't-miss evening for art lovers of all ages. The walk spans the entire NoDa arts district along North Davidson Street, with participating galleries staying open late.\n\nNew this month: A collaborative mural project where attendees can contribute to a community artwork that will be permanently installed in the neighborhood. Plus, the NoDa Jazz Collective performs live on the outdoor stage at 8 PM.",
      imageUrl: "/images/seed/art-walk.png",
      startDateTime: new Date(Date.now() + 7 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 7 * 86400000 + 4 * 3600000).toISOString(),
      locationName: "NoDa Arts District",
      address: "3000 N Davidson St",
      city: "Charlotte",
      state: "NC",
      zip: "28205",
      costText: "Free",
      isFeatured: true,
      isSponsored: false,
      organizer: "NoDa Arts District Association",
      neighborhood: "NoDa",
      category: "Arts & Culture",
      tags: ["family-friendly", "outdoor", "free", "monthly", "art", "live-music"],
    } as any,
    partners: [
      { businessName: "NoDa Brewing Company", businessSlug: "noda-brewing-company", imageUrl: "/images/seed/brewery.png" },
    ],
  },
  "south-end-food-truck-friday": {
    event: {
      id: "sample-evt-2",
      title: "South End Food Truck Friday",
      description: "Charlotte's biggest weekly food truck gathering returns to South End! Over 25 food trucks serving cuisines from around the world — Korean BBQ, gourmet tacos, wood-fired pizza, Caribbean jerk, and artisan ice cream.\n\nCraft beer garden featuring local breweries, live DJ spinning feel-good vibes, face painting and activities for kids, and plenty of outdoor seating along the Rail Trail. The event takes place rain or shine in the Atherton Mill parking area, with overflow seating available along the greenway.\n\nThis week's featured trucks include Queen City Smoke, Papi Queso, Indy Food Truck, and Bao & Broth. Don't miss the dessert row with Jeni's Splendid Ice Creams pop-up and Charlotte Cheesecake Company!",
      imageUrl: "/images/seed/food-truck.png",
      startDateTime: new Date(Date.now() + 10 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 10 * 86400000 + 5 * 3600000).toISOString(),
      locationName: "Atherton Mill & Market",
      address: "2104 South Blvd",
      city: "Charlotte",
      state: "NC",
      zip: "28203",
      costText: "Free Entry",
      isFeatured: false,
      isSponsored: false,
      organizer: "South End Partners",
      neighborhood: "South End",
      category: "Food & Drink",
      tags: ["family-friendly", "outdoor", "food", "weekly", "live-music"],
    } as any,
    partners: [
      { businessName: "Queen City Roasters", businessSlug: "queen-city-roasters", imageUrl: "/images/seed/coffee-shop.png" },
    ],
  },
  "queen-city-startup-pitch-night": {
    event: {
      id: "sample-evt-3",
      title: "Queen City Startup Pitch Night",
      description: "Watch 10 of Charlotte's most promising early-stage startups pitch their ideas to a panel of investors and industry leaders. Each founder gets 5 minutes to make their case, followed by a 3-minute Q&A with the judges.\n\nThe evening kicks off with a networking reception at 6 PM featuring local craft cocktails and appetizers from Bardo. Connect with founders, investors, mentors, and fellow tech enthusiasts before the pitches begin at 7 PM.\n\nThe night wraps up with the Audience Choice Award — vote for your favorite pitch and help decide who takes home the $5,000 prize. Previous winners have gone on to raise seed rounds and join accelerators like Techstars and Y Combinator.",
      imageUrl: "/images/seed/pitch-night.png",
      startDateTime: new Date(Date.now() + 14 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 14 * 86400000 + 3 * 3600000).toISOString(),
      locationName: "Packard Place",
      address: "222 S Church St",
      city: "Charlotte",
      state: "NC",
      zip: "28202",
      costText: "$15",
      isFeatured: false,
      isSponsored: false,
      organizer: "Charlotte Tech Alliance",
      neighborhood: "Uptown",
      category: "Tech & Innovation",
      tags: ["networking", "startups", "indoor", "tech"],
    } as any,
    partners: [],
  },
  "latte-art-championship": {
    event: {
      id: "sample-evt-5",
      title: "Latte Art Championship",
      description: "Watch Charlotte's most talented baristas compete in the ultimate latte art throwdown at Queen City Roasters! Competitors will face off in three rounds — free pour, designer, and speed — judged by a panel of specialty coffee professionals from across the Southeast.\n\nThe competition kicks off at 10 AM with an open practice session where attendees can try their hand at latte art with guidance from our expert baristas. The official rounds begin at noon, with each competitor crafting intricate designs in milk and espresso.\n\nAdmission includes unlimited drip coffee tastings, a behind-the-scenes roastery tour, and a cupping session featuring our newest single-origin arrivals. The winner takes home the Golden Tamper trophy and a feature on our seasonal menu. Food trucks will be on-site, and local band The Drip will perform acoustic sets between rounds.",
      imageUrl: "/images/seed/coffee-shop.png",
      startDateTime: new Date(Date.now() + 14 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 14 * 86400000 + 6 * 3600000).toISOString(),
      locationName: "Queen City Roasters - South End",
      address: "2100 South Blvd",
      city: "Charlotte",
      state: "NC",
      zip: "28203",
      costText: "$10",
      isFeatured: true,
      isSponsored: false,
      organizer: "Queen City Roasters",
      neighborhood: "South End",
      category: "Food & Drink",
      tags: ["coffee", "competition", "indoor", "food", "live-music"],
    } as any,
    partners: [
      { businessName: "Queen City Roasters", businessSlug: "queen-city-roasters" },
    ],
  },
  "friday-night-live-music": {
    event: {
      id: "sample-evt-6",
      title: "Friday Night Live Music",
      description: "Every Friday night, NoDa Brewing Company transforms its taproom and patio into Charlotte's favorite live music venue. This week features The Mint Condition, a high-energy funk and soul band that's been tearing up stages across the Carolinas.\n\nDoors open at 7 PM with the first set starting at 8. Grab a seat on the dog-friendly patio under the string lights or pull up a stool inside the taproom. We'll have 22 beers on tap including two brand-new seasonal releases — a citrus wheat ale and a smoked porter.\n\nFood truck Bao & Broth will be parked out front serving steaming bowls and crispy bao buns. No cover charge — just show up, grab a pint, and enjoy the vibes. This is the best way to kick off your weekend in NoDa.",
      imageUrl: "/images/seed/brewery.png",
      startDateTime: new Date(Date.now() + 5 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 5 * 86400000 + 4 * 3600000).toISOString(),
      locationName: "NoDa Brewing Taproom",
      address: "2921 N Tryon St",
      city: "Charlotte",
      state: "NC",
      zip: "28206",
      costText: "Free",
      isFeatured: false,
      isSponsored: false,
      organizer: "NoDa Brewing Company",
      neighborhood: "NoDa",
      category: "Music & Entertainment",
      tags: ["live-music", "outdoor", "free", "weekly", "dog-friendly", "craft-beer"],
    } as any,
    partners: [
      { businessName: "NoDa Brewing Company", businessSlug: "noda-brewing-company" },
    ],
  },
  "annual-charlotte-arts-festival": {
    event: {
      id: "sample-evt-7",
      title: "Annual Charlotte Arts Festival",
      description: "The Charlotte Arts Foundation presents its signature annual event — a three-day celebration of visual arts, live performance, and community creativity at Romare Bearden Park in Uptown Charlotte.\n\nOver 100 artists from across the Southeast will exhibit paintings, sculpture, ceramics, photography, and mixed media. Live stages will host dance troupes, spoken word poets, and musical acts throughout the weekend. Interactive art stations invite attendees of all ages to paint, sculpt, and create alongside professional artists.\n\nHighlights include the Emerging Artist Pavilion showcasing 20 artists under 30, the Community Mural Wall where visitors contribute to a collaborative artwork, and the evening Illumination Walk featuring light-based installations along the park's paths. Local food vendors and craft beverage stations will keep you fueled throughout the festival.",
      imageUrl: "/images/seed/arts-foundation.jpg",
      startDateTime: new Date(Date.now() + 30 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 32 * 86400000).toISOString(),
      locationName: "Romare Bearden Park",
      address: "300 S Church St",
      city: "Charlotte",
      state: "NC",
      zip: "28202",
      costText: "Free",
      isFeatured: true,
      isSponsored: false,
      organizer: "Charlotte Arts Foundation",
      neighborhood: "Uptown",
      category: "Arts & Culture",
      tags: ["family-friendly", "outdoor", "free", "art", "festival", "live-music", "interactive"],
    } as any,
    partners: [
      { businessName: "Charlotte Arts Foundation", businessSlug: "charlotte-arts-foundation" },
    ],
  },
  "youth-art-showcase": {
    event: {
      id: "sample-evt-8",
      title: "Youth Art Showcase",
      description: "The Charlotte Arts Foundation invites you to celebrate the next generation of Charlotte artists at our annual Youth Art Showcase. This inspiring exhibition features work from over 150 students ages 8-18, selected from schools and community art programs across the Charlotte metro.\n\nThe showcase includes paintings, digital art, photography, ceramics, and short films created by young artists who participated in the Foundation's year-round arts education programs. Each piece tells a story about the artist's community, identity, and vision for Charlotte's future.\n\nThe evening opens with a reception where families and the public can meet the young artists, enjoy refreshments, and vote for the People's Choice Award. Scholarships will be announced for outstanding student artists, providing funding for summer arts intensives and mentorship programs. A silent auction of donated professional artworks will raise funds for next year's youth programs.",
      imageUrl: "/images/seed/noda-art.png",
      startDateTime: new Date(Date.now() + 45 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 45 * 86400000 + 3 * 3600000).toISOString(),
      locationName: "Charlotte Arts Foundation Gallery",
      address: "345 N College St",
      city: "Charlotte",
      state: "NC",
      zip: "28202",
      costText: "Free",
      isFeatured: false,
      isSponsored: false,
      organizer: "Charlotte Arts Foundation",
      neighborhood: "Uptown",
      category: "Arts & Culture",
      tags: ["family-friendly", "indoor", "free", "art", "youth", "education", "community"],
    } as any,
    partners: [
      { businessName: "Charlotte Arts Foundation", businessSlug: "charlotte-arts-foundation" },
    ],
  },
  "camp-north-end-night-market": {
    event: {
      id: "sample-evt-4",
      title: "Camp North End Night Market",
      description: "A magical evening at one of Charlotte's most unique venues. Browse 50+ local artisan vendors selling handmade jewelry, candles, pottery, and vintage finds. Live performances on two stages featuring local bands and DJs.\n\nFood hall pop-ups from Charlotte's hottest restaurants including Leah & Louise, Haberdish, and Growlers Pourhouse. Outdoor cinema screening a cult classic under the stars starting at 9 PM.\n\nOpen-air bars, string lights, and community vibes throughout the sprawling industrial campus. Don't miss the Maker's Alley where local artists demonstrate their craft live — from ceramics to letterpress to leather working. Free parking available in the main lot off Statesville Ave.",
      imageUrl: "/images/seed/camp-north-end.png",
      startDateTime: new Date(Date.now() + 21 * 86400000).toISOString(),
      endDateTime: new Date(Date.now() + 21 * 86400000 + 5 * 3600000).toISOString(),
      locationName: "Camp North End",
      address: "1824 Statesville Ave",
      city: "Charlotte",
      state: "NC",
      zip: "28206",
      costText: "Free",
      isFeatured: false,
      isSponsored: false,
      organizer: "Camp North End",
      neighborhood: "Camp North End",
      category: "Music & Entertainment",
      tags: ["outdoor", "free", "nightlife", "shopping", "art", "food"],
    } as any,
    partners: [],
  },
};

export default function EventDetail({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { locale, t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const smartBack = useSmartBack(`/${citySlug}`);
  const smartBackEvents = useSmartBack(`/${citySlug}/events`);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [saved, setSaved] = useState(false);
  const { data: affiliateConfigs } = usePlatformAffiliates();

  const sampleData = SAMPLE_EVENTS[slug];

  const inviteToken = new URLSearchParams(window.location.search).get("invite") || "";
  const eventQuerySuffix = inviteToken ? `?invite=${inviteToken}` : "";

  const { data: event, isLoading } = useQuery<EventType & { _gated?: boolean }>({
    queryKey: ["/api/cities", citySlug, "events", slug, inviteToken],
    queryFn: async () => {
      const resp = await fetch(`/api/cities/${citySlug}/events/${slug}${eventQuerySuffix}`);
      if (!resp.ok) throw new Error("Not found");
      return resp.json();
    },
    enabled: !sampleData,
  });

  useRegisterAdminEdit("events", event?.id || sampleData?.id, "Edit Event");

  const { data: eventPartners } = useQuery<{ businessName: string; businessSlug: string; amountPaid: number }[]>({
    queryKey: ["/api/cities", citySlug, "events", slug, "partners"],
    enabled: !!slug && !sampleData,
  });

  const { data: eventSponsors } = useQuery<{ id: string; name: string; slug: string; imageUrl?: string | null; micrositeLogo?: string | null }[]>({
    queryKey: ["/api/cities", citySlug, "events", slug, "sponsors"],
    enabled: !!slug && !sampleData,
  });

  const { data: relatedBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/cities", citySlug, "events", slug, "related-businesses"],
    enabled: !!slug && !sampleData,
  });

  const { data: backofficeSponsors } = useQuery<EventSponsor[]>({
    queryKey: ["/api/events", event?.id, "sponsors", "public"],
    queryFn: async () => {
      if (!event?.id) return [];
      const resp = await fetch(`/api/events/${event.id}/sponsors/public`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!event?.id && !sampleData,
  });

  const { data: backofficeVendors } = useQuery<EventVendorManaged[]>({
    queryKey: ["/api/events", event?.id, "vendors-managed", "public"],
    queryFn: async () => {
      if (!event?.id) return [];
      const resp = await fetch(`/api/events/${event.id}/vendors-managed/public`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!event?.id && !sampleData,
  });

  const { data: eventStory } = useQuery<{ id: string; title: string; local_article_slug: string; rewritten_summary: string | null; image_url: string | null; source_name: string } | null>({
    queryKey: ["/api/cities", citySlug, "events", slug, "story"],
    queryFn: async () => {
      const resp = await fetch(`/api/cities/${citySlug}/events/${slug}/story`);
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: !!slug && !sampleData,
  });

  const { data: allCategories } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["/api/categories"],
    enabled: !!slug && !sampleData,
  });

  const { data: allZones } = useQuery<{ id: string; name: string; slug: string; type: string }[]>({
    queryKey: ["/api/cities", citySlug, "zones"],
    enabled: !!slug && !sampleData,
  });

  const resolvedEvent = sampleData?.event || event;
  const resolvedPartners = sampleData?.partners || eventPartners || [];
  const extraData = sampleData?.event as any;

  const liveCategory = useMemo(() => {
    if (extraData?.category) return { name: extraData.category, slug: extraData.categorySlug || (extraData.category as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") };
    const evRec = resolvedEvent as Record<string, unknown> | undefined;
    const catIds = evRec?.categoryIds as string[] | undefined;
    if (!catIds?.length || !allCategories?.length) return null;
    const match = allCategories.find(c => catIds.includes(c.id));
    return match ? { name: match.name, slug: match.slug } : null;
  }, [resolvedEvent, allCategories, extraData]);

  const liveNeighborhood = useMemo(() => {
    if (extraData?.neighborhood) return { name: extraData.neighborhood, slug: extraData.neighborhoodSlug || (extraData.neighborhood as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") };
    const evRec = resolvedEvent as Record<string, unknown> | undefined;
    const zId = evRec?.zoneId as string | undefined;
    if (!zId || !allZones?.length) return null;
    const match = allZones.find(z => z.id === zId);
    return match ? { name: match.name, slug: match.slug } : null;
  }, [resolvedEvent, allZones, extraData]);
  const isGated = !sampleData && (event as Record<string, unknown>)?._gated === true;
  const eventVisibility = (resolvedEvent as Record<string, unknown>)?.visibility as string | undefined;
  const isRsvpEnabled = (resolvedEvent as Record<string, unknown>)?.rsvp_enabled === true || (resolvedEvent as Record<string, unknown>)?.rsvpEnabled === true;

  const { data: ticketTypes } = useQuery<any[]>({
    queryKey: ["/api/events", resolvedEvent?.id, "ticket-types"],
    queryFn: async () => {
      if (!resolvedEvent?.id) return [];
      const resp = await fetch(`/api/events/${resolvedEvent.id}/ticket-types`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!resolvedEvent?.id && !sampleData && !isGated,
  });

  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [customResponses, setCustomResponses] = useState<Record<string, any>>({});
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const hasNativeTickets = useMemo(() => {
    if (!ticketTypes || ticketTypes.length === 0) return false;
    return ticketTypes.some((tt: any) => (tt.price_cents || tt.priceCents) && (tt.price_cents || tt.priceCents) > 0);
  }, [ticketTypes]);

  const hasFreeTickets = useMemo(() => {
    if (!ticketTypes || ticketTypes.length === 0) return false;
    return ticketTypes.some((tt: any) => !(tt.price_cents || tt.priceCents) || (tt.price_cents || tt.priceCents) === 0);
  }, [ticketTypes]);

  const allSoldOut = useMemo(() => {
    if (!ticketTypes || ticketTypes.length === 0) return false;
    return ticketTypes.every((tt: any) => {
      const qty = tt.quantity ?? tt.quantity;
      const sold = tt.quantity_sold ?? tt.quantitySold ?? 0;
      return qty !== null && qty !== undefined && sold >= qty;
    });
  }, [ticketTypes]);

  const customFields = useMemo(() => {
    if (!ticketTypes) return [];
    const fields: any[] = [];
    for (const tt of ticketTypes) {
      const cf = tt.custom_fields || tt.customFields;
      if (cf && Array.isArray(cf)) {
        for (const f of cf) {
          if (!fields.find((x: any) => x.name === f.name)) fields.push(f);
        }
      }
    }
    return fields;
  }, [ticketTypes]);

  const handleCheckout = async () => {
    if (!resolvedEvent?.id) return;
    setCheckoutLoading(true);
    try {
      const items = Object.entries(ticketQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));

      if (items.length === 0) {
        toast({ title: "Select at least one ticket", variant: "destructive" });
        setCheckoutLoading(false);
        return;
      }

      const resp = await apiRequest("POST", `/api/events/${resolvedEvent.id}/checkout`, {
        items,
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || undefined,
        customFieldResponses: Object.keys(customResponses).length > 0 ? customResponses : undefined,
        citySlug,
      });
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleFreeRsvp = async () => {
    if (!resolvedEvent?.id) return;
    setCheckoutLoading(true);
    try {
      const selectedTT = Object.entries(ticketQuantities).find(([, qty]) => qty > 0);
      const resp = await apiRequest("POST", `/api/events/${resolvedEvent.id}/rsvp-free`, {
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || undefined,
        ticketTypeId: selectedTT ? selectedTT[0] : undefined,
        customFieldResponses: Object.keys(customResponses).length > 0 ? customResponses : undefined,
      });
      toast({ title: "You're registered!" });
      setShowTicketForm(false);
      setBuyerName(""); setBuyerEmail(""); setBuyerPhone("");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleWaitlistJoin = async () => {
    if (!resolvedEvent?.id || !waitlistName || !waitlistEmail) return;
    try {
      await apiRequest("POST", `/api/events/${resolvedEvent.id}/waitlist`, {
        name: waitlistName,
        email: waitlistEmail,
        phone: waitlistPhone || undefined,
      });
      setWaitlistSubmitted(true);
      toast({ title: "You're on the waitlist!" });
    } catch (err: any) {
      toast({ title: "Failed to join waitlist", description: err.message, variant: "destructive" });
    }
  };

  const { data: myRsvp } = useQuery<{ id: string; response: string } | null>({
    queryKey: ["/api/events", resolvedEvent?.id, "rsvp", "mine"],
    queryFn: async () => {
      if (!resolvedEvent?.id) return null;
      const resp = await fetch(`/api/events/${resolvedEvent.id}/rsvp/mine`);
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: !!resolvedEvent?.id && !sampleData && !isGated,
  });

  const rsvpMutation = useMutation({
    mutationFn: async (response: string) => {
      if (!resolvedEvent?.id) return;
      const resp = await apiRequest("POST", `/api/events/${resolvedEvent.id}/rsvp${inviteToken ? `?invite=${inviteToken}` : ""}`, { response });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", resolvedEvent?.id, "rsvp", "mine"] });
      toast({ title: "RSVP updated" });
    },
    onError: (err: Error) => {
      toast({ title: "RSVP failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: nearbyData } = useNearbyData(
    citySlug,
    (resolvedEvent as Record<string, unknown>)?.latitude,
    (resolvedEvent as Record<string, unknown>)?.longitude,
    "event"
  );

  const eventCityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const eventHubName = "CLT Hub";
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "default") : null;
  usePageMeta({
    title: resolvedEvent ? `${resolvedEvent.title} | Events ${brand?.titleSuffix || `| ${eventHubName}`}` : `Event ${brand?.titleSuffix || `| ${eventHubName}`}`,
    description: resolvedEvent?.description?.slice(0, 160) || `Local event in ${eventCityName} on ${brand?.descriptionBrand || eventHubName}.`,
    canonical: `${window.location.origin}/${citySlug}/events/${slug}`,
    ogImage: `${window.location.origin}/api/og-image/event/${slug}`,
    ogSiteName: brand?.ogSiteName,
  });

  const handleSave = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    if (sampleData) {
      toast({ title: "This is a sample event — saving is disabled during preview." });
      return;
    }
    try {
      await apiRequest("POST", `/api/cities/${citySlug}/saved`, {
        deviceId: getDeviceId(),
        itemType: "EVENT",
        itemId: resolvedEvent?.id,
      });
      setSaved(true);
      toast({ title: "Saved!" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (!sampleData && isLoading) {
    return (
      <DarkPageShell maxWidth="wide">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="aspect-[2/1] w-full rounded-md" />
          <Skeleton className="h-20 w-full" />
        </div>
      </DarkPageShell>
    );
  }

  if (!resolvedEvent) {
    return (
      <DarkPageShell maxWidth="wide">
        <Card className="p-12 text-center">
          <h3 className="font-semibold text-lg mb-1 text-white">Event not found</h3>
          <Link href={`/${citySlug}/events`}>
            <Button variant="ghost" className="mt-2">Back to events</Button>
          </Link>
        </Card>
      </DarkPageShell>
    );
  }

  if (isGated) {
    return (
      <DarkPageShell maxWidth="wide">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={smartBackEvents} data-testid="button-back-gated"><ArrowLeft className="h-4 w-4 mr-1" /> Events</Button>
          </div>
          <Card className="p-12 text-center border-2 border-dashed">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2" data-testid="text-private-event-title">{resolvedEvent.title}</h3>
            <p className="text-muted-foreground mb-4">This is a private event. You need an invitation to view the details.</p>
            {resolvedEvent.startDateTime && (
              <p className="text-sm text-muted-foreground">
                <Calendar className="inline h-4 w-4 mr-1" />
                {format(new Date(resolvedEvent.startDateTime), "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </Card>
        </div>
      </DarkPageShell>
    );
  }

  const start = new Date(resolvedEvent.startDateTime!);
  const end = resolvedEvent.endDateTime ? new Date(resolvedEvent.endDateTime) : null;
  const catColor = liveCategory?.name ? (EVENT_CATEGORY_COLORS[liveCategory.name] || "bg-gray-600") : "";
  const backHref = sampleData ? `/${citySlug}` : `/${citySlug}/events`;

  return (
    <DarkPageShell maxWidth="wide">
    <div className="space-y-6">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Event",
        name: resolvedEvent.title,
        url: `${window.location.origin}/${citySlug}/events/${slug}`,
        ...(resolvedEvent.description && { description: resolvedEvent.description }),
        ...(resolvedEvent.imageUrl && { image: resolvedEvent.imageUrl }),
        startDate: resolvedEvent.startDateTime,
        ...(resolvedEvent.endDateTime && { endDate: resolvedEvent.endDateTime }),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        ...(resolvedEvent.locationName && {
          location: {
            "@type": "Place",
            name: resolvedEvent.locationName,
            address: {
              "@type": "PostalAddress",
              addressLocality: resolvedEvent.city || citySlug.charAt(0).toUpperCase() + citySlug.slice(1),
              addressRegion: resolvedEvent.state || "NC",
              ...(resolvedEvent.address && { streetAddress: resolvedEvent.address }),
              ...(resolvedEvent.zip && { postalCode: resolvedEvent.zip }),
              addressCountry: "US",
            },
            ...(() => {
              const lat = parseFloat(String((resolvedEvent as Record<string, unknown>).latitude ?? ""));
              const lng = parseFloat(String((resolvedEvent as Record<string, unknown>).longitude ?? ""));
              return Number.isFinite(lat) && Number.isFinite(lng) ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {};
            })(),
          },
        }),
        ...(resolvedEvent.costText && {
          offers: {
            "@type": "Offer",
            description: resolvedEvent.costText,
            url: `${window.location.origin}/${citySlug}/events/${slug}`,
            availability: "https://schema.org/InStock",
          },
        }),
        ...(extraData?.organizer && {
          organizer: {
            "@type": "Organization",
            name: extraData.organizer,
          },
        }),
        ...((resolvedEvent as any).hostBusinessId && resolvedPartners.length > 0 && {
          performer: {
            "@type": "Organization",
            name: resolvedPartners[0]?.businessName,
          },
        }),
        isPartOf: {
          "@type": "WebSite",
          name: brand?.jsonLdName || eventHubName,
          alternateName: branding?.brandVariants || [],
          ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
        },
      }} />
      {nearbyData && nearbyData.groups.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Nearby points of interest around ${resolvedEvent.title}`,
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
            <span className="font-semibold">PREVIEW ONLY</span> — This is a fictional event created to preview the experience. No tickets, venues, or dates are actual. Do not attempt to attend.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 text-purple-300" onClick={smartBack} data-testid="link-back-pulse">
          <ArrowLeft className="h-4 w-4" /> Back to Feed
        </Button>
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-1 text-white/50" data-testid="link-back-events">
            {sampleData ? "Home" : "Events"}
          </Button>
        </Link>
        {(resolvedEvent as Record<string, unknown>).latitude && (resolvedEvent as Record<string, unknown>).longitude && (
          <Link href={`/${citySlug}/map`}>
            <Button variant="ghost" size="sm" className="gap-1 text-white/50" data-testid="link-view-on-map">
              <Navigation className="h-3 w-3" /> {t("biz.viewOnMap")}
            </Button>
          </Link>
        )}
      </div>

      {resolvedEvent.imageUrl && (
        <div className="aspect-[2.5/1] overflow-hidden rounded-xl shadow-lg">
          <img src={resolvedEvent.imageUrl} alt={resolvedEvent.title || ""} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold md:text-3xl text-white" data-testid="text-event-title">{localized(locale, resolvedEvent.title, (resolvedEvent as any).titleEs)}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {resolvedEvent.isSponsored && <Badge variant="outline">Sponsored</Badge>}
            {liveCategory && (
              <Link href={`/${citySlug}/${liveCategory.slug}`}>
                <Badge className={`${catColor} text-white border-0 cursor-pointer hover:opacity-80`} data-testid="badge-event-category">
                  <Tag className="h-3 w-3 mr-1" />{liveCategory.name}
                </Badge>
              </Link>
            )}
            {liveNeighborhood && (
              <Link href={`/${citySlug}/neighborhoods/${liveNeighborhood.slug}`}>
                <Badge variant="outline" className="gap-1 cursor-pointer hover:text-white hover:border-white/40" data-testid="badge-event-neighborhood">
                  <MapPin className="h-3 w-3" />{liveNeighborhood.name}
                </Badge>
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleSave} data-testid="button-save-event">
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </Button>
          <ShareMenu title={resolvedEvent.title || ""} type="event" slug={slug} eventId={resolvedEvent.id} />
        </div>
      </div>

      {isRsvpEnabled && !sampleData && (
        <Card className="p-4" data-testid="section-event-rsvp">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {myRsvp ? (
              <>
                <Badge className={`text-xs ${myRsvp.response === "attending" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : myRsvp.response === "maybe" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`} data-testid="badge-my-rsvp">
                  {myRsvp.response === "attending" ? "Going" : myRsvp.response === "maybe" ? "Maybe" : "Not Going"}
                </Badge>
                {myRsvp.response !== "attending" && (
                  <Button size="sm" onClick={() => rsvpMutation.mutate("attending")} disabled={rsvpMutation.isPending} data-testid="button-rsvp-attending">
                    Attend
                  </Button>
                )}
                {myRsvp.response !== "maybe" && (
                  <Button size="sm" variant="outline" onClick={() => rsvpMutation.mutate("maybe")} disabled={rsvpMutation.isPending} data-testid="button-rsvp-maybe">
                    Maybe
                  </Button>
                )}
                {myRsvp.response !== "declined" && (
                  <Button size="sm" variant="outline" onClick={() => rsvpMutation.mutate("declined")} disabled={rsvpMutation.isPending} data-testid="button-rsvp-decline">
                    Decline
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => {
                  if (!user) { setShowAuthDialog(true); return; }
                  rsvpMutation.mutate("attending");
                }} disabled={rsvpMutation.isPending} data-testid="button-rsvp-attend">
                  <UserCheck className="h-4 w-4 mr-1" /> Attend
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (!user) { setShowAuthDialog(true); return; }
                  rsvpMutation.mutate("maybe");
                }} disabled={rsvpMutation.isPending} data-testid="button-rsvp-maybe-new">
                  Maybe
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (!user) { setShowAuthDialog(true); return; }
                  rsvpMutation.mutate("declined");
                }} disabled={rsvpMutation.isPending} data-testid="button-rsvp-decline-new">
                  Decline
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {ticketTypes && ticketTypes.length > 0 && !sampleData && !isGated && (
        <Card className="p-4 space-y-4" data-testid="section-event-tickets">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Ticket className="h-4 w-4" /> Tickets
            </h3>
            {allSoldOut && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-sold-out">Sold Out</Badge>
            )}
          </div>

          {!allSoldOut && (
            <>
              <div className="space-y-3">
                {ticketTypes.map((tt: any) => {
                  const priceCents = tt.price_cents ?? tt.priceCents ?? 0;
                  const qty = tt.quantity;
                  const sold = tt.quantity_sold ?? tt.quantitySold ?? 0;
                  const remaining = qty != null ? qty - sold : null;
                  const isSoldOut = remaining !== null && remaining <= 0;
                  const currentQty = ticketQuantities[tt.id] || 0;
                  const maxQty = remaining !== null ? Math.min(remaining, 10) : 10;

                  return (
                    <div key={tt.id} className={`flex items-center justify-between p-3 rounded-lg border ${isSoldOut ? "opacity-50" : "border-border"}`} data-testid={`ticket-type-${tt.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-white">{tt.name}</p>
                        {tt.description && <p className="text-xs text-muted-foreground mt-0.5">{tt.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold text-purple-400" data-testid={`text-price-${tt.id}`}>
                            {priceCents > 0 ? `$${(priceCents / 100).toFixed(2)}` : "Free"}
                          </span>
                          {remaining !== null && remaining > 0 && remaining <= 10 && (
                            <span className="text-[10px] text-amber-400">{remaining} left</span>
                          )}
                          {isSoldOut && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Sold Out</Badge>}
                        </div>
                      </div>
                      {!isSoldOut && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={currentQty <= 0}
                            onClick={() => setTicketQuantities(prev => ({ ...prev, [tt.id]: Math.max(0, (prev[tt.id] || 0) - 1) }))}
                            data-testid={`button-qty-minus-${tt.id}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium text-white" data-testid={`text-qty-${tt.id}`}>{currentQty}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={currentQty >= maxQty}
                            onClick={() => setTicketQuantities(prev => ({ ...prev, [tt.id]: Math.min(maxQty, (prev[tt.id] || 0) + 1) }))}
                            data-testid={`button-qty-plus-${tt.id}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {Object.values(ticketQuantities).some(q => q > 0) && !showTicketForm && (
                <Button className="w-full" onClick={() => setShowTicketForm(true)} data-testid="button-continue-checkout">
                  Continue to Checkout
                </Button>
              )}

              {showTicketForm && (
                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <Label htmlFor="buyerName" className="text-xs text-muted-foreground">Full Name *</Label>
                    <Input id="buyerName" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Your full name" data-testid="input-buyer-name" />
                  </div>
                  <div>
                    <Label htmlFor="buyerEmail" className="text-xs text-muted-foreground">Email *</Label>
                    <Input id="buyerEmail" type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} placeholder="you@email.com" data-testid="input-buyer-email" />
                  </div>
                  <div>
                    <Label htmlFor="buyerPhone" className="text-xs text-muted-foreground">Phone (optional)</Label>
                    <Input id="buyerPhone" type="tel" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-buyer-phone" />
                  </div>

                  {customFields.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Additional Information</p>
                      {customFields.map((field: any) => (
                        <div key={field.name}>
                          <Label className="text-xs text-muted-foreground">
                            {field.label || field.name} {field.required && "*"}
                          </Label>
                          {(field.type === "select" || field.type === "dropdown") && field.options ? (
                            <select
                              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                              value={customResponses[field.name] || ""}
                              onChange={e => setCustomResponses(prev => ({ ...prev, [field.name]: e.target.value }))}
                              data-testid={`select-custom-${field.name}`}
                            >
                              <option value="">Select...</option>
                              {field.options.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === "checkbox" ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                checked={!!customResponses[field.name]}
                                onChange={e => setCustomResponses(prev => ({ ...prev, [field.name]: e.target.checked }))}
                                className="h-4 w-4"
                                data-testid={`checkbox-custom-${field.name}`}
                              />
                              <span className="text-sm text-muted-foreground">{field.label || field.name}</span>
                            </div>
                          ) : field.type === "textarea" ? (
                            <Textarea
                              value={customResponses[field.name] || ""}
                              onChange={e => setCustomResponses(prev => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.label || field.name}
                              data-testid={`textarea-custom-${field.name}`}
                            />
                          ) : (
                            <Input
                              value={customResponses[field.name] || ""}
                              onChange={e => setCustomResponses(prev => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.label || field.name}
                              data-testid={`input-custom-${field.name}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const totalCents = Object.entries(ticketQuantities).reduce((sum, [id, qty]) => {
                      const tt = ticketTypes?.find((t: any) => t.id === id);
                      const price = tt ? (tt.price_cents ?? tt.priceCents ?? 0) : 0;
                      return sum + price * qty;
                    }, 0);
                    const totalQty = Object.values(ticketQuantities).reduce((s, q) => s + q, 0);
                    return (
                      <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                        <span className="text-muted-foreground">{totalQty} ticket{totalQty !== 1 ? "s" : ""}</span>
                        <span className="font-semibold text-white" data-testid="text-total-price">
                          {totalCents > 0 ? `$${(totalCents / 100).toFixed(2)}` : "Free"}
                        </span>
                      </div>
                    );
                  })()}

                  {(() => {
                    const selectedTotal = Object.entries(ticketQuantities).reduce((sum, [id, qty]) => {
                      if (qty <= 0) return sum;
                      const tt = ticketTypes?.find((t: any) => t.id === id);
                      return sum + (tt ? (tt.price_cents ?? tt.priceCents ?? 0) : 0) * qty;
                    }, 0);
                    const isPaidSelection = selectedTotal > 0;
                    return (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowTicketForm(false)} className="flex-1" data-testid="button-back-tickets">
                          Back
                        </Button>
                        {isPaidSelection ? (
                          <Button
                            onClick={handleCheckout}
                            disabled={checkoutLoading || !buyerName || !buyerEmail}
                            className="flex-1"
                            data-testid="button-checkout"
                          >
                            {checkoutLoading ? "Processing..." : "Pay & Reserve"}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleFreeRsvp}
                            disabled={checkoutLoading || !buyerName || !buyerEmail}
                            className="flex-1"
                            data-testid="button-free-register"
                          >
                            {checkoutLoading ? "Processing..." : "Register (Free)"}
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {allSoldOut && !waitlistSubmitted && (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">This event is sold out. Join the waitlist to be notified if spots open up.</p>
              <Input value={waitlistName} onChange={e => setWaitlistName(e.target.value)} placeholder="Your name" data-testid="input-waitlist-name" />
              <Input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="Email address" type="email" data-testid="input-waitlist-email" />
              <Input value={waitlistPhone} onChange={e => setWaitlistPhone(e.target.value)} placeholder="Phone (optional)" type="tel" data-testid="input-waitlist-phone" />
              <Button className="w-full" onClick={handleWaitlistJoin} disabled={!waitlistName || !waitlistEmail} data-testid="button-join-waitlist">
                <Clock className="h-4 w-4 mr-1" /> Join Waitlist
              </Button>
            </div>
          )}

          {waitlistSubmitted && (
            <div className="text-center py-2">
              <Badge variant="outline" className="text-green-400 border-green-500/30">
                You're on the waitlist!
              </Badge>
            </div>
          )}
        </Card>
      )}

      {resolvedEvent && !sampleData && (
        <Card className="p-4" data-testid="section-add-to-calendar">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-white">Add to Calendar</span>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                if (resolvedEvent?.id) window.open(`/api/events/${resolvedEvent.id}/ics`, "_blank");
              }}
              data-testid="button-cal-ics"
            >
              <Download className="h-3 w-3 mr-1" /> .ics
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                if (!resolvedEvent) return;
                const start = new Date(resolvedEvent.startDateTime);
                const end = resolvedEvent.endDateTime ? new Date(resolvedEvent.endDateTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
                const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
                const loc = [resolvedEvent.locationName, resolvedEvent.address, resolvedEvent.city, resolvedEvent.state].filter(Boolean).join(", ");
                window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(resolvedEvent.title)}&dates=${fmt(start)}/${fmt(end)}&location=${encodeURIComponent(loc)}&details=${encodeURIComponent((resolvedEvent.description || "").substring(0, 200))}`, "_blank");
              }}
              data-testid="button-cal-google"
            >
              Google
            </Button>
          </div>
        </Card>
      )}

      {resolvedPartners.length > 0 && (() => {
        const hasHost = resolvedPartners.some((p: any) => p.isHost);
        const label = hasHost ? "Hosted by" : "Supported in the Hub by";
        return (
          <div data-testid="section-event-partners">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">{label}</h3>
            <div className="flex flex-wrap gap-3">
              {resolvedPartners.map((partner: any) => (
                <Link key={partner.businessSlug} href={`/${citySlug}/presence/${partner.businessSlug}`}>
                  <Card className="p-3 flex items-center gap-3 cursor-pointer hover-elevate" data-testid={`link-partner-${partner.businessSlug}`}>
                    <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      {partner.imageUrl ? (
                        <img src={partner.imageUrl} alt={partner.businessName} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="font-medium text-sm">{partner.businessName}</span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {eventSponsors && eventSponsors.length > 0 && (
        <div data-testid="section-event-sponsors">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase flex items-center gap-1">
            <Award className="h-3 w-3" /> Event Sponsors
          </h3>
          <div className="flex flex-wrap gap-3">
            {eventSponsors.map((sponsor) => (
              <Link key={sponsor.slug} href={`/${citySlug}/presence/${sponsor.slug}`}>
                <Card
                  className="p-3 flex items-center gap-3 cursor-pointer hover-elevate"
                  data-testid={`link-sponsor-${sponsor.slug}`}
                  onClick={() => {
                    apiRequest("POST", "/api/track-share", { type: "business", slug: sponsor.slug, channel: "copy" }).catch(() => {});
                  }}
                >
                  <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {(sponsor.micrositeLogo || sponsor.imageUrl) ? (
                      <img src={sponsor.micrositeLogo || sponsor.imageUrl!} alt={sponsor.name} className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{sponsor.name}</span>
                    <span className="text-[10px] text-muted-foreground">Event Sponsor</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <EventSponsorAdSlot citySlug={citySlug} page="event-detail" />

      {backofficeSponsors && backofficeSponsors.length > 0 && (
        <div data-testid="section-backoffice-sponsors">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase flex items-center gap-1">
            <Star className="h-3 w-3" /> Sponsors
          </h3>
          <div className="flex flex-wrap gap-3">
            {backofficeSponsors.map((s) => (
              <Card key={s.id} className="p-3 flex items-center gap-3" data-testid={`card-public-sponsor-${s.id}`}>
                <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <Star className="h-5 w-5 text-amber-400" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-sm truncate">{s.name}</span>
                  <Badge variant="secondary" className="text-[10px] w-fit capitalize">{s.tier.replace(/_/g, " ")} sponsor</Badge>
                </div>
                {s.websiteUrl && (
                  <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0">
                    <Globe className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {backofficeVendors && backofficeVendors.length > 0 && (
        <div data-testid="section-backoffice-vendors">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase flex items-center gap-1">
            <Store className="h-3 w-3" /> Vendors
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {backofficeVendors.map((v) => (
              <Card key={v.id} className="p-3 flex items-center gap-3" data-testid={`card-public-vendor-${v.id}`}>
                <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {v.logoUrl ? (
                    <img src={v.logoUrl} alt={v.name} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-sm truncate">{v.name}</span>
                  {v.category && <span className="text-[10px] text-muted-foreground">{v.category}</span>}
                  {v.boothLabel && <span className="text-[10px] text-muted-foreground">Booth: {v.boothLabel}</span>}
                </div>
                {v.websiteUrl && (
                  <a href={v.websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0">
                    <Globe className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {resolvedEvent.description && (
            <Card className="p-5">
              <h2 className="font-semibold mb-3 text-white">{t("events.aboutThisEvent")}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{localized(locale, resolvedEvent.description, (resolvedEvent as any).descriptionEs)}</p>
            </Card>
          )}

          {eventStory && (
            <Link href={`/${citySlug}/news/${eventStory.local_article_slug}`}>
              <Card className="p-5 cursor-pointer hover:border-purple-500/40 transition-colors" data-testid="link-event-story">
                <div className="flex items-start gap-4">
                  {eventStory.image_url && (
                    <div className="w-20 h-14 rounded-md overflow-hidden flex-shrink-0">
                      <img src={eventStory.image_url} alt={eventStory.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="h-3 w-3 text-purple-400" />
                      <span className="text-[10px] uppercase tracking-wide text-purple-400 font-semibold">{eventStory.source_name}</span>
                    </div>
                    <h3 className="font-semibold text-sm text-white line-clamp-2 mb-1">{eventStory.title}</h3>
                    {eventStory.rewritten_summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{eventStory.rewritten_summary}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-purple-400 shrink-0 mt-1" />
                </div>
              </Card>
            </Link>
          )}

          {extraData?.tags && extraData.tags.length > 0 && (
            <Card className="p-5" data-testid="section-event-tags">
              <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {extraData.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs" data-testid={`badge-tag-${tag}`}>
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-white">Event Details</h3>
            <div className="flex items-start gap-3 text-sm">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <div className="font-medium">{format(start, "EEEE, MMMM d, yyyy")}</div>
                <div className="text-muted-foreground">
                  {format(start, "h:mm a")}
                  {end && ` – ${format(end, "h:mm a")}`}
                </div>
              </div>
            </div>
            {resolvedEvent.locationName && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <div className="font-medium">{resolvedEvent.locationName}</div>
                  {resolvedEvent.address && (
                    <div className="text-muted-foreground">
                      {[resolvedEvent.address, resolvedEvent.city, resolvedEvent.state, resolvedEvent.zip].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            )}
            {resolvedEvent.costText && (
              <div className="flex items-center gap-3 text-sm">
                <Ticket className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{resolvedEvent.costText}</span>
              </div>
            )}
            {resolvedEvent?.id && !sampleData && (
              <a href={`/api/events/${resolvedEvent.id}/calendar.ics`} download className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors cursor-pointer pt-1" data-testid="link-download-ics">
                <Download className="h-4 w-4 shrink-0" />
                <span>Add to Calendar (.ics)</span>
              </a>
            )}
            {resolvedEvent.address && (resolvedEvent as Record<string, unknown>).latitude && (resolvedEvent as Record<string, unknown>).longitude && (
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Car className="h-3 w-3" /> {locale === "es" ? "Pide un viaje" : "Get a Ride"}
                </div>
                <div className="flex gap-2">
                  <a
                    href={buildUberRideLink(
                      Number((resolvedEvent as Record<string, unknown>).latitude),
                      Number((resolvedEvent as Record<string, unknown>).longitude),
                      resolvedEvent.locationName || resolvedEvent.title || "Event",
                      getAffiliateId(affiliateConfigs || [], "uber")
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (resolvedEvent?.id) trackIntelligenceEvent({ citySlug, entityType: "EVENT", entityId: resolvedEvent.id, eventType: "RIDE_CLICK", metadata: { platform: "uber" } });
                    }}
                    className="flex-1"
                    data-testid="button-ride-uber"
                  >
                    <Button variant="outline" size="sm" className="w-full text-xs">Uber</Button>
                  </a>
                  <a
                    href={buildLyftRideLink(
                      Number((resolvedEvent as Record<string, unknown>).latitude),
                      Number((resolvedEvent as Record<string, unknown>).longitude),
                      getAffiliateId(affiliateConfigs || [], "lyft")
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (resolvedEvent?.id) trackIntelligenceEvent({ citySlug, entityType: "EVENT", entityId: resolvedEvent.id, eventType: "RIDE_CLICK", metadata: { platform: "lyft" } });
                    }}
                    className="flex-1"
                    data-testid="button-ride-lyft"
                  >
                    <Button variant="outline" size="sm" className="w-full text-xs">Lyft</Button>
                  </a>
                </div>
              </div>
            )}
          </Card>

          {extraData?.organizer && (
            <Card className="p-5 space-y-2" data-testid="card-organizer">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Organizer</h3>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{extraData.organizer}</span>
              </div>
            </Card>
          )}

          <SidebarAd citySlug={citySlug} page="event-detail" />
        </div>
      </div>

      {resolvedEvent?.id && !sampleData && <ArticleMentionsSection eventId={resolvedEvent.id} />}

      {relatedBusinesses && relatedBusinesses.length > 0 && (
        <Card className="p-5" data-testid="section-related-businesses">
          <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase flex items-center gap-1">
            <Store className="h-3 w-3" /> Related Businesses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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


      {resolvedEvent?.id && !sampleData && !isGated && (
        <EventReviewsSection eventId={resolvedEvent.id} lifecycleStatus={(resolvedEvent as any).lifecycleStatus || (resolvedEvent as any).lifecycle_status} user={user} onAuthRequired={() => setShowAuthDialog(true)} />
      )}

      {resolvedEvent?.id && !sampleData && !isGated && (
        <EventCommentsSection eventId={resolvedEvent.id} user={user} onAuthRequired={() => setShowAuthDialog(true)} />
      )}

      {resolvedEvent?.id && !sampleData && !isGated && (
        <EventEngagementSection eventId={resolvedEvent.id} user={user} onAuthRequired={() => setShowAuthDialog(true)} />
      )}

      {resolvedEvent?.id && !sampleData && !isGated && (resolvedEvent as any).eventClaimStatus === "UNCLAIMED" && (
        <Card className="p-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20" data-testid="section-claim-event">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1" data-testid="text-claim-prompt-title">Are you the organizer?</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Claim this event to manage details, track RSVPs, and engage with attendees directly.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                onClick={() => {
                  window.location.href = `/${citySlug}/claim-event/self?eventId=${resolvedEvent.id}`;
                }}
                data-testid="button-claim-this-event"
              >
                <Shield className="h-3.5 w-3.5 mr-1" />
                Claim This Event
              </Button>
            </div>
          </div>
        </Card>
      )}

      {resolvedEvent?.id && !sampleData && !isGated && (
        <EventIntakeForms eventId={resolvedEvent.id} />
      )}

      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        defaultTab="register"
      />
    </div>
    </DarkPageShell>
  );
}

function ArticleMentionsSection({ eventId }: { eventId: string }) {
  const { data: mentions } = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "mentions"],
    queryFn: async () => {
      const resp = await fetch(`/api/events/${eventId}/mentions`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  if (!mentions || mentions.length === 0) return null;

  return (
    <Card className="p-5" data-testid="section-article-mentions">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase flex items-center gap-1">
        <FileText className="h-3 w-3" /> Press & Mentions
      </h3>
      <div className="space-y-2">
        {mentions.map((m: any) => (
          <div key={m.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30" data-testid={`mention-${m.id}`}>
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {m.url ? (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-primary transition-colors">
                  {m.title || "Article"}
                </a>
              ) : (
                <span className="text-sm font-medium">{m.title || "Mention"}</span>
              )}
              {m.source_name && <p className="text-xs text-muted-foreground mt-0.5">{m.source_name}</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EventReviewsSection({ eventId, lifecycleStatus, user, onAuthRequired }: { eventId: string; lifecycleStatus?: string; user: any; onAuthRequired: () => void }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const { data: aggregate } = useQuery<{ reviewCount: number; avgRating: number }>({
    queryKey: ["/api/events", eventId, "reviews", "aggregate"],
    queryFn: async () => {
      const resp = await fetch(`/api/events/${eventId}/reviews/aggregate`);
      if (!resp.ok) return { reviewCount: 0, avgRating: 0 };
      return resp.json();
    },
  });

  const { data: reviews } = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "reviews"],
    queryFn: async () => {
      const resp = await fetch(`/api/events/${eventId}/reviews`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/events/${eventId}/reviews`, { rating, comment: reviewText || null });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "reviews", "aggregate"] });
      toast({ title: "Review submitted! It will appear after approval." });
      setRating(0);
      setReviewText("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isCompleted = lifecycleStatus === "completed";
  const hasReviews = (aggregate?.reviewCount || 0) > 0;

  if (!isCompleted && !hasReviews) return null;

  return (
    <Card className="p-5 space-y-4" data-testid="section-event-reviews">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-400" /> Reviews & Ratings
      </h3>

      {hasReviews && (
        <div className="flex items-center gap-3" data-testid="text-aggregate-rating">
          <span className="text-2xl font-bold text-white">{aggregate!.avgRating.toFixed(1)}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`h-4 w-4 ${s <= Math.round(aggregate!.avgRating) ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
            ))}
          </div>
          <span className="text-sm text-white/50">({aggregate!.reviewCount} review{aggregate!.reviewCount !== 1 ? "s" : ""})</span>
        </div>
      )}

      {reviews && reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <div key={r.id} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2" data-testid={`review-${r.id}`}>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                  ))}
                </div>
                <span className="text-xs text-white/50">{r.display_name || "Anonymous"}</span>
                <span className="text-xs text-white/30">·</span>
                <span className="text-xs text-white/30">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.comment && <p className="text-sm text-white/70">{r.comment}</p>}
              {r.owner_response && (
                <div className="pl-4 border-l-2 border-purple-500/30 mt-2">
                  <p className="text-xs text-purple-300 font-medium">Organizer Response</p>
                  <p className="text-sm text-white/60">{r.owner_response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isCompleted && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <p className="text-sm text-white/60">How was this event?</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => {
                  if (!user) { onAuthRequired(); return; }
                  setRating(s);
                }}
                data-testid={`button-rate-${s}`}
              >
                <Star className={`h-6 w-6 cursor-pointer transition-colors ${s <= (hoverRating || rating) ? "fill-amber-400 text-amber-400" : "text-white/20 hover:text-white/40"}`} />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience (optional)"
                rows={3}
                className="bg-white/5 border-white/10 text-white"
                data-testid="input-review-text"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!user) { onAuthRequired(); return; }
                  submitMutation.mutate();
                }}
                disabled={submitMutation.isPending}
                data-testid="button-submit-review"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function EventCommentsSection({ eventId, user, onAuthRequired }: { eventId: string; user: any; onAuthRequired: () => void }) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  const { data: comments } = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "comments"],
    queryFn: async () => {
      const resp = await fetch(`/api/events/${eventId}/comments`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/events/${eventId}/comments`, { commentText });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "comments"] });
      toast({ title: "Comment posted!" });
      setCommentText("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `/api/events/${eventId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "comments"] });
      toast({ title: "Comment removed" });
    },
  });

  const ROLE_BADGES: Record<string, { label: string; className: string }> = {
    attendee: { label: "Attendee", className: "bg-green-500/20 text-green-300 border-green-500/30" },
    sponsor: { label: "Sponsor", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    community_member: { label: "Community Member", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  };

  const commentCount = comments?.length || 0;

  return (
    <Card className="p-5 space-y-4" data-testid="section-event-comments">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setShowComments(!showComments)}
        data-testid="button-toggle-comments"
      >
        <h3 className="font-semibold text-white flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-purple-400" /> Discussion ({commentCount})
        </h3>
        {showComments ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
      </button>

      {showComments && (
        <>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={user ? "Share your thoughts about this event..." : "Sign in to comment"}
                rows={2}
                className="bg-white/5 border-white/10 text-white flex-1"
                disabled={!user}
                data-testid="input-comment-text"
              />
            </div>
            {commentText.trim() && (
              <Button
                size="sm"
                onClick={() => {
                  if (!user) { onAuthRequired(); return; }
                  postMutation.mutate();
                }}
                disabled={postMutation.isPending || !commentText.trim()}
                data-testid="button-post-comment"
              >
                <Send className="h-3 w-3 mr-1" />
                {postMutation.isPending ? "Posting..." : "Post Comment"}
              </Button>
            )}
          </div>

          {comments && comments.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              {comments.map((c: any) => {
                const badge = ROLE_BADGES[c.role_badge] || ROLE_BADGES.community_member;
                return (
                  <div key={c.id} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2" data-testid={`comment-${c.id}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="h-3 w-3 text-purple-300" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-white">{c.display_name || "User"}</span>
                      <Badge variant="outline" className={`text-[10px] ${badge.className}`} data-testid={`badge-role-${c.id}`}>
                        {badge.label}
                      </Badge>
                      <span className="text-xs text-white/30 ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
                      {user && c.user_id === (user as any).id && (
                        <button
                          onClick={() => deleteMutation.mutate(c.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                          data-testid={`button-delete-comment-${c.id}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-white/70">{c.comment_text}</p>
                    {c.photo_urls && c.photo_urls.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {c.photo_urls.map((url: string, i: number) => (
                          <img key={i} src={url} alt="" className="h-20 w-20 rounded-md object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function EventEngagementSection({ eventId, user, onAuthRequired }: { eventId: string; user: any; onAuthRequired: () => void }) {
  const { toast } = useToast();

  const { data: nominations } = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "nominations"],
    queryFn: async () => {
      const resp = await fetch(`/api/events/${eventId}/nominations`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const { data: giveaways } = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "giveaways"],
    queryFn: async () => {
      const resp = await fetch(`/api/events/${eventId}/giveaways`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ nominationId, label }: { nominationId: string; label: string }) => {
      await apiRequest("POST", `/api/events/${eventId}/nominations/${nominationId}/vote`, { nomineeLabel: label });
    },
    onSuccess: () => toast({ title: "Vote recorded!" }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const enterMutation = useMutation({
    mutationFn: async (giveawayId: string) => {
      await apiRequest("POST", `/api/events/${eventId}/giveaways/${giveawayId}/enter`);
    },
    onSuccess: () => toast({ title: "You're entered! Good luck!" }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const hasNominations = nominations && nominations.length > 0;
  const hasGiveaways = giveaways && giveaways.length > 0;
  if (!hasNominations && !hasGiveaways) return null;

  return (
    <div className="space-y-4" data-testid="section-event-engagement">
      {hasNominations && (
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" /> Vote & Nominate
          </h3>
          <div className="space-y-3">
            {nominations!.map((nom: any) => (
              <div key={nom.id} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2" data-testid={`nomination-${nom.id}`}>
                <h4 className="text-sm font-medium text-white">{nom.category_name}</h4>
                {nom.description && <p className="text-xs text-white/50">{nom.description}</p>}
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter your nominee..."
                    className="bg-white/5 border-white/10 text-white text-sm h-8 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                        if (!user) { onAuthRequired(); return; }
                        voteMutation.mutate({ nominationId: nom.id, label: (e.target as HTMLInputElement).value });
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                    data-testid={`input-nomination-${nom.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {hasGiveaways && (
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Gift className="h-4 w-4 text-purple-400" /> Giveaways
          </h3>
          <div className="space-y-3">
            {giveaways!.map((g: any) => (
              <div key={g.id} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2" data-testid={`giveaway-${g.id}`}>
                <h4 className="text-sm font-medium text-white">{g.title}</h4>
                {g.description && <p className="text-xs text-white/50">{g.description}</p>}
                {g.prize_description && <p className="text-xs text-amber-300">Prize: {g.prize_description}</p>}
                {g.winner_id ? (
                  <Badge variant="outline" className="text-amber-300 border-amber-500/30">Winner drawn!</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      if (!user) { onAuthRequired(); return; }
                      enterMutation.mutate(g.id);
                    }}
                    disabled={enterMutation.isPending}
                    data-testid={`button-enter-giveaway-${g.id}`}
                  >
                    <Gift className="h-3 w-3 mr-1" /> Enter Giveaway
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function EventIntakeForms({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);

  const [sponsorForm, setSponsorForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [vendorForm, setVendorForm] = useState({ name: "", email: "", phone: "", businessName: "", category: "", description: "" });

  const sponsorMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/events/${eventId}/sponsor-interest`, {
        name: sponsorForm.company || sponsorForm.name,
        contactName: sponsorForm.name,
        contactEmail: sponsorForm.email,
        contactPhone: sponsorForm.phone || undefined,
        notes: sponsorForm.message || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Sponsor interest submitted! We'll be in touch." });
      setSponsorForm({ name: "", email: "", phone: "", company: "", message: "" });
      setShowSponsorForm(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const vendorMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/events/${eventId}/vendor-application`, {
        name: vendorForm.businessName || vendorForm.name,
        contactName: vendorForm.name,
        contactEmail: vendorForm.email,
        contactPhone: vendorForm.phone || undefined,
        category: vendorForm.category || undefined,
        description: vendorForm.description || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Vendor application submitted! We'll review and get back to you." });
      setVendorForm({ name: "", email: "", phone: "", businessName: "", category: "", description: "" });
      setShowVendorForm(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3" data-testid="section-intake-forms">
      <Card className="overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          onClick={() => setShowSponsorForm(!showSponsorForm)}
          data-testid="button-toggle-sponsor-interest"
        >
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-sm">Interested in Sponsoring?</span>
          </div>
          {showSponsorForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showSponsorForm && (
          <div className="px-4 pb-4 space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Your Name</Label>
                <Input value={sponsorForm.name} onChange={(e) => setSponsorForm((f) => ({ ...f, name: e.target.value }))} data-testid="input-sponsor-interest-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={sponsorForm.email} onChange={(e) => setSponsorForm((f) => ({ ...f, email: e.target.value }))} data-testid="input-sponsor-interest-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={sponsorForm.phone} onChange={(e) => setSponsorForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-sponsor-interest-phone" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Company / Organization</Label>
                <Input value={sponsorForm.company} onChange={(e) => setSponsorForm((f) => ({ ...f, company: e.target.value }))} data-testid="input-sponsor-interest-company" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Message (optional)</Label>
              <Textarea value={sponsorForm.message} onChange={(e) => setSponsorForm((f) => ({ ...f, message: e.target.value }))} rows={2} data-testid="input-sponsor-interest-message" />
            </div>
            <Button
              size="sm"
              onClick={() => sponsorMutation.mutate()}
              disabled={!sponsorForm.name || !sponsorForm.email || sponsorMutation.isPending}
              data-testid="button-submit-sponsor-interest"
            >
              <Send className="h-3 w-3 mr-1" />
              {sponsorMutation.isPending ? "Submitting..." : "Submit Interest"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          onClick={() => setShowVendorForm(!showVendorForm)}
          data-testid="button-toggle-vendor-application"
        >
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-sm">Apply as a Vendor</span>
          </div>
          {showVendorForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showVendorForm && (
          <div className="px-4 pb-4 space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Contact Name</Label>
                <Input value={vendorForm.name} onChange={(e) => setVendorForm((f) => ({ ...f, name: e.target.value }))} data-testid="input-vendor-app-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={vendorForm.email} onChange={(e) => setVendorForm((f) => ({ ...f, email: e.target.value }))} data-testid="input-vendor-app-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={vendorForm.phone} onChange={(e) => setVendorForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-vendor-app-phone" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Business Name</Label>
                <Input value={vendorForm.businessName} onChange={(e) => setVendorForm((f) => ({ ...f, businessName: e.target.value }))} data-testid="input-vendor-app-business" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category (e.g. Food, Crafts, Art)</Label>
              <Input value={vendorForm.category} onChange={(e) => setVendorForm((f) => ({ ...f, category: e.target.value }))} data-testid="input-vendor-app-category" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description of what you'd bring</Label>
              <Textarea value={vendorForm.description} onChange={(e) => setVendorForm((f) => ({ ...f, description: e.target.value }))} rows={3} data-testid="input-vendor-app-description" />
            </div>
            <Button
              size="sm"
              onClick={() => vendorMutation.mutate()}
              disabled={!vendorForm.name || !vendorForm.email || !vendorForm.businessName || vendorMutation.isPending}
              data-testid="button-submit-vendor-application"
            >
              <Send className="h-3 w-3 mr-1" />
              {vendorMutation.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        )}
      </Card>
      <NeighborhoodContext
        citySlug={citySlug}
        lat={(resolvedEvent as Record<string, unknown>).latitude}
        lng={(resolvedEvent as Record<string, unknown>).longitude}
        sourceType="event"
      />
    </div>
  );
}
