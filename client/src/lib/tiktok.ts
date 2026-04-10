export function isTikTokEmbed(url: string | null | undefined): boolean {
  if (!url) return false;
  return /tiktok\.com\/embed/i.test(url);
}

export function isTikTokUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /tiktok\.com/i.test(url) || /vm\.tiktok\.com/i.test(url);
}

export function parseTikTokUrl(url: string): { embedUrl: string; videoId: string } | null {
  if (!url) return null;
  const trimmed = url.trim();

  const longFormMatch = trimmed.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (longFormMatch) {
    return { videoId: longFormMatch[1], embedUrl: `https://www.tiktok.com/embed/v2/${longFormMatch[1]}` };
  }

  const shortFormMatch = trimmed.match(/(?:vm\.tiktok\.com|tiktok\.com\/t)\/([a-zA-Z0-9_-]+)/i);
  if (shortFormMatch) {
    return { videoId: shortFormMatch[1], embedUrl: `https://www.tiktok.com/embed/v2/${shortFormMatch[1]}` };
  }

  const embedMatch = trimmed.match(/tiktok\.com\/embed\/v2\/(\d+)/i);
  if (embedMatch) {
    return { videoId: embedMatch[1], embedUrl: `https://www.tiktok.com/embed/v2/${embedMatch[1]}` };
  }

  return null;
}
