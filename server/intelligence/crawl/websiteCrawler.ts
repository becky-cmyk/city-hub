import { db } from "../../db";
import {
  businesses,
  businessContacts,
  crmContacts,
  entityContactVerification,
  entityFieldHistory,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as cheerio from "cheerio";
import { createInboxItemIfNotOpen } from "../../admin-inbox";

const ROBOTS_CACHE = new Map<string, { allowed: boolean; cachedAt: number }>();
const ROBOTS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const DOMAIN_LAST_REQUEST = new Map<string, number>();
const DOMAIN_DELAY_MS = 3000;

const BUSINESS_EMAIL_PREFIXES = [
  "info",
  "contact",
  "hello",
  "support",
  "sales",
  "admin",
  "office",
  "help",
  "team",
  "general",
  "inquiries",
  "billing",
  "press",
  "media",
  "hr",
  "careers",
  "jobs",
  "feedback",
  "service",
  "customerservice",
];

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
  "nextdoor.com": "nextdoor",
};

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

interface CrawlResult {
  crawlStatus: "SUCCESS" | "FAILED" | "BLOCKED" | "NO_WEBSITE";
  httpStatus: number | null;
  finalUrl: string | null;
  pageTitle: string | null;
  detectedName: string | null;
  detectedPhone: string | null;
  detectedEmail: string | null;
  detectedContactFormUrl: string | null;
  detectedSocialJson: Record<string, string> | null;
  detectedAddress: string | null;
  detectedHoursJson: Record<string, string> | null;
  schemaOrgJson: any | null;
  detectedFeedUrl: string | null;
  confidenceScore: number;
  notes: string | null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
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
  if (cached && Date.now() - cached.cachedAt < ROBOTS_CACHE_TTL) {
    return cached.allowed;
  }

  try {
    const origin = getOrigin(websiteUrl);
    const robotsUrl = `${origin}/robots.txt`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(robotsUrl, {
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
    let relevantAgent = false;
    let allowed = true;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.replace("user-agent:", "").trim();
        relevantAgent = agent === "*" || agent.includes("cityhubbot");
      }
      if (relevantAgent && trimmed.startsWith("disallow:")) {
        const path = trimmed.replace("disallow:", "").trim();
        if (path === "/" || path === "/*") {
          allowed = false;
        }
      }
    }

    ROBOTS_CACHE.set(domain, { allowed, cachedAt: Date.now() });
    return allowed;
  } catch {
    ROBOTS_CACHE.set(domain, { allowed: true, cachedAt: Date.now() });
    return true;
  }
}

async function fetchPage(
  url: string
): Promise<{ html: string; status: number; finalUrl: string } | null> {
  const domain = getDomain(url);
  await throttleDomain(domain);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "CityHubBot/1.0 (+https://cityhub.com/bot; contact verification)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      return null;
    }

    const html = await resp.text();
    return {
      html,
      status: resp.status,
      finalUrl: resp.url || url,
    };
  } catch {
    return null;
  }
}

function isBusinessEmail(email: string): boolean {
  const local = email.split("@")[0].toLowerCase();
  return BUSINESS_EMAIL_PREFIXES.some(
    (prefix) => local === prefix || local.startsWith(prefix + ".")
  );
}

function extractPhones(html: string, $: cheerio.CheerioAPI): string[] {
  const phones = new Set<string>();

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const num = href.replace("tel:", "").replace(/\D/g, "");
      if (num.length >= 10) phones.add(num);
    }
  });

  const textContent = $("body").text();
  const matches = textContent.match(PHONE_REGEX);
  if (matches) {
    for (const m of matches) {
      const num = m.replace(/\D/g, "");
      if (num.length >= 10 && num.length <= 11) phones.add(num);
    }
  }

  return Array.from(phones);
}

function extractEmails(html: string, $: cheerio.CheerioAPI): string[] {
  const emails = new Set<string>();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (EMAIL_REGEX.test(email) && isBusinessEmail(email)) {
        emails.add(email);
      }
    }
  });

  const textContent = $("body").text();
  const matches = textContent.match(EMAIL_REGEX);
  if (matches) {
    for (const m of matches) {
      const email = m.toLowerCase();
      if (isBusinessEmail(email)) {
        emails.add(email);
      }
    }
  }

  return Array.from(emails);
}

function extractSocialLinks($: cheerio.CheerioAPI): Record<string, string> {
  const socials: Record<string, string> = {};

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const url = new URL(href);
      const host = url.hostname.replace("www.", "").toLowerCase();
      for (const [domain, platform] of Object.entries(SOCIAL_DOMAINS)) {
        if (host === domain || host.endsWith("." + domain)) {
          if (!socials[platform]) {
            socials[platform] = href;
          }
        }
      }
    } catch {}
  });

  return socials;
}

function extractContactPageUrl(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string | null {
  const contactPatterns = [
    /\/contact/i,
    /\/get-in-touch/i,
    /\/reach-us/i,
    /\/connect/i,
  ];

  let contactUrl: string | null = null;
  $("a[href]").each((_, el) => {
    if (contactUrl) return;
    const href = $(el).attr("href");
    const text = $(el).text().toLowerCase().trim();

    if (!href) return;

    if (
      text.includes("contact") ||
      text.includes("get in touch") ||
      text.includes("reach us")
    ) {
      contactUrl = resolveUrl(href, baseUrl);
      return;
    }

    for (const pattern of contactPatterns) {
      if (pattern.test(href)) {
        contactUrl = resolveUrl(href, baseUrl);
        return;
      }
    }
  });

  return contactUrl;
}

function extractAboutPageUrl(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string | null {
  let aboutUrl: string | null = null;
  $("a[href]").each((_, el) => {
    if (aboutUrl) return;
    const href = $(el).attr("href");
    const text = $(el).text().toLowerCase().trim();

    if (!href) return;
    if (text === "about" || text === "about us" || /\/about/i.test(href)) {
      aboutUrl = resolveUrl(href, baseUrl);
    }
  });

  return aboutUrl;
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function extractSchemaOrg($: cheerio.CheerioAPI): any | null {
  let schemaData: any = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (schemaData) return;
    try {
      const json = JSON.parse($(el).html() || "");
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (
          item["@type"] === "LocalBusiness" ||
          item["@type"] === "Organization" ||
          item["@type"] === "Restaurant" ||
          item["@type"] === "Store" ||
          item["@type"] === "ProfessionalService" ||
          (Array.isArray(item["@type"]) &&
            item["@type"].some(
              (t: string) =>
                t === "LocalBusiness" ||
                t === "Organization" ||
                t === "Restaurant"
            ))
        ) {
          schemaData = item;
          return;
        }
      }
    } catch {}
  });

  return schemaData;
}

function extractAddressFromSchema(schema: any): string | null {
  if (!schema?.address) return null;
  const addr = schema.address;
  if (typeof addr === "string") return addr;
  const parts = [
    addr.streetAddress,
    addr.addressLocality,
    addr.addressRegion,
    addr.postalCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function extractHoursFromSchema(
  schema: any
): Record<string, string> | null {
  if (!schema?.openingHoursSpecification) return null;
  const specs = Array.isArray(schema.openingHoursSpecification)
    ? schema.openingHoursSpecification
    : [schema.openingHoursSpecification];

  const hours: Record<string, string> = {};
  for (const spec of specs) {
    const days = Array.isArray(spec.dayOfWeek)
      ? spec.dayOfWeek
      : [spec.dayOfWeek];
    for (const day of days) {
      if (day) {
        const dayName =
          typeof day === "string" ? day.replace("http://schema.org/", "") : day;
        hours[dayName] = `${spec.opens || "?"}-${spec.closes || "?"}`;
      }
    }
  }

  return Object.keys(hours).length > 0 ? hours : null;
}

function extractFeedUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const feedSelectors = [
    'link[type="application/rss+xml"]',
    'link[type="application/atom+xml"]',
    'link[type="application/feed+json"]',
  ];

  for (const sel of feedSelectors) {
    const href = $(sel).attr("href");
    if (href) return resolveUrl(href, baseUrl);
  }

  let feedUrl: string | null = null;
  $("a[href]").each((_, el) => {
    if (feedUrl) return;
    const href = $(el).attr("href") || "";
    if (/\/(feed|rss|atom)(\.xml)?$/i.test(href)) {
      feedUrl = resolveUrl(href, baseUrl);
    }
  });

  return feedUrl;
}

function computeConfidenceScore(result: Partial<CrawlResult>): number {
  let score = 0;
  if (result.crawlStatus === "SUCCESS") score += 20;
  if (result.detectedPhone) score += 20;
  if (result.detectedEmail) score += 15;
  if (result.detectedContactFormUrl) score += 10;
  if (result.schemaOrgJson) score += 20;
  if (
    result.detectedSocialJson &&
    Object.keys(result.detectedSocialJson).length > 0
  )
    score += 5;
  if (result.detectedAddress) score += 10;
  return Math.min(score, 100);
}

async function parsePage(
  html: string,
  url: string
): Promise<{
  phones: string[];
  emails: string[];
  socials: Record<string, string>;
  contactUrl: string | null;
  aboutUrl: string | null;
  schemaOrg: any | null;
  pageTitle: string | null;
  detectedName: string | null;
  detectedAddress: string | null;
  detectedHours: Record<string, string> | null;
  feedUrl: string | null;
}> {
  const $ = cheerio.load(html);

  const phones = extractPhones(html, $);
  const emails = extractEmails(html, $);
  const socials = extractSocialLinks($);
  const contactUrl = extractContactPageUrl($, url);
  const aboutUrl = extractAboutPageUrl($, url);
  const schemaOrg = extractSchemaOrg($);
  const pageTitle = $("title").first().text().trim() || null;
  const feedUrl = extractFeedUrl($, url);

  let detectedName: string | null = null;
  let detectedAddress: string | null = null;
  let detectedHours: Record<string, string> | null = null;

  if (schemaOrg) {
    detectedName = schemaOrg.name || null;
    detectedAddress = extractAddressFromSchema(schemaOrg);
    detectedHours = extractHoursFromSchema(schemaOrg);
  }

  if (!detectedName) {
    const ogName =
      $('meta[property="og:site_name"]').attr("content") || null;
    if (ogName) detectedName = ogName;
  }

  return {
    phones,
    emails,
    socials,
    contactUrl,
    aboutUrl,
    schemaOrg,
    pageTitle,
    detectedName,
    detectedAddress,
    detectedHours,
    feedUrl,
  };
}

export async function crawlEntityWebsite(
  entityId: string,
  websiteUrl: string,
  metroId: string
): Promise<CrawlResult> {
  const url = normalizeUrl(websiteUrl);
  if (!url) {
    return createResult("NO_WEBSITE", "No website URL provided");
  }

  const robotsAllowed = await checkRobotsTxt(url);
  if (!robotsAllowed) {
    const result = createResult("BLOCKED", "Blocked by robots.txt");
    await upsertVerification(entityId, metroId, url, result);
    return result;
  }

  const homePage = await fetchPage(url);
  if (!homePage) {
    const result = createResult("FAILED", "Failed to fetch homepage");
    await upsertVerification(entityId, metroId, url, result);
    return result;
  }

  const homeData = await parsePage(homePage.html, homePage.finalUrl);

  let allPhones = [...homeData.phones];
  let allEmails = [...homeData.emails];
  let allSocials = { ...homeData.socials };
  let contactFormUrl = homeData.contactUrl;
  let feedUrl = homeData.feedUrl;
  let schemaOrg = homeData.schemaOrg;
  let detectedName = homeData.detectedName;
  let detectedAddress = homeData.detectedAddress;
  let detectedHours = homeData.detectedHours;

  const internalPages: string[] = [];
  if (homeData.contactUrl && isSameDomain(homeData.contactUrl, url)) {
    internalPages.push(homeData.contactUrl);
  }
  if (
    homeData.aboutUrl &&
    isSameDomain(homeData.aboutUrl, url) &&
    homeData.aboutUrl !== homeData.contactUrl
  ) {
    internalPages.push(homeData.aboutUrl);
  }

  let pagesVisited = 1;
  const maxPages = 3;

  for (const pageUrl of internalPages) {
    if (pagesVisited >= maxPages) break;

    const page = await fetchPage(pageUrl);
    if (!page) continue;
    pagesVisited++;

    const pageData = await parsePage(page.html, page.finalUrl);

    allPhones = [...new Set([...allPhones, ...pageData.phones])];
    allEmails = [...new Set([...allEmails, ...pageData.emails])];
    allSocials = { ...allSocials, ...pageData.socials };

    if (!contactFormUrl && pageData.contactUrl) {
      contactFormUrl = pageData.contactUrl;
    }
    if (!feedUrl && pageData.feedUrl) {
      feedUrl = pageData.feedUrl;
    }
    if (!schemaOrg && pageData.schemaOrg) {
      schemaOrg = pageData.schemaOrg;
    }
    if (!detectedName && pageData.detectedName) {
      detectedName = pageData.detectedName;
    }
    if (!detectedAddress && pageData.detectedAddress) {
      detectedAddress = pageData.detectedAddress;
    }
    if (!detectedHours && pageData.detectedHours) {
      detectedHours = pageData.detectedHours;
    }
  }

  const result: CrawlResult = {
    crawlStatus: "SUCCESS",
    httpStatus: homePage.status,
    finalUrl: homePage.finalUrl,
    pageTitle: homeData.pageTitle,
    detectedName,
    detectedPhone: allPhones[0] || null,
    detectedEmail: allEmails[0] || null,
    detectedContactFormUrl: contactFormUrl,
    detectedSocialJson:
      Object.keys(allSocials).length > 0 ? allSocials : null,
    detectedAddress,
    detectedHoursJson: detectedHours,
    schemaOrgJson: schemaOrg,
    detectedFeedUrl: feedUrl,
    confidenceScore: 0,
    notes: `Crawled ${pagesVisited} page(s)`,
  };

  result.confidenceScore = computeConfidenceScore(result);

  await upsertVerification(entityId, metroId, url, result);

  await maybeUpdateBusinessFields(entityId, result);

  await syncCrawlToContacts(entityId, result);

  return result;
}

function isSameDomain(href: string, baseUrl: string): boolean {
  try {
    const hDomain = new URL(href).hostname;
    const bDomain = new URL(baseUrl).hostname;
    return hDomain === bDomain;
  } catch {
    return false;
  }
}

function createResult(
  status: CrawlResult["crawlStatus"],
  notes: string
): CrawlResult {
  return {
    crawlStatus: status,
    httpStatus: null,
    finalUrl: null,
    pageTitle: null,
    detectedName: null,
    detectedPhone: null,
    detectedEmail: null,
    detectedContactFormUrl: null,
    detectedSocialJson: null,
    detectedAddress: null,
    detectedHoursJson: null,
    schemaOrgJson: null,
    detectedFeedUrl: null,
    confidenceScore: 0,
    notes,
  };
}

async function upsertVerification(
  entityId: string,
  metroId: string,
  websiteUrl: string,
  result: CrawlResult
): Promise<void> {
  const now = new Date();

  const existing = await db
    .select({ id: entityContactVerification.id })
    .from(entityContactVerification)
    .where(eq(entityContactVerification.entityId, entityId))
    .limit(1);

  const values = {
    metroId,
    entityId,
    websiteUrl,
    crawlStatus: result.crawlStatus,
    httpStatus: result.httpStatus,
    finalUrl: result.finalUrl,
    pageTitle: result.pageTitle,
    detectedName: result.detectedName,
    detectedPhone: result.detectedPhone,
    detectedEmail: result.detectedEmail,
    detectedContactFormUrl: result.detectedContactFormUrl,
    detectedSocialJson: result.detectedSocialJson,
    detectedAddress: result.detectedAddress,
    detectedHoursJson: result.detectedHoursJson,
    schemaOrgJson: result.schemaOrgJson,
    detectedFeedUrl: result.detectedFeedUrl,
    confidenceScore: result.confidenceScore,
    notes: result.notes,
    crawledAt: now,
    updatedAt: now,
  };

  if (existing.length > 0) {
    await db
      .update(entityContactVerification)
      .set(values)
      .where(eq(entityContactVerification.id, existing[0].id));
  } else {
    await db.insert(entityContactVerification).values(values);
  }
}

async function maybeUpdateBusinessFields(
  entityId: string,
  result: CrawlResult
): Promise<void> {
  if (result.crawlStatus !== "SUCCESS") return;
  if (result.confidenceScore < 80) return;

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, entityId))
    .limit(1);

  if (!biz) return;

  const updates: Record<string, any> = {};
  const historyEntries: {
    fieldName: string;
    oldValue: string | null;
    newValue: string;
  }[] = [];

  if (result.detectedPhone && !biz.phone) {
    updates.phone = result.detectedPhone;
    historyEntries.push({
      fieldName: "phone",
      oldValue: biz.phone || null,
      newValue: result.detectedPhone,
    });
  }

  if (result.detectedEmail && !biz.ownerEmail) {
    updates.ownerEmail = result.detectedEmail;
    historyEntries.push({
      fieldName: "ownerEmail",
      oldValue: biz.ownerEmail || null,
      newValue: result.detectedEmail,
    });
  }

  if (result.detectedAddress && !biz.address) {
    updates.address = result.detectedAddress;
    historyEntries.push({
      fieldName: "address",
      oldValue: biz.address || null,
      newValue: result.detectedAddress,
    });
  }

  if (
    result.detectedSocialJson &&
    (!biz.socialLinks || Object.keys(biz.socialLinks).length === 0)
  ) {
    updates.socialLinks = result.detectedSocialJson;
    historyEntries.push({
      fieldName: "socialLinks",
      oldValue: biz.socialLinks ? JSON.stringify(biz.socialLinks) : null,
      newValue: JSON.stringify(result.detectedSocialJson),
    });
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db.update(businesses).set(updates).where(eq(businesses.id, entityId));

    for (const entry of historyEntries) {
      await db.insert(entityFieldHistory).values({
        entityId,
        fieldName: entry.fieldName,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        source: "CRAWL",
      });
    }
  }
}

async function syncCrawlToContacts(
  entityId: string,
  result: CrawlResult
): Promise<void> {
  if (result.crawlStatus !== "SUCCESS") return;
  if (!result.detectedEmail && !result.detectedPhone) return;

  const [biz] = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, entityId))
    .limit(1);
  if (!biz) return;

  if (result.confidenceScore < 80) {
    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "businesses",
        relatedId: entityId,
        title: `Low-confidence crawl data: ${biz.name}`,
        summary: `Website crawl found contact info but confidence is ${result.confidenceScore}%. Email: ${result.detectedEmail || "none"}, Phone: ${result.detectedPhone || "none"}. Requires admin review before contact creation.`,
        priority: "med",
        tags: ["Crawl", "Low-Confidence", "Review"],
        links: [
          { label: "Review Listing", urlOrRoute: `/admin/businesses?openBiz=${entityId}` },
        ],
      });
    } catch (inboxErr) {
      console.error(`[CRAWL→CONTACTS] Failed to create low-confidence inbox item for ${entityId}:`, inboxErr);
    }
    return;
  }

  try {
    const contactName = result.detectedName || biz.name;
    const contactEmail = result.detectedEmail || null;
    const contactPhone = result.detectedPhone || null;

    let crmContactId: string | null = null;

    if (contactEmail) {
      const [existingCrm] = await db
        .select({ id: crmContacts.id })
        .from(crmContacts)
        .where(eq(crmContacts.email, contactEmail))
        .limit(1);

      if (existingCrm) {
        crmContactId = existingCrm.id;
      } else {
        const [newCrm] = await db
          .insert(crmContacts)
          .values({
            userId: "system",
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            company: biz.name,
            linkedBusinessId: entityId,
            captureMethod: "CRAWL",
            status: "active",
          })
          .returning({ id: crmContacts.id });
        crmContactId = newCrm.id;
      }
    } else if (contactPhone) {
      const normalizedPhone = contactPhone.replace(/\D/g, "");
      const [existingCrm] = await db
        .select({ id: crmContacts.id })
        .from(crmContacts)
        .where(eq(crmContacts.phone, contactPhone))
        .limit(1);

      if (existingCrm) {
        crmContactId = existingCrm.id;
      } else {
        const [newCrm] = await db
          .insert(crmContacts)
          .values({
            userId: "system",
            name: contactName,
            phone: normalizedPhone.length >= 10 ? contactPhone : normalizedPhone,
            company: biz.name,
            linkedBusinessId: entityId,
            captureMethod: "CRAWL",
            status: "active",
          })
          .returning({ id: crmContacts.id });
        crmContactId = newCrm.id;
      }
    }

    const conditions = [eq(businessContacts.businessId, entityId)];
    if (contactEmail) {
      conditions.push(eq(businessContacts.email, contactEmail));
    } else if (contactPhone) {
      conditions.push(eq(businessContacts.phone, contactPhone));
    }

    const [existingBc] = await db
      .select({ id: businessContacts.id })
      .from(businessContacts)
      .where(and(...conditions))
      .limit(1);

    if (existingBc) {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (crmContactId) updateData.crmContactId = crmContactId;
      if (contactPhone) updateData.phone = contactPhone;
      await db.update(businessContacts).set(updateData).where(eq(businessContacts.id, existingBc.id));
      console.log(`[CRAWL→CONTACTS] Updated existing business_contact for ${entityId}`);
    } else {
      const existingContacts = await db
        .select({ id: businessContacts.id })
        .from(businessContacts)
        .where(eq(businessContacts.businessId, entityId))
        .limit(1);
      const isFirst = existingContacts.length === 0;

      await db.insert(businessContacts).values({
        businessId: entityId,
        crmContactId,
        name: contactName,
        role: isFirst ? "OWNER" : "OTHER",
        email: contactEmail,
        phone: contactPhone,
        source: "CRAWL",
        isPrimary: isFirst,
      });
      console.log(`[CRAWL→CONTACTS] Created business_contact for ${entityId} from crawl data`);
    }
  } catch (err) {
    console.error(`[CRAWL→CONTACTS] Failed to sync crawl data to contacts for ${entityId}:`, err);
  }
}
