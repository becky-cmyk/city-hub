import type { FeedCardItem } from "@/components/feed/feed-card";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const TIME_PHRASES = ["today", "tonight", "this weekend", "this week"];

function pickTimePhrase(item: FeedCardItem): string {
  if (!item.startDate) {
    const idx = simpleHash(item.id) % TIME_PHRASES.length;
    return TIME_PHRASES[idx];
  }
  const d = new Date(item.startDate);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "this week";
  if (diffDays < 1) return d.getHours() >= 17 ? "tonight" : "today";
  if (diffDays < 3) return "this weekend";
  return "this week";
}

function extractCategory(item: FeedCardItem): string | null {
  return item.primaryTag?.label || null;
}

function extractNeighborhood(item: FeedCardItem): string | null {
  const loc = item.locationTags?.[0];
  return loc?.label || null;
}

const TYPE_CATEGORY_MAP: Record<string, string[]> = {
  event: ["events near me", "things to do near me", "local activities"],
  business: ["businesses near me", "local services near me", "places to visit"],
  article: ["local stories near me", "community news", "local articles"],
  marketplace: ["deals near me", "local marketplace", "shopping near me"],
  shop_item: ["deals near me", "local shopping", "local products"],
  shop_drop: ["new drops near me", "deals near me", "local shopping"],
  job: ["jobs near me", "local careers", "hiring near me"],
  attraction: ["attractions near me", "things to do near me", "places to visit"],
  podcast: ["local podcasts", "community stories", "local interviews"],
  rss: ["local news near me", "community stories", "local updates"],
  post: ["community posts", "local updates near me", "community stories"],
  curated_list: ["curated local guides", "best of near me", "local picks"],
};

export function generateRelatedSearches(item: FeedCardItem, cityName?: string): string[] {
  const suggestions: string[] = [];
  const category = extractCategory(item);
  const neighborhood = extractNeighborhood(item);
  const timePhrase = pickTimePhrase(item);
  const typeTerms = TYPE_CATEGORY_MAP[item.type] || ["things to do near me"];
  const city = cityName || "your city";

  if (item.type === "event") {
    if (neighborhood) suggestions.push(`events ${timePhrase} in ${neighborhood}`);
    suggestions.push(`events ${timePhrase} in ${city}`);
    if (category && category.toLowerCase() !== "events") {
      suggestions.push(`${category.toLowerCase()} events in ${city}`);
    }
    suggestions.push(`things to do ${timePhrase}`);
    if (neighborhood) suggestions.push(`${neighborhood} events`);
  } else if (item.type === "business" || item.type === "enhanced_listing") {
    if (category && neighborhood) suggestions.push(`${category.toLowerCase()} in ${neighborhood}`);
    if (category) suggestions.push(`${category.toLowerCase()} in ${city}`);
    if (neighborhood) suggestions.push(`businesses in ${neighborhood}`);
    if (category) suggestions.push(`${category.toLowerCase()} near me`);
    suggestions.push(`local services in ${city}`);
  } else if (item.type === "article" || item.type === "rss" || item.type === "post") {
    if (neighborhood) suggestions.push(`stories from ${neighborhood}`);
    if (category) suggestions.push(`${category.toLowerCase()} in ${city}`);
    suggestions.push(`local news in ${city}`);
    if (neighborhood) suggestions.push(`what's happening in ${neighborhood}`);
    suggestions.push(`community updates ${timePhrase}`);
  } else if (item.type === "job") {
    if (category) suggestions.push(`${category.toLowerCase()} jobs in ${city}`);
    suggestions.push(`jobs near me`);
    if (neighborhood) suggestions.push(`hiring in ${neighborhood}`);
    suggestions.push(`careers in ${city}`);
  } else if (item.type === "marketplace" || item.type === "shop_item" || item.type === "shop_drop") {
    suggestions.push(`deals in ${city}`);
    if (category) suggestions.push(`${category.toLowerCase()} deals`);
    if (neighborhood) suggestions.push(`shopping in ${neighborhood}`);
    suggestions.push(`local products near me`);
  } else {
    if (neighborhood) suggestions.push(`${typeTerms[0].split(" near")[0]} in ${neighborhood}`);
    suggestions.push(`${typeTerms[0].split(" near")[0]} in ${city}`);
    if (category) suggestions.push(`${category.toLowerCase()} near me`);
    suggestions.push(`things to do ${timePhrase}`);
    if (neighborhood) suggestions.push(`explore ${neighborhood}`);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of suggestions) {
    const key = s.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
    if (unique.length >= 5) break;
  }

  if (unique.length < 3) {
    const fallbacks = [
      `things to do ${timePhrase} in ${city}`,
      `explore ${neighborhood || city}`,
      `what's happening in ${city}`,
    ];
    for (const f of fallbacks) {
      const key = f.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(f);
      }
      if (unique.length >= 3) break;
    }
  }

  return unique;
}
