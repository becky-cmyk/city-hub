import { storage } from "./storage";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { generateBusinessSlug } from "./lib/slug-utils";
import { enqueueCrawlJobs } from "./intelligence/crawl/crawlJobRunner";
import { db } from "./db";
import { crmContacts, businessContacts, users, businesses, categories, shoppingCenters } from "@shared/schema";
import { eq, sql, ilike, and } from "drizzle-orm";
import { queueTranslation } from "./services/auto-translate";

const VENUE_SCREEN_GOOGLE_TYPES = new Set([
  "bar", "restaurant", "night_club", "gym", "cafe",
  "hair_care", "spa", "car_repair", "car_wash",
  "laundry", "lodging", "bowling_alley", "movie_theater",
]);

const VENUE_TYPE_L2_SLUGS = new Set([
  "restaurant-dining", "bars-breweries", "coffee-tea",
  "music-nightlife", "entertainment-recreation",
  "health-wellness-cat", "beauty-personal-care", "automotive",
]);

export function isVenueScreenLikelyFromGoogleTypes(googleTypes: string[]): boolean {
  return googleTypes.some(t => VENUE_SCREEN_GOOGLE_TYPES.has(t));
}

const SHOPPING_CENTER_GOOGLE_TYPES = new Set([
  "shopping_mall",
]);

const SHOPPING_CENTER_NAME_PATTERNS = [
  /\bcommons\b/i,
  /\bplaza\b/i,
  /\bmall\b/i,
  /\bvillage\b/i,
  /\bsquare\b/i,
  /\bmarketplace\b/i,
  /\bcrossing\b/i,
  /\btowne?\s*cent(?:er|re)\b/i,
  /\bshopping\s+cent(?:er|re)\b/i,
  /\boutlet\b/i,
  /\bgalleria\b/i,
  /\bpromenade\b/i,
  /\bpavillion\b/i,
  /\bpavilion\b/i,
  /\bretail\s+(?:center|park|village)\b/i,
];

const SHOPPING_CENTER_RETAIL_TYPES = new Set([
  "shopping_mall", "department_store", "clothing_store", "shoe_store",
  "jewelry_store", "electronics_store", "furniture_store", "home_goods_store",
  "store", "establishment", "point_of_interest",
]);

interface ShoppingCenterDetection {
  isShoppingCenter: boolean;
  centerType: "SHOPPING_CENTER" | "PLAZA" | "MALL" | "MIXED_USE" | "OTHER";
}

function detectShoppingCenter(name: string, googleTypes: string[]): ShoppingCenterDetection {
  const hasShoppingType = googleTypes.some(t => SHOPPING_CENTER_GOOGLE_TYPES.has(t));
  if (hasShoppingType) {
    const nameLower = name.toLowerCase();
    let centerType: ShoppingCenterDetection["centerType"] = "SHOPPING_CENTER";
    if (/\bmall\b/i.test(name) || /\bgalleria\b/i.test(name)) centerType = "MALL";
    else if (/\bplaza\b/i.test(name)) centerType = "PLAZA";
    else if (/\bmixed.?use\b/i.test(name)) centerType = "MIXED_USE";
    return { isShoppingCenter: true, centerType };
  }

  const hasRetailType = googleTypes.some(t => SHOPPING_CENTER_RETAIL_TYPES.has(t));
  if (hasRetailType) {
    const matchedPattern = SHOPPING_CENTER_NAME_PATTERNS.some(p => p.test(name));
    if (matchedPattern) {
      let centerType: ShoppingCenterDetection["centerType"] = "SHOPPING_CENTER";
      if (/\bmall\b/i.test(name) || /\bgalleria\b/i.test(name)) centerType = "MALL";
      else if (/\bplaza\b/i.test(name)) centerType = "PLAZA";
      else if (/\bmixed.?use\b/i.test(name)) centerType = "MIXED_USE";
      return { isShoppingCenter: true, centerType };
    }
  }

  return { isShoppingCenter: false, centerType: "OTHER" };
}

async function upsertShoppingCenter(
  name: string,
  address: string | null,
  centerType: string,
  cityId: string,
  zoneId: string | null
): Promise<string> {
  const slug = slugify(name);
  const existing = await storage.getShoppingCenterBySlug(slug);
  if (existing) return existing.id;

  const sc = await storage.createShoppingCenter({
    name,
    slug,
    address: address || null,
    centerType: centerType as any,
    cityId,
    zoneId: zoneId || null,
  });
  console.log(`[ShoppingCenter] Created: ${name} (${centerType}) → ${sc.id}`);
  return sc.id;
}

const DAILY_TEXTSEARCH_LIMIT = parseInt(process.env.PLACES_IMPORT_DAILY_TEXTSEARCH_LIMIT || "100");
const DAILY_DETAILS_LIMIT = parseInt(process.env.PLACES_IMPORT_DAILY_DETAILS_LIMIT || "500");
const RPM_LIMIT = parseInt(process.env.PLACES_IMPORT_RPM_LIMIT || "30");

const CORPORATE_BLOCKLIST = [
  "walmart", "target", "costco", "sam's club", "home depot", "lowe's",
  "best buy", "staples", "office depot",
  "walgreens", "cvs", "rite aid",
  "wells fargo", "bank of america", "chase bank", "truist", "pnc bank",
  "shell", "bp", "exxon", "chevron", "speedway", "circle k", "7-eleven",
  "autozone", "advance auto", "o'reilly auto",
  "dollar general", "dollar tree", "family dollar",
  "petsmart", "petco",
  "at&t", "verizon", "t-mobile", "sprint",
  "publix", "aldi", "food lion", "harris teeter", "lidl", "trader joe",
  "kohl's", "ross", "tj maxx", "marshalls", "burlington",
  "fedex", "ups store",
  "rent-a-center", "aaron's",
];

const FRANCHISE_BRANDS = [
  "mcdonald", "burger king", "wendy", "chick-fil-a", "taco bell", "subway",
  "applebee", "olive garden", "red lobster", "denny", "ihop", "waffle house",
  "panera", "starbucks", "dunkin",
  "planet fitness", "anytime fitness", "orangetheory",
  "great clips", "supercuts", "sports clips",
  "jiffy lube", "valvoline", "firestone", "goodyear", "midas",
  "domino", "papa john", "pizza hut", "little caesars",
  "chipotle", "five guys", "zaxby", "bojangles", "cook out",
  "cracker barrel", "golden corral", "outback", "longhorn",
  "chili's", "buffalo wild wings", "wingstop",
  "h&r block", "jackson hewitt", "liberty tax",
  "state farm", "allstate", "farmers insurance", "geico",
];

function classifyChain(name: string): "corporate" | "franchise" | null {
  const lower = name.toLowerCase();
  if (CORPORATE_BLOCKLIST.some((brand) => lower.includes(brand))) return "corporate";
  if (FRANCHISE_BRANDS.some((brand) => lower.includes(brand))) return "franchise";
  return null;
}

let dailyCounters = {
  textsearch: 0,
  details: 0,
  lastReset: new Date().toDateString(),
};

const rpmTracker: number[] = [];

function resetDailyIfNeeded() {
  const today = new Date().toDateString();
  if (dailyCounters.lastReset !== today) {
    dailyCounters = { textsearch: 0, details: 0, lastReset: today };
  }
}

function checkRpm(): boolean {
  const now = Date.now();
  const oneMinAgo = now - 60000;
  while (rpmTracker.length > 0 && rpmTracker[0] < oneMinAgo) rpmTracker.shift();
  return rpmTracker.length < RPM_LIMIT;
}

function recordRpm() {
  rpmTracker.push(Date.now());
}

async function waitForRpmSlot(): Promise<void> {
  let attempts = 0;
  while (!checkRpm() && attempts < 120) {
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
  }
  if (!checkRpm()) throw new Error("RPM throttle timeout after 2 minutes");
  recordRpm();
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY not configured");
  return key;
}

export interface PlaceTextSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  types?: string[];
  geometry?: { location: { lat: number; lng: number } };
  business_status?: string;
}

export interface PlacePhoto {
  photo_reference: string;
  width: number;
  height: number;
  html_attributions: string[];
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  national_phone_number?: string;
  website?: string;
  opening_hours?: { weekday_text?: string[] };
  types?: string[];
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
  business_status?: string;
  geometry?: { location: { lat: number; lng: number } };
  photos?: PlacePhoto[];
  rating?: number;
  user_ratings_total?: number;
  url?: string;
}

export function googlePlacePhotoUrl(photoReference: string, maxWidth: number = 400): string {
  const apiKey = getApiKey();
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;
}

export async function textSearchPlaces(query: string, maxResults: number = 20, options?: { skipDailyLimit?: boolean }): Promise<PlaceTextSearchResult[]> {
  resetDailyIfNeeded();
  if (!options?.skipDailyLimit && dailyCounters.textsearch >= DAILY_TEXTSEARCH_LIMIT) {
    throw new Error(`Daily text search limit reached (${DAILY_TEXTSEARCH_LIMIT}). Try again tomorrow.`);
  }

  const apiKey = getApiKey();
  const results: PlaceTextSearchResult[] = [];
  let pageToken: string | undefined;

  while (results.length < maxResults) {
    await waitForRpmSlot();
    dailyCounters.textsearch++;

    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    if (pageToken) url += `&pagetoken=${pageToken}`;

    let resp: Response;
    try {
      resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    } catch (fetchErr: any) {
      if (fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError") {
        throw new Error(`Google Places text search timed out after 30 seconds`);
      }
      throw new Error(`Network error during text search: ${fetchErr.message || "Load failed"}`);
    }
    const data = await resp.json() as any;

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places text search error: ${data.status} - ${data.error_message || ""}`);
    }

    if (data.results) {
      for (const r of data.results) {
        if (results.length >= maxResults) break;
        results.push({
          place_id: r.place_id,
          name: r.name,
          formatted_address: r.formatted_address,
          types: r.types,
          geometry: r.geometry,
          business_status: r.business_status,
        });
      }
    }

    pageToken = data.next_page_token;
    if (!pageToken || results.length >= maxResults) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

export async function nearbySearchPlaces(
  lat: number, lng: number, radiusMeters: number,
  keyword: string, maxResults: number = 20
): Promise<PlaceTextSearchResult[]> {
  resetDailyIfNeeded();
  if (dailyCounters.textsearch >= DAILY_TEXTSEARCH_LIMIT) {
    throw new Error(`Daily text search limit reached (${DAILY_TEXTSEARCH_LIMIT}). Try again tomorrow.`);
  }

  const apiKey = getApiKey();
  const results: PlaceTextSearchResult[] = [];
  let pageToken: string | undefined;

  while (results.length < maxResults) {
    await waitForRpmSlot();
    dailyCounters.textsearch++;

    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;
    if (pageToken) url += `&pagetoken=${pageToken}`;

    let resp: Response;
    try {
      resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    } catch (fetchErr: any) {
      if (fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError") {
        throw new Error(`Google Places nearby search timed out after 30 seconds`);
      }
      throw new Error(`Network error during nearby search: ${fetchErr.message || "Load failed"}`);
    }
    const data = await resp.json() as any;

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places nearby search error: ${data.status} - ${data.error_message || ""}`);
    }

    if (data.results) {
      for (const r of data.results) {
        if (results.length >= maxResults) break;
        results.push({
          place_id: r.place_id,
          name: r.name,
          formatted_address: r.formatted_address,
          types: r.types,
          geometry: r.geometry,
          business_status: r.business_status,
        });
      }
    }

    pageToken = data.next_page_token;
    if (!pageToken || results.length >= maxResults) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

export async function fetchPlaceDetails(placeId: string, options?: { skipDailyLimit?: boolean }): Promise<PlaceDetails> {
  resetDailyIfNeeded();
  if (!options?.skipDailyLimit && dailyCounters.details >= DAILY_DETAILS_LIMIT) {
    throw new Error(`Daily details limit reached (${DAILY_DETAILS_LIMIT}). Try again tomorrow.`);
  }

  const apiKey = getApiKey();
  await waitForRpmSlot();
  dailyCounters.details++;

  const fields = "place_id,name,formatted_address,formatted_phone_number,website,opening_hours,types,address_components,business_status,geometry,photos,rating,user_ratings_total,url";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

  let resp: Response;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  } catch (fetchErr: any) {
    if (fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError") {
      throw new Error(`Google Places details request timed out after 30 seconds`);
    }
    throw new Error(`Network error fetching place details: ${fetchErr.message || "Load failed"}`);
  }
  const data = await resp.json() as any;

  if (data.status !== "OK") {
    throw new Error(`Google Places details error: ${data.status} - ${data.error_message || ""}`);
  }

  return data.result as PlaceDetails;
}

export const GOOGLE_TYPES_TO_L2_SLUGS: Record<string, string[]> = {
  "restaurant": ["restaurant-dining"],
  "food": ["restaurant-dining"],
  "meal_delivery": ["restaurant-dining"],
  "meal_takeaway": ["restaurant-dining"],
  "cafe": ["coffee-tea"],
  "coffee_shop": ["coffee-tea"],
  "bakery": ["bakeries-desserts"],
  "bar": ["bars-breweries"],
  "night_club": ["music-nightlife"],
  "liquor_store": ["bars-breweries"],
  "grocery_or_supermarket": ["grocery-market"],
  "supermarket": ["grocery-market"],
  "convenience_store": ["grocery-market"],
  "shopping_mall": ["retail-shopping-cat"],
  "clothing_store": ["retail-shopping-cat"],
  "shoe_store": ["retail-shopping-cat"],
  "jewelry_store": ["retail-shopping-cat"],
  "department_store": ["retail-shopping-cat"],
  "electronics_store": ["retail-shopping-cat"],
  "furniture_store": ["retail-shopping-cat", "home-services-cat"],
  "home_goods_store": ["home-services-cat"],
  "hardware_store": ["home-services-cat"],
  "beauty_salon": ["beauty-personal-care"],
  "hair_care": ["beauty-personal-care"],
  "barber_shop": ["beauty-personal-care"],
  "spa": ["beauty-personal-care"],
  "gym": ["entertainment-recreation"],
  "health": ["health-wellness-cat"],
  "hospital": ["health-wellness-cat"],
  "doctor": ["health-wellness-cat"],
  "dentist": ["health-wellness-cat"],
  "pharmacy": ["health-wellness-cat"],
  "physiotherapist": ["health-wellness-cat"],
  "veterinary_care": ["pets"],
  "pet_store": ["pets"],
  "car_dealer": ["automotive"],
  "car_repair": ["automotive"],
  "car_wash": ["automotive"],
  "gas_station": ["automotive"],
  "parking": ["automotive"],
  "lawyer": ["professional-services-cat"],
  "accounting": ["professional-services-cat"],
  "insurance_agency": ["professional-services-cat"],
  "real_estate_agency": ["real-estate"],
  "bank": ["financial-services"],
  "atm": ["financial-services"],
  "finance": ["financial-services"],
  "lodging": ["travel-lodging"],
  "hotel": ["travel-lodging"],
  "travel_agency": ["travel-lodging"],
  "rv_park": ["travel-lodging", "parks-outdoors"],
  "church": ["nonprofit-faith", "churches-places-of-worship"],
  "mosque": ["nonprofit-faith", "churches-places-of-worship", "islamic-mosque"],
  "synagogue": ["nonprofit-faith", "churches-places-of-worship", "jewish-synagogue"],
  "hindu_temple": ["nonprofit-faith", "churches-places-of-worship", "hindu-temple"],
  "place_of_worship": ["nonprofit-faith", "churches-places-of-worship"],
  "school": ["government-public-services", "public-schools"],
  "university": ["education", "colleges-universities"],
  "library": ["government-public-services", "public-libraries"],
  "art_gallery": ["arts-culture"],
  "museum": ["arts-culture"],
  "movie_theater": ["arts-culture"],
  "park": ["entertainment-recreation", "parks-outdoors"],
  "amusement_park": ["entertainment-recreation", "family-fun"],
  "bowling_alley": ["entertainment-recreation", "family-fun"],
  "stadium": ["entertainment-recreation", "sports-athletics"],
  "aquarium": ["entertainment-recreation", "parks-outdoors"],
  "zoo": ["entertainment-recreation", "parks-outdoors"],
  "campground": ["entertainment-recreation", "parks-outdoors"],
  "city_hall": ["government-public-services", "city-county-government"],
  "courthouse": ["government-public-services", "courts-legal-services"],
  "fire_station": ["government-public-services", "public-safety"],
  "police": ["government-public-services", "public-safety"],
  "post_office": ["government-public-services", "public-utilities-infrastructure"],
  "local_government_office": ["government-public-services", "city-county-government"],
  "tourist_attraction": ["entertainment-recreation", "arts-culture"],
  "plumber": ["home-services-cat"],
  "electrician": ["home-services-cat"],
  "locksmith": ["home-services-cat"],
  "painter": ["home-services-cat"],
  "roofing_contractor": ["home-services-cat"],
  "general_contractor": ["home-services-cat"],
  "moving_company": ["home-services-cat"],
  "storage": ["home-services-cat"],
  "laundry": ["home-services-cat"],
  "florist": ["retail-shopping-cat"],
  "book_store": ["retail-shopping-cat"],
  "bicycle_store": ["retail-shopping-cat"],
  "pet_grooming": ["pets"],
  "transit_station": ["transit-transportation"],
  "bus_station": ["transit-transportation"],
  "train_station": ["transit-transportation"],
  "subway_station": ["transit-transportation"],
  "light_rail_station": ["transit-transportation"],
  "airport": ["transit-transportation"],
  "taxi_stand": ["transit-transportation"],
  "funeral_home": ["nonprofit-faith", "funeral-memorial"],
  "cemetery": ["nonprofit-faith", "funeral-memorial"],
  "car_rental": ["automotive"],
  "primary_school": ["government-public-services", "public-schools"],
  "secondary_school": ["government-public-services", "public-schools"],
  "drugstore": ["health-wellness-cat"],
  "embassy": ["government-public-services", "city-county-government"],
  "casino": ["entertainment-recreation"],
  "movie_rental": ["entertainment-recreation", "arts-culture"],
  "natural_feature": ["entertainment-recreation", "parks-outdoors"],
  "physiotherapy": ["health-wellness-cat"],
  "child_care": ["education", "early-childhood-preschool"],
  "meal_preparation": ["restaurant-dining"],
  "taxi_service": ["transit-transportation"],
  "dry_cleaner": ["home-services-cat"],
  "tailor": ["retail-shopping-cat"],
  "cobbler": ["retail-shopping-cat"],
  "pawn_shop": ["retail-shopping-cat"],
  "notary": ["professional-services-cat"],
  "bail_bonds": ["professional-services-cat"],
  "check_cashing": ["financial-services"],
  "money_transfer": ["financial-services"],
  "self_storage": ["home-services-cat"],
  "kennel": ["pets"],
  "animal_shelter": ["pets"],
  "animal_hospital": ["pets"],
};

export const GOOGLE_TYPES_TO_L3_SLUGS: Record<string, string[]> = {
  "restaurant": ["dine-in", "full-service"],
  "meal_delivery": ["delivery", "takeout"],
  "meal_takeaway": ["takeout"],
  "cafe": ["espresso-drinks", "pastries"],
  "bakery": ["cakes-pastries", "bread"],
  "bar": ["cocktails", "craft-beer"],
  "night_club": ["live-music", "dj"],
  "beauty_salon": ["hair-styling", "nails"],
  "barber_shop": ["haircut", "beard-trim"],
  "spa": ["massage", "facials"],
  "gym": ["personal-training", "group-fitness"],
  "dentist": ["general-dentistry", "cosmetic-dentistry"],
  "doctor": ["primary-care", "specialist"],
  "veterinary_care": ["pet-wellness", "emergency-vet"],
  "car_repair": ["oil-change", "brake-repair", "tire-service"],
  "car_wash": ["detail-service", "exterior-wash"],
  "lawyer": ["family-law", "business-law"],
  "real_estate_agency": ["buying", "selling", "property-management"],
  "plumber": ["drain-cleaning", "water-heater"],
  "electrician": ["wiring", "panel-upgrade"],
  "roofing_contractor": ["roof-repair", "roof-replacement"],
  "general_contractor": ["remodeling", "new-construction"],
  "hair_care": ["haircut", "color-treatment"],
  "florist": ["weddings", "arrangements"],
};

const GOOGLE_META_TYPES = new Set([
  "establishment", "point_of_interest", "political", "geocode",
  "street_address", "route", "intersection", "country",
  "administrative_area_level_1", "administrative_area_level_2",
  "locality", "sublocality", "neighborhood", "premise",
  "postal_code", "floor", "room",
]);

const DENOMINATION_NAME_PATTERNS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /\bbaptist\b/i, slug: "baptist" },
  { pattern: /\bcatholic\b/i, slug: "catholic" },
  { pattern: /\bparish\b/i, slug: "catholic" },
  { pattern: /\bmethodist\b/i, slug: "methodist" },
  { pattern: /\bumc\b/i, slug: "methodist" },
  { pattern: /\bpresbyterian\b/i, slug: "presbyterian" },
  { pattern: /\bnon[\s-]*denominational/i, slug: "non-denominational" },
  { pattern: /\bpentecostal\b/i, slug: "pentecostal" },
  { pattern: /\bassembl(y|ies)\s+of\s+god/i, slug: "pentecostal" },
  { pattern: /\bcogic\b/i, slug: "pentecostal" },
  { pattern: /\blutheran\b/i, slug: "lutheran" },
  { pattern: /\bepiscopal\b/i, slug: "episcopal-anglican" },
  { pattern: /\banglican\b/i, slug: "episcopal-anglican" },
  { pattern: /\bame\b/i, slug: "ame-african-methodist" },
  { pattern: /\bafrican\s+methodist/i, slug: "ame-african-methodist" },
  { pattern: /\bchurch\s+of\s+god\b/i, slug: "church-of-god" },
  { pattern: /\bseventh[\s-]*day\s+adventist/i, slug: "seventh-day-adventist" },
  { pattern: /\badventist\b/i, slug: "seventh-day-adventist" },
  { pattern: /\bmosque\b/i, slug: "islamic-mosque" },
  { pattern: /\bmasjid\b/i, slug: "islamic-mosque" },
  { pattern: /\bislamic\b/i, slug: "islamic-mosque" },
  { pattern: /\bhindu\b/i, slug: "hindu-temple" },
  { pattern: /\bmandir\b/i, slug: "hindu-temple" },
  { pattern: /\bsynagogue\b/i, slug: "jewish-synagogue" },
  { pattern: /\bjewish\b/i, slug: "jewish-synagogue" },
  { pattern: /\btemple\s+beth\b/i, slug: "jewish-synagogue" },
  { pattern: /\bchabad\b/i, slug: "jewish-synagogue" },
  { pattern: /\bbuddhist\b/i, slug: "buddhist-temple" },
  { pattern: /\bzen\s+(center|temple|monastery)/i, slug: "buddhist-temple" },
  { pattern: /\bsikh\b/i, slug: "sikh-gurdwara" },
  { pattern: /\bgurdwara\b/i, slug: "sikh-gurdwara" },
  { pattern: /\bgurudwara\b/i, slug: "sikh-gurdwara" },
];

export function detectDenominationFromName(name: string): string | null {
  for (const { pattern, slug } of DENOMINATION_NAME_PATTERNS) {
    if (pattern.test(name)) return slug;
  }
  return null;
}

export function mapGoogleTypesToCategories(googleTypes: string[]): { l2Slugs: string[]; l3Slugs: string[] } {
  const l2Set = new Set<string>();
  const l3Set = new Set<string>();
  for (const gType of googleTypes) {
    const l2Matches = GOOGLE_TYPES_TO_L2_SLUGS[gType];
    if (l2Matches) l2Matches.forEach(s => l2Set.add(s));
    const l3Matches = GOOGLE_TYPES_TO_L3_SLUGS[gType];
    if (l3Matches) l3Matches.forEach(s => l3Set.add(s));
  }
  const unmappedTypes = googleTypes.filter(t => !GOOGLE_TYPES_TO_L2_SLUGS[t] && !GOOGLE_META_TYPES.has(t));
  if (unmappedTypes.length > 0 && l2Set.size === 0) {
    console.log(`[CategoryMap] Unmapped Google types (no match found): ${unmappedTypes.join(", ")}`);
  }
  return { l2Slugs: Array.from(l2Set), l3Slugs: Array.from(l3Set) };
}

export async function aiFallbackCategorize(businessName: string, googleTypes: string[]): Promise<string[]> {
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.Open_AI_Key || process.env.OPENAI_API_KEY });
    const allL2 = await db.select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .where(sql`${categories.parentCategoryId} IS NOT NULL`);
    const l2List = allL2.map(c => `${c.slug} (${c.name})`).join(", ");
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 100,
      messages: [{
        role: "system",
        content: `You categorize businesses into directory categories. Return ONLY a JSON array of 1-3 category slugs from this list: ${l2List}. No explanation.`
      }, {
        role: "user",
        content: `Business: "${businessName}". Google types: ${googleTypes.join(", ")}. Pick the best matching category slugs.`
      }],
    });
    const text = resp.choices[0]?.message?.content?.trim() || "[]";
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validSlugs = new Set(allL2.map(c => c.slug));
      const result = parsed.filter((s: string) => validSlugs.has(s));
      if (result.length > 0) {
        console.log(`[CategoryMap] AI fallback for "${businessName}": ${result.join(", ")}`);
        return result;
      }
    }
  } catch (err: any) {
    console.error(`[CategoryMap] AI fallback error for "${businessName}":`, err.message);
  }
  return [];
}

export function getDailyUsage() {
  resetDailyIfNeeded();
  return {
    textsearch: { used: dailyCounters.textsearch, limit: DAILY_TEXTSEARCH_LIMIT },
    details: { used: dailyCounters.details, limit: DAILY_DETAILS_LIMIT },
    rpm: { current: rpmTracker.filter((t) => t > Date.now() - 60000).length, limit: RPM_LIMIT },
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

function parseHours(weekdayText?: string[]): Record<string, string> | undefined {
  if (!weekdayText || weekdayText.length === 0) return undefined;
  const hours: Record<string, string> = {};
  for (const line of weekdayText) {
    const parts = line.split(": ");
    if (parts.length >= 2) hours[parts[0].trim()] = parts.slice(1).join(": ").trim();
  }
  return hours;
}

const CHARLOTTE_ZIP_ZONE_MAP: Record<string, string> = {
  "28202": "uptown", "28203": "south-end", "28204": "elizabeth",
  "28205": "plaza-midwood", "28206": "noda", "28207": "myers-park",
  "28208": "seversville", "28209": "dilworth", "28210": "southpark",
  "28211": "southpark", "28212": "eastway", "28213": "university-city",
  "28214": "northlake", "28215": "eastway", "28216": "northlake",
  "28217": "ayrsley", "28226": "southpark", "28227": "east-forest",
  "28244": "uptown", "28246": "uptown", "28262": "university-city",
  "28269": "northlake", "28270": "providence", "28273": "ayrsley",
  "28274": "myers-park", "28277": "ballantyne", "28278": "steele-creek",
  "28036": "davidson", "28031": "cornelius", "28078": "huntersville",
  "28105": "matthews", "28134": "pineville", "28173": "waxhaw",
  "28104": "indian-trail", "28079": "indian-trail",
  "28025": "concord", "28027": "concord", "28075": "harrisburg",
  "28052": "gastonia", "28054": "gastonia", "28056": "gastonia",
  "28012": "belmont", "28120": "mount-holly",
  "28098": "lake-wylie", "28106": "mint-hill",
  "28174": "monroe", "28110": "monroe", "28117": "mooresville",
  "28115": "mooresville", "28150": "mount-pleasant",
  "28023": "cornelius", "28035": "huntersville",
  "28037": "denver", "28164": "lincolnton",
  "29708": "fort-mill", "29715": "fort-mill",
  "29707": "indian-land", "29036": "fort-mill",
  "29720": "rock-hill", "29732": "rock-hill",
  "29710": "indian-land", "29745": "york-town",
  "29614": "tega-cay",
};

function extractZipFromAddress(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

export async function matchZoneForAddress(address: string, cityId: string): Promise<string | null> {
  const zip = extractZipFromAddress(address);
  if (!zip) return null;

  const zoneSlug = CHARLOTTE_ZIP_ZONE_MAP[zip];
  if (!zoneSlug) return null;

  const zones = await storage.getZonesByCityId(cityId);
  const matched = zones.find((z: any) => z.slug === zoneSlug);
  return matched ? matched.id : null;
}

export interface ImportSummary {
  totalFound: number;
  imported: number;
  skipped: number;
  failed: number;
  skipReasons: Record<string, number>;
  failReasons: Record<string, number>;
}

export async function runImportJob(jobId: string, opts?: { overrideCategoryIds?: string[] }): Promise<ImportSummary> {
  const job = await storage.getPlaceImportJob(jobId);
  if (!job) throw new Error("Job not found");

  await storage.updatePlaceImportJob(jobId, { status: "running" });

  const summary: ImportSummary = {
    totalFound: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    skipReasons: {},
    failReasons: {},
  };

  function trackSkip(reason: string) {
    summary.skipped++;
    summary.skipReasons[reason] = (summary.skipReasons[reason] || 0) + 1;
  }

  function trackFail(reason: string) {
    summary.failed++;
    summary.failReasons[reason] = (summary.failReasons[reason] || 0) + 1;
  }

  try {
    let searchResults: PlaceTextSearchResult[];
    const maxResults = Math.min(job.requestedCount || 20, 60);

    if (job.mode === "text_search") {
      if (!job.queryText) throw new Error("Query text is required for text search");
      searchResults = await textSearchPlaces(job.queryText, maxResults);
    } else {
      if (!job.centerLat || !job.centerLng) throw new Error("Center coordinates required for nearby search");
      searchResults = await nearbySearchPlaces(
        parseFloat(job.centerLat), parseFloat(job.centerLng),
        job.radiusMeters || 5000, job.categoryKeyword || "", maxResults
      );
    }

    summary.totalFound = searchResults.length;

    for (const sr of searchResults) {
      await storage.createPlaceImportResult({
        jobId,
        placeId: sr.place_id,
        name: sr.name,
        formattedAddress: sr.formatted_address,
        primaryType: sr.types?.[0] || null,
        categoriesJson: sr.types || [],
        lat: sr.geometry?.location.lat?.toString() || null,
        lng: sr.geometry?.location.lng?.toString() || null,
        status: "discovered",
      });
    }

    const allCities = await storage.getAllCities();
    const city = allCities.find((c: any) => c.slug === "charlotte") || allCities[0];
    if (!city) throw new Error("No city found for import");

    const zones = await storage.getZonesByCityId(city.id);
    const defaultZone = zones[0];
    if (!defaultZone) throw new Error("No zone found for import");

    const results = await storage.getPlaceImportResults(jobId);
    let importedCount = 0;

    for (const result of results) {
      try {
        const existing = await storage.getPresencePlacesSource(result.placeId);
        if (existing) {
          const reason = "Place ID already linked to existing presence";
          await storage.updatePlaceImportResult(result.id, {
            status: "skipped",
            skipReason: reason,
          });
          trackSkip("duplicate_place_id");
          continue;
        }

        const chainClass = result.name ? classifyChain(result.name) : null;
        if (chainClass === "corporate") {
          console.log(`[PlacesImport] Skipped corporate chain: "${result.name}"`);
          await storage.updatePlaceImportResult(result.id, {
            status: "skipped",
            skipReason: "corporate_chain",
          });
          trackSkip("corporate_chain");
          continue;
        }

        let details: PlaceDetails;
        try {
          details = await fetchPlaceDetails(result.placeId);
          await storage.updatePlaceImportResult(result.id, { status: "details_fetched" });
        } catch (detailErr: any) {
          if (detailErr.message.includes("Daily details limit")) {
            await storage.updatePlaceImportResult(result.id, {
              status: "failed",
              skipReason: detailErr.message,
            });
            trackSkip("daily_details_limit_reached");
            break;
          }
          throw detailErr;
        }

        const matchedZoneId = details.formatted_address
          ? await matchZoneForAddress(details.formatted_address, city.id)
          : null;

        const extractedZip = details.formatted_address
          ? extractZipFromAddress(details.formatted_address)
          : null;

        const assignedZoneId = matchedZoneId || defaultZone.id;
        const needsZoneReview = !matchedZoneId;

        if (needsZoneReview && extractedZip) {
          console.warn(`[GooglePlaces] No ZIP-zone match for "${details.name}" ZIP=${extractedZip} — assigned to default zone, flagged for review`);
        } else if (needsZoneReview) {
          console.warn(`[GooglePlaces] No ZIP extracted for "${details.name}" — assigned to default zone, flagged for review`);
        }

        let slug = await generateBusinessSlug(details.name, city.id, {
          zoneId: assignedZoneId,
          address: details.formatted_address,
          cityName: city.name || null,
        });

        const isAutoPublish = !!job.autoPublish;

        let photoImageUrl: string | null = null;
        let photoAttr: string | null = null;
        if (details.photos && details.photos.length > 0) {
          const firstPhoto = details.photos[0];
          photoImageUrl = googlePlacePhotoUrl(firstPhoto.photo_reference, 800);
          if (firstPhoto.html_attributions && firstPhoto.html_attributions.length > 0) {
            photoAttr = firstPhoto.html_attributions.join("; ");
          }
        }

        let resolvedCategoryIds: string[] = opts?.overrideCategoryIds ? [...opts.overrideCategoryIds] : [];
        let venueScreenLikely = false;
        if (resolvedCategoryIds.length === 0 && details.types && details.types.length > 0) {
          let { l2Slugs } = mapGoogleTypesToCategories(details.types);
          if (l2Slugs.length === 0) {
            l2Slugs = await aiFallbackCategorize(details.name, details.types);
          }
          const isWorshipType = details.types.some((t: string) =>
            ["church", "mosque", "synagogue", "hindu_temple", "place_of_worship"].includes(t)
          );
          if (isWorshipType && details.name) {
            const denomSlug = detectDenominationFromName(details.name);
            if (denomSlug && !l2Slugs.includes(denomSlug)) {
              l2Slugs.push(denomSlug);
            }
          }
          if (l2Slugs.length > 0) {
            const allCategories = await db.select().from(categories);
            resolvedCategoryIds = allCategories
              .filter((c: any) => l2Slugs.includes(c.slug))
              .map((c: any) => c.id);
          }
          venueScreenLikely = isVenueScreenLikelyFromGoogleTypes(details.types);
        }

        let shoppingCenterId: string | null = null;
        const scDetection = detectShoppingCenter(details.name, details.types || []);
        if (scDetection.isShoppingCenter) {
          shoppingCenterId = await upsertShoppingCenter(
            details.name,
            details.formatted_address || null,
            scDetection.centerType,
            city.id,
            assignedZoneId
          );
        }

        const presence = await storage.createBusiness({
          cityId: city.id,
          zoneId: assignedZoneId,
          name: details.name,
          slug,
          description: null,
          address: details.formatted_address || null,
          city: process.env.DEFAULT_CITY || "Charlotte",
          state: process.env.DEFAULT_STATE || "NC",
          zip: extractedZip || null,
          phone: details.formatted_phone_number || null,
          websiteUrl: details.website || null,
          hoursOfOperation: parseHours(details.opening_hours?.weekday_text) || null,
          googlePlaceId: result.placeId,
          googleRating: details.rating?.toString() || null,
          googleReviewCount: details.user_ratings_total || null,
          latitude: details.geometry?.location.lat?.toString() || null,
          longitude: details.geometry?.location.lng?.toString() || null,
          claimStatus: "UNCLAIMED",
          micrositeTier: "none",
          listingTier: "FREE",
          presenceStatus: "ACTIVE",
          presenceStatus2: isAutoPublish ? "PUBLISHED" : "DRAFT",
          categoryIds: resolvedCategoryIds,
          tagIds: [],
          venueScreenLikely,
          needsZoneReview,
          isFranchise: chainClass === "franchise",
          ...(shoppingCenterId ? { shoppingCenterId } : {}),
          ...(photoImageUrl ? { imageUrl: photoImageUrl, photoAttribution: photoAttr } : {}),
        });

        if (chainClass === "franchise") {
          console.log(`[PlacesImport] Franchise imported: "${details.name}" (locally owned)`);
        }

        queueTranslation("business", presence.id);

        await storage.createPresencePlacesSource({
          presenceId: presence.id,
          placeId: result.placeId,
        });

        if (!isAutoPublish) {
          await storage.createListingsToClaimQueue({
            presenceId: presence.id,
            source: "google_places",
            status: "ready",
          });
        }

        await storage.updatePlaceImportResult(result.id, {
          status: "presence_created",
          createdPresenceId: presence.id,
        });

        let createdCrmContactId: string | null = null;
        try {
          const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN")).limit(1);
          if (adminUser) {
            const [existingContact] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.linkedBusinessId, presence.id)).limit(1);
            if (existingContact) {
              createdCrmContactId = existingContact.id;
            } else {
              const hasContact = details.formatted_phone_number || details.website;
              const [newContact] = await db.insert(crmContacts).values({
                userId: adminUser.id,
                name: details.name,
                company: details.name,
                phone: details.formatted_phone_number || null,
                website: details.website || null,
                address: details.formatted_address || null,
                linkedBusinessId: presence.id,
                category: "potential_client",
                status: "active",
                captureMethod: "google_places",
                connectionSource: "google_places_import",
                notes: hasContact ? "Auto-created from Google Places import with contact info" : "Auto-created from Google Places import — no contact info yet",
              }).returning({ id: crmContacts.id });
              if (newContact) createdCrmContactId = newContact.id;
            }
          }
        } catch (contactErr: any) {
          console.warn(`[GooglePlaces] Failed to create CRM contact for ${details.name}:`, contactErr.message);
        }

        try {
          const hasContactInfo = details.formatted_phone_number || details.website;
          if (hasContactInfo) {
            const [existingBizContact] = await db.select({ id: businessContacts.id })
              .from(businessContacts)
              .where(eq(businessContacts.businessId, presence.id))
              .limit(1);
            if (!existingBizContact) {
              await db.insert(businessContacts).values({
                businessId: presence.id,
                name: details.name,
                role: "OWNER",
                phone: details.formatted_phone_number || null,
                isPrimary: true,
                source: "GOOGLE_PLACES",
                notes: "Auto-created from Google Places import",
                ...(createdCrmContactId && { crmContactId: createdCrmContactId }),
              });
              console.log(`[GooglePlaces] Created business contact for "${details.name}"${createdCrmContactId ? " (linked to CRM)" : ""}`);
            }
          }
        } catch (bizContactErr: any) {
          console.warn(`[GooglePlaces] Failed to create business contact for ${details.name}:`, bizContactErr.message);
        }

        const isBatchImport = isAutoPublish || (job.requestedCount && job.requestedCount > 5);
        if (!isBatchImport) {
          try {
            await createInboxItemIfNotOpen({
              itemType: "listing_imported_needs_publish",
              relatedTable: "businesses",
              relatedId: presence.id,
              title: `Imported listing ready: ${details.name}`,
              summary: `${details.formatted_address || "No address"}`,
              priority: "low",
            });
          } catch (_) {}
        }

        importedCount++;
        summary.imported++;
      } catch (err: any) {
        await storage.updatePlaceImportResult(result.id, {
          status: "failed",
          skipReason: err.message,
        });
        trackFail(err.message.substring(0, 100));
      }
    }

    const summaryText = `Found: ${summary.totalFound}, Imported: ${summary.imported}, Skipped: ${summary.skipped}, Failed: ${summary.failed}` +
      (Object.keys(summary.skipReasons).length > 0 ? ` | Skip reasons: ${Object.entries(summary.skipReasons).map(([k, v]) => `${k}(${v})`).join(", ")}` : "") +
      (Object.keys(summary.failReasons).length > 0 ? ` | Fail reasons: ${Object.entries(summary.failReasons).map(([k, v]) => `${k}(${v})`).join(", ")}` : "");

    await storage.updatePlaceImportJob(jobId, {
      status: "completed",
      importedCount,
      errorText: importedCount === 0 ? summaryText : null,
    });

    if (importedCount > 0) {
      try {
        const enqueued = await enqueueCrawlJobs(city.id);
        console.log(`[GooglePlaces] Enqueued ${enqueued} businesses for contact enrichment crawl`);
      } catch (err: any) {
        console.warn(`[GooglePlaces] Contact enrichment enqueue failed:`, err.message);
      }
    }

    return summary;
  } catch (err: any) {
    await storage.updatePlaceImportJob(jobId, {
      status: "failed",
      errorText: err.message,
    });

    try {
      await createInboxItemIfNotOpen({
        itemType: "places_import_failed",
        relatedTable: "place_import_jobs",
        relatedId: jobId,
        title: `Places import job failed`,
        summary: err.message,
        priority: "high",
      });
    } catch (_) {}

    throw err;
  }
}

export async function backfillGooglePhotos(cityId: string): Promise<{ updated: number; skipped: number; failed: number }> {
  const allBusinesses = await storage.getBusinessesByCityId(cityId);
  const needsPhoto = allBusinesses.filter(
    (b: any) => !b.imageUrl && b.googlePlaceId
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const biz of needsPhoto) {
    try {
      const details = await fetchPlaceDetails(biz.googlePlaceId!);
      if (details.photos && details.photos.length > 0) {
        const firstPhoto = details.photos[0];
        const photoUrl = googlePlacePhotoUrl(firstPhoto.photo_reference, 800);
        const attribution = firstPhoto.html_attributions?.join("; ") || null;
        await storage.updateBusiness(biz.id, {
          imageUrl: photoUrl,
          photoAttribution: attribution,
        });
        updated++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      if (err.message.includes("Daily details limit") || err.message.includes("RPM throttle")) {
        break;
      }
      failed++;
    }
  }

  return { updated, skipped, failed };
}

export async function backfillVenueScreenLikely(): Promise<{ updated: number }> {
  try {
    const allCategories = await db.select().from(categories);
    const venueCategoryIds = allCategories
      .filter((c: any) => VENUE_TYPE_L2_SLUGS.has(c.slug))
      .map((c: any) => c.id);

    if (venueCategoryIds.length === 0) {
      console.log("[VenueScreen] No venue-type categories found, skipping backfill");
      return { updated: 0 };
    }

    const result = await db.update(businesses)
      .set({ venueScreenLikely: true })
      .where(
        sql`${businesses.venueScreenLikely} = false AND ${businesses.categoryIds} && ARRAY[${sql.join(venueCategoryIds.map((id: string) => sql`${id}`), sql`, `)}]::text[]`
      );

    const updated = (result as any).rowCount ?? 0;
    console.log(`[VenueScreen] Backfill complete: ${updated} businesses flagged as venue-screen-likely`);
    return { updated };
  } catch (err) {
    console.error("[VenueScreen] Backfill failed:", err);
    return { updated: 0 };
  }
}

const BUSINESS_WORD_BLOCKLIST = /\b(?:church|yoga|grooming|dentist|dental|auto|tire|bakery|coffee|roasters|veterinar|salon|spa|barber|clinic|hospital|school|academy|university|college|restaurant|grill|bar\b|pub\b|tavern|brewery|fitness|gym|chiropractic|pediatric|orthodont|dermatolog|optic|eye\s*care|pet|animal|daycare|child|learning|insurance|realt|mortgage|law\s+office|attorney|accounting|tax\s+service|plumbing|electric|hvac|landscap|clean|laundry|storage|repair|tattoo|photo|print|nail|lash|wax|tan\b|threading|massage|therap|counsel|psycholog|physical\s*therap|urgent\s*care|smallcakes|cupcake|donut|doughnut|pizza|taco|burger|sushi|pho|ramen|wing|chicken|bbq|barbecue|smokehouse|deli|sub|sandwich|ice\s*cream|froyo|juice|smoothie|acai|bowl|woof\s*gang|petsmart|petco|genesis|landmark|summit|rooster|amélie|amelie)\b/i;

function isStandaloneShoppingCenter(name: string): ShoppingCenterDetection {
  if (BUSINESS_WORD_BLOCKLIST.test(name)) {
    return { isShoppingCenter: false, centerType: "OTHER" };
  }

  const trimmed = name.trim();

  if (/\b(?:mall|galleria)\b/i.test(trimmed)) {
    return { isShoppingCenter: true, centerType: "MALL" };
  }

  if (/\bshopping\s+cent(?:er|re)\b/i.test(trimmed)) {
    return { isShoppingCenter: true, centerType: "SHOPPING_CENTER" };
  }

  if (/\btown\s*cent(?:er|re)\b/i.test(trimmed)) {
    return { isShoppingCenter: true, centerType: "SHOPPING_CENTER" };
  }

  if (/\bmarketplace\s*$/i.test(trimmed)) {
    return { isShoppingCenter: true, centerType: "SHOPPING_CENTER" };
  }

  if (/\boutlet(?:s)?\s*$/i.test(trimmed)) {
    return { isShoppingCenter: true, centerType: "SHOPPING_CENTER" };
  }

  if (/\bpromenade\s*$/i.test(trimmed)) {
    return { isShoppingCenter: true, centerType: "SHOPPING_CENTER" };
  }

  const shortNameSuffix = /^[\w\s'-]{3,25}\s+(commons|village|square|crossing|pavilion)\s*$/i;
  const shortNameSuffixDir = /^[\w\s'-]{3,25}\s+(commons|village|square|crossing|pavilion)\s+(east|west|north|south)\s*$/i;
  if (shortNameSuffix.test(trimmed) || shortNameSuffixDir.test(trimmed)) {
    return { isShoppingCenter: true, centerType: "SHOPPING_CENTER" };
  }

  return { isShoppingCenter: false, centerType: "OTHER" };
}

function normalizeStreetAddress(address: string): string | null {
  const match = address.match(/^(\d+)\s+(.+?)(?:\s*(?:,|$))/);
  if (!match) return null;
  const streetNum = match[1];
  const streetName = match[2]
    .toLowerCase()
    .replace(/\bste\.?\s*\S+/i, "")
    .replace(/\bsuite\s*\S+/i, "")
    .replace(/\bunit\s*\S+/i, "")
    .replace(/\b#\s*\S+/i, "")
    .replace(/\bapt\.?\s*\S+/i, "")
    .replace(/\s+[a-z]?\d{2,5}$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!streetName) return null;
  return `${streetNum} ${streetName}`;
}

export async function backfillShoppingCenters(): Promise<{ created: number; linked: number; skipped: number }> {
  let created = 0;
  let linked = 0;
  let skipped = 0;

  try {
    const allCities = await storage.getAllCities();
    const city = allCities.find((c: any) => c.slug === "charlotte") || allCities[0];
    if (!city) {
      console.log("[ShoppingCenter] No city found, skipping backfill");
      return { created: 0, linked: 0, skipped: 0 };
    }

    const allBusinesses = await db.select({
      id: businesses.id,
      name: businesses.name,
      address: businesses.address,
      googlePlaceId: businesses.googlePlaceId,
      shoppingCenterId: businesses.shoppingCenterId,
      zoneId: businesses.zoneId,
      cityId: businesses.cityId,
    }).from(businesses).where(sql`${businesses.presenceStatus} = 'ACTIVE'`);

    const addressToScId = new Map<string, string>();

    for (const biz of allBusinesses) {
      if (biz.shoppingCenterId) {
        skipped++;
        continue;
      }

      const detection = isStandaloneShoppingCenter(biz.name);
      if (detection.isShoppingCenter) {
        const scId = await upsertShoppingCenter(
          biz.name,
          biz.address || null,
          detection.centerType,
          biz.cityId || city.id,
          biz.zoneId || null
        );
        await db.update(businesses).set({ shoppingCenterId: scId }).where(eq(businesses.id, biz.id));
        linked++;
        created++;
        if (linked <= 20) console.log(`[ShoppingCenter] Created: ${biz.name} → ${scId}`);

        if (biz.address) {
          const normalized = normalizeStreetAddress(biz.address);
          if (normalized) addressToScId.set(normalized, scId);
        }
      } else {
        skipped++;
      }
    }

    if (addressToScId.size > 0) {
      let tenantLinked = 0;
      for (const biz of allBusinesses) {
        if (biz.shoppingCenterId || !biz.address) continue;
        const detection = isStandaloneShoppingCenter(biz.name);
        if (detection.isShoppingCenter) continue;

        const normalized = normalizeStreetAddress(biz.address);
        if (!normalized) continue;

        const matchedScId = addressToScId.get(normalized);
        if (matchedScId) {
          await db.update(businesses).set({ shoppingCenterId: matchedScId }).where(eq(businesses.id, biz.id));
          tenantLinked++;
          linked++;
          if (tenantLinked <= 20) console.log(`[ShoppingCenter] Tenant linked: ${biz.name} → ${matchedScId}`);
        }
      }
    }

    console.log(`[ShoppingCenter] Backfill complete: ${created} centers created, ${linked} businesses linked, ${skipped} skipped`);
    return { created, linked, skipped };
  } catch (err) {
    console.error("[ShoppingCenter] Backfill failed:", err);
    return { created: 0, linked: 0, skipped: 0 };
  }
}
