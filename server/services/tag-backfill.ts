import { db } from "../db";
import { eq, and, sql, inArray, notInArray } from "drizzle-orm";
import {
  tags, contentTags, zones, categories, businesses, events, articles,
  rssItems, marketplaceListings, cities, hubZipCoverage, zipGeos, regions,
  type Tag, type InsertTag, type InsertContentTag,
} from "@shared/schema";

interface BackfillStats {
  locationTags: number;
  topicTags: number;
  contentTagsCreated: number;
  errors: string[];
}

const RSS_CATEGORY_MAP: Record<string, string> = {
  "local news": "news",
  "news": "news",
  "breaking news": "news",
  "headlines": "news",
  "top stories": "news",
  "crime": "public-safety",
  "public safety": "public-safety",
  "police": "public-safety",
  "courts": "public-safety",
  "safety": "public-safety",
  "food": "food-dining",
  "food & drink": "food-dining",
  "food and drink": "food-dining",
  "dining": "food-dining",
  "restaurants": "food-dining",
  "eats": "food-dining",
  "recipes": "food-dining",
  "drink": "food-dining",
  "bars": "nightlife",
  "nightlife": "nightlife",
  "entertainment": "entertainment",
  "movies": "entertainment",
  "music": "entertainment",
  "theater": "entertainment",
  "theatre": "entertainment",
  "tv": "entertainment",
  "arts": "arts-culture",
  "arts & culture": "arts-culture",
  "arts and culture": "arts-culture",
  "culture": "arts-culture",
  "art": "arts-culture",
  "museums": "arts-culture",
  "sports": "sports",
  "football": "sports",
  "basketball": "sports",
  "baseball": "sports",
  "soccer": "sports",
  "panthers": "sports",
  "hornets": "sports",
  "charlotte fc": "sports",
  "nascar": "sports",
  "racing": "sports",
  "business": "business",
  "economy": "business",
  "finance": "business",
  "money": "business",
  "jobs": "business",
  "careers": "business",
  "planning": "business",
  "zoning": "business",
  "commercial real estate": "business",
  "economic development": "business",
  "small business": "business",
  "entrepreneurship": "business",
  "banking": "business",
  "leadership": "business",
  "commercial": "business",
  "investing": "business",
  "workplace": "business",
  "real estate": "real-estate",
  "housing": "real-estate",
  "property": "real-estate",
  "homes": "real-estate",
  "education": "education",
  "schools": "education",
  "college": "education",
  "university": "education",
  "health": "health-wellness",
  "health & wellness": "health-wellness",
  "fitness": "health-wellness",
  "medical": "health-wellness",
  "healthcare": "health-wellness",
  "salon": "lifestyle",
  "barber": "lifestyle",
  "hair": "lifestyle",
  "spa": "lifestyle",
  "community": "community",
  "neighborhoods": "community",
  "volunteer": "community",
  "nonprofit": "community",
  "charity": "community",
  "politics": "government",
  "government": "government",
  "city council": "government",
  "election": "government",
  "elections": "government",
  "weather": "weather",
  "forecast": "weather",
  "storm": "weather",
  "events": "events",
  "things to do": "events",
  "calendar": "events",
  "festivals": "events",
  "family": "family",
  "kids": "family",
  "parenting": "family",
  "pets": "pets-animals",
  "animals": "pets-animals",
  "dogs": "pets-animals",
  "cats": "pets-animals",
  "outdoors": "outdoors",
  "parks": "outdoors",
  "hiking": "outdoors",
  "nature": "outdoors",
  "travel": "travel",
  "tourism": "travel",
  "automotive": "automotive",
  "cars": "automotive",
  "traffic": "automotive",
  "transportation": "automotive",
  "transit": "automotive",
  "shopping": "shopping-retail",
  "retail": "shopping-retail",
  "deals": "shopping-retail",
  "technology": "technology",
  "tech": "technology",
  "startups": "technology",
  "opinion": "opinion",
  "editorial": "opinion",
  "op-ed": "opinion",
  "lifestyle": "lifestyle",
  "fashion": "lifestyle",
  "beauty": "lifestyle",
  "home": "lifestyle",
  "home & garden": "lifestyle",
  "religion": "faith",
  "faith": "faith",
  "church": "faith",
  "development": "development",
  "construction": "development",
  "infrastructure": "development",
  "growth": "development",
  "seniors": "seniors",
  "senior": "seniors",
  "aging": "seniors",
  "retirement": "seniors",
  "elder": "seniors",
  "elderly": "seniors",
  "commerce": "business",
  "merchant": "business",
};

const TITLE_KEYWORD_MAP: Array<{ keywords: string[]; slug: string }> = [
  { keywords: ["murder", "shooting", "crime", "arrest", "police", "officer", "robbery", "assault", "homicide", "suspect", "investigation"], slug: "public-safety" },
  { keywords: ["restaurant", "chef", "menu", "dining", "brewery", "food truck", "brunch", "cafe", "bakery"], slug: "food-dining" },
  { keywords: ["concert", "festival", "show", "performance", "theater", "comedy", "live music"], slug: "entertainment" },
  { keywords: ["game", "score", "season", "playoff", "championship", "roster", "coach", "athlete", "panthers", "hornets", "knights"], slug: "sports" },
  { keywords: ["school", "student", "teacher", "campus", "graduation", "classroom", "curriculum"], slug: "education" },
  { keywords: ["council", "mayor", "vote", "election", "ordinance", "legislation", "governor", "senator", "ballot"], slug: "government" },
  { keywords: ["apartment", "condo", "mortgage", "housing", "rent", "lease", "realty", "listing", "home sale", "planning commission", "land use", "commercial property"], slug: "real-estate" },
  { keywords: ["startup", "funding", "investment", "hiring", "layoff", "revenue", "market", "stock", "company", "ceo", "planning", "zoning", "rezoning", "permit", "commercial real estate", "office space", "warehouse", "economic development", "small business", "entrepreneur", "banking", "fintech"], slug: "business" },
  { keywords: ["hospital", "clinic", "doctor", "patient", "vaccine", "therapy", "mental health"], slug: "health-wellness" },
  { keywords: ["salon", "barber", "barbershop", "hair salon", "hair stylist", "nail salon", "spa", "beauty", "skincare", "aesthetics", "lashes", "waxing"], slug: "lifestyle" },
  { keywords: ["art", "gallery", "exhibit", "museum", "sculpture", "mural", "cultural"], slug: "arts-culture" },
  { keywords: ["park", "trail", "hike", "greenway", "lake", "outdoor", "camping", "kayak"], slug: "outdoors" },
  { keywords: ["volunteer", "donate", "nonprofit", "charity", "community", "neighborhood"], slug: "community" },
  { keywords: ["weather", "storm", "rain", "forecast", "hurricane", "tornado", "flood"], slug: "weather" },
  { keywords: ["bar", "club", "nightlife", "cocktail", "happy hour", "lounge"], slug: "nightlife" },
  { keywords: ["dog", "cat", "pet", "animal", "shelter", "adoption", "veterinary"], slug: "pets-animals" },
  { keywords: ["family", "kids", "children", "parent", "playground", "summer camp"], slug: "family" },
  { keywords: ["traffic", "highway", "transit", "commute", "road", "construction", "i-77", "i-85", "i-485", "light rail", "bus route"], slug: "automotive" },
  { keywords: ["shop", "store", "retail", "mall", "boutique", "sale", "discount"], slug: "shopping-retail" },
  { keywords: ["development", "construction", "rezoning", "building", "skyline", "tower", "mixed-use"], slug: "development" },
  { keywords: ["senior", "seniors", "aging", "retirement", "elderly", "aarp", "assisted living", "nursing home", "medicare", "retiree"], slug: "seniors" },
  { keywords: ["commerce", "merchant", "vendor", "marketplace", "storefront", "buy local", "local business"], slug: "business" },
];

export function matchRssCategoriesToSlugs(categoriesJson: string[] | null | undefined): string[] {
  if (!categoriesJson || categoriesJson.length === 0) return [];
  const matched = new Set<string>();
  for (const cat of categoriesJson) {
    const normalized = cat.toLowerCase().trim();
    const direct = RSS_CATEGORY_MAP[normalized];
    if (direct) {
      matched.add(direct);
      continue;
    }
    for (const [key, slug] of Object.entries(RSS_CATEGORY_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        matched.add(slug);
        break;
      }
    }
  }
  return Array.from(matched);
}

export function matchTitleToSlugs(title: string | null | undefined): string[] {
  if (!title) return [];
  const lower = title.toLowerCase();
  const matched = new Set<string>();
  for (const entry of TITLE_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        matched.add(entry.slug);
        break;
      }
    }
  }
  return Array.from(matched);
}

function resolveRssTopicSlugs(
  categoriesJson: string[] | null | undefined,
  title: string | null | undefined,
  tagsBySlug: Map<string, Tag>,
  tagsByName: Map<string, Tag>,
  allTopicTags: Tag[],
): Tag[] {
  const resultTags = new Map<string, Tag>();

  if (categoriesJson && categoriesJson.length > 0) {
    for (const cat of categoriesJson) {
      const normalized = cat.toLowerCase().trim();
      const catSlug = slugify(cat);
      const directTag = tagsBySlug.get(catSlug);
      if (directTag && directTag.type === "topic") {
        resultTags.set(directTag.id, directTag);
        continue;
      }
      const nameTag = tagsByName.get(normalized);
      if (nameTag && nameTag.type === "topic") {
        resultTags.set(nameTag.id, nameTag);
        continue;
      }
      for (const t of allTopicTags) {
        if (t.synonyms && t.synonyms.length > 0) {
          for (const syn of t.synonyms) {
            if (syn.toLowerCase() === normalized) {
              resultTags.set(t.id, t);
              break;
            }
          }
        }
      }
    }
    const mappedSlugs = matchRssCategoriesToSlugs(categoriesJson);
    for (const slug of mappedSlugs) {
      const tag = tagsBySlug.get(slug);
      if (tag && tag.type === "topic") {
        resultTags.set(tag.id, tag);
      }
    }
  }

  if (resultTags.size === 0) {
    const titleSlugs = matchTitleToSlugs(title);
    for (const slug of titleSlugs) {
      const tag = tagsBySlug.get(slug);
      if (tag && tag.type === "topic") {
        resultTags.set(tag.id, tag);
      }
    }
  }

  return Array.from(resultTags.values());
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function upsertTag(data: InsertTag): Promise<Tag> {
  const existing = await db.select().from(tags).where(eq(tags.slug, data.slug)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const [inserted] = await db.insert(tags).values(data).returning();
  return inserted;
}

async function upsertContentTag(data: InsertContentTag): Promise<boolean> {
  try {
    await db.insert(contentTags).values(data).onConflictDoNothing();
    return true;
  } catch {
    return false;
  }
}

export async function backfillLocationTags(cityId: string): Promise<number> {
  let count = 0;

  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) return 0;

  const cityTag = await upsertTag({
    name: city.name,
    slug: slugify(city.name),
    type: "location",
    parentTagId: null,
    icon: "MapPin",
    sortOrder: 0,
  });
  count++;

  const allZones = await db.select().from(zones).where(eq(zones.cityId, cityId));
  const zoneTagMap = new Map<string, string>();

  for (const zone of allZones) {
    const zoneTag = await upsertTag({
      name: zone.name,
      slug: slugify(zone.name),
      type: "location",
      parentTagId: cityTag.id,
      icon: "Navigation",
      sortOrder: 0,
    });
    zoneTagMap.set(zone.id, zoneTag.id);
    count++;
  }

  const coverageRows = await db.select().from(hubZipCoverage);
  const hubRegionIdSet = new Set(coverageRows.map(r => r.hubRegionId));
  const hubRegionIds = Array.from(hubRegionIdSet);

  if (hubRegionIds.length > 0) {
    const hubRegions = await db.select().from(regions).where(inArray(regions.id, hubRegionIds));
    const hubRegionMap = new Map(hubRegions.map(r => [r.id, r]));

    const zipToZoneTag = new Map<string, string>();
    for (const row of coverageRows) {
      const region = hubRegionMap.get(row.hubRegionId);
      if (!region) continue;

      const matchedZone = allZones.find(z =>
        z.name.toLowerCase() === (region.name || "").toLowerCase() ||
        z.slug === slugify(region.name || "")
      );

      if (matchedZone) {
        const parentTagId = zoneTagMap.get(matchedZone.id);
        if (parentTagId) {
          zipToZoneTag.set(row.zip, parentTagId);
        }
      }
    }

    const coveredZips = coverageRows.map(r => r.zip);
    const uniqueZips = Array.from(new Set(coveredZips));
    for (const zip of uniqueZips) {
      const parentId = zipToZoneTag.get(zip) || cityTag.id;
      await upsertTag({
        name: zip,
        slug: `zip-${zip}`,
        type: "location",
        parentTagId: parentId,
        icon: "Hash",
        sortOrder: 0,
      });
      count++;
    }
  }

  return count;
}

export async function backfillTopicTags(): Promise<number> {
  let count = 0;
  const allCategories = await db.select().from(categories);

  const l1Categories = allCategories.filter(c => !c.parentCategoryId);
  const catTagMap = new Map<string, string>();

  for (const cat of l1Categories) {
    const tag = await upsertTag({
      name: cat.name,
      slug: slugify(cat.name),
      type: "topic",
      parentTagId: null,
      icon: cat.icon || null,
      sortOrder: cat.sortOrder,
    });
    catTagMap.set(cat.id, tag.id);
    count++;
  }

  const l2Categories = allCategories.filter(c => c.parentCategoryId);
  for (const cat of l2Categories) {
    const parentTagId = catTagMap.get(cat.parentCategoryId!) || null;
    const tag = await upsertTag({
      name: cat.name,
      slug: slugify(cat.name),
      type: "topic",
      parentTagId,
      icon: cat.icon || null,
      sortOrder: cat.sortOrder,
    });
    catTagMap.set(cat.id, tag.id);
    count++;
  }

  return count;
}

export async function backfillContentTags(cityId: string): Promise<number> {
  let count = 0;

  const allTags = await db.select().from(tags);
  const tagsBySlug = new Map(allTags.map(t => [t.slug, t]));

  const allZones = await db.select().from(zones).where(eq(zones.cityId, cityId));
  const zoneIdToTagId = new Map<string, string>();
  for (const zone of allZones) {
    const tag = tagsBySlug.get(slugify(zone.name));
    if (tag) zoneIdToTagId.set(zone.id, tag.id);
  }

  const allCategories = await db.select().from(categories);
  const catIdToTagId = new Map<string, string>();
  for (const cat of allCategories) {
    const tag = tagsBySlug.get(slugify(cat.name));
    if (tag) catIdToTagId.set(cat.id, tag.id);
  }

  const allBusinesses = await db.select().from(businesses).where(eq(businesses.cityId, cityId));
  for (const biz of allBusinesses) {
    const locationTagId = zoneIdToTagId.get(biz.zoneId);
    if (locationTagId) {
      if (await upsertContentTag({ contentType: "business", contentId: biz.id, tagId: locationTagId })) count++;
    }
    if (biz.categoryIds && biz.categoryIds.length > 0) {
      for (const catId of biz.categoryIds) {
        const topicTagId = catIdToTagId.get(catId);
        if (topicTagId) {
          if (await upsertContentTag({ contentType: "business", contentId: biz.id, tagId: topicTagId })) count++;
        }
      }
    }
  }

  const allEvents = await db.select().from(events).where(eq(events.cityId, cityId));
  for (const event of allEvents) {
    const locationTagId = zoneIdToTagId.get(event.zoneId);
    if (locationTagId) {
      if (await upsertContentTag({ contentType: "event", contentId: event.id, tagId: locationTagId })) count++;
    }
    if (event.categoryIds && event.categoryIds.length > 0) {
      for (const catId of event.categoryIds) {
        const topicTagId = catIdToTagId.get(catId);
        if (topicTagId) {
          if (await upsertContentTag({ contentType: "event", contentId: event.id, tagId: topicTagId })) count++;
        }
      }
    }
    if (event.hostBusinessId) {
      const hostBiz = allBusinesses.find(b => b.id === event.hostBusinessId);
      if (hostBiz?.categoryIds) {
        for (const catId of hostBiz.categoryIds) {
          const topicTagId = catIdToTagId.get(catId);
          if (topicTagId) {
            if (await upsertContentTag({ contentType: "event", contentId: event.id, tagId: topicTagId })) count++;
          }
        }
      }
    }
  }

  const allArticles = await db.select().from(articles).where(eq(articles.cityId, cityId));
  for (const article of allArticles) {
    if (article.zoneId) {
      const locationTagId = zoneIdToTagId.get(article.zoneId);
      if (locationTagId) {
        if (await upsertContentTag({ contentType: "article", contentId: article.id, tagId: locationTagId })) count++;
      }
    }
    if (article.primaryCategoryId) {
      const topicTagId = catIdToTagId.get(article.primaryCategoryId);
      if (topicTagId) {
        if (await upsertContentTag({ contentType: "article", contentId: article.id, tagId: topicTagId })) count++;
      }
    }
  }

  try {
    const approvedRss = await db.select().from(rssItems).where(
      and(eq(rssItems.cityId, cityId), eq(rssItems.reviewStatus, "APPROVED"))
    );
    const allTopicTags = allTags.filter(t => t.type === "topic");
    const tagsByName = new Map(allTags.map(t => [t.name.toLowerCase(), t]));
    for (const item of approvedRss) {
      if (item.zoneSlug) {
        const tag = tagsBySlug.get(slugify(item.zoneSlug));
        if (tag) {
          if (await upsertContentTag({ contentType: "rss_item", contentId: item.id, tagId: tag.id })) count++;
        }
      }
      const topicTags = resolveRssTopicSlugs(
        item.categoriesJson,
        item.title,
        tagsBySlug,
        tagsByName,
        allTopicTags,
      );
      for (const topicTag of topicTags) {
        if (await upsertContentTag({ contentType: "rss_item", contentId: item.id, tagId: topicTag.id })) count++;
      }
      const parentTag = topicTags.find(t => !t.parentTagId);
      const childTag = topicTags.find(t => !!t.parentTagId);
      let resolvedCoreSlug: string | undefined;
      let resolvedSubSlug: string | undefined;
      if (parentTag) {
        resolvedCoreSlug = parentTag.slug;
        if (childTag) resolvedSubSlug = childTag.slug;
      } else if (childTag) {
        const parentOfChild = allTopicTags.find(t => t.id === childTag.parentTagId);
        resolvedCoreSlug = parentOfChild?.slug || childTag.slug;
        resolvedSubSlug = childTag.slug;
      }
      const drizzleUpdates: Partial<Record<string, string>> = {};
      if (resolvedCoreSlug && !item.categoryCoreSlug) drizzleUpdates.categoryCoreSlug = resolvedCoreSlug;
      if (resolvedSubSlug && !item.categorySubSlug) drizzleUpdates.categorySubSlug = resolvedSubSlug;
      if (item.zoneSlug && !item.geoPrimarySlug) drizzleUpdates.geoPrimarySlug = item.zoneSlug;
      if (Object.keys(drizzleUpdates).length > 0) {
        await db.update(rssItems).set(drizzleUpdates).where(eq(rssItems.id, item.id)).catch(() => {});
      }
    }
  } catch {
  }

  try {
    const allMarketplace = await db.select().from(marketplaceListings).where(eq(marketplaceListings.cityId, cityId));
    for (const listing of allMarketplace) {
      if (listing.zoneId) {
        const locationTagId = zoneIdToTagId.get(listing.zoneId);
        if (locationTagId) {
          if (await upsertContentTag({ contentType: "marketplace_listing", contentId: listing.id, tagId: locationTagId })) count++;
        }
      }
      if (listing.category) {
        const tag = tagsBySlug.get(slugify(listing.category));
        if (tag) {
          if (await upsertContentTag({ contentType: "marketplace_listing", contentId: listing.id, tagId: tag.id })) count++;
        }
      }
    }
  } catch {
  }

  return count;
}

export async function runFullBackfill(cityId: string): Promise<BackfillStats> {
  const stats: BackfillStats = {
    locationTags: 0,
    topicTags: 0,
    contentTagsCreated: 0,
    errors: [],
  };

  try {
    stats.locationTags = await backfillLocationTags(cityId);
  } catch (err: any) {
    stats.errors.push(`Location tags: ${err.message}`);
  }

  try {
    stats.topicTags = await backfillTopicTags();
  } catch (err: any) {
    stats.errors.push(`Topic tags: ${err.message}`);
  }

  try {
    stats.contentTagsCreated = await backfillContentTags(cityId);
  } catch (err: any) {
    stats.errors.push(`Content tags: ${err.message}`);
  }

  return stats;
}

export async function autoTagContent(
  contentType: "business" | "event" | "article" | "rss_item" | "marketplace_listing",
  contentId: string,
  data: {
    zoneId?: string | null;
    categoryIds?: string[] | null;
    primaryCategoryId?: string | null;
    zoneSlug?: string | null;
    additionalZoneSlugs?: string[] | null;
    countySlug?: string | null;
    category?: string | null;
    categoriesJson?: string[] | null;
    title?: string | null;
  }
): Promise<number> {
  let count = 0;
  const allTags = await db.select().from(tags);
  const tagsBySlug = new Map(allTags.map(t => [t.slug, t]));

  if (data.zoneId) {
    const [zone] = await db.select().from(zones).where(eq(zones.id, data.zoneId)).limit(1);
    if (zone) {
      const tag = tagsBySlug.get(slugify(zone.name));
      if (tag) {
        if (await upsertContentTag({ contentType, contentId, tagId: tag.id })) count++;
      }
    }
  }

  if (data.zoneSlug) {
    const tag = tagsBySlug.get(slugify(data.zoneSlug));
    if (tag) {
      if (await upsertContentTag({ contentType, contentId, tagId: tag.id })) count++;
    }
  }

  if (data.additionalZoneSlugs && data.additionalZoneSlugs.length > 0) {
    for (const extraSlug of data.additionalZoneSlugs) {
      const tag = tagsBySlug.get(slugify(extraSlug));
      if (tag) {
        if (await upsertContentTag({ contentType, contentId, tagId: tag.id })) count++;
      }
    }
  }

  if (data.countySlug) {
    const countyTag = tagsBySlug.get(slugify(data.countySlug));
    if (countyTag) {
      if (await upsertContentTag({ contentType, contentId, tagId: countyTag.id })) count++;
    }
  }

  const allCategories = await db.select().from(categories);
  const catIdToSlug = new Map(allCategories.map(c => [c.id, slugify(c.name)]));

  if (data.categoryIds && data.categoryIds.length > 0) {
    for (const catId of data.categoryIds) {
      const catSlug = catIdToSlug.get(catId);
      if (catSlug) {
        const tag = tagsBySlug.get(catSlug);
        if (tag) {
          if (await upsertContentTag({ contentType, contentId, tagId: tag.id })) count++;
        }
      }
    }
  }

  if (data.primaryCategoryId) {
    const catSlug = catIdToSlug.get(data.primaryCategoryId);
    if (catSlug) {
      const tag = tagsBySlug.get(catSlug);
      if (tag) {
        if (await upsertContentTag({ contentType, contentId, tagId: tag.id })) count++;
      }
    }
  }

  if (data.category) {
    const tag = tagsBySlug.get(slugify(data.category));
    if (tag) {
      if (await upsertContentTag({ contentType, contentId, tagId: tag.id })) count++;
    }
  }

  if (contentType === "rss_item" && (data.categoriesJson || data.title)) {
    const allTopicTags = allTags.filter(t => t.type === "topic");
    const tagsByName = new Map(allTags.map(t => [t.name.toLowerCase(), t]));
    const topicTags = resolveRssTopicSlugs(
      data.categoriesJson,
      data.title,
      tagsBySlug,
      tagsByName,
      allTopicTags,
    );
    for (const topicTag of topicTags) {
      if (await upsertContentTag({ contentType, contentId, tagId: topicTag.id })) count++;
    }
    const parentTag2 = topicTags.find(t => !t.parentTagId);
    const childTag2 = topicTags.find(t => !!t.parentTagId);
    const routingUpdates: Record<string, string> = {};
    if (parentTag2) {
      routingUpdates.categoryCoreSlug = parentTag2.slug;
      if (childTag2) routingUpdates.categorySubSlug = childTag2.slug;
    } else if (childTag2) {
      const allTopicTags2 = allTags.filter(t => t.type === "topic");
      const parentOfChild2 = allTopicTags2.find(t => t.id === childTag2.parentTagId);
      routingUpdates.categoryCoreSlug = parentOfChild2?.slug || childTag2.slug;
      routingUpdates.categorySubSlug = childTag2.slug;
    }
    if (data.zoneSlug) routingUpdates.geoPrimarySlug = data.zoneSlug;
    if (data.additionalZoneSlugs && data.additionalZoneSlugs.length > 0) {
      routingUpdates.geoSecondarySlug = data.additionalZoneSlugs[0];
    }
    if (data.countySlug) routingUpdates.countySlug = data.countySlug;
    if (Object.keys(routingUpdates).length > 0) {
      await db.update(rssItems).set(routingUpdates).where(eq(rssItems.id, contentId)).catch(() => {});
    }
  }

  return count;
}

export async function backfillUntaggedRssItems(): Promise<number> {
  let count = 0;

  try {
    const untaggedRss = await db
      .select({ rssItem: rssItems })
      .from(rssItems)
      .leftJoin(
        contentTags,
        and(
          eq(contentTags.contentType, "rss_item"),
          eq(contentTags.contentId, rssItems.id)
        )
      )
      .where(
        and(
          eq(rssItems.reviewStatus, "APPROVED"),
          sql`${contentTags.id} IS NULL`
        )
      )
      .then(rows => rows.map(r => r.rssItem));

    if (untaggedRss.length === 0) return 0;

    console.log(`[RssTagBackfill] Found ${untaggedRss.length} untagged approved RSS items`);

    const allTags = await db.select().from(tags);
    const tagsBySlug = new Map(allTags.map(t => [t.slug, t]));

    for (const item of untaggedRss) {
      if (item.categoryCoreSlug) {
        const tag = tagsBySlug.get(item.categoryCoreSlug);
        if (tag) {
          if (await upsertContentTag({ contentType: "rss_item", contentId: item.id, tagId: tag.id })) count++;
        }
      }

      if (item.geoPrimarySlug) {
        const tag = tagsBySlug.get(item.geoPrimarySlug);
        if (tag) {
          if (await upsertContentTag({ contentType: "rss_item", contentId: item.id, tagId: tag.id })) count++;
        }
      }

      if (item.geoSecondarySlug) {
        const tag = tagsBySlug.get(item.geoSecondarySlug);
        if (tag) {
          if (await upsertContentTag({ contentType: "rss_item", contentId: item.id, tagId: tag.id })) count++;
        }
      }

      if (item.zoneSlug && !item.geoPrimarySlug) {
        const tag = tagsBySlug.get(slugify(item.zoneSlug));
        if (tag) {
          if (await upsertContentTag({ contentType: "rss_item", contentId: item.id, tagId: tag.id })) count++;
        }
      }
    }

    console.log(`[RssTagBackfill] Created ${count} content tags for ${untaggedRss.length} RSS items`);
  } catch (err: any) {
    console.error("[RssTagBackfill] Error:", err.message);
  }

  return count;
}
