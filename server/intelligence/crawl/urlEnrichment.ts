import { db } from "../../db";
import {
  crmContacts,
  businesses,
  contactFieldHistory,
  entityFieldHistory,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";

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
  "nextdoor.com": "nextdoor",
};

export interface EnrichmentResult {
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  extractedFields: Record<string, string | null>;
  fieldsUpdated: string[];
  url: string;
}

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

async function fetchPageHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityHubBot/1.0 (+https://cityhub.com/bot; enrichment)",
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
    return { html, finalUrl: resp.url || url };
  } catch {
    return null;
  }
}

function extractFromPage(html: string, url: string): Record<string, string | null> {
  const $ = cheerio.load(html);
  const result: Record<string, string | null> = {
    name: null,
    phone: null,
    email: null,
    company: null,
    address: null,
    website: url,
    jobTitle: null,
    socialLinks: null,
  };

  const schemaOrg = extractSchemaOrg($);
  if (schemaOrg) {
    if (schemaOrg.name) result.name = schemaOrg.name;
    if (schemaOrg.telephone) result.phone = schemaOrg.telephone;
    if (schemaOrg.email) result.email = schemaOrg.email;
    if (schemaOrg.jobTitle) result.jobTitle = schemaOrg.jobTitle;

    const addr = schemaOrg.address;
    if (addr) {
      if (typeof addr === "string") {
        result.address = addr;
      } else {
        const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean);
        if (parts.length > 0) result.address = parts.join(", ");
      }
    }
  }

  if (!result.name) {
    const ogName = $('meta[property="og:site_name"]').attr("content") || null;
    if (ogName) result.name = ogName;
  }
  if (!result.name) {
    const title = $("title").first().text().trim();
    if (title) {
      const cleaned = title.split(/[|\-–—]/)[0].trim();
      if (cleaned.length > 0 && cleaned.length < 100) result.name = cleaned;
    }
  }

  if (!result.phone) {
    $('a[href^="tel:"]').each((_, el) => {
      if (result.phone) return;
      const href = $(el).attr("href");
      if (href) {
        const num = href.replace("tel:", "").replace(/\D/g, "");
        if (num.length >= 10) result.phone = num;
      }
    });
  }
  if (!result.phone) {
    const bodyText = $("body").text();
    const phoneMatches = bodyText.match(PHONE_REGEX);
    if (phoneMatches && phoneMatches.length > 0) {
      const num = phoneMatches[0].replace(/\D/g, "");
      if (num.length >= 10 && num.length <= 11) result.phone = num;
    }
  }

  if (!result.email) {
    $('a[href^="mailto:"]').each((_, el) => {
      if (result.email) return;
      const href = $(el).attr("href");
      if (href) {
        const email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
        if (EMAIL_REGEX.test(email)) result.email = email;
      }
    });
  }
  if (!result.email) {
    const bodyText = $("body").text();
    const emailMatches = bodyText.match(EMAIL_REGEX);
    if (emailMatches && emailMatches.length > 0) {
      result.email = emailMatches[0].toLowerCase();
    }
  }

  const socials: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const linkUrl = new URL(href);
      const host = linkUrl.hostname.replace("www.", "").toLowerCase();
      for (const [domain, platform] of Object.entries(SOCIAL_DOMAINS)) {
        if (host === domain || host.endsWith("." + domain)) {
          if (!socials[platform]) socials[platform] = href;
        }
      }
    } catch {}
  });
  if (Object.keys(socials).length > 0) {
    result.socialLinks = JSON.stringify(socials);
  }

  if (!result.company && result.name) {
    result.company = result.name;
  }

  return result;
}

function extractSchemaOrg($: cheerio.CheerioAPI): any | null {
  let schemaData: any = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (schemaData) return;
    try {
      const json = JSON.parse($(el).html() || "");
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        const relevantTypes = ["LocalBusiness", "Organization", "Restaurant", "Store", "ProfessionalService", "Person"];
        if (types.some((t: string) => relevantTypes.includes(t))) {
          schemaData = item;
          return;
        }
      }
    } catch {}
  });
  return schemaData;
}

export async function enrichFromUrl(
  url: string,
  targetType: "contact" | "business",
  targetId: string,
  changedBy?: string,
): Promise<EnrichmentResult> {
  const normalizedUrl = normalizeUrl(url);
  const failedResult: EnrichmentResult = {
    status: "FAILED",
    extractedFields: {},
    fieldsUpdated: [],
    url: normalizedUrl,
  };

  if (!normalizedUrl) return failedResult;

  const page = await fetchPageHtml(normalizedUrl);
  if (!page) return failedResult;

  const extracted = extractFromPage(page.html, page.finalUrl);
  const fieldsUpdated: string[] = [];

  try {
    if (targetType === "contact") {
      await updateContactFromExtracted(targetId, extracted, fieldsUpdated, changedBy || "system");
    } else {
      await updateBusinessFromExtracted(targetId, extracted, fieldsUpdated);
    }
  } catch (err) {
    console.error(`[URL_ENRICHMENT] Failed to update ${targetType} ${targetId}:`, err);
    return failedResult;
  }

  return {
    status: "SUCCESS",
    extractedFields: extracted,
    fieldsUpdated,
    url: normalizedUrl,
  };
}

async function updateContactFromExtracted(
  contactId: string,
  extracted: Record<string, string | null>,
  fieldsUpdated: string[],
  changedBy: string,
): Promise<void> {
  const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, contactId)).limit(1);
  if (!contact) return;

  const updates: Record<string, any> = {};
  const historyEntries: Array<{
    contactId: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: string;
    source: string;
  }> = [];

  const fieldMap: Record<string, keyof typeof contact> = {
    email: "email",
    phone: "phone",
    company: "company",
    jobTitle: "jobTitle",
    website: "website",
    address: "address",
  };

  for (const [extractedKey, contactKey] of Object.entries(fieldMap)) {
    const newVal = extracted[extractedKey];
    if (!newVal) continue;
    const currentVal = contact[contactKey] as string | null;
    if (currentVal) continue;

    updates[contactKey] = newVal;
    fieldsUpdated.push(contactKey as string);
    historyEntries.push({
      contactId,
      fieldName: contactKey as string,
      oldValue: currentVal || null,
      newValue: newVal,
      changedBy,
      source: "CRAWL",
    });
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db.update(crmContacts).set(updates).where(eq(crmContacts.id, contactId));

    if (historyEntries.length > 0) {
      await db.insert(contactFieldHistory).values(historyEntries);
    }
  }
}

async function updateBusinessFromExtracted(
  entityId: string,
  extracted: Record<string, string | null>,
  fieldsUpdated: string[],
): Promise<void> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
  if (!biz) return;

  const updates: Record<string, any> = {};
  const historyEntries: Array<{
    entityId: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string;
    source: "SEED" | "CRAWL" | "MANUAL_VERIFY";
  }> = [];

  if (extracted.phone && !biz.phone) {
    updates.phone = extracted.phone;
    fieldsUpdated.push("phone");
    historyEntries.push({ entityId, fieldName: "phone", oldValue: biz.phone || null, newValue: extracted.phone, source: "CRAWL" });
  }

  if (extracted.email && !biz.ownerEmail) {
    updates.ownerEmail = extracted.email;
    fieldsUpdated.push("ownerEmail");
    historyEntries.push({ entityId, fieldName: "ownerEmail", oldValue: biz.ownerEmail || null, newValue: extracted.email, source: "CRAWL" });
  }

  if (extracted.address && !biz.address) {
    updates.address = extracted.address;
    fieldsUpdated.push("address");
    historyEntries.push({ entityId, fieldName: "address", oldValue: biz.address || null, newValue: extracted.address, source: "CRAWL" });
  }

  if (extracted.socialLinks && (!biz.socialLinks || Object.keys(biz.socialLinks).length === 0)) {
    const parsedSocials = JSON.parse(extracted.socialLinks);
    updates.socialLinks = parsedSocials;
    fieldsUpdated.push("socialLinks");
    historyEntries.push({
      entityId,
      fieldName: "socialLinks",
      oldValue: biz.socialLinks ? JSON.stringify(biz.socialLinks) : null,
      newValue: extracted.socialLinks,
      source: "CRAWL",
    });
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db.update(businesses).set(updates).where(eq(businesses.id, entityId));

    for (const entry of historyEntries) {
      await db.insert(entityFieldHistory).values(entry);
    }
  }
}
