const CLT_LOGO_FALLBACK = "/icons/clt-logo.png";

const CLT_HERO_IMAGES = [
  CLT_LOGO_FALLBACK,
];

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

const OLD_STOCK_PATTERN = /^\/assets\/stock_images\/feed_/;

const MAP_TILE_PATTERNS = [
  /maps\.googleapis\.com\/maps\/api\/staticmap/i,
  /maps\.googleapis\.com\/maps\/api\/streetview/i,
  /tile\.openstreetmap/i,
  /\.tile\./i,
  /\/map_imagery\//i,
  /\/maptile\//i,
  /staticmap\?/i,
  /streetviewpixels/i,
];

const BRANDED_LOGO_URL_PATTERNS = [
  /\/logo[s]?\//i,
  /\/brand(?:ing)?\//i,
  /\/masthead\//i,
  /\/header[-_]?(?:logo|image|banner)/i,
  /logo[-_.]?(?:wide|main|default|header|horizontal|square|full)/i,
  /masthead/i,
  /site[-_]?(?:logo|banner|header)/i,
  /brand[-_]?(?:logo|mark|image)/i,
  /og[-_]?(?:logo|default|image)/i,
  /favicon/i,
  /apple-touch-icon/i,
];

const BRANDED_SOURCE_DOMAINS = [
  "salisburypost.com/wp-content/uploads/sites",
  "bloximages.newyork1.vip.townnews.com",
  "townlogo",
  "avatars.wp.com",
];

export function isBrandedSourceImage(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  for (const domain of BRANDED_SOURCE_DOMAINS) {
    if (lower.includes(domain) && (lower.includes("logo") || lower.includes("masthead") || lower.includes("brand"))) {
      return true;
    }
  }
  for (const pattern of BRANDED_LOGO_URL_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (OLD_STOCK_PATTERN.test(trimmed)) return false;
  for (const pattern of MAP_TILE_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  return trimmed.startsWith("http") || trimmed.startsWith("/");
}

export function isValidRssImageUrl(url: string | null | undefined): boolean {
  if (!isValidImageUrl(url)) return false;
  if (isBrandedSourceImage(url)) return false;
  return true;
}

export function getFallbackImage(
  _contentType: string,
  _categorySlug: string | null | undefined,
  _title: string | null | undefined,
  itemId: string
): string {
  const seed = djb2Hash(itemId);
  return CLT_HERO_IMAGES[seed % CLT_HERO_IMAGES.length];
}
