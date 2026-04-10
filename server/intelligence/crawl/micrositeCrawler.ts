import * as cheerio from "cheerio";

const DOMAIN_LAST_REQUEST = new Map<string, number>();
const DOMAIN_DELAY_MS = 3000;
const ROBOTS_CACHE = new Map<string, { allowed: boolean; cachedAt: number }>();
const ROBOTS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export interface MicrositeCrawlResult {
  status: "success" | "failed" | "blocked";
  sourceUrl: string;
  pagesCrawled: number;
  businessName: string | null;
  metaDescription: string | null;
  headings: string[];
  aboutText: string | null;
  serviceNames: string[];
  faqPairs: Array<{ question: string; answer: string }>;
  testimonials: Array<{ text: string; author: string | null }>;
  teamMembers: Array<{ name: string; title: string | null }>;
  ctaLabels: Array<{ text: string; url: string }>;
  phone: string | null;
  email: string | null;
  address: string | null;
  hours: Record<string, string> | null;
  socialLinks: Record<string, string>;
  bookingUrl: string | null;
  imageUrls: string[];
  brandColors: string[];
  heroHeadline: string | null;
  heroSubheadline: string | null;
  mainTextBlocks: string[];
  error: string | null;
}

const PRIORITY_PAGES = [
  { pattern: /\/(about|about-us|who-we-are|our-story)/i, label: "about" },
  { pattern: /\/(services|what-we-do|our-services|offerings)/i, label: "services" },
  { pattern: /\/(contact|contact-us|get-in-touch|reach-us)/i, label: "contact" },
  { pattern: /\/(faq|faqs|frequently-asked|questions)/i, label: "faq" },
  { pattern: /\/(testimonials|reviews|what-people-say|clients)/i, label: "testimonials" },
  { pattern: /\/(team|our-team|staff|providers|doctors|meet-us)/i, label: "team" },
];

const LINK_TEXT_PATTERNS: Record<string, RegExp> = {
  about: /^(about|about us|who we are|our story)$/i,
  services: /^(services|our services|what we do|offerings)$/i,
  contact: /^(contact|contact us|get in touch|reach us)$/i,
  faq: /^(faq|faqs|frequently asked|questions)$/i,
  testimonials: /^(testimonials|reviews|what (people|clients) say)$/i,
  team: /^(team|our team|staff|providers|meet (us|our|the))$/i,
};

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SOCIAL_DOMAINS: Record<string, string> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "youtube.com": "youtube",
  "tiktok.com": "tiktok",
  "yelp.com": "yelp",
  "pinterest.com": "pinterest",
};

const BOOKING_DOMAINS = [
  "calendly.com", "acuityscheduling.com", "square.site", "vagaro.com",
  "booksy.com", "schedulicity.com", "fresha.com", "styleseat.com",
  "opentable.com", "resy.com", "zocdoc.com", "healthgrades.com",
];

const JUNK_PATTERNS = [
  /cookie/i, /privacy policy/i, /terms of (service|use)/i,
  /copyright/i, /all rights reserved/i, /powered by/i,
  /skip to (content|main)/i, /toggle navigation/i,
];

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function resolveUrl(href: string, baseUrl: string): string {
  try { return new URL(href, baseUrl).href; } catch { return href; }
}

function isSameDomain(href: string, baseUrl: string): boolean {
  try {
    return new URL(href).hostname === new URL(baseUrl).hostname;
  } catch { return false; }
}

async function throttleDomain(domain: string): Promise<void> {
  const last = DOMAIN_LAST_REQUEST.get(domain) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < DOMAIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, DOMAIN_DELAY_MS - elapsed));
  }
  DOMAIN_LAST_REQUEST.set(domain, Date.now());
}

async function checkRobotsTxt(websiteUrl: string): Promise<boolean> {
  const domain = getDomain(websiteUrl);
  const cached = ROBOTS_CACHE.get(domain);
  if (cached && Date.now() - cached.cachedAt < ROBOTS_CACHE_TTL) return cached.allowed;

  try {
    const origin = new URL(websiteUrl).origin;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { "User-Agent": "CityHubBot/1.0" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      ROBOTS_CACHE.set(domain, { allowed: true, cachedAt: Date.now() });
      return true;
    }

    const text = await resp.text();
    const lines = text.toLowerCase().split("\n");
    let relevant = false;
    let allowed = true;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.replace("user-agent:", "").trim();
        relevant = agent === "*" || agent.includes("cityhubbot");
      }
      if (relevant && trimmed.startsWith("disallow:")) {
        const path = trimmed.replace("disallow:", "").trim();
        if (path === "/" || path === "/*") allowed = false;
      }
    }

    ROBOTS_CACHE.set(domain, { allowed, cachedAt: Date.now() });
    return allowed;
  } catch {
    ROBOTS_CACHE.set(domain, { allowed: true, cachedAt: Date.now() });
    return true;
  }
}

async function fetchPage(url: string): Promise<{ html: string; status: number; finalUrl: string } | null> {
  const domain = getDomain(url);
  await throttleDomain(domain);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityHubBot/1.0 (+https://cityhub.com/bot; microsite-crawl)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) return null;

    const html = await resp.text();
    return { html, status: resp.status, finalUrl: resp.url || url };
  } catch { return null; }
}

function isJunk(text: string): boolean {
  return JUNK_PATTERNS.some(p => p.test(text));
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractMainContent($: cheerio.CheerioAPI): string[] {
  const blocks: string[] = [];
  const selectors = ["main", "article", '[role="main"]', ".content", "#content", ".page-content", ".entry-content"];

  let $container: cheerio.Cheerio<any> | null = null;
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length > 0) { $container = el; break; }
  }

  if (!$container) $container = $("body");

  $container.find("p, li").each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length > 30 && text.length < 2000 && !isJunk(text)) {
      blocks.push(text);
    }
  });

  return blocks.slice(0, 30);
}

function extractHeadings($: cheerio.CheerioAPI): string[] {
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length > 2 && text.length < 200 && !isJunk(text)) {
      headings.push(text);
    }
  });
  return headings.slice(0, 20);
}

function extractFaqPairs($: cheerio.CheerioAPI): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = [];

  $('[itemtype*="FAQPage"] [itemprop="mainEntity"], [itemtype*="Question"]').each((_, el) => {
    const q = cleanText($(el).find('[itemprop="name"]').text());
    const a = cleanText($(el).find('[itemprop="acceptedAnswer"], [itemprop="text"]').text());
    if (q && a) faqs.push({ question: q, answer: a });
  });

  if (faqs.length === 0) {
    $("details, .faq-item, .accordion-item").each((_, el) => {
      const q = cleanText($(el).find("summary, .faq-question, .accordion-header, .accordion-button").text());
      const a = cleanText($(el).find(".faq-answer, .accordion-body, .accordion-content, p").first().text());
      if (q && a && q.length < 300 && a.length < 1000) faqs.push({ question: q, answer: a });
    });
  }

  return faqs.slice(0, 15);
}

function extractTestimonials($: cheerio.CheerioAPI): Array<{ text: string; author: string | null }> {
  const testimonials: Array<{ text: string; author: string | null }> = [];

  $('[itemtype*="Review"], .testimonial, .review, .review-item, .testimonial-item').each((_, el) => {
    const text = cleanText($(el).find('[itemprop="reviewBody"], p, .testimonial-text, .review-text').first().text());
    const author = cleanText($(el).find('[itemprop="author"], .author, .reviewer, cite').first().text()) || null;
    if (text && text.length > 20 && text.length < 1000) {
      testimonials.push({ text, author });
    }
  });

  if (testimonials.length === 0) {
    $("blockquote").each((_, el) => {
      const text = cleanText($(el).find("p").first().text() || $(el).text());
      const author = cleanText($(el).find("cite, footer, .author").first().text()) || null;
      if (text && text.length > 20 && text.length < 1000 && !isJunk(text)) {
        testimonials.push({ text, author });
      }
    });
  }

  return testimonials.slice(0, 10);
}

function extractTeamMembers($: cheerio.CheerioAPI): Array<{ name: string; title: string | null }> {
  const members: Array<{ name: string; title: string | null }> = [];

  $(".team-member, .staff-member, .provider, .doctor, .therapist, [itemtype*='Person']").each((_, el) => {
    const name = cleanText($(el).find("h3, h4, .name, [itemprop='name']").first().text());
    const title = cleanText($(el).find(".title, .role, .position, [itemprop='jobTitle']").first().text()) || null;
    if (name && name.length > 2 && name.length < 100) {
      members.push({ name, title });
    }
  });

  return members.slice(0, 20);
}

function extractServiceNames($: cheerio.CheerioAPI): string[] {
  const services: string[] = [];

  $(".service, .service-item, .service-card, [itemtype*='Service']").each((_, el) => {
    const name = cleanText($(el).find("h3, h4, .service-title, [itemprop='name']").first().text());
    if (name && name.length > 2 && name.length < 150 && !isJunk(name)) {
      services.push(name);
    }
  });

  if (services.length === 0) {
    $("ul li").each((_, el) => {
      const parent = $(el).parent().prev("h2, h3");
      if (parent.length > 0) {
        const heading = cleanText(parent.text()).toLowerCase();
        if (heading.includes("service") || heading.includes("offering") || heading.includes("what we")) {
          const name = cleanText($(el).text());
          if (name.length > 3 && name.length < 150 && !isJunk(name)) {
            services.push(name);
          }
        }
      }
    });
  }

  return [...new Set(services)].slice(0, 20);
}

function extractCtaLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{ text: string; url: string }> {
  const ctas: Array<{ text: string; url: string }> = [];
  const ctaPatterns = /book|schedule|appointment|get started|contact|call|request|consultation|free|sign up|get a quote|learn more/i;

  $("a").each((_, el) => {
    const text = cleanText($(el).text());
    const href = $(el).attr("href");
    if (!href || !text) return;
    if (ctaPatterns.test(text) && text.length < 60) {
      ctas.push({ text, url: resolveUrl(href, baseUrl) });
    }
  });

  $("button").each((_, el) => {
    const text = cleanText($(el).text());
    if (ctaPatterns.test(text) && text.length < 60) {
      ctas.push({ text, url: "" });
    }
  });

  return ctas.slice(0, 10);
}

function extractPhones($: cheerio.CheerioAPI): string[] {
  const phones = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const num = href.replace("tel:", "").replace(/\D/g, "");
      if (num.length >= 10) phones.add(num);
    }
  });
  const bodyText = $("body").text();
  const matches = bodyText.match(PHONE_REGEX);
  if (matches) {
    for (const m of matches) {
      const num = m.replace(/\D/g, "");
      if (num.length >= 10 && num.length <= 11) phones.add(num);
    }
  }
  return Array.from(phones);
}

function extractEmails($: cheerio.CheerioAPI): string[] {
  const emails = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (EMAIL_REGEX.test(email)) emails.add(email);
    }
  });
  const bodyText = $("body").text();
  const matches = bodyText.match(EMAIL_REGEX);
  if (matches) {
    for (const m of matches) emails.add(m.toLowerCase());
  }
  return Array.from(emails);
}

function extractSocialLinks($: cheerio.CheerioAPI): Record<string, string> {
  const socials: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const host = new URL(href).hostname.replace("www.", "").toLowerCase();
      for (const [domain, platform] of Object.entries(SOCIAL_DOMAINS)) {
        if (host === domain || host.endsWith("." + domain)) {
          if (!socials[platform]) socials[platform] = href;
        }
      }
    } catch {}
  });
  return socials;
}

function extractBookingUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  let bookingUrl: string | null = null;

  $("a[href]").each((_, el) => {
    if (bookingUrl) return;
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const host = new URL(href).hostname.replace("www.", "").toLowerCase();
      for (const bd of BOOKING_DOMAINS) {
        if (host === bd || host.endsWith("." + bd)) {
          bookingUrl = href;
          return;
        }
      }
    } catch {}

    const text = cleanText($(el).text()).toLowerCase();
    if (/^(book|schedule|make an appointment|book now|book online|book appointment)/i.test(text)) {
      bookingUrl = resolveUrl(href, baseUrl);
    }
  });

  return bookingUrl;
}

function extractBrandColors($: cheerio.CheerioAPI): string[] {
  const colors = new Set<string>();

  $('meta[name="theme-color"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) colors.add(content);
  });

  $("style").each((_, el) => {
    const css = $(el).html() || "";
    const hexMatches = css.match(/#[0-9a-fA-F]{6}/g);
    if (hexMatches) {
      for (const hex of hexMatches.slice(0, 5)) colors.add(hex);
    }
  });

  const inlineStyles = $("[style]").slice(0, 20);
  inlineStyles.each((_, el) => {
    const style = $(el).attr("style") || "";
    const hexMatches = style.match(/#[0-9a-fA-F]{6}/g);
    if (hexMatches) {
      for (const hex of hexMatches.slice(0, 3)) colors.add(hex);
    }
  });

  return Array.from(colors).slice(0, 5);
}

function extractImageUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const resolved = resolveUrl(src, baseUrl);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    const alt = $(el).attr("alt") || "";
    if (/logo|icon|badge|sprite|pixel|track|analytics/i.test(resolved)) return;
    if (/\.(svg|gif)$/i.test(resolved)) return;
    const width = parseInt($(el).attr("width") || "0", 10);
    const height = parseInt($(el).attr("height") || "0", 10);
    if ((width > 0 && width < 50) || (height > 0 && height < 50)) return;
    images.push(resolved);
  });

  return images.slice(0, 15);
}

function extractSchemaOrg($: cheerio.CheerioAPI): Record<string, unknown> | null {
  let schemaData: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (schemaData) return;
    try {
      const json = JSON.parse($(el).html() || "");
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        const relevant = ["LocalBusiness", "Organization", "Restaurant", "Store", "ProfessionalService", "MedicalBusiness", "HealthAndBeautyBusiness"];
        if (types.some((t: string) => relevant.includes(t))) {
          schemaData = item;
          return;
        }
      }
    } catch {}
  });
  return schemaData;
}

function extractHoursFromSchema(schema: Record<string, unknown>): Record<string, string> | null {
  const specs = schema.openingHoursSpecification;
  if (!specs) return null;
  const specArr = Array.isArray(specs) ? specs : [specs];
  const hours: Record<string, string> = {};
  for (const spec of specArr) {
    const days = Array.isArray((spec as Record<string, unknown>).dayOfWeek) ? (spec as Record<string, unknown>).dayOfWeek as string[] : [(spec as Record<string, unknown>).dayOfWeek as string];
    for (const day of days) {
      if (day) {
        const dayName = typeof day === "string" ? day.replace("http://schema.org/", "") : String(day);
        hours[dayName] = `${(spec as Record<string, unknown>).opens || "?"}-${(spec as Record<string, unknown>).closes || "?"}`;
      }
    }
  }
  return Object.keys(hours).length > 0 ? hours : null;
}

function findInternalPageUrls($: cheerio.CheerioAPI, baseUrl: string): Map<string, string> {
  const found = new Map<string, string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = cleanText($(el).text());
    if (!href || !text) return;

    const resolved = resolveUrl(href, baseUrl);
    if (!isSameDomain(resolved, baseUrl)) return;

    for (const { pattern, label } of PRIORITY_PAGES) {
      if (pattern.test(resolved) && !found.has(label)) {
        found.set(label, resolved);
        return;
      }
    }

    for (const [label, textPattern] of Object.entries(LINK_TEXT_PATTERNS)) {
      if (textPattern.test(text) && !found.has(label)) {
        found.set(label, resolved);
        return;
      }
    }
  });

  return found;
}

export async function crawlForMicrosite(websiteUrl: string): Promise<MicrositeCrawlResult> {
  const url = normalizeUrl(websiteUrl);

  const emptyResult: MicrositeCrawlResult = {
    status: "failed", sourceUrl: url, pagesCrawled: 0,
    businessName: null, metaDescription: null, headings: [],
    aboutText: null, serviceNames: [], faqPairs: [], testimonials: [],
    teamMembers: [], ctaLabels: [], phone: null, email: null,
    address: null, hours: null, socialLinks: {}, bookingUrl: null,
    imageUrls: [], brandColors: [], heroHeadline: null,
    heroSubheadline: null, mainTextBlocks: [], error: null,
  };

  if (!url) return { ...emptyResult, error: "No website URL" };

  const robotsAllowed = await checkRobotsTxt(url);
  if (!robotsAllowed) return { ...emptyResult, status: "blocked", error: "Blocked by robots.txt" };

  const homePage = await fetchPage(url);
  if (!homePage) return { ...emptyResult, error: "Failed to fetch homepage" };

  const $ = cheerio.load(homePage.html);
  const schema = extractSchemaOrg($);

  let businessName = schema?.name as string || null;
  if (!businessName) businessName = $('meta[property="og:site_name"]').attr("content") || null;
  if (!businessName) {
    const title = $("title").first().text().trim();
    if (title) businessName = title.split(/[|\-–—]/)[0].trim() || null;
  }

  const metaDescription = $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") || null;

  const headings = extractHeadings($);
  const heroHeadline = cleanText($("h1").first().text()) || headings[0] || null;
  const heroSubheadline = metaDescription;

  const mainTextBlocks = extractMainContent($);
  let serviceNames = extractServiceNames($);
  let faqPairs = extractFaqPairs($);
  let testimonials = extractTestimonials($);
  let teamMembers = extractTeamMembers($);
  const ctaLabels = extractCtaLinks($, url);
  const phones = extractPhones($);
  const emails = extractEmails($);
  let socialLinks = extractSocialLinks($);
  let bookingUrl = extractBookingUrl($, url);
  const brandColors = extractBrandColors($);
  const imageUrls = extractImageUrls($, url);

  let address: string | null = null;
  let hours: Record<string, string> | null = null;
  if (schema) {
    const addr = schema.address;
    if (typeof addr === "string") address = addr;
    else if (addr && typeof addr === "object") {
      const a = addr as Record<string, string>;
      const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean);
      if (parts.length > 0) address = parts.join(", ");
    }
    hours = extractHoursFromSchema(schema);
  }

  const internalPages = findInternalPageUrls($, url);
  let pagesCrawled = 1;
  const maxPages = 6;
  let aboutText: string | null = null;

  for (const [label, pageUrl] of internalPages) {
    if (pagesCrawled >= maxPages) break;

    const page = await fetchPage(pageUrl);
    if (!page) continue;
    pagesCrawled++;

    const $page = cheerio.load(page.html);

    if (label === "about" && !aboutText) {
      const blocks = extractMainContent($page);
      if (blocks.length > 0) aboutText = blocks.slice(0, 3).join("\n\n");
    }

    if (label === "services" && serviceNames.length === 0) {
      serviceNames = extractServiceNames($page);
      if (serviceNames.length === 0) {
        const svcHeadings = extractHeadings($page).filter(h => !isJunk(h));
        serviceNames = svcHeadings.slice(0, 10);
      }
    }

    if (label === "faq" && faqPairs.length === 0) {
      faqPairs = extractFaqPairs($page);
    }

    if (label === "testimonials" && testimonials.length === 0) {
      testimonials = extractTestimonials($page);
    }

    if (label === "team" && teamMembers.length === 0) {
      teamMembers = extractTeamMembers($page);
    }

    if (label === "contact") {
      const contactPhones = extractPhones($page);
      const contactEmails = extractEmails($page);
      phones.push(...contactPhones);
      emails.push(...contactEmails);

      if (!bookingUrl) bookingUrl = extractBookingUrl($page, pageUrl);

      if (!address) {
        const contactSchema = extractSchemaOrg($page);
        if (contactSchema?.address) {
          const addr = contactSchema.address;
          if (typeof addr === "string") address = addr;
          else if (typeof addr === "object") {
            const a = addr as Record<string, string>;
            const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean);
            if (parts.length > 0) address = parts.join(", ");
          }
        }
      }

      if (!hours) {
        const contactSchema = extractSchemaOrg($page);
        if (contactSchema) hours = extractHoursFromSchema(contactSchema);
      }
    }

    const pageSocials = extractSocialLinks($page);
    socialLinks = { ...socialLinks, ...pageSocials };
    imageUrls.push(...extractImageUrls($page, pageUrl).slice(0, 5));
  }

  if (!aboutText && mainTextBlocks.length > 0) {
    aboutText = mainTextBlocks.slice(0, 3).join("\n\n");
  }

  return {
    status: "success",
    sourceUrl: url,
    pagesCrawled,
    businessName,
    metaDescription,
    headings: [...new Set(headings)],
    aboutText,
    serviceNames: [...new Set(serviceNames)],
    faqPairs,
    testimonials,
    teamMembers,
    ctaLabels,
    phone: [...new Set(phones)][0] || null,
    email: [...new Set(emails)][0] || null,
    address,
    hours,
    socialLinks,
    bookingUrl,
    imageUrls: [...new Set(imageUrls)].slice(0, 15),
    brandColors: [...new Set(brandColors)],
    heroHeadline,
    heroSubheadline,
    mainTextBlocks: mainTextBlocks.slice(0, 15),
    error: null,
  };
}
