import { db } from "../../db";
import { sql } from "drizzle-orm";
import * as cheerio from "cheerio";

const DOMAIN_LAST_REQUEST = new Map<string, number>();
const DOMAIN_DELAY_MS = 3000;
const MAX_PAGES_PER_SITE = 5;
const CRAWL_CONCURRENCY = 2;

const ROBOTS_CACHE = new Map<string, { allowed: boolean; cachedAt: number }>();
const ROBOTS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SOCIAL_DOMAINS: Record<string, string> = {
  "facebook.com": "facebook", "fb.com": "facebook", "instagram.com": "instagram",
  "linkedin.com": "linkedin", "twitter.com": "twitter", "x.com": "twitter",
  "youtube.com": "youtube", "tiktok.com": "tiktok", "yelp.com": "yelp",
};

const PRIORITY_LINK_PATTERNS = [
  /directory/i, /listings?/i, /businesses/i, /places/i, /members/i,
  /submit/i, /add[-_]?listing/i, /claim/i, /get[-_]?listed/i,
  /advertise/i, /sponsor/i, /media[-_]?kit/i, /partners/i,
  /events?/i, /calendar/i, /neighborhoods?/i, /areas/i, /locations?/i,
  /about/i, /contact/i, /pricing/i, /membership/i,
];

const DIRECTORY_KEYWORDS = [
  "directory", "listings", "get listed", "add your business", "list your business",
  "add a listing", "claim your listing", "claim listing", "businesses",
  "members", "sponsors", "advertise with us", "submit your business",
  "business directory", "local directory", "find a business",
];

const NICHE_MAP: Record<string, string[]> = {
  PETS: ["pets", "pet", "groomer", "grooming", "vet", "veterinar", "animal", "dog", "cat", "puppy"],
  FOOD: ["restaurant", "dining", "brunch", "bars", "food", "chef", "kitchen", "cafe", "brewery", "bakery", "pizza", "taco"],
  SENIOR: ["senior", "assisted living", "elder", "retirement", "aging", "medicare"],
  HOME_SERVICES: ["contractor", "roofing", "plumber", "plumbing", "hvac", "electrical", "handyman", "remodel", "renovation", "landscap"],
  MULTIFAMILY: ["apartment", "leasing", "multifamily", "complex", "rental", "rent"],
  EVENTS: ["events", "calendar", "festival", "concert", "show", "performance", "tickets", "things to do"],
  NEIGHBORHOODS: ["neighborhood", "community", "district", "area guide", "south end", "noda", "plaza midwood", "uptown", "dilworth"],
  NIGHTLIFE: ["nightlife", "club", "lounge", "bar", "happy hour", "cocktail", "live music"],
  ARTS_CULTURE: ["art", "gallery", "museum", "theater", "theatre", "culture", "heritage", "mural"],
  WELLNESS: ["wellness", "yoga", "fitness", "spa", "meditation", "gym", "health"],
  FAMILY_KIDS: ["family", "kids", "children", "playground", "camp", "school", "daycare", "childcare"],
};

const CHARLOTTE_CITIES = [
  "charlotte", "huntersville", "cornelius", "davidson", "mooresville", "concord",
  "kannapolis", "gastonia", "belmont", "mount holly", "indian trail", "matthews",
  "mint hill", "pineville", "waxhaw", "weddington", "monroe", "statesville",
  "rock hill", "fort mill", "lake norman", "lake wylie",
];

const CHARLOTTE_NEIGHBORHOODS = [
  "south end", "noda", "plaza midwood", "uptown", "dilworth", "myers park",
  "ballantyne", "university city", "northlake", "steele creek", "eastland",
  "elizabeth", "cherry", "cotswold", "sedgefield", "enderly park",
  "west end", "optimist park", "camp north end", "fourth ward", "third ward",
  "first ward", "second ward", "belmont", "villa heights", "commonwealth",
];

const CHARLOTTE_COUNTIES = [
  "mecklenburg", "gaston", "cabarrus", "union", "iredell", "lincoln",
  "rowan", "york", "lancaster", "catawba",
];

const MONETIZATION_KEYWORDS = [
  "sponsor", "advertise", "advertising", "media kit", "mediakit",
  "partners", "partnership", "get listed", "pricing", "membership",
  "subscribe", "sponsored", "promotion", "promote your", "featured listing",
];

async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(baseUrl);
    const cacheKey = parsed.origin;
    const cached = ROBOTS_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < ROBOTS_CACHE_TTL) return cached.allowed;

    const robotsUrl = `${parsed.origin}/robots.txt`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "CityHubBot/1.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      ROBOTS_CACHE.set(cacheKey, { allowed: true, cachedAt: Date.now() });
      return true;
    }

    const text = await res.text();
    const lines = text.split("\n");
    let inOurSection = false;
    let inWildcard = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.replace("user-agent:", "").trim();
        inOurSection = agent === "cityhubbot";
        inWildcard = agent === "*";
      }
      if ((inOurSection || inWildcard) && trimmed.startsWith("disallow:")) {
        const path = trimmed.replace("disallow:", "").trim();
        if (path === "/" || path === "/*") {
          ROBOTS_CACHE.set(cacheKey, { allowed: false, cachedAt: Date.now() });
          return false;
        }
      }
    }

    ROBOTS_CACHE.set(cacheKey, { allowed: true, cachedAt: Date.now() });
    return true;
  } catch {
    ROBOTS_CACHE.set(cacheKey, { allowed: true, cachedAt: Date.now() });
    return true;
  }
}

async function waitForDomain(domain: string): Promise<void> {
  const lastReq = DOMAIN_LAST_REQUEST.get(domain) || 0;
  const elapsed = Date.now() - lastReq;
  if (elapsed < DOMAIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, DOMAIN_DELAY_MS - elapsed));
  }
  DOMAIN_LAST_REQUEST.set(domain, Date.now());
}

async function fetchPage(url: string): Promise<{ html: string; status: number; finalUrl: string } | null> {
  try {
    const parsed = new URL(url);
    await waitForDomain(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityHubBot/1.0 (+https://citycoreh.com/bot)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) return null;

    const html = await res.text();
    return { html, status: res.status, finalUrl: res.url };
  } catch {
    return null;
  }
}

function classifyPageType(url: string, title: string): string {
  const lower = (url + " " + title).toLowerCase();
  if (/\/about/i.test(url) || /about\s+us/i.test(title)) return "ABOUT";
  if (/advertise|media.?kit|sponsor/i.test(lower)) return "ADVERTISE";
  if (/submit|add.?listing|get.?listed|claim/i.test(lower)) return "SUBMIT";
  if (/directory|listings?|businesses|members|places/i.test(lower)) return "LISTINGS";
  if (/contact/i.test(lower)) return "CONTACT";
  if (/events?|calendar/i.test(lower)) return "EVENTS";
  if (/blog|news|articles?/i.test(lower)) return "BLOG";
  return "OTHER";
}

function extractTextContent($: cheerio.CheerioAPI): string {
  $("script, style, noscript, nav, header, footer").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return text.substring(0, 2000);
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches.map(p => p.replace(/\D/g, "").replace(/^1/, "")))].filter(p => p.length === 10).slice(0, 3);
}

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches)].filter(e => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.includes("example.com")).slice(0, 5);
}

function extractSocialLinks($: cheerio.CheerioAPI): Record<string, string> {
  const socials: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      const parsed = new URL(href);
      const host = parsed.hostname.replace(/^www\./, "");
      const platform = SOCIAL_DOMAINS[host];
      if (platform && !socials[platform]) socials[platform] = href;
    } catch {}
  });
  return socials;
}

function extractContactFormUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const forms = $("form");
  for (let i = 0; i < forms.length; i++) {
    const action = $(forms[i]).attr("action") || "";
    const text = $(forms[i]).text().toLowerCase();
    if (text.includes("contact") || text.includes("message") || text.includes("email") || text.includes("inquiry")) {
      try {
        return new URL(action || baseUrl, baseUrl).href;
      } catch {
        return baseUrl;
      }
    }
  }
  const contactLink = $('a[href*="contact"]').first().attr("href");
  if (contactLink) {
    try {
      return new URL(contactLink, baseUrl).href;
    } catch {}
  }
  return null;
}

interface DirectoryAnalysis {
  directoryScore: number;
  evidence: string[];
  nicheTags: Array<{ tag: string; confidence: number }>;
  territory: { cities: string[]; neighborhoods: string[]; counties: string[]; zips: string[] };
  monetizationSignals: string[];
  contactMethods: { emails: string[]; phones: string[]; contactFormUrl: string | null; socials: Record<string, string> };
}

function analyzePages(pages: Array<{ url: string; title: string; text: string; pageType: string; $: cheerio.CheerioAPI }>): DirectoryAnalysis {
  const evidence: string[] = [];
  let score = 0;
  const allText = pages.map(p => p.text).join(" ").toLowerCase();
  const allUrls = pages.map(p => p.url.toLowerCase()).join(" ");

  for (const keyword of DIRECTORY_KEYWORDS) {
    if (allText.includes(keyword)) {
      if (keyword.includes("get listed") || keyword.includes("add your") || keyword.includes("add a listing") || keyword.includes("claim")) {
        score += 25;
        evidence.push(`Found "${keyword}" — strong listing signal`);
      } else if (keyword.includes("directory") || keyword.includes("listings")) {
        score += 20;
        evidence.push(`Found "${keyword}" keyword`);
      } else {
        score += 5;
        evidence.push(`Found "${keyword}"`);
      }
    }
  }

  const directoryUrlPatterns = ["/directory", "/businesses", "/listings", "/members", "/places"];
  for (const pattern of directoryUrlPatterns) {
    if (allUrls.includes(pattern)) {
      score += 20;
      evidence.push(`URL pattern: ${pattern}`);
      break;
    }
  }

  const monetizationSignals: string[] = [];
  for (const keyword of MONETIZATION_KEYWORDS) {
    if (allText.includes(keyword)) {
      if (!monetizationSignals.includes(keyword)) {
        monetizationSignals.push(keyword);
      }
    }
  }
  if (monetizationSignals.length > 0) {
    score += 15;
    evidence.push(`Monetization signals: ${monetizationSignals.join(", ")}`);
  }

  const territory: { cities: string[]; neighborhoods: string[]; counties: string[]; zips: string[] } = {
    cities: [], neighborhoods: [], counties: [], zips: [],
  };

  for (const city of CHARLOTTE_CITIES) {
    if (allText.includes(city)) territory.cities.push(city);
  }
  for (const hood of CHARLOTTE_NEIGHBORHOODS) {
    if (allText.includes(hood)) territory.neighborhoods.push(hood);
  }
  for (const county of CHARLOTTE_COUNTIES) {
    if (allText.includes(county)) territory.counties.push(county);
  }

  const zipMatches = allText.match(/\b(28[0-9]{3})\b/g);
  if (zipMatches) {
    territory.zips = [...new Set(zipMatches)].slice(0, 20);
  }

  if (territory.cities.length > 0 || territory.neighborhoods.length > 0 || territory.counties.length > 0 || territory.zips.length > 0) {
    score += 15;
    evidence.push(`Territory: ${territory.cities.length} cities, ${territory.neighborhoods.length} neighborhoods, ${territory.zips.length} zips`);
  }

  const nicheScores: Record<string, number> = {};
  for (const [tag, keywords] of Object.entries(NICHE_MAP)) {
    let hits = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}`, "gi");
      const matches = allText.match(regex);
      if (matches) hits += matches.length;
    }
    if (hits > 0) {
      nicheScores[tag] = Math.min(100, hits * 10);
    }
  }

  const nicheTags = Object.entries(nicheScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, confidence]) => ({ tag, confidence }));

  if (nicheTags.length > 0 && nicheTags[0].confidence > 60) {
    score += 10;
    evidence.push(`Niche clarity: ${nicheTags[0].tag} (confidence ${nicheTags[0].confidence})`);
  }

  const emails: string[] = [];
  const phones: string[] = [];
  let contactFormUrl: string | null = null;
  const socials: Record<string, string> = {};

  for (const page of pages) {
    const pageEmails = extractEmails(page.text);
    emails.push(...pageEmails);
    const pagePhones = extractPhones(page.text);
    phones.push(...pagePhones);
    const pageSocials = extractSocialLinks(page.$);
    Object.assign(socials, pageSocials);
    if (!contactFormUrl) {
      contactFormUrl = extractContactFormUrl(page.$, page.url);
    }
  }

  score = Math.min(100, score);

  return {
    directoryScore: score,
    evidence,
    nicheTags,
    territory,
    monetizationSignals,
    contactMethods: {
      emails: [...new Set(emails)].slice(0, 5),
      phones: [...new Set(phones)].slice(0, 3),
      contactFormUrl,
      socials,
    },
  };
}

export async function crawlDirectoryProspect(prospectId: string): Promise<{ success: boolean; score: number }> {
  const result = await db.execute(sql`
    SELECT id, root_domain, website_url FROM directory_prospects WHERE id = ${prospectId}
  `);
  const rows = (result as any).rows ?? result;
  if (rows.length === 0) return { success: false, score: 0 };

  const prospect = rows[0];
  const websiteUrl = prospect.website_url.startsWith("http") ? prospect.website_url : `https://${prospect.website_url}`;

  const allowed = await checkRobotsTxt(websiteUrl);
  if (!allowed) {
    await db.execute(sql`
      UPDATE directory_prospects SET crawl_status = 'BLOCKED', computed_at = NOW(), updated_at = NOW()
      WHERE id = ${prospectId}
    `);
    return { success: false, score: 0 };
  }

  const homePage = await fetchPage(websiteUrl);
  if (!homePage) {
    await db.execute(sql`
      UPDATE directory_prospects SET crawl_status = 'FAILED', computed_at = NOW(), updated_at = NOW()
      WHERE id = ${prospectId}
    `);
    return { success: false, score: 0 };
  }

  await db.execute(sql`DELETE FROM directory_site_pages WHERE directory_prospect_id = ${prospectId}`);

  const pages: Array<{ url: string; title: string; text: string; pageType: string; $: cheerio.CheerioAPI }> = [];

  const home$ = cheerio.load(homePage.html);
  const homeTitle = home$("title").text().trim();
  const homeText = extractTextContent(cheerio.load(homePage.html));

  pages.push({ url: homePage.finalUrl, title: homeTitle, text: homeText, pageType: "HOME", $: home$ });

  await db.execute(sql`
    INSERT INTO directory_site_pages (directory_prospect_id, url, page_type, title, text_excerpt, fetched_at)
    VALUES (${prospectId}, ${homePage.finalUrl}, 'HOME', ${homeTitle}, ${homeText.substring(0, 500)}, NOW())
  `);

  const links: string[] = [];
  const baseOrigin = new URL(homePage.finalUrl).origin;
  const seenUrls = new Set<string>([homePage.finalUrl]);

  home$("a[href]").each((_, el) => {
    const href = home$(el).attr("href") || "";
    try {
      const resolved = new URL(href, homePage.finalUrl);
      if (resolved.origin === baseOrigin && !seenUrls.has(resolved.href)) {
        seenUrls.add(resolved.href);
        links.push(resolved.href);
      }
    } catch {}
  });

  const priorityLinks = links
    .map(link => ({
      url: link,
      priority: PRIORITY_LINK_PATTERNS.reduce((score, pattern) => score + (pattern.test(link) ? 1 : 0), 0),
    }))
    .filter(l => l.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_PAGES_PER_SITE - 1);

  for (const link of priorityLinks) {
    const page = await fetchPage(link.url);
    if (!page) continue;

    const $ = cheerio.load(page.html);
    const title = $("title").text().trim();
    const text = extractTextContent(cheerio.load(page.html));
    const pageType = classifyPageType(page.finalUrl, title);

    pages.push({ url: page.finalUrl, title, text, pageType, $ });

    await db.execute(sql`
      INSERT INTO directory_site_pages (directory_prospect_id, url, page_type, title, text_excerpt, fetched_at)
      VALUES (${prospectId}, ${page.finalUrl}, ${pageType}, ${title}, ${text.substring(0, 500)}, NOW())
    `);
  }

  const analysis = analyzePages(pages);

  const bucket = analysis.directoryScore >= 60 ? "MICRO_LICENSE_TARGET"
    : analysis.directoryScore >= 40 ? "PARTNER_TARGET"
    : "IGNORE";

  await db.execute(sql`
    UPDATE directory_prospects SET
      crawl_status = 'SUCCESS',
      directory_score = ${analysis.directoryScore},
      territory_json = ${JSON.stringify(analysis.territory)}::jsonb,
      niche_tags_json = ${JSON.stringify(analysis.nicheTags)}::jsonb,
      monetization_signals_json = ${JSON.stringify(analysis.monetizationSignals)}::jsonb,
      contact_methods_json = ${JSON.stringify(analysis.contactMethods)}::jsonb,
      evidence_json = ${JSON.stringify(analysis.evidence)}::jsonb,
      bucket = ${bucket}::directory_bucket,
      computed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${prospectId}
  `);

  console.log(`[DirectoryCrawler] ${prospect.root_domain}: score=${analysis.directoryScore}, bucket=${bucket}, pages=${pages.length}`);
  return { success: true, score: analysis.directoryScore };
}

export async function crawlAllDirectoryProspects(metroId?: string): Promise<{ crawled: number; succeeded: number; failed: number; blocked: number }> {
  const metroWhere = metroId ? sql`AND metro_id = ${metroId}` : sql``;
  const result = await db.execute(sql`
    SELECT id, root_domain FROM directory_prospects
    WHERE crawl_status = 'PENDING' ${metroWhere}
    ORDER BY created_at ASC
    LIMIT 100
  `);
  const prospects = (result as any).rows ?? result;

  console.log(`[DirectoryCrawler] Starting batch crawl of ${prospects.length} PENDING prospects...`);

  let crawled = 0, succeeded = 0, failed = 0, blocked = 0;

  for (let i = 0; i < prospects.length; i += CRAWL_CONCURRENCY) {
    const batch = prospects.slice(i, i + CRAWL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((p: any) => crawlDirectoryProspect(p.id))
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      crawled++;
      if (r.status === "fulfilled") {
        if (r.value.success) {
          succeeded++;
        } else {
          const prospectCheck = await db.execute(sql`
            SELECT crawl_status FROM directory_prospects WHERE id = ${batch[j].id}
          `);
          const checkRows = (prospectCheck as any).rows ?? prospectCheck;
          if (checkRows[0]?.crawl_status === "BLOCKED") blocked++;
          else failed++;
        }
      } else {
        failed++;
      }
    }
  }

  console.log(`[DirectoryCrawler] Batch complete: ${crawled} crawled, ${succeeded} succeeded, ${failed} failed, ${blocked} blocked`);
  return { crawled, succeeded, failed, blocked };
}
