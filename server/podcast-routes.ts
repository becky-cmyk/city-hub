import type { Express, Request, Response } from "express";
import { db } from "./db";
import { videoContent, cities, businesses } from "@shared/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRfc822(date: Date): string {
  return date.toUTCString();
}

export function registerPodcastRoutes(app: Express) {
  app.get("/api/podcast/:metroSlug/feed.xml", async (req: Request, res: Response) => {
    try {
      const { metroSlug } = req.params;

      const [city] = await db
        .select()
        .from(cities)
        .where(eq(cities.slug, metroSlug))
        .limit(1);

      if (!city) {
        return res.status(404).type("text/plain").send("City not found");
      }

      const episodes = await db
        .select()
        .from(videoContent)
        .where(
          and(
            eq(videoContent.cityId, city.id),
            eq(videoContent.podcastEligible, true),
            isNotNull(videoContent.audioUrl)
          )
        )
        .orderBy(desc(videoContent.createdAt))
        .limit(100);

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const feedUrl = `${baseUrl}/api/podcast/${metroSlug}/feed.xml`;
      const siteUrl = `${baseUrl}/${metroSlug}`;
      const brandLabel = city.brandName || `${city.name} Metro Hub`;
      const channelTitle = `${brandLabel} Podcast`;
      const channelDescription = `Local stories, expert interviews, and community highlights from the ${city.name} metro area. Powered by CLT Metro Hub.`;
      const logoUrl = city.logoUrl || `${baseUrl}/favicon.png`;
      const now = new Date();

      let itemsXml = "";
      for (const ep of episodes) {
        if (!ep.audioUrl) continue;

        let authorName = "";
        if (ep.businessId) {
          const [biz] = await db
            .select({ name: businesses.name })
            .from(businesses)
            .where(eq(businesses.id, ep.businessId))
            .limit(1);
          if (biz) authorName = biz.name;
        }

        const pubDate = ep.createdAt ? formatRfc822(new Date(ep.createdAt)) : formatRfc822(now);
        const durationSec = ep.durationSec || 0;
        const durationFormatted = `${String(Math.floor(durationSec / 3600)).padStart(2, "0")}:${String(Math.floor((durationSec % 3600) / 60)).padStart(2, "0")}:${String(durationSec % 60).padStart(2, "0")}`;

        itemsXml += `
    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description || ep.title)}</description>
      <enclosure url="${escapeXml(ep.audioUrl)}" type="audio/mpeg" length="0" />
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:duration>${durationFormatted}</itunes:duration>
      ${authorName ? `<itunes:author>${escapeXml(authorName)}</itunes:author>` : ""}
      ${ep.thumbnailUrl ? `<itunes:image href="${escapeXml(ep.thumbnailUrl)}" />` : ""}
      <itunes:explicit>false</itunes:explicit>
    </item>`;
      }

      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${formatRfc822(now)}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <itunes:author>${escapeXml(brandLabel)}</itunes:author>
    <itunes:summary>${escapeXml(channelDescription)}</itunes:summary>
    <itunes:owner>
      <itunes:name>${escapeXml(brandLabel)}</itunes:name>
      <itunes:email>hello@cltcityhub.com</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(logoUrl)}" />
    <itunes:category text="Society &amp; Culture">
      <itunes:category text="Places &amp; Travel" />
    </itunes:category>
    <itunes:category text="News">
      <itunes:category text="Daily News" />
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <image>
      <url>${escapeXml(logoUrl)}</url>
      <title>${escapeXml(channelTitle)}</title>
      <link>${escapeXml(siteUrl)}</link>
    </image>${itemsXml}
  </channel>
</rss>`;

      res.set("Content-Type", "application/rss+xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300");
      res.send(rssXml);
    } catch (error: any) {
      console.error("[Podcast Feed] Error generating feed:", error);
      res.status(500).type("text/plain").send("Error generating podcast feed");
    }
  });
}
