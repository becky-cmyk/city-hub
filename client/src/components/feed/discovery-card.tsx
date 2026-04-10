import { useLocation } from "wouter";
import { Lightbulb, Search, MapPin, TrendingUp, Users, Clock, Compass } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface SampleSearch {
  labelKey: TranslationKey;
  query: string;
}

interface DiscoveryCardConfig {
  id: string;
  typeLabelKey: TranslationKey;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  sampleSearches: SampleSearch[];
  ctaLabelKey?: TranslationKey;
  ctaQuery?: string;
  icon: typeof Lightbulb;
  accent: string;
}

const DISCOVERY_CARDS: DiscoveryCardConfig[] = [
  {
    id: "did-you-know",
    typeLabelKey: "discovery.typeDidYouKnow",
    titleKey: "discovery.didYouKnow",
    bodyKey: "discovery.didYouKnowBody",
    sampleSearches: [
      { labelKey: "discovery.search.eventsWeekendCharlotte", query: "events this weekend in Charlotte" },
      { labelKey: "discovery.search.liveMusicNoda", query: "live music tonight in NoDa" },
      { labelKey: "discovery.search.networkingNearMe", query: "networking events near me" },
      { labelKey: "discovery.search.familyWeekend", query: "family things to do this weekend" },
    ],
    ctaLabelKey: "discovery.trySearch",
    ctaQuery: "events this weekend in Charlotte",
    icon: Lightbulb,
    accent: "from-amber-500/20 to-orange-500/20",
  },
  {
    id: "pulse-tip",
    typeLabelKey: "discovery.typePulseTip",
    titleKey: "discovery.pulseTip",
    bodyKey: "discovery.pulseTipBody",
    sampleSearches: [
      { labelKey: "discovery.search.networkTonight", query: "where can I network tonight" },
      { labelKey: "discovery.search.festivalsWeekend", query: "what festivals are happening this weekend" },
      { labelKey: "discovery.search.patioRestaurants", query: "what restaurants have patios in Charlotte" },
    ],
    icon: Search,
    accent: "from-purple-500/20 to-indigo-500/20",
  },
  {
    id: "explore-near-you",
    typeLabelKey: "discovery.typeExploreNearYou",
    titleKey: "discovery.exploreNearYou",
    bodyKey: "discovery.exploreNearYouBody",
    sampleSearches: [
      { labelKey: "discovery.search.eventsSouthEnd", query: "events in South End" },
      { labelKey: "discovery.search.restaurantsBallantyne", query: "restaurants in Ballantyne" },
      { labelKey: "discovery.search.thingsMatthews", query: "things to do in Matthews" },
      { labelKey: "discovery.search.businessesPlazaMidwood", query: "businesses in Plaza Midwood" },
    ],
    icon: MapPin,
    accent: "from-emerald-500/20 to-teal-500/20",
  },
  {
    id: "trending-searches",
    typeLabelKey: "discovery.typeTrending",
    titleKey: "discovery.trendingSearches",
    bodyKey: "discovery.trendingSearchesBody",
    sampleSearches: [
      { labelKey: "discovery.search.liveMusicTonight", query: "live music tonight" },
      { labelKey: "discovery.search.networkingCharlotte", query: "Charlotte networking events" },
      { labelKey: "discovery.search.foodTrucksWeekend", query: "food trucks this weekend" },
      { labelKey: "discovery.search.newRestaurants", query: "new restaurants in Charlotte" },
    ],
    icon: TrendingUp,
    accent: "from-pink-500/20 to-rose-500/20",
  },
  {
    id: "community-discovery",
    typeLabelKey: "discovery.typeCommunity",
    titleKey: "discovery.communityDiscovery",
    bodyKey: "discovery.communityDiscoveryBody",
    sampleSearches: [
      { labelKey: "discovery.search.nonprofitsVolunteers", query: "nonprofits needing volunteers" },
      { labelKey: "discovery.search.communityEventsWeek", query: "community events this week" },
      { labelKey: "discovery.search.localArtists", query: "local artists in Charlotte" },
      { labelKey: "discovery.search.charityNearMe", query: "charity events near me" },
    ],
    icon: Users,
    accent: "from-cyan-500/20 to-blue-500/20",
  },
  {
    id: "whats-happening",
    typeLabelKey: "discovery.typeWhatsHappening",
    titleKey: "discovery.whatsHappening",
    bodyKey: "discovery.whatsHappeningBody",
    sampleSearches: [
      { labelKey: "discovery.search.eventsToday", query: "events today near me" },
      { labelKey: "discovery.search.happyHour", query: "happy hour near me" },
      { labelKey: "discovery.search.liveMusicTonight", query: "live music tonight" },
      { labelKey: "discovery.search.freeEventsWeek", query: "free events this week" },
    ],
    icon: Clock,
    accent: "from-violet-500/20 to-purple-500/20",
  },
  {
    id: "micro-hub-discovery",
    typeLabelKey: "discovery.typeMicroHub",
    titleKey: "discovery.exploreYourArea",
    bodyKey: "discovery.exploreYourAreaBody",
    sampleSearches: [
      { labelKey: "discovery.search.nodaEvents", query: "NoDa events" },
      { labelKey: "discovery.search.southEndRestaurants", query: "South End restaurants" },
      { labelKey: "discovery.search.plazaMidwoodNightlife", query: "Plaza Midwood nightlife" },
      { labelKey: "discovery.search.ballantyneFamily", query: "Ballantyne family events" },
    ],
    icon: Compass,
    accent: "from-sky-500/20 to-indigo-500/20",
  },
];

interface DiscoveryCardProps {
  citySlug: string;
  cardIndex: number;
}

export function DiscoveryCard({ citySlug, cardIndex }: DiscoveryCardProps) {
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const card = DISCOVERY_CARDS[cardIndex % DISCOVERY_CARDS.length];
  const Icon = card.icon;

  const handleSearchTap = (query: string) => {
    setLocation(`/${citySlug}/directory?q=${encodeURIComponent(query)}`);
  };

  return (
    <div
      className={`rounded-xl border border-white/10 bg-gradient-to-br ${card.accent} p-4`}
      data-testid={`discovery-card-${card.id}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-full bg-white/10 p-1.5">
          <Icon className="h-3.5 w-3.5 text-white/80" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{t(card.typeLabelKey)}</span>
      </div>

      <h3 className="text-sm font-bold text-white mb-1" data-testid={`discovery-title-${card.id}`}>{t(card.titleKey)}</h3>
      <p className="text-xs text-white/60 leading-relaxed mb-3">{t(card.bodyKey)}</p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {card.sampleSearches.map((search) => (
          <button
            key={search.query}
            onClick={() => handleSearchTap(search.query)}
            className="flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-[11px] text-white/80 font-medium transition-colors active:bg-white/20"
            data-testid={`discovery-search-${search.query.replace(/\s+/g, "-").toLowerCase()}`}
          >
            <Search className="h-2.5 w-2.5 text-white/40" />
            {t(search.labelKey)}
          </button>
        ))}
      </div>

      {card.ctaLabelKey && card.ctaQuery && (
        <button
          onClick={() => handleSearchTap(card.ctaQuery!)}
          className="mt-1 rounded-full bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors active:bg-purple-700"
          data-testid={`discovery-cta-${card.id}`}
        >
          {t(card.ctaLabelKey)}
        </button>
      )}
    </div>
  );
}
