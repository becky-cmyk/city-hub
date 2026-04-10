export type VerticalType =
  | "business"
  | "event"
  | "article"
  | "marketplace"
  | "attraction"
  | "job";

export interface VerticalRegistration {
  type: VerticalType;
  label: string;
  pluralLabel: string;
  icon: string;
  tableName: string;
  slugField: string;
  nameField: string;
  latField: string;
  lngField: string;
  imageField: string;
  detailUrlPattern: (citySlug: string, slug: string) => string;
  extraSelectFields?: string[];
}

const VERTICAL_REGISTRY: VerticalRegistration[] = [
  {
    type: "business",
    label: "Business",
    pluralLabel: "Businesses",
    icon: "Store",
    tableName: "businesses",
    slugField: "slug",
    nameField: "name",
    latField: "latitude",
    lngField: "longitude",
    imageField: "image_url",
    detailUrlPattern: (city, slug) => `/${city}/directory/${slug}`,
    extraSelectFields: ["tagline", "google_rating"],
  },
  {
    type: "event",
    label: "Event",
    pluralLabel: "Events",
    icon: "Calendar",
    tableName: "events",
    slugField: "slug",
    nameField: "title",
    latField: "latitude",
    lngField: "longitude",
    imageField: "image_url",
    detailUrlPattern: (city, slug) => `/${city}/events/${slug}`,
    extraSelectFields: ["start_date_time", "location_name"],
  },
  {
    type: "article",
    label: "Article",
    pluralLabel: "Articles",
    icon: "Newspaper",
    tableName: "articles",
    slugField: "slug",
    nameField: "title",
    latField: "latitude",
    lngField: "longitude",
    imageField: "image_url",
    detailUrlPattern: (city, slug) => `/${city}/articles/${slug}`,
    extraSelectFields: ["excerpt"],
  },
  {
    type: "marketplace",
    label: "Listing",
    pluralLabel: "Marketplace",
    icon: "ShoppingBag",
    tableName: "marketplace_listings",
    slugField: "id",
    nameField: "title",
    latField: "latitude",
    lngField: "longitude",
    imageField: "image_url",
    detailUrlPattern: (city, id) => `/${city}/marketplace/${id}`,
    extraSelectFields: ["price", "type AS marketplace_type"],
  },
  {
    type: "attraction",
    label: "Attraction",
    pluralLabel: "Attractions",
    icon: "Landmark",
    tableName: "attractions",
    slugField: "slug",
    nameField: "name",
    latField: "latitude",
    lngField: "longitude",
    imageField: "image_url",
    detailUrlPattern: (city, slug) => `/${city}/attractions/${slug}`,
    extraSelectFields: ["attraction_type", "fun_fact"],
  },
  {
    type: "job",
    label: "Job",
    pluralLabel: "Jobs",
    icon: "Briefcase",
    tableName: "job_listings",
    slugField: "slug",
    nameField: "title",
    latField: "latitude",
    lngField: "longitude",
    imageField: "''",
    detailUrlPattern: (city, slug) => `/${city}/jobs/${slug}`,
    extraSelectFields: ["employment_type", "location"],
  },
];

export function getVerticalRegistry(): VerticalRegistration[] {
  return [...VERTICAL_REGISTRY];
}

export function getVerticalByType(type: VerticalType): VerticalRegistration | undefined {
  return VERTICAL_REGISTRY.find((v) => v.type === type);
}

export function getOtherVerticals(excludeType: VerticalType): VerticalRegistration[] {
  return VERTICAL_REGISTRY.filter((v) => v.type !== excludeType);
}

export interface NearbyItem {
  type: VerticalType;
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  detailUrl: string;
  distanceMiles: number;
  extra: Record<string, unknown>;
}

export interface NearbyGroup {
  type: VerticalType;
  label: string;
  pluralLabel: string;
  icon: string;
  items: NearbyItem[];
}

export interface NearbyResponse {
  groups: NearbyGroup[];
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
}
