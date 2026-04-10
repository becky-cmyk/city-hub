import {
  UtensilsCrossed, Music, Briefcase, Users, Heart,
  PawPrint, Church, Home, Building2, Calendar, Landmark,
  Crown, Newspaper, ShoppingBag
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface FilterSubCategory {
  key: string;
  label: string;
  matchSlugs?: string[];
  matchSubtypes?: string[];
}

export interface FilterGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  itemTypes: string[];
  matchCategorySlugs?: string[];
  subCategories?: FilterSubCategory[];
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    key: "food",
    label: "Food & Dining",
    icon: UtensilsCrossed,
    color: "#ef4444",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "restaurant-dining", "coffee-tea", "bars-breweries",
      "bakeries-desserts", "grocery-market", "food-beverage",
      "food-trucks", "catering", "food",
    ],
    subCategories: [
      { key: "restaurant-dining", label: "Restaurants", matchSlugs: ["restaurant-dining"] },
      { key: "bars-breweries", label: "Bars & Breweries", matchSlugs: ["bars-breweries"] },
      { key: "coffee-tea", label: "Coffee & Tea", matchSlugs: ["coffee-tea"] },
      { key: "bakeries-desserts", label: "Bakeries & Desserts", matchSlugs: ["bakeries-desserts"] },
      { key: "grocery-market", label: "Grocery & Market", matchSlugs: ["grocery-market", "food-beverage"] },
    ],
  },
  {
    key: "arts-entertainment",
    label: "Arts & Nightlife",
    icon: Music,
    color: "#8b5cf6",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "entertainment-recreation", "arts-culture",
      "music-nightlife", "galleries", "museums", "theaters",
      "comedy", "live-music", "nightlife", "performing-arts",
      "visual-arts", "dance", "film-media",
    ],
    subCategories: [
      { key: "entertainment-recreation", label: "Entertainment", matchSlugs: ["entertainment-recreation"] },
      { key: "arts-culture", label: "Arts & Culture", matchSlugs: ["arts-culture", "galleries", "museums", "visual-arts"] },
      { key: "music-nightlife", label: "Music & Nightlife", matchSlugs: ["music-nightlife", "nightlife", "live-music"] },
      { key: "theaters", label: "Theater", matchSlugs: ["theaters", "performing-arts"] },
    ],
  },
  {
    key: "commerce",
    label: "Commerce & Business",
    icon: Briefcase,
    color: "#3b82f6",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "retail-shopping-cat", "professional-services-cat", "financial-services",
      "automotive", "home-services-cat", "beauty-personal-care",
      "commerce", "retail", "shopping", "coworking",
    ],
    subCategories: [
      { key: "retail-shopping", label: "Retail & Shopping", matchSlugs: ["retail-shopping-cat", "retail", "shopping"] },
      { key: "professional-services", label: "Professional Services", matchSlugs: ["professional-services-cat", "financial-services"] },
      { key: "automotive", label: "Automotive", matchSlugs: ["automotive"] },
      { key: "beauty-personal-care", label: "Beauty & Personal Care", matchSlugs: ["beauty-personal-care"] },
      { key: "home-services", label: "Home Services", matchSlugs: ["home-services-cat"] },
    ],
  },
  {
    key: "health",
    label: "Health & Wellness",
    icon: Heart,
    color: "#14b8a6",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "health-wellness-cat", "healthcare", "wellness",
      "fitness", "medical", "dental", "pharmacy",
    ],
  },
  {
    key: "family",
    label: "Family & Kids",
    icon: Users,
    color: "#ec4899",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "family-fun", "family", "kids", "daycares", "camps",
      "education", "childcare", "youth", "family-kids",
      "tutoring", "children",
    ],
    subCategories: [
      { key: "family-fun", label: "Family Fun", matchSlugs: ["family-fun", "family", "kids"] },
      { key: "education", label: "Schools & Education", matchSlugs: ["education", "public-schools", "tutoring"] },
      { key: "childcare", label: "Childcare & Camps", matchSlugs: ["daycares", "camps", "childcare"] },
    ],
  },
  {
    key: "senior",
    label: "Senior Living",
    icon: Heart,
    color: "#0d9488",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "senior", "senior-living", "senior-services",
      "assisted-living", "home-care", "memory-care",
      "senior-centers", "retirement",
    ],
  },
  {
    key: "pets",
    label: "Pets & Animals",
    icon: PawPrint,
    color: "#22c55e",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "pets", "veterinary", "groomers", "pet-stores",
      "dog-parks", "boarding", "pet-services", "animal",
      "pet-supplies", "pet-care",
    ],
  },
  {
    key: "churches",
    label: "Churches & Faith",
    icon: Church,
    color: "#a855f7",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "churches", "faith", "worship", "religious",
      "church", "synagogue", "mosque", "temple",
      "faith-based", "ministry", "spiritual",
    ],
  },
  {
    key: "realtors",
    label: "Real Estate",
    icon: Home,
    color: "#f97316",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "real-estate", "realtors", "property-management",
      "relocation", "mortgage", "apartment-communities",
    ],
  },
  {
    key: "government",
    label: "Government & Education",
    icon: Building2,
    color: "#64748b",
    itemTypes: ["business"],
    matchCategorySlugs: [
      "government-public-services", "public-schools",
      "government", "public-services",
    ],
  },
  {
    key: "housing",
    label: "Housing",
    icon: ShoppingBag,
    color: "#e11d48",
    itemTypes: ["marketplace"],
    subCategories: [
      { key: "housing-supply", label: "For Rent/Sale", matchSubtypes: ["HOUSING_SUPPLY"] },
      { key: "commercial", label: "Commercial Property", matchSubtypes: ["COMMERCIAL_PROPERTY"] },
    ],
  },
  {
    key: "organizations",
    label: "Organizations",
    icon: Building2,
    color: "#06b6d4",
    itemTypes: ["organization"],
  },
  {
    key: "events",
    label: "Events",
    icon: Calendar,
    color: "#7c3aed",
    itemTypes: ["event"],
    subCategories: [
      { key: "food-events", label: "Food & Dining", matchSlugs: ["restaurant-dining", "food", "food-beverage", "bars-breweries"] },
      { key: "arts-events", label: "Arts & Entertainment", matchSlugs: ["entertainment-recreation", "arts-culture", "music-nightlife"] },
      { key: "community-events", label: "Community", matchSlugs: ["community", "nonprofit"] },
      { key: "family-events", label: "Family", matchSlugs: ["family", "family-fun", "kids", "education"] },
    ],
  },
  {
    key: "things-to-do",
    label: "Things To Do",
    icon: Landmark,
    color: "#f59e0b",
    itemTypes: ["attraction"],
  },
  {
    key: "jobs",
    label: "Jobs",
    icon: Briefcase,
    color: "#0ea5e9",
    itemTypes: ["job"],
  },
  {
    key: "crown",
    label: "Crown",
    icon: Crown,
    color: "#eab308",
    itemTypes: ["crown"],
  },
  {
    key: "pulse-pickups",
    label: "Pulse Pickups",
    icon: Newspaper,
    color: "#d97706",
    itemTypes: ["pulse_pickup"],
  },
];

export interface MapItem {
  type: string;
  id: string;
  slug: string;
  title: string;
  lat: number;
  lng: number;
  category?: string;
  categorySlug?: string;
  categorySlugs?: string[];
  categoryNames?: string[];
  presenceType?: string;
  marketplaceSubtype?: string;
  eventCategoryNames?: string[];
  zone?: string;
  zoneSlug?: string;
  imageUrl?: string;
  isFeatured: boolean;
  isVerified: boolean;
  isSponsored: boolean;
  isCrown: boolean;
  promotedPin: boolean;
  detailUrl: string;
  address?: string;
  description?: string;
}

export function resolveGroupForItem(item: MapItem): FilterGroup | undefined {
  if (item.isCrown) {
    const crownGroup = FILTER_GROUPS.find(g => g.key === 'crown');
    if (crownGroup) return crownGroup;
  }
  if (item.type === 'organization' || (item.type === 'business' && item.presenceType === 'organization')) {
    return FILTER_GROUPS.find(g => g.key === 'organizations');
  }
  if (item.type === 'business') {
    const itemSlugs = item.categorySlugs || (item.categorySlug ? [item.categorySlug] : []);
    for (const group of FILTER_GROUPS) {
      if (!group.itemTypes.includes('business') || !group.matchCategorySlugs) continue;
      if (itemSlugs.some(s => group.matchCategorySlugs!.includes(s))) return group;
    }
    return FILTER_GROUPS.find(g => g.key === 'commerce');
  }
  return FILTER_GROUPS.find(g => g.itemTypes.includes(item.type));
}

export function matchesFilterGroup(item: MapItem, group: FilterGroup): boolean {
  if (item.isCrown && group.key === 'crown') return true;

  if (item.type === 'organization' && group.key === 'organizations') return true;
  if (item.type === 'business' && item.presenceType === 'organization' && group.key === 'organizations') return true;

  if (!group.itemTypes.includes(item.type)) return false;

  if (item.type === 'business' && group.matchCategorySlugs) {
    const itemSlugs = item.categorySlugs || (item.categorySlug ? [item.categorySlug] : []);
    return itemSlugs.some(s => group.matchCategorySlugs!.includes(s));
  }

  return true;
}

export function matchesSubCategory(item: MapItem, sub: FilterSubCategory): boolean {
  if (sub.matchSlugs) {
    const itemSlugs = item.categorySlugs || (item.categorySlug ? [item.categorySlug] : []);
    return itemSlugs.some(s => sub.matchSlugs!.includes(s));
  }
  if (sub.matchSubtypes && item.marketplaceSubtype) {
    return sub.matchSubtypes.includes(item.marketplaceSubtype);
  }
  return true;
}

export function filterItems(
  items: MapItem[],
  activeGroups: Set<string>,
  activeSubCategories: Map<string, Set<string>>,
): MapItem[] {
  if (activeGroups.size === 0) return [];

  return items.filter(item => {
    for (const group of FILTER_GROUPS) {
      if (!activeGroups.has(group.key)) continue;
      if (!matchesFilterGroup(item, group)) continue;

      const activeSubs = activeSubCategories.get(group.key);
      if (!activeSubs || !group.subCategories || activeSubs.size === 0) {
        return true;
      }

      if (activeSubs.size === group.subCategories.length) {
        return true;
      }

      for (const sub of group.subCategories) {
        if (!activeSubs.has(sub.key)) continue;
        if (matchesSubCategory(item, sub)) return true;
      }
    }
    return false;
  });
}
