export interface TikTokParsed {
  embedUrl: string;
  videoId: string;
}

export function parseTikTokUrl(url: string): TikTokParsed | null {
  if (!url) return null;

  const trimmed = url.trim();

  const longFormMatch = trimmed.match(
    /tiktok\.com\/@[^/]+\/video\/(\d+)/i
  );
  if (longFormMatch) {
    return {
      videoId: longFormMatch[1],
      embedUrl: `https://www.tiktok.com/embed/v2/${longFormMatch[1]}`,
    };
  }

  const shortFormMatch = trimmed.match(
    /(?:vm\.tiktok\.com|tiktok\.com\/t)\/([a-zA-Z0-9_-]+)/i
  );
  if (shortFormMatch) {
    return {
      videoId: shortFormMatch[1],
      embedUrl: `https://www.tiktok.com/embed/v2/${shortFormMatch[1]}`,
    };
  }

  const embedMatch = trimmed.match(
    /tiktok\.com\/embed\/v2\/(\d+)/i
  );
  if (embedMatch) {
    return {
      videoId: embedMatch[1],
      embedUrl: `https://www.tiktok.com/embed/v2/${embedMatch[1]}`,
    };
  }

  return null;
}

export function isTikTokUrl(url: string): boolean {
  if (!url) return false;
  return /tiktok\.com/i.test(url) || /vm\.tiktok\.com/i.test(url);
}

export function isTikTokEmbed(embedUrl: string | null | undefined): boolean {
  if (!embedUrl) return false;
  return /tiktok\.com\/embed/i.test(embedUrl);
}

export async function fetchTikTokOEmbed(url: string): Promise<{ title?: string; thumbnailUrl?: string } | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "CityHub/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data.title || undefined,
      thumbnailUrl: data.thumbnail_url || undefined,
    };
  } catch {
    return null;
  }
}

export function processTikTokVideoFields(fields: {
  videoUrl?: string | null;
  videoEmbedUrl?: string | null;
}): {
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  isTikTok: boolean;
} {
  const urlToCheck = fields.videoUrl || fields.videoEmbedUrl;
  if (!urlToCheck) {
    return { videoUrl: fields.videoUrl || null, videoEmbedUrl: fields.videoEmbedUrl || null, isTikTok: false };
  }

  const parsed = parseTikTokUrl(urlToCheck);
  if (parsed) {
    return {
      videoUrl: fields.videoUrl || null,
      videoEmbedUrl: parsed.embedUrl,
      isTikTok: true,
    };
  }

  return { videoUrl: fields.videoUrl || null, videoEmbedUrl: fields.videoEmbedUrl || null, isTikTok: false };
}
