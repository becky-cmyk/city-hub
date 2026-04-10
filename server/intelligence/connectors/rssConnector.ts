import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";
import Parser from "rss-parser";
import crypto from "crypto";

async function fetchOgImage(url: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CityHub/1.0 (og:image fetcher)" },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const html = await resp.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return ogMatch ? ogMatch[1] : null;
  } catch {
    return null;
  }
}

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "CityHub/1.0 (RSS Aggregator)",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
    ],
  },
});

function computeExternalId(baseUrl: string, link: string): string {
  return crypto
    .createHash("sha256")
    .update(baseUrl + link)
    .digest("hex");
}

async function extractImage(item: any): Promise<string | null> {
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) {
    return item.enclosure.url;
  }
  if (item.mediaContent?.$ ?.url) {
    return item.mediaContent.$.url;
  }
  if (item.mediaThumbnail?.$ ?.url) {
    return item.mediaThumbnail.$.url;
  }
  const imgMatch = (item["content:encoded"] || item.content || "").match(
    /<img[^>]+src=["']([^"']+)["']/i
  );
  if (imgMatch) return imgMatch[1];
  const link = item.link || "";
  if (link) {
    const ogImage = await fetchOgImage(link);
    if (ogImage) return ogImage;
  }
  return null;
}

export class RssConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const { baseUrl } = config;

    if (!baseUrl) {
      throw new Error("RssConnector requires baseUrl (the RSS feed URL)");
    }

    const feed = await parser.parseURL(baseUrl);
    const rows: any[] = [];

    for (const item of feed.items || []) {
      const link = item.link || "";
      const externalId = computeExternalId(baseUrl, link);
      const rawItem = item as any;

      rows.push({
        _externalId: externalId,
        _title: item.title || "",
        _link: link,
        _pubDate: item.pubDate || item.isoDate || null,
        _summary:
          item.contentSnippet ||
          item.content?.replace(/<[^>]*>/g, "").slice(0, 500) ||
          "",
        _author: item.creator || rawItem.author || null,
        _categories: item.categories || [],
        _imageUrl: await extractImage(rawItem),
        _feedTitle: feed.title || "",
        _raw: rawItem,
      });
    }

    return {
      rows,
      totalAvailable: rows.length,
    };
  }
}
