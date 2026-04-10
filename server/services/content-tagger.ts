import { db, pool } from "../db";
import { eq } from "drizzle-orm";
import {
  tags, zones, categories, businesses, events, articles,
  rssItems, regions, cities,
  type Tag,
} from "@shared/schema";

type ContentType =
  | "business" | "event" | "article" | "rss_item" | "marketplace_listing"
  | "post" | "reel" | "shop_item" | "shop_drop"
  | "job" | "local_podcast" | "podcast_episode" | "music_artist"
  | "radio_station" | "tv_item" | "video_content" | "attraction"
  | "area_fact" | "shopping_center" | "transit_stop" | "pulse_video"
  | "giveaway" | "poll" | "voting_nominee" | "crown_campaign"
  | "crown_winner" | "organization" | "review"
  | "curated_list" | "community_campaign" | "neighborhood_review"
  | "voting_campaign" | "expert_show_slot" | "live_broadcast"
  | "event_collection" | "event_series" | "transit_line"
  | "digital_card" | "crown_event" | "crown_participant";

export interface TagHints {
  cityId?: string | null;
  zoneId?: string | null;
  zoneSlug?: string | null;
  additionalZoneSlugs?: string[] | null;
  countySlug?: string | null;
  hubSlug?: string | null;
  hubRegionId?: string | null;
  zipCode?: string | null;
  categoryIds?: string[] | null;
  primaryCategoryId?: string | null;
  categoriesJson?: string[] | null;
  title?: string | null;
  category?: string | null;
  genre?: string | null;
  businessId?: string | null;
}

interface TagCache {
  allTags: Tag[];
  bySlug: Map<string, Tag>;
  byId: Map<string, Tag>;
  charlotteRootId: string | null;
  countyTagIds: Map<string, string>;
  hubTagIds: Map<string, string>;
  zoneToTagId: Map<string, string>;
  catToTagId: Map<string, string>;
}

let tagCache: TagCache | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000;

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadCache(): Promise<TagCache> {
  if (tagCache && Date.now() < cacheExpiry) return tagCache;

  const allTags = await db.select().from(tags);
  const bySlug = new Map(allTags.map(t => [t.slug, t]));
  const byId = new Map(allTags.map(t => [t.id, t]));

  const charlotteTag = bySlug.get("charlotte");
  const charlotteRootId = charlotteTag?.id || null;

  const countyTagIds = new Map<string, string>();
  const hubTagIds = new Map<string, string>();
  for (const t of allTags) {
    if (t.type === "location" && t.parentTagId === charlotteRootId) {
      if (t.slug.endsWith("-county")) {
        countyTagIds.set(t.slug, t.id);
      } else {
        hubTagIds.set(t.slug, t.id);
      }
    }
  }

  const allZones = await db.select().from(zones);
  const zoneToTagId = new Map<string, string>();
  for (const z of allZones) {
    const tag = bySlug.get(slugify(z.name));
    if (tag && tag.type === "location") zoneToTagId.set(z.id, tag.id);
  }

  const allCats = await db.select().from(categories);
  const catToTagId = new Map<string, string>();
  for (const c of allCats) {
    const tag = bySlug.get(slugify(c.name));
    if (tag && tag.type === "topic") catToTagId.set(c.id, tag.id);
  }

  tagCache = { allTags, bySlug, byId, charlotteRootId, countyTagIds, hubTagIds, zoneToTagId, catToTagId };
  cacheExpiry = Date.now() + CACHE_TTL;
  return tagCache;
}

export function invalidateTagCache() {
  tagCache = null;
  cacheExpiry = 0;
}

const COUNTY_SLUG_MAP: Record<string, string> = {
  "MECK": "mecklenburg-county",
  "YORK": "york-county",
  "GASTON": "gaston-county",
  "IREDELL": "iredell-county",
  "CAB": "cabarrus-county",
  "UNION": "union-county",
  "ROWAN": "rowan-county",
  "STANLY": "stanly-county",
  "CHESTER": "chester-county",
  "LANCASTER": "lancaster-county",
  "LINCOLN": "lincoln-county",
  "ANSON": "anson-county",
  "CLEVELAND": "cleveland-county",
  "CATAWBA": "catawba-county",
  "ALEXANDER": "alexander-county",
  "BURKE": "burke-county",
  "CALDWELL": "caldwell-county",
  "MCDOWELL": "mcdowell-county",
  "CHESTERFIELD": "chesterfield-county",
};

const HUB_CODE_TO_COUNTY: Record<string, string> = {
  "UPTOWN": "MECK", "NODA": "MECK", "PLAZAMIDWOOD": "MECK", "SOUTHEND": "MECK",
  "DILWORTH": "MECK", "MYERSPARK": "MECK", "ELIZABETH": "MECK", "SOUTHPARK": "MECK",
  "COTSWOLD": "MECK", "UNICITY": "MECK", "STEELECREEK": "MECK", "BALLANTYNE": "MECK",
  "LOSO": "MECK", "WESTEND": "MECK",
  "HUNTERSVILLE": "MECK", "CORNELIUS": "MECK", "DAVIDSON": "MECK",
  "MATTHEWS": "MECK", "MINTHILL": "MECK", "PINEVILLE": "MECK", "NORTHLAKE": "MECK",
  "ROCKHILL": "YORK", "LAKEWYLIE": "YORK", "FORTMILL": "YORK", "TEGACAY": "YORK",
  "CLOVER": "YORK", "YORK_TOWN": "YORK",
  "GASTONIA": "GASTON", "BELMONT": "GASTON", "MOUNTHOLLY": "GASTON",
  "CRAMERTON": "GASTON", "LOWELL": "GASTON", "MCADENVILLE": "GASTON", "RANLO": "GASTON",
  "MOORESVILLE": "IREDELL", "STATESVILLE": "IREDELL", "TROUTMAN": "IREDELL",
  "CONCORD": "CAB", "KANNAPOLIS": "CAB", "HARRISBURG": "CAB", "MIDLAND": "CAB", "MOUNTPLEASANT": "CAB",
  "INDIANTRAIL": "UNION", "WAXHAW": "UNION", "WEDDINGTON": "UNION", "STALLINGS": "UNION",
  "MONROE": "UNION", "MARVIN": "UNION", "WESLEYCHAPEL": "UNION",
  "SALISBURY": "ROWAN", "CHINAGROVE": "ROWAN",
  "ALBEMARLE": "STANLY", "LOCUST": "STANLY",
  "CHESTER_TOWN": "CHESTER", "GREATFALLS": "CHESTER",
  "INDIANLAND": "LANCASTER", "LANCASTER_TOWN": "LANCASTER",
  "DENVER": "LINCOLN", "LINCOLNTON": "LINCOLN",
  "WADESBORO": "ANSON", "POLKTON": "ANSON", "PEACHLAND": "ANSON", "MORVEN": "ANSON", "LILESVILLE": "ANSON",
  "SHELBY": "CLEVELAND", "KINGSMOUNTAIN": "CLEVELAND", "BOILINGSPRINGS": "CLEVELAND", "LAWNDALE": "CLEVELAND",
  "HICKORY": "CATAWBA", "NEWTON": "CATAWBA", "CONOVER": "CATAWBA", "MAIDEN": "CATAWBA",
  "TAYLORSVILLE": "ALEXANDER", "HIDDENITE": "ALEXANDER",
  "MORGANTON": "BURKE", "VALDESE": "BURKE", "GLENALPINE": "BURKE",
  "LENOIR": "CALDWELL", "GRANITEFALLS": "CALDWELL", "HUDSON": "CALDWELL",
  "MARION": "MCDOWELL", "OLDFORT": "MCDOWELL",
  "CHERAW": "CHESTERFIELD", "CHESTERFIELD_TOWN": "CHESTERFIELD", "PAGELAND": "CHESTERFIELD",
};

const ZONE_TO_COUNTY: Record<string, string> = {
  "uptown": "MECK", "south-end": "MECK", "noda": "MECK", "plaza-midwood": "MECK",
  "dilworth": "MECK", "myers-park": "MECK", "southpark": "MECK", "elizabeth": "MECK",
  "cotswold": "MECK", "montford": "MECK", "steele-creek": "MECK", "providence": "MECK",
  "east-forest": "MECK", "ayrsley": "MECK", "eastway": "MECK",
  "university-city": "MECK", "ballantyne": "MECK", "northlake": "MECK",
  "huntersville": "MECK", "cornelius": "MECK", "davidson": "MECK",
  "mint-hill": "MECK", "matthews": "MECK", "pineville": "MECK",
  "mooresville": "IREDELL", "troutman": "IREDELL", "statesville": "IREDELL",
  "concord": "CAB", "kannapolis": "CAB", "harrisburg": "CAB", "midland": "CAB", "mount-pleasant": "CAB",
  "monroe": "UNION", "indian-trail": "UNION", "waxhaw": "UNION", "weddington": "UNION",
  "stallings": "UNION", "marvin": "UNION", "wesley-chapel": "UNION",
  "rock-hill": "YORK", "lake-wylie": "YORK", "fort-mill": "YORK", "tega-cay": "YORK",
  "clover": "YORK", "york": "YORK",
  "gastonia": "GASTON", "belmont": "GASTON", "mount-holly": "GASTON",
  "cramerton": "GASTON", "lowell": "GASTON", "mcadenville": "GASTON", "ranlo": "GASTON",
  "salisbury": "ROWAN", "china-grove": "ROWAN",
  "albemarle": "STANLY", "locust": "STANLY",
  "denver": "LINCOLN", "lincolnton": "LINCOLN",
  "shelby": "CLEVELAND", "kings-mountain": "CLEVELAND",
  "hickory": "CATAWBA", "newton": "CATAWBA", "conover": "CATAWBA", "maiden": "CATAWBA",
};

const ZIP_TO_COUNTY: Record<string, string> = {
  "28202": "MECK", "28203": "MECK", "28204": "MECK", "28205": "MECK", "28206": "MECK",
  "28207": "MECK", "28208": "MECK", "28209": "MECK", "28210": "MECK", "28211": "MECK",
  "28212": "MECK", "28213": "MECK", "28214": "MECK", "28215": "MECK", "28216": "MECK",
  "28217": "MECK", "28226": "MECK", "28227": "MECK", "28262": "MECK", "28269": "MECK",
  "28270": "MECK", "28273": "MECK", "28277": "MECK", "28278": "MECK",
  "28031": "MECK", "28035": "MECK", "28036": "MECK", "28078": "MECK",
  "28104": "MECK", "28105": "MECK", "28134": "MECK",
  "28025": "CAB", "28027": "CAB", "28075": "CAB", "28081": "CAB", "28083": "CAB",
  "28107": "CAB", "28124": "CAB",
  "28052": "GASTON", "28054": "GASTON", "28056": "GASTON", "28012": "GASTON",
  "28120": "GASTON", "28032": "GASTON", "28098": "GASTON", "28101": "GASTON",
  "28115": "IREDELL", "28117": "IREDELL", "28166": "IREDELL", "28625": "IREDELL", "28677": "IREDELL",
  "28079": "UNION", "28110": "UNION", "28112": "UNION", "28173": "UNION",
  "29730": "YORK", "29732": "YORK", "29733": "YORK", "29710": "YORK", "29715": "YORK", "29708": "YORK", "29745": "YORK",
  "28144": "ROWAN", "28146": "ROWAN", "28147": "ROWAN", "28023": "ROWAN",
  "28001": "STANLY", "28002": "STANLY", "28097": "STANLY",
  "29706": "CHESTER", "29055": "CHESTER",
  "29707": "LANCASTER", "29720": "LANCASTER",
  "28037": "LINCOLN", "28092": "LINCOLN",
  "28170": "ANSON", "28135": "ANSON", "28133": "ANSON", "28119": "ANSON", "28091": "ANSON",
  "28150": "CLEVELAND", "28152": "CLEVELAND", "28086": "CLEVELAND", "28017": "CLEVELAND", "28090": "CLEVELAND",
  "28601": "CATAWBA", "28602": "CATAWBA", "28658": "CATAWBA", "28613": "CATAWBA", "28650": "CATAWBA",
  "28681": "ALEXANDER", "28636": "ALEXANDER",
  "28655": "BURKE", "28690": "BURKE", "28628": "BURKE",
  "28645": "CALDWELL", "28630": "CALDWELL", "28638": "CALDWELL",
  "28752": "MCDOWELL", "28762": "MCDOWELL",
  "29520": "CHESTERFIELD", "29709": "CHESTERFIELD", "29728": "CHESTERFIELD",
};

const GENRE_TO_TOPIC: Record<string, string> = {
  "hip-hop": "entertainment", "hip hop": "entertainment", "rap": "entertainment",
  "r&b": "entertainment", "rnb": "entertainment", "soul": "entertainment",
  "rock": "entertainment", "pop": "entertainment", "country": "entertainment",
  "jazz": "entertainment", "gospel": "faith", "christian": "faith",
  "latin": "entertainment", "reggae": "entertainment", "electronic": "entertainment",
  "classical": "entertainment", "blues": "entertainment", "folk": "entertainment",
  "news": "news", "talk": "news", "sports": "sports",
  "comedy": "entertainment", "true crime": "public-safety",
  "business": "business", "technology": "technology", "tech": "technology",
  "health": "health-wellness", "education": "education",
  "food": "food-dining", "travel": "travel",
};

async function upsertContentTag(contentType: string, contentId: string, tagId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `INSERT INTO content_tags (id, content_type, content_id, tag_id)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (content_type, content_id, tag_id) DO NOTHING`,
      [contentType, contentId, tagId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ContentTagger] upsertContentTag failed ${contentType}/${contentId.substring(0, 8)} tag=${tagId.substring(0, 8)}:`, msg);
    return false;
  }
}

async function resolveCountyCode(hints: TagHints): Promise<string | null> {
  if (hints.zoneSlug) {
    const code = ZONE_TO_COUNTY[hints.zoneSlug];
    if (code) return code;
  }

  if (hints.zoneId) {
    const [zone] = await db.select().from(zones).where(eq(zones.id, hints.zoneId)).limit(1);
    if (zone?.slug) {
      const code = ZONE_TO_COUNTY[zone.slug];
      if (code) return code;
    }
    if (zone?.county) {
      for (const [code, name] of Object.entries(COUNTY_SLUG_MAP)) {
        if (name.replace("-county", "") === zone.county.toLowerCase()) return code;
      }
    }
  }

  if (hints.zipCode) {
    const code = ZIP_TO_COUNTY[hints.zipCode];
    if (code) return code;
  }

  if (hints.hubSlug) {
    const hubCode = hints.hubSlug.toUpperCase().replace(/-/g, "");
    const code = HUB_CODE_TO_COUNTY[hubCode];
    if (code) return code;
  }

  if (hints.hubRegionId) {
    const [region] = await db.select().from(regions).where(eq(regions.id, hints.hubRegionId)).limit(1);
    if (region?.code) {
      const code = HUB_CODE_TO_COUNTY[region.code];
      if (code) return code;
    }
    if (region?.parentRegionId) {
      const [parent] = await db.select().from(regions).where(eq(regions.id, region.parentRegionId)).limit(1);
      if (parent?.code) {
        return parent.code;
      }
    }
  }

  return null;
}

function resolveTopicSlugs(hints: TagHints, cache: TagCache): string[] {
  const result = new Set<string>();

  if (hints.categoryIds) {
    for (const catId of hints.categoryIds) {
      const tagId = cache.catToTagId.get(catId);
      if (tagId) {
        const tag = cache.byId.get(tagId);
        if (tag) result.add(tag.slug);
      }
    }
  }

  if (hints.primaryCategoryId) {
    const tagId = cache.catToTagId.get(hints.primaryCategoryId);
    if (tagId) {
      const tag = cache.byId.get(tagId);
      if (tag) result.add(tag.slug);
    }
  }

  if (hints.category) {
    const slug = slugify(hints.category);
    if (cache.bySlug.has(slug)) result.add(slug);
  }

  if (hints.genre) {
    const genreLower = hints.genre.toLowerCase().trim();
    const topicSlug = GENRE_TO_TOPIC[genreLower];
    if (topicSlug && cache.bySlug.has(topicSlug)) result.add(topicSlug);
  }

  if (hints.categoriesJson && hints.categoriesJson.length > 0) {
    for (const cat of hints.categoriesJson) {
      const normalized = cat.toLowerCase().trim();
      const catSlug = slugify(cat);
      if (cache.bySlug.has(catSlug) && cache.bySlug.get(catSlug)!.type === "topic") {
        result.add(catSlug);
        continue;
      }
      const mapped = RSS_CATEGORY_MAP[normalized];
      if (mapped && cache.bySlug.has(mapped)) {
        result.add(mapped);
      }
    }
  }

  if (result.size === 0 && hints.title) {
    const lower = hints.title.toLowerCase();
    for (const entry of TITLE_KEYWORD_MAP) {
      for (const kw of entry.keywords) {
        if (lower.includes(kw)) {
          if (cache.bySlug.has(entry.slug)) result.add(entry.slug);
          break;
        }
      }
    }
  }

  return Array.from(result);
}

export async function applyFullTagStack(
  contentType: ContentType,
  contentId: string,
  hints: TagHints,
): Promise<number> {
  const cache = await loadCache();
  if (!cache.charlotteRootId) return 0;

  let count = 0;
  const tagIdsApplied = new Set<string>();

  if (await upsertContentTag(contentType, contentId, cache.charlotteRootId)) count++;
  tagIdsApplied.add(cache.charlotteRootId);

  const countyCode = await resolveCountyCode(hints);
  if (countyCode) {
    const countySlug = COUNTY_SLUG_MAP[countyCode];
    if (countySlug) {
      const countyTagId = cache.countyTagIds.get(countySlug);
      if (countyTagId && !tagIdsApplied.has(countyTagId)) {
        if (await upsertContentTag(contentType, contentId, countyTagId)) count++;
        tagIdsApplied.add(countyTagId);
      }
    }
  }

  if (hints.zoneId) {
    const tagId = cache.zoneToTagId.get(hints.zoneId);
    if (tagId && !tagIdsApplied.has(tagId)) {
      if (await upsertContentTag(contentType, contentId, tagId)) count++;
      tagIdsApplied.add(tagId);
    }
  }

  if (hints.zoneSlug) {
    const tag = cache.bySlug.get(hints.zoneSlug) || cache.bySlug.get(slugify(hints.zoneSlug));
    if (tag && tag.type === "location" && !tagIdsApplied.has(tag.id)) {
      if (await upsertContentTag(contentType, contentId, tag.id)) count++;
      tagIdsApplied.add(tag.id);
    }
  }

  if (hints.additionalZoneSlugs && hints.additionalZoneSlugs.length > 0) {
    for (const extraSlug of hints.additionalZoneSlugs) {
      const tag = cache.bySlug.get(extraSlug) || cache.bySlug.get(slugify(extraSlug));
      if (tag && tag.type === "location" && !tagIdsApplied.has(tag.id)) {
        if (await upsertContentTag(contentType, contentId, tag.id)) count++;
        tagIdsApplied.add(tag.id);
      }
    }
  }

  if (hints.countySlug) {
    const countyTag = cache.bySlug.get(hints.countySlug) || cache.bySlug.get(slugify(hints.countySlug));
    if (countyTag && !tagIdsApplied.has(countyTag.id)) {
      if (await upsertContentTag(contentType, contentId, countyTag.id)) count++;
      tagIdsApplied.add(countyTag.id);
    }
  }

  if (hints.hubSlug) {
    const tag = cache.bySlug.get(hints.hubSlug) || cache.bySlug.get(slugify(hints.hubSlug));
    if (tag && tag.type === "location" && !tagIdsApplied.has(tag.id)) {
      if (await upsertContentTag(contentType, contentId, tag.id)) count++;
      tagIdsApplied.add(tag.id);
    }
  }

  if (hints.zipCode) {
    const zipSlug = `zip-${hints.zipCode}`;
    const tag = cache.bySlug.get(zipSlug) || cache.bySlug.get(hints.zipCode);
    if (tag && tag.type === "location" && !tagIdsApplied.has(tag.id)) {
      if (await upsertContentTag(contentType, contentId, tag.id)) count++;
      tagIdsApplied.add(tag.id);
    }
  }

  const topicSlugs = resolveTopicSlugs(hints, cache);
  for (const slug of topicSlugs) {
    const tag = cache.bySlug.get(slug);
    if (tag && !tagIdsApplied.has(tag.id)) {
      if (await upsertContentTag(contentType, contentId, tag.id)) count++;
      tagIdsApplied.add(tag.id);

      if (tag.parentTagId && !tagIdsApplied.has(tag.parentTagId)) {
        if (await upsertContentTag(contentType, contentId, tag.parentTagId)) count++;
        tagIdsApplied.add(tag.parentTagId);
      }
    }
  }

  return count;
}

const RSS_CATEGORY_MAP: Record<string, string> = {
  "local news": "news", "news": "news", "breaking news": "news", "headlines": "news", "top stories": "news",
  "crime": "public-safety", "public safety": "public-safety", "police": "public-safety", "courts": "public-safety",
  "food": "food-dining", "food & drink": "food-dining", "dining": "food-dining", "restaurants": "food-dining",
  "entertainment": "entertainment", "movies": "entertainment", "music": "entertainment",
  "arts": "arts-culture", "arts & culture": "arts-culture", "culture": "arts-culture",
  "sports": "sports", "football": "sports", "basketball": "sports", "baseball": "sports",
  "panthers": "sports", "hornets": "sports", "charlotte fc": "sports", "nascar": "sports",
  "business": "business", "economy": "business", "finance": "business", "jobs": "business",
  "real estate": "real-estate", "housing": "real-estate", "property": "real-estate",
  "education": "education", "schools": "education",
  "health": "health-wellness", "healthcare": "health-wellness", "fitness": "health-wellness",
  "community": "community", "neighborhoods": "community", "volunteer": "community", "nonprofit": "community",
  "government": "government", "politics": "government", "city council": "government", "election": "government",
  "weather": "weather", "forecast": "weather",
  "events": "events", "things to do": "events", "calendar": "events", "festivals": "events",
  "family": "family", "kids": "family", "parenting": "family",
  "pets": "pets-animals", "animals": "pets-animals",
  "outdoors": "outdoors", "parks": "outdoors", "hiking": "outdoors",
  "travel": "travel", "tourism": "travel",
  "automotive": "automotive", "traffic": "automotive", "transportation": "automotive", "transit": "automotive",
  "shopping": "shopping-retail", "retail": "shopping-retail",
  "technology": "technology", "tech": "technology", "startups": "technology",
  "opinion": "opinion", "editorial": "opinion",
  "lifestyle": "lifestyle", "fashion": "lifestyle", "beauty": "lifestyle",
  "faith": "faith", "religion": "faith", "church": "faith",
  "development": "development", "construction": "development", "infrastructure": "development",
  "seniors": "seniors", "senior": "seniors", "aging": "seniors", "retirement": "seniors",
  "nightlife": "nightlife", "bars": "nightlife",
};

const TITLE_KEYWORD_MAP: Array<{ keywords: string[]; slug: string }> = [
  { keywords: ["murder", "shooting", "crime", "arrest", "police", "robbery", "assault", "homicide"], slug: "public-safety" },
  { keywords: ["restaurant", "chef", "menu", "dining", "brewery", "food truck", "brunch", "cafe", "bakery"], slug: "food-dining" },
  { keywords: ["concert", "festival", "show", "performance", "theater", "comedy", "live music"], slug: "entertainment" },
  { keywords: ["game", "score", "season", "playoff", "championship", "panthers", "hornets", "knights"], slug: "sports" },
  { keywords: ["school", "student", "teacher", "campus", "graduation"], slug: "education" },
  { keywords: ["council", "mayor", "vote", "election", "ordinance", "governor"], slug: "government" },
  { keywords: ["apartment", "condo", "mortgage", "housing", "rent", "realty"], slug: "real-estate" },
  { keywords: ["startup", "funding", "investment", "hiring", "layoff", "revenue", "company", "ceo"], slug: "business" },
  { keywords: ["hospital", "clinic", "doctor", "patient", "vaccine", "therapy", "mental health"], slug: "health-wellness" },
  { keywords: ["art", "gallery", "exhibit", "museum", "sculpture", "mural"], slug: "arts-culture" },
  { keywords: ["park", "trail", "hike", "greenway", "lake", "outdoor"], slug: "outdoors" },
  { keywords: ["volunteer", "donate", "nonprofit", "charity", "community", "neighborhood"], slug: "community" },
  { keywords: ["weather", "storm", "rain", "forecast", "hurricane", "tornado"], slug: "weather" },
  { keywords: ["bar", "club", "nightlife", "cocktail", "happy hour", "lounge"], slug: "nightlife" },
  { keywords: ["dog", "cat", "pet", "animal", "shelter", "veterinary"], slug: "pets-animals" },
  { keywords: ["family", "kids", "children", "parent", "playground"], slug: "family" },
  { keywords: ["traffic", "highway", "transit", "commute", "i-77", "i-85", "i-485", "light rail"], slug: "automotive" },
  { keywords: ["shop", "store", "retail", "mall", "boutique", "sale"], slug: "shopping-retail" },
  { keywords: ["development", "construction", "rezoning", "building", "skyline", "mixed-use"], slug: "development" },
  { keywords: ["senior", "seniors", "aging", "retirement", "elderly"], slug: "seniors" },
  { keywords: ["salon", "barber", "barbershop", "hair salon", "spa", "beauty", "skincare"], slug: "lifestyle" },
];

export async function ensureTagHierarchyReady(): Promise<void> {
  let cache = await loadCache();
  if (!cache.charlotteRootId) {
    try {
      const cityRows = await db.select().from(cities).where(eq(cities.slug, "charlotte")).limit(1);
      if (cityRows.length > 0) {
        await db.insert(tags).values({
          name: "Charlotte",
          slug: "charlotte",
          type: "location",
          parentTagId: null,
          icon: "MapPin",
          sortOrder: 0,
        }).onConflictDoNothing();
        console.log("[ContentTagger] Created missing 'charlotte' root location tag");
        invalidateTagCache();
        cache = await loadCache();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[ContentTagger] Failed to create charlotte root tag:", msg);
    }
    if (!cache.charlotteRootId) return;
  }

  const countyNames: Array<{ code: string; name: string }> = [
    { code: "MECK", name: "Mecklenburg County" },
    { code: "YORK", name: "York County" },
    { code: "GASTON", name: "Gaston County" },
    { code: "IREDELL", name: "Iredell County" },
    { code: "CAB", name: "Cabarrus County" },
    { code: "UNION", name: "Union County" },
    { code: "ROWAN", name: "Rowan County" },
    { code: "STANLY", name: "Stanly County" },
    { code: "CHESTER", name: "Chester County" },
    { code: "LANCASTER", name: "Lancaster County" },
    { code: "LINCOLN", name: "Lincoln County" },
    { code: "ANSON", name: "Anson County" },
    { code: "CLEVELAND", name: "Cleveland County" },
    { code: "CATAWBA", name: "Catawba County" },
    { code: "ALEXANDER", name: "Alexander County" },
    { code: "BURKE", name: "Burke County" },
    { code: "CALDWELL", name: "Caldwell County" },
    { code: "MCDOWELL", name: "McDowell County" },
    { code: "CHESTERFIELD", name: "Chesterfield County" },
  ];

  let created = 0;
  for (const county of countyNames) {
    const slug = COUNTY_SLUG_MAP[county.code];
    if (!slug) continue;
    const existing = cache.bySlug.get(slug);
    if (!existing) {
      try {
        await db.insert(tags).values({
          name: county.name,
          slug,
          type: "location",
          parentTagId: cache.charlotteRootId,
          icon: "MapPin",
          sortOrder: 0,
        }).onConflictDoNothing();
        created++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ContentTagger] County tag insert failed for ${slug}: ${msg}`);
      }
    }
  }

  if (created > 0) {
    console.log(`[ContentTagger] Created ${created} county tags`);
    invalidateTagCache();
  }
}

export async function cleanupNashvilleTags(): Promise<number> {
  const result = await pool.query(`
    DELETE FROM content_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug LIKE 'nashville-%');
  `);
  const deleteResult = await pool.query(`
    DELETE FROM tags WHERE slug LIKE 'nashville-%';
  `);
  const count = deleteResult.rowCount || 0;
  if (count > 0) {
    console.log(`[ContentTagger] Deleted ${count} nashville-* tags`);
    invalidateTagCache();
  }
  return count;
}

export async function cleanupOrphanLocTags(): Promise<number> {
  const cache = await loadCache();
  if (!cache.charlotteRootId) return 0;

  const locTags = cache.allTags.filter(t => t.slug.startsWith("loc-") && t.type === "location");
  let fixed = 0;

  for (const locTag of locTags) {
    const baseName = locTag.slug.replace("loc-", "");
    const realTag = cache.bySlug.get(baseName) || cache.bySlug.get(slugify(locTag.name));

    if (realTag && realTag.id !== locTag.id && realTag.type === "location") {
      await pool.query(
        `DELETE FROM content_tags WHERE tag_id = $2 AND EXISTS (
          SELECT 1 FROM content_tags ct2 WHERE ct2.content_type = content_tags.content_type
            AND ct2.content_id = content_tags.content_id AND ct2.tag_id = $1
        )`,
        [realTag.id, locTag.id]
      );
      await pool.query(
        `UPDATE content_tags SET tag_id = $1 WHERE tag_id = $2`,
        [realTag.id, locTag.id]
      );
      await pool.query(`DELETE FROM tags WHERE id = $1`, [locTag.id]);
      fixed++;
    } else {
      if (!locTag.parentTagId) {
        await db.update(tags).set({ parentTagId: cache.charlotteRootId }).where(eq(tags.id, locTag.id));
        fixed++;
      }
    }
  }

  if (fixed > 0) {
    console.log(`[ContentTagger] Cleaned up ${fixed} orphan loc-* tags`);
    invalidateTagCache();
  }
  return fixed;
}

interface SafeRow {
  id: string;
  city_id?: string;
  zone_id?: string | null;
  zone_slug?: string | null;
  business_id?: string | null;
  hub_slug?: string | null;
  hub_region_id?: string | null;
  category_ids?: string[] | null;
  category?: string | null;
  genre?: string | null;
  title?: string | null;
  name?: string | null;
  zip_code?: string | null;
  tv_tags?: string | null;
  marketplace_listing_id?: string | null;
  provider_id?: string | null;
  posted_by_business_id?: string | null;
  creator_business_id?: string | null;
  category_id?: string | null;
  title_en?: string | null;
  [key: string]: unknown;
}

async function safeFetch(tableName: string, columns: string, where?: string): Promise<SafeRow[]> {
  try {
    const q = `SELECT ${columns} FROM ${tableName}${where ? " WHERE " + where : ""} LIMIT 10000`;
    const result = await pool.query(q);
    return result.rows;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ContentTagger] safeFetch(${tableName}) skipped: ${msg}`);
    return [];
  }
}

export async function backfillAllContent(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  await ensureTagHierarchyReady();
  await cleanupNashvilleTags();
  await cleanupOrphanLocTags();

  invalidateTagCache();

  const cityRows = await db.select().from(cities).where(eq(cities.slug, "charlotte")).limit(1);
  const cityId = cityRows[0]?.id;
  if (!cityId) {
    console.log("[ContentTagger] No charlotte city found, skipping backfill");
    return stats;
  }

  const cache = await loadCache();
  if (cache.charlotteRootId) {
    try {
      const orphanResult = await pool.query(
        `UPDATE tags SET parent_tag_id = $1
         WHERE type = 'location' AND parent_tag_id IS NULL AND slug != 'charlotte'
         AND id != $1`,
        [cache.charlotteRootId]
      );
      const reparented = orphanResult.rowCount || 0;
      if (reparented > 0) {
        console.log(`[ContentTagger] Reparented ${reparented} orphan location tags under charlotte root`);
        invalidateTagCache();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[ContentTagger] Reparent orphan tags failed:", msg);
    }
  }

  const allBusinesses = await db.select().from(businesses).where(eq(businesses.cityId, cityId));
  let bizCount = 0;
  for (const biz of allBusinesses) {
    bizCount += await applyFullTagStack("business", biz.id, {
      cityId, zoneId: biz.zoneId, categoryIds: biz.categoryIds,
      zipCode: biz.zip || null,
      title: biz.name,
    });
  }
  stats.businesses = bizCount;

  const allEvents = await db.select().from(events).where(eq(events.cityId, cityId));
  let evtCount = 0;
  for (const evt of allEvents) {
    const hints: TagHints = {
      cityId, zoneId: evt.zoneId, categoryIds: evt.categoryIds,
      title: evt.title,
    };
    if (evt.hostBusinessId) {
      const host = allBusinesses.find(b => b.id === evt.hostBusinessId);
      if (host) {
        hints.zoneId = hints.zoneId || host.zoneId;
        if (!hints.categoryIds?.length && host.categoryIds?.length) {
          hints.categoryIds = host.categoryIds;
        }
      }
    }
    evtCount += await applyFullTagStack("event", evt.id, hints);
  }
  stats.events = evtCount;

  const allArticles = await db.select().from(articles).where(eq(articles.cityId, cityId));
  let artCount = 0;
  for (const art of allArticles) {
    artCount += await applyFullTagStack("article", art.id, {
      cityId, zoneId: art.zoneId, primaryCategoryId: art.primaryCategoryId,
      title: art.title,
    });
  }
  stats.articles = artCount;

  try {
    const allRss = await db.select().from(rssItems).where(eq(rssItems.cityId, cityId));
    let rssCount = 0;
    for (const item of allRss) {
      rssCount += await applyFullTagStack("rss_item", item.id, {
        cityId, zoneSlug: item.zoneSlug || undefined,
        categoriesJson: item.categoriesJson || undefined,
        title: item.title,
      });
    }
    stats.rss_items = rssCount;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ContentTagger] RSS backfill error: ${msg}`);
  }

  const tvRows = await safeFetch("tv_items", "id, city_id, hub_slug, category_ids, title, tags as tv_tags", `city_id = '${cityId}'`);
  let tvCount = 0;
  for (const row of tvRows) {
    tvCount += await applyFullTagStack("tv_item", row.id, {
      cityId, hubSlug: row.hub_slug,
      categoryIds: row.category_ids,
      title: row.title,
    });
  }
  stats.tv_items = tvCount;

  const factRows = await safeFetch("area_facts", "id, city_id, hub_region_id, zone_slug, category", `city_id = '${cityId}'`);
  let factCount = 0;
  for (const row of factRows) {
    factCount += await applyFullTagStack("area_fact", row.id, {
      cityId, hubRegionId: row.hub_region_id, zoneSlug: row.zone_slug,
      category: row.category,
    });
  }
  stats.area_facts = factCount;

  const attractionRows = await safeFetch("attractions", "id, city_id, zone_id", `city_id = '${cityId}'`);
  let attrCount = 0;
  for (const row of attractionRows) {
    attrCount += await applyFullTagStack("attraction", row.id, {
      cityId, zoneId: row.zone_id,
    });
  }
  stats.attractions = attrCount;

  const transitRows = await safeFetch("transit_stops", "id, city_id, zone_id", `city_id = '${cityId}'`);
  let transitCount = 0;
  for (const row of transitRows) {
    transitCount += await applyFullTagStack("transit_stop", row.id, {
      cityId, zoneId: row.zone_id,
    });
  }
  stats.transit_stops = transitCount;

  const shopCenterRows = await safeFetch("shopping_centers", "id, city_id, zone_id", `city_id = '${cityId}'`);
  let scCount = 0;
  for (const row of shopCenterRows) {
    scCount += await applyFullTagStack("shopping_center", row.id, {
      cityId, zoneId: row.zone_id,
    });
  }
  stats.shopping_centers = scCount;

  const radioRows = await safeFetch("radio_stations", "id, city_id, hub_slug, station_type", `city_id = '${cityId}'`);
  let radioCount = 0;
  for (const row of radioRows) {
    radioCount += await applyFullTagStack("radio_station", row.id, {
      cityId, hubSlug: row.hub_slug,
    });
  }
  stats.radio_stations = radioCount;

  const podcastRows = await safeFetch("local_podcasts", "id, city_id, hub_slug, category", `city_id = '${cityId}'`);
  let podCount = 0;
  for (const row of podcastRows) {
    podCount += await applyFullTagStack("local_podcast", row.id, {
      cityId, hubSlug: row.hub_slug, category: row.category,
    });
  }
  stats.local_podcasts = podCount;

  const musicRows = await safeFetch("music_artists", "id, city_id, genre", `city_id = '${cityId}'`);
  let musicCount = 0;
  for (const row of musicRows) {
    musicCount += await applyFullTagStack("music_artist", row.id, {
      cityId, genre: row.genre,
    });
  }
  stats.music_artists = musicCount;

  const jobRows = await safeFetch("jobs", "id, city_id, business_id, zip_code, title", `city_id = '${cityId}'`);
  let jobCount = 0;
  for (const row of jobRows) {
    const hints: TagHints = { cityId, zipCode: row.zip_code, title: row.title };
    if (row.business_id) {
      const biz = allBusinesses.find(b => b.id === row.business_id);
      if (biz) { hints.zoneId = biz.zoneId; hints.categoryIds = biz.categoryIds; }
    }
    jobCount += await applyFullTagStack("job", row.id, hints);
  }
  stats.jobs = jobCount;

  const giveawayRows = await safeFetch("giveaways", "id, city_id, zone_id, title", `city_id = '${cityId}'`);
  let giveCount = 0;
  for (const row of giveawayRows) {
    giveCount += await applyFullTagStack("giveaway", row.id, { cityId, zoneId: row.zone_id, title: row.title });
  }
  stats.giveaways = giveCount;

  const pollRows = await safeFetch("polls", "id, city_id", `city_id = '${cityId}'`);
  let pollCount = 0;
  for (const row of pollRows) {
    pollCount += await applyFullTagStack("poll", row.id, { cityId });
  }
  stats.polls = pollCount;

  const videoRows = await safeFetch("video_content", "id, city_id", `city_id = '${cityId}'`);
  let vidCount = 0;
  for (const row of videoRows) {
    vidCount += await applyFullTagStack("video_content", row.id, { cityId });
  }
  stats.video_content = vidCount;

  const pulseRows = await safeFetch("pulse_videos", "id, city_id", `city_id = '${cityId}'`);
  let pulseCount = 0;
  for (const row of pulseRows) {
    pulseCount += await applyFullTagStack("pulse_video", row.id, { cityId });
  }
  stats.pulse_videos = pulseCount;

  const reviewRows = await safeFetch("reviews", "id, business_id, marketplace_listing_id", "1=1");
  let reviewCount = 0;
  for (const row of reviewRows) {
    const hints: TagHints = { cityId };
    if (row.business_id) {
      const biz = allBusinesses.find(b => b.id === row.business_id);
      if (biz) { hints.zoneId = biz.zoneId; hints.categoryIds = biz.categoryIds; }
    }
    reviewCount += await applyFullTagStack("review", row.id, hints);
  }
  stats.reviews = reviewCount;

  const mplRows = await safeFetch("marketplace_listings", "id, city_id, posted_by_business_id, creator_business_id, zone_id, category, title", `city_id = '${cityId}'`);
  let mplCount = 0;
  for (const row of mplRows) {
    const hints: TagHints = { cityId, zoneId: row.zone_id, title: row.title };
    const mplBizId = (row.posted_by_business_id || row.creator_business_id) as string | null;
    if (mplBizId) {
      const biz = allBusinesses.find(b => b.id === mplBizId);
      if (biz) { hints.zoneId = hints.zoneId || biz.zoneId; if (!hints.categoryIds?.length) hints.categoryIds = biz.categoryIds; }
    }
    mplCount += await applyFullTagStack("marketplace_listing", row.id, hints);
  }
  stats.marketplace_listings = mplCount;

  const shopRows = await safeFetch("shop_items", "id, city_id, business_id, title", `city_id = '${cityId}'`);
  let shopCount = 0;
  for (const row of shopRows) {
    const hints: TagHints = { cityId, title: row.title };
    if (row.business_id) {
      const biz = allBusinesses.find(b => b.id === row.business_id);
      if (biz) { hints.zoneId = biz.zoneId; hints.categoryIds = biz.categoryIds; }
    }
    shopCount += await applyFullTagStack("shop_item", row.id, hints);
  }
  stats.shop_items = shopCount;

  const nomineeRows = await safeFetch("voting_nominees", "id, business_id, name", "1=1");
  let nomCount = 0;
  for (const row of nomineeRows) {
    const hints: TagHints = { cityId, title: row.name };
    if (row.business_id) {
      const biz = allBusinesses.find(b => b.id === row.business_id);
      if (biz) { hints.zoneId = biz.zoneId; hints.categoryIds = biz.categoryIds; }
    }
    nomCount += await applyFullTagStack("voting_nominee", row.id, hints);
  }
  stats.voting_nominees = nomCount;

  const cmsRows = await safeFetch("cms_content_items", "id, city_id, category_id, title_en", `city_id = '${cityId}'`);
  let cmsCount = 0;
  for (const row of cmsRows) {
    cmsCount += await applyFullTagStack("article", row.id, { cityId, primaryCategoryId: row.category_id as string | null, title: row.title_en as string | null });
  }
  stats.cms_content = cmsCount;

  const postRows = await safeFetch("posts", "id, city_id, business_id, title", `city_id = '${cityId}'`);
  let postCount = 0;
  for (const row of postRows) {
    const hints: TagHints = { cityId, title: row.title };
    if (row.business_id) {
      const biz = allBusinesses.find(b => b.id === row.business_id);
      if (biz) { hints.zoneId = biz.zoneId; hints.categoryIds = biz.categoryIds; }
    }
    postCount += await applyFullTagStack("post", row.id, hints);
  }
  stats.posts = postCount;

  const crownCampaignRows = await safeFetch("crown_campaigns", "id, city_id", `city_id = '${cityId}'`);
  let crownCampaignCount = 0;
  for (const row of crownCampaignRows) {
    crownCampaignCount += await applyFullTagStack("crown_campaign", row.id, { cityId });
  }
  stats.crown_campaigns = crownCampaignCount;

  const crownWinnerRows = await safeFetch("crown_winners", "id, city_id, category_id", `city_id = '${cityId}'`);
  let crownWinnerCount = 0;
  for (const row of crownWinnerRows) {
    crownWinnerCount += await applyFullTagStack("crown_winner", row.id, { cityId, primaryCategoryId: row.category_id as string | null });
  }
  stats.crown_winners = crownWinnerCount;

  const curatedRows = await safeFetch("curated_lists", "id, city_id, zone_id, category_id, title", `city_id = '${cityId}'`);
  let curatedCount = 0;
  for (const row of curatedRows) {
    curatedCount += await applyFullTagStack("curated_list", row.id, { cityId, zoneId: row.zone_id, primaryCategoryId: row.category_id as string | null, title: row.title });
  }
  stats.curated_lists = curatedCount;

  const commCampaignRows = await safeFetch("community_campaigns", "id, city_id, title", `city_id = '${cityId}'`);
  let commCampaignCount = 0;
  for (const row of commCampaignRows) {
    commCampaignCount += await applyFullTagStack("community_campaign", row.id, { cityId, title: row.title });
  }
  stats.community_campaigns = commCampaignCount;

  const neighborhoodReviewRows = await safeFetch("neighborhood_reviews", "id, city_id, zone_id", `city_id = '${cityId}'`);
  let nrCount = 0;
  for (const row of neighborhoodReviewRows) {
    nrCount += await applyFullTagStack("neighborhood_review", row.id, { cityId, zoneId: row.zone_id });
  }
  stats.neighborhood_reviews = nrCount;

  const votingCampaignRows = await safeFetch("voting_campaigns", "id, city_id, title", `city_id = '${cityId}'`);
  let vcCount = 0;
  for (const row of votingCampaignRows) {
    vcCount += await applyFullTagStack("voting_campaign", row.id, { cityId, title: row.title });
  }
  stats.voting_campaigns = vcCount;

  const expertSlotRows = await safeFetch("expert_show_slots", "id, city_id, hub_slug, business_id", `city_id = '${cityId}'`);
  let expertCount = 0;
  for (const row of expertSlotRows) {
    const hints: TagHints = { cityId, hubSlug: row.hub_slug };
    if (row.business_id) {
      const biz = allBusinesses.find(b => b.id === row.business_id);
      if (biz) { hints.zoneId = biz.zoneId; hints.categoryIds = biz.categoryIds; }
    }
    expertCount += await applyFullTagStack("expert_show_slot", row.id, hints);
  }
  stats.expert_show_slots = expertCount;

  const broadcastRows = await safeFetch("live_broadcasts", "id, city_id, hub_slug, title", `city_id = '${cityId}'`);
  let broadcastCount = 0;
  for (const row of broadcastRows) {
    broadcastCount += await applyFullTagStack("live_broadcast", row.id, { cityId, hubSlug: row.hub_slug, title: row.title });
  }
  stats.live_broadcasts = broadcastCount;

  const eventCollectionRows = await safeFetch("event_collections", "id, city_id, title", `city_id = '${cityId}'`);
  let ecCount = 0;
  for (const row of eventCollectionRows) {
    ecCount += await applyFullTagStack("event_collection", row.id, { cityId, title: row.title });
  }
  stats.event_collections = ecCount;

  const eventSeriesRows = await safeFetch("event_series", "id, city_id, zone_id, category_id, name", `city_id = '${cityId}'`);
  let esCount = 0;
  for (const row of eventSeriesRows) {
    esCount += await applyFullTagStack("event_series", row.id, { cityId, zoneId: row.zone_id, primaryCategoryId: row.category_id as string | null, title: row.name });
  }
  stats.event_series = esCount;

  const crownEventRows = await safeFetch("crown_events", "id, city_id, category_id, title", `city_id = '${cityId}'`);
  let crownEventCount = 0;
  for (const row of crownEventRows) {
    crownEventCount += await applyFullTagStack("crown_event", row.id, { cityId, primaryCategoryId: row.category_id as string | null, title: row.title });
  }
  stats.crown_events = crownEventCount;

  const crownParticipantRows = await safeFetch("crown_participants", "id, city_id, business_id, category_id, name", `city_id = '${cityId}'`);
  let crownPartCount = 0;
  for (const row of crownParticipantRows) {
    const hints: TagHints = { cityId, primaryCategoryId: row.category_id as string | null, title: row.name };
    if (row.business_id) {
      const biz = allBusinesses.find(b => b.id === row.business_id);
      if (biz) { hints.zoneId = biz.zoneId; if (!hints.categoryIds?.length) hints.categoryIds = biz.categoryIds; }
    }
    crownPartCount += await applyFullTagStack("crown_participant", row.id, hints);
  }
  stats.crown_participants = crownPartCount;

  const transitLineRows = await safeFetch("transit_lines", "id, city_id, name", `city_id = '${cityId}'`);
  let transitLineCount = 0;
  for (const row of transitLineRows) {
    transitLineCount += await applyFullTagStack("transit_line", row.id, { cityId, title: row.name });
  }
  stats.transit_lines = transitLineCount;

  const totalTags = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`[ContentTagger] Backfill complete: ${totalTags} total tag links across ${Object.keys(stats).length} content types`);
  for (const [type, cnt] of Object.entries(stats)) {
    if (cnt > 0) console.log(`  ${type}: ${cnt} tags`);
  }

  return stats;
}
