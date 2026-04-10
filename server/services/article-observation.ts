import { recordSystemObservation } from "./charlotte-memory-service";

interface ArticleObservation {
  title: string;
  summary?: string | null;
  categoryName?: string;
  neighborhoodName?: string;
  cityName?: string;
  topics?: string[];
}

interface RssObservation {
  title: string;
  sourceName?: string;
  summary?: string | null;
  neighborhoodName?: string;
  categories?: string[];
}

function extractEntities(text: string): string[] {
  const words = text.split(/\s+/);
  const entities: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (/^[A-Z][a-z]+$/.test(words[i]) && /^[A-Z][a-z]+$/.test(words[i + 1])) {
      entities.push(`${words[i]} ${words[i + 1]}`);
      i++;
    }
  }
  return [...new Set(entities)].slice(0, 5);
}

function extractTopics(text: string, categories?: string[]): string[] {
  const topics = new Set<string>();
  if (categories) categories.forEach(c => topics.add(c));
  const topicKeywords = ["restaurant", "dining", "food", "coffee", "brewery", "art", "music", "event",
    "real estate", "development", "park", "fitness", "health", "education", "shopping", "retail",
    "community", "nonprofit", "tech", "startup", "construction", "transit"];
  const lower = text.toLowerCase();
  for (const kw of topicKeywords) {
    if (lower.includes(kw)) topics.add(kw);
  }
  return [...topics].slice(0, 8);
}

export async function observeArticlePublished(article: ArticleObservation): Promise<void> {
  const fullText = [article.title, article.summary || ""].join(" ");
  const entities = extractEntities(fullText);
  const topics = extractTopics(fullText, article.topics);

  const structured: Record<string, unknown> = {
    source: "article",
    title: article.title,
  };
  if (article.categoryName) structured.category = article.categoryName;
  if (article.neighborhoodName) structured.neighborhood = article.neighborhoodName;
  if (article.cityName) structured.city = article.cityName;
  if (entities.length > 0) structured.entities = entities;
  if (topics.length > 0) structured.topics = topics;

  const content = `[Article] ${JSON.stringify(structured)}`;
  await recordSystemObservation(content);
}

export async function observeRssItemIngested(item: RssObservation): Promise<void> {
  const fullText = [item.title, item.summary || ""].join(" ");
  const entities = extractEntities(fullText);
  const topics = extractTopics(fullText, item.categories);

  const structured: Record<string, unknown> = {
    source: "rss",
    title: item.title,
  };
  if (item.sourceName) structured.feed = item.sourceName;
  if (item.neighborhoodName) structured.neighborhood = item.neighborhoodName;
  if (entities.length > 0) structured.entities = entities;
  if (topics.length > 0) structured.topics = topics;

  const content = `[RSS] ${JSON.stringify(structured)}`;
  await recordSystemObservation(content);
}
