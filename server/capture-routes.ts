import type { Express, Request, Response } from "express";
import { db } from "./db";
import { crmContacts, businesses, businessContacts, listingsToClaimQueue, insertCrmContactSchema, categories, zones, verificationCodes } from "@shared/schema";
import { eq, and, or, ilike, sql, isNull, gt, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { openai } from "./lib/openai";
import { extractFromImage, parseVcard as sharedParseVcard } from "./lib/capture-extraction";
import { resolvePreferredChannel } from "./communication-routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { geoTagAndClassify } from "./services/geo-tagger";
import { speechToText, ensureCompatibleFormat } from "./replit_integrations/audio/client";
import { Buffer } from "node:buffer";
import { enrichFromUrl } from "./intelligence/crawl/urlEnrichment";
import { storage } from "./storage";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { sendTerritoryEmail } from "./services/territory-email";
import { sendTerritorySms } from "./services/territory-sms";
import { generateCaptureOutreachDraft } from "./intelligence/outreach-drafter";
import { crawlEntityWebsite } from "./intelligence/crawl/websiteCrawler";
import { queueTranslation } from "./services/auto-translate";
import { classifyEntityLocation } from "./intelligence/classify/locationClassifier";
import { tagEntityIndustry } from "./intelligence/classify/industryTagger";
import { textSearchPlaces, fetchPlaceDetails, mapGoogleTypesToCategories, googlePlacePhotoUrl, isVenueScreenLikelyFromGoogleTypes } from "./google-places";

const shareUploadDir = path.join(process.cwd(), "uploads", "share-target");
if (!fs.existsSync(shareUploadDir)) fs.mkdirSync(shareUploadDir, { recursive: true });

const SHARE_ALLOWED_MIMES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "application/pdf",
  "text/vcard", "text/x-vcard",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const SHARE_ALLOWED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif",
  ".pdf", ".vcf", ".txt", ".doc", ".docx",
]);

const sharePayloads = new Map<string, { title: string; text: string; url: string; files: string[]; fileType: string; createdAt: number }>();

setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [token, payload] of sharePayloads) {
    if (payload.createdAt < cutoff) {
      for (const f of payload.files) {
        const fp = path.join(shareUploadDir, f);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      sharePayloads.delete(token);
    }
  }
}, 60 * 1000);

const shareUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, shareUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (SHARE_ALLOWED_MIMES.has(file.mimetype) || SHARE_ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const analyzeCardSchema = z.object({
  image: z.string().min(1),
  mimeType: z.string().default("image/jpeg"),
});

const parseVcardSchema = z.object({
  vcardText: z.string().min(1),
});

const analyzeHandwritingSchema = z.object({
  image: z.string().min(1),
  mimeType: z.string().default("image/jpeg"),
});

const analyzeAdSchema = z.object({
  image: z.string().min(1),
  mimeType: z.string().default("image/jpeg"),
});

const captureSaveSchema = z.object({
  name: z.string().optional().nullable().default(""),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  parentBrand: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  captureMethod: z.string().optional().nullable(),
  intakeType: z.string().optional().nullable(),
  connectionSource: z.string().optional().nullable(),
  whyCaptured: z.string().optional().nullable(),
  businessCardImageUrl: z.string().optional().nullable(),
  businessCardBackImageUrl: z.string().optional().nullable(),
  documentImageUrl: z.string().optional().nullable(),
  handwritingImageUrl: z.string().optional().nullable(),
  audioTranscription: z.string().optional().nullable(),
  audioRecordingUrl: z.string().optional().nullable(),
  qrLinkUrl: z.string().optional().nullable(),
  qrRawText: z.string().optional().nullable(),
  vcardData: z.record(z.any()).optional().nullable(),
  documentCategory: z.string().optional().nullable(),
  documentTitle: z.string().optional().nullable(),
  capturedWithHubId: z.string().optional().nullable(),
  aiExtracted: z.record(z.any()).optional().nullable(),
  category: z.string().optional().nullable(),
  captureOrigin: z.enum(["met_in_person", "stopped_by_location", "found_business_card", "found_ad"]).optional().nullable(),
  adMedium: z.string().optional().nullable(),
  adPhotoUrl: z.string().optional().nullable(),
  stockPhotoUrls: z.array(z.string()).optional().nullable(),
  stockTags: z.string().optional().nullable(),
});

const syncBatchSchema = z.object({
  captures: z.array(z.object({
    name: z.string().optional().nullable().default(""),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    jobTitle: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    captureMethod: z.string().optional().nullable(),
    intakeType: z.string().optional().nullable(),
    connectionSource: z.string().optional().nullable(),
    whyCaptured: z.string().optional().nullable(),
    businessCardImageUrl: z.string().optional().nullable(),
    businessCardBackImageUrl: z.string().optional().nullable(),
    documentImageUrl: z.string().optional().nullable(),
    handwritingImageUrl: z.string().optional().nullable(),
    audioTranscription: z.string().optional().nullable(),
    audioRecordingUrl: z.string().optional().nullable(),
    qrLinkUrl: z.string().optional().nullable(),
    qrRawText: z.string().optional().nullable(),
    vcardData: z.record(z.any()).optional().nullable(),
    documentCategory: z.string().optional().nullable(),
    documentTitle: z.string().optional().nullable(),
    capturedWithHubId: z.string().optional().nullable(),
    aiExtracted: z.record(z.any()).optional().nullable(),
    category: z.string().optional().nullable(),
    captureOrigin: z.enum(["met_in_person", "stopped_by_location", "found_business_card", "found_ad"]).optional().nullable(),
    adMedium: z.string().optional().nullable(),
    adPhotoUrl: z.string().optional().nullable(),
    stockPhotoUrls: z.array(z.string()).optional().nullable(),
    stockTags: z.string().optional().nullable(),
    localId: z.string().optional(),
  })),
});

async function checkDuplicates(userId: string, name?: string | null, email?: string | null, phone?: string | null, company?: string | null, website?: string | null) {
  const conditions: any[] = [eq(crmContacts.userId, userId)];
  const matchConditions: any[] = [];

  if (name) matchConditions.push(ilike(crmContacts.name, `%${name}%`));
  if (email) matchConditions.push(eq(crmContacts.email, email));
  if (phone) matchConditions.push(eq(crmContacts.phone, phone));
  if (company) matchConditions.push(ilike(crmContacts.company, `%${company}%`));
  if (website) matchConditions.push(eq(crmContacts.website, website));

  if (matchConditions.length === 0) return [];

  conditions.push(or(...matchConditions)!);
  return db.select().from(crmContacts).where(and(...conditions)).limit(10);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function resolveZoneFromAddress(cityId: string, address?: string | null): Promise<string | null> {
  if (!address) return null;
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (!zipMatch) return null;
  const zip = zipMatch[1];
  const cityZones = await storage.getZonesByCityId(cityId);
  for (const zone of cityZones) {
    if (zone.zipCodes && zone.zipCodes.includes(zip)) {
      return zone.id;
    }
  }
  return null;
}

function parseAddressParts(address: string): { city: string; state: string; zip: string } {
  const result = { city: "", state: "", zip: "" };
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) result.zip = zipMatch[1];
  const stateMatch = address.match(/\b([A-Z]{2})\b/);
  if (stateMatch) result.state = stateMatch[1];
  const parts = address.split(",").map(p => p.trim());
  if (parts.length >= 2) {
    result.city = parts[parts.length - 2] || "";
    result.city = result.city.replace(/\b[A-Z]{2}\b/, "").replace(/\d{5}/, "").trim();
  }
  return result;
}

const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  "restaurant-dining": ["restaurant", "grill", "bistro", "eatery", "diner", "steakhouse", "sushi", "pizzeria", "taqueria", "bbq", "barbecue", "wingz", "wings"],
  "casual-dining": ["cafe", "café", "deli", "sandwich", "sub", "burger", "pho", "ramen", "noodle", "bowl"],
  "coffee-tea": ["coffee", "espresso", "tea", "roast", "brew", "latte", "boba"],
  "bars-breweries": ["brewery", "brewing", "taproom", "pub", "lounge", "tavern", "distillery", "winery", "wine bar", "sports bar", "cocktail bar"],
  "bakery-desserts": ["bakery", "cake", "cupcake", "donut", "pastry", "dessert", "sweets", "ice cream", "gelato", "candy"],
  "hair-salon": ["salon", "hair", "barber", "braids", "locs", "beauty"],
  "nail-spa": ["nail", "spa", "massage", "facial", "wax", "lash", "brow"],
  "fitness-gym": ["fitness", "gym", "crossfit", "yoga", "pilates", "boxing", "martial art", "karate", "training"],
  "auto-repair": ["auto", "mechanic", "tire", "car wash", "detailing", "body shop", "collision", "transmission"],
  "legal-services": ["law", "attorney", "lawyer", "legal", "paralegal", "notary"],
  "accounting-financial": ["accounting", "accountant", "cpa", "tax", "bookkeep", "financial advisor"],
  "real-estate": ["real estate", "realty", "realtor", "property", "mortgage", "title"],
  "insurance-services": ["insurance", "allstate", "state farm", "geico"],
  "medical-health": ["medical", "doctor", "clinic", "health", "dental", "dentist", "chiropr", "therapy", "urgent care", "pharmacy", "optical", "vision", "dermat"],
  "clothing-apparel": ["clothing", "apparel", "boutique", "fashion", "shoes", "sneaker"],
  "grocery-market": ["grocery", "market", "supermarket", "bodega", "organic"],
  "retail-shopping-cat": ["shop", "store", "supply", "depot", "mart", "outlet"],
  "photography-video": ["photo", "video", "film", "media", "production", "studio"],
  "graphic-design": ["design", "graphic", "creative", "branding", "print", "sign"],
  "tech-it": ["tech", "software", "app", "web develop", "it service", "computer", "repair"],
  "cleaning-services": ["cleaning", "clean", "janitorial", "maid", "pressure wash"],
  "landscaping": ["landscap", "lawn", "garden", "tree", "mow"],
  "plumbing": ["plumb", "plumber", "drain"],
  "electrical-services": ["electric", "electrician", "wiring"],
  "construction-contracting": ["construct", "contractor", "build", "roofing", "roof", "paint", "renovation", "remodel", "handyman", "hvac"],
  "pet-services": ["pet", "vet", "veterinar", "groom", "dog", "kennel", "boarding"],
  "childcare-education": ["daycare", "childcare", "preschool", "tutor", "learning", "academy", "school", "education"],
  "music-nightlife": ["music", "dj", "club", "nightclub", "karaoke", "concert", "venue"],
  "arts-culture": ["art", "gallery", "museum", "theater", "theatre"],
  "event-planning": ["event", "wedding", "catering", "caterer", "party", "banquet", "planner"],
  "marketing-advertising": ["marketing", "advertis", "seo", "social media", "pr ", "public relation", "consult"],
  "food-trucks": ["food truck", "mobile food", "pop-up"],
  "home-based-business": ["freelanc", "side hustle", "home-based", "virtual"],
  "nonprofit-community": ["nonprofit", "non-profit", "foundation", "ministry", "church", "faith", "community org"],
  "networking-coworking": ["networking", "cowork", "co-work", "incubator", "accelerator"],
};

async function guessCategories(companyName: string, jobTitle?: string | null): Promise<string[]> {
  const text = `${companyName} ${jobTitle || ""}`.toLowerCase();
  const matchedSlugs: string[] = [];
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        matchedSlugs.push(slug);
        break;
      }
    }
  }
  if (matchedSlugs.length === 0) return [];
  const allCats = await db.select().from(categories);
  return allCats.filter((c: any) => matchedSlugs.includes(c.slug)).map((c: any) => c.id);
}

interface CaptureContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
}

async function syncCrmContactToBusinessContacts(contact: CaptureContact, businessId: string) {
  if (!contact.id || !contact.name) return;
  try {
    const conditions = [eq(businessContacts.businessId, businessId)];
    if (contact.email) {
      conditions.push(eq(businessContacts.email, contact.email));
    } else {
      conditions.push(eq(businessContacts.name, contact.name));
      conditions.push(isNull(businessContacts.email));
    }
    const existing = await db.select({ id: businessContacts.id })
      .from(businessContacts)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0) {
      if (contact.id) {
        await db.update(businessContacts)
          .set({ crmContactId: contact.id, updatedAt: new Date() })
          .where(eq(businessContacts.id, existing[0].id));
      }
      return;
    }

    const existingContacts = await db.select({ id: businessContacts.id })
      .from(businessContacts)
      .where(eq(businessContacts.businessId, businessId))
      .limit(1);
    const isFirstContact = existingContacts.length === 0;

    await db.insert(businessContacts).values({
      businessId,
      crmContactId: contact.id || null,
      name: contact.name,
      role: isFirstContact ? "OWNER" : "OTHER",
      title: contact.jobTitle || null,
      email: contact.email || null,
      phone: contact.phone || null,
      source: "CAPTURE",
      isPrimary: isFirstContact,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CAPTURE] Failed to sync CRM contact to business_contacts:`, message);
    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_processing_failed",
        relatedTable: "businesses",
        relatedId: businessId,
        title: `Contact sync failed: ${contact.name}`,
        summary: `Failed to sync CRM contact "${contact.name}" to business_contacts for business ${businessId}: ${message}`,
        priority: "high",
        tags: ["Capture", "Error", "Contact-Sync"],
        triageCategory: "exception",
      });
    } catch (inboxErr) {
      console.error(`[CAPTURE] Also failed to create inbox exception for business=${businessId} contact=${contact.name}:`, inboxErr);
    }
  }
}

async function autoCreateListingFromCapture(
  contact: any,
  data: { company?: string | null; website?: string | null; phone?: string | null; email?: string | null; address?: string | null; name?: string | null; jobTitle?: string | null; captureMethod?: string | null; capturedWithHubId?: string | null; parentBrand?: string | null; businessCardImageUrl?: string | null; intakeType?: string | null; aiExtracted?: Record<string, any> | null; adMedium?: string | null; adPhotoUrl?: string | null; documentImageUrl?: string | null },
  userId: string
): Promise<{ businessId: string | null; action: "created" | "linked" | "skipped"; businessName?: string }> {
  const companyName = data.company?.trim();
  if (!companyName) return { businessId: null, action: "skipped" };

  const cityList = await storage.getAllCities();
  if (cityList.length === 0) return { businessId: null, action: "skipped" };
  let city = cityList[0];
  if (data.capturedWithHubId) {
    const hubCity = cityList.find(c => c.id === data.capturedWithHubId);
    if (hubCity) city = hubCity;
  }

  const slug = slugify(companyName);
  if (!slug) return { businessId: null, action: "skipped" };

  const existing = await storage.getBusinessBySlug(city.id, slug);
  if (existing) {
    if (contact?.id) {
      await db.update(crmContacts).set({ linkedBusinessId: existing.id }).where(eq(crmContacts.id, contact.id));
      await syncCrmContactToBusinessContacts(contact, existing.id);
    }

    if (data.intakeType === "ad_spot") {
      await db.update(businesses).set({
        seedSourceType: "AD_SPOT",
        ...(data.website && !existing.websiteUrl ? { websiteUrl: data.website } : {}),
        adIntelligence: {
          adMedium: data.aiExtracted?.adMedium || data.adMedium || undefined,
          adDescription: data.aiExtracted?.adDescription || undefined,
          tagline: data.aiExtracted?.tagline || undefined,
          adPhotoUrl: data.adPhotoUrl || data.documentImageUrl || undefined,
          capturedAt: new Date().toISOString(),
        },
      }).where(eq(businesses.id, existing.id));
    }

    if (data.intakeType !== "ad_spot") {
      enrichListingInBackground(existing.id, null, city.id, existing.name, contact?.id, data.name, data.jobTitle, data.captureMethod, userId);
    }
    return { businessId: existing.id, action: "linked", businessName: existing.name };
  }

  const zoneId = await resolveZoneFromAddress(city.id, data.address);
  const fallbackZones = await storage.getZonesByCityId(city.id);
  const resolvedZoneId = zoneId || (fallbackZones.length > 0 ? fallbackZones[0].id : null);
  if (!resolvedZoneId) return { businessId: null, action: "skipped" };

  const addressParts = data.address ? parseAddressParts(data.address) : { city: "", state: "", zip: "" };

  const displayName = data.parentBrand
    ? `${data.parentBrand} — ${companyName}`
    : companyName;

  const guessedCategoryIds = await guessCategories(companyName, data.jobTitle).catch(() => [] as string[]);

  const adIntel = data.intakeType === "ad_spot" ? {
    adMedium: data.aiExtracted?.adMedium || data.adMedium || undefined,
    adDescription: data.aiExtracted?.adDescription || undefined,
    tagline: data.aiExtracted?.tagline || undefined,
    adPhotoUrl: data.adPhotoUrl || data.documentImageUrl || undefined,
    capturedAt: new Date().toISOString(),
  } : undefined;

  const biz = await storage.createBusiness({
    cityId: city.id,
    name: displayName,
    slug,
    zoneId: resolvedZoneId,
    parentBrand: data.parentBrand || null,
    address: data.address?.split(",")[0]?.trim() || null,
    city: addressParts.city || city.name,
    state: addressParts.state || "NC",
    zip: addressParts.zip || null,
    phone: data.phone || null,
    email: data.email || null,
    websiteUrl: data.website || null,
    imageUrl: null,
    listingTier: "FREE",
    claimStatus: "UNCLAIMED",
    seedSourceType: data.intakeType === "ad_spot" ? "AD_SPOT" : "CAPTURE",
    categoryIds: guessedCategoryIds.length > 0 ? guessedCategoryIds : undefined,
    adIntelligence: adIntel,
  });

  if (contact?.id) {
    await db.update(crmContacts).set({ linkedBusinessId: biz.id }).where(eq(crmContacts.id, contact.id));
    await syncCrmContactToBusinessContacts(contact, biz.id);
  }
  geoTagAndClassify("business", biz.id, city.id, {
    title: displayName,
    description: null,
    address: data.address || null,
    zip: addressParts.zip || null,
    categoryIds: guessedCategoryIds.length > 0 ? guessedCategoryIds : [],
  }, { existingZoneId: resolvedZoneId || undefined }).catch(err => console.error("[GeoTagger] Capture biz:", err.message));

  try {
    const [existingQueueItem] = await db.select({ id: listingsToClaimQueue.id }).from(listingsToClaimQueue).where(eq(listingsToClaimQueue.presenceId, biz.id)).limit(1);
    if (!existingQueueItem) {
      await db.insert(listingsToClaimQueue).values({
        presenceId: biz.id,
        source: data.intakeType === "ad_spot" ? "ad_spot" : "capture",
        status: "ready",
        notes: data.intakeType === "ad_spot" ? `Captured from competitor ad: ${companyName}` : `Captured from business card: ${companyName}`,
      });
    }
  } catch (queueErr: any) {
    console.warn(`[CAPTURE→LISTING] Failed to add to claim queue for ${companyName}:`, queueErr.message);
  }

  queueTranslation("business", biz.id);

  if (data.intakeType !== "ad_spot") {
    enrichListingInBackground(biz.id, data.website, city.id, companyName, contact?.id, data.name, data.jobTitle, data.captureMethod, userId);
  }

  return { businessId: biz.id, action: "created", businessName: companyName };
}

function enrichListingInBackground(
  businessId: string,
  websiteUrl: string | null | undefined,
  cityId: string,
  businessName: string,
  contactId: string | undefined,
  contactName: string | null | undefined,
  contactTitle: string | null | undefined,
  captureMethod: string | null | undefined,
  userId: string,
  fieldCaptureId?: string
) {
  (async () => {
    const enrichmentErrors: string[] = [];
    let crawlResult: { detectedEmail?: string | null; detectedPhone?: string | null; detectedSocialJson?: Record<string, string> | null; detectedContactFormUrl?: string | null } = {};

    try {
      if (websiteUrl) {
        crawlResult = await crawlEntityWebsite(businessId, websiteUrl, cityId) || {};
      }
    } catch (crawlErr) {
      const msg = crawlErr instanceof Error ? crawlErr.message : String(crawlErr);
      enrichmentErrors.push(`Website crawl: ${msg}`);
      console.error(`[CAPTURE→LISTING] Website crawl failed for ${businessId}:`, msg);
    }

    try {
      await classifyEntityLocation(businessId);
    } catch (locErr) {
      const msg = locErr instanceof Error ? locErr.message : String(locErr);
      enrichmentErrors.push(`Location classification: ${msg}`);
      console.warn(`[CAPTURE→LISTING] Location classification failed for ${businessId}:`, msg);
    }

    try {
      await tagEntityIndustry(businessId);
    } catch (indErr) {
      const msg = indErr instanceof Error ? indErr.message : String(indErr);
      enrichmentErrors.push(`Industry tagging: ${msg}`);
      console.warn(`[CAPTURE→LISTING] Industry tagging failed for ${businessId}:`, msg);
    }

    if (fieldCaptureId) {
      try {
        const { pool } = await import("./db");
        const { computeEntityScores } = await import("./intelligence/scoring/entityScoring");
        const scoringResult = await computeEntityScores(businessId);
        const fcResult = await pool.query(`SELECT raw_data FROM field_captures WHERE id = $1`, [fieldCaptureId]);
        if (fcResult.rows.length > 0) {
          const existingRaw = fcResult.rows[0].raw_data || {};
          const crawlEmails = crawlResult.detectedEmail ? [crawlResult.detectedEmail] : [];
          const crawlPhones = crawlResult.detectedPhone ? [crawlResult.detectedPhone] : [];
          const crawlSocials = crawlResult.detectedSocialJson ? Object.values(crawlResult.detectedSocialJson) : [];
          const updatedRaw = {
            ...existingRaw,
            radarScore: scoringResult?.prospectFitScore ?? null,
            dataQualityScore: scoringResult?.dataQualityScore ?? null,
            contactReadyScore: scoringResult?.contactReadyScore ?? null,
            scoringBucket: scoringResult?.bucket ?? null,
            crawlEmails,
            crawlPhones,
            crawlSocials,
            crawlContactForm: crawlResult.detectedContactFormUrl || "",
          };
          await pool.query(`UPDATE field_captures SET raw_data = $1 WHERE id = $2`, [JSON.stringify(updatedRaw), fieldCaptureId]);
          console.log(`[CAPTURE→FIELD] Updated field capture ${fieldCaptureId} with crawl results and scores (PF=${scoringResult?.prospectFitScore}, DQ=${scoringResult?.dataQualityScore}, CR=${scoringResult?.contactReadyScore})`);
        }
      } catch (fcErr: any) {
        const msg = fcErr instanceof Error ? fcErr.message : String(fcErr);
        enrichmentErrors.push(`Field capture scoring: ${msg}`);
        console.warn(`[CAPTURE→FIELD] Failed to update field capture with enrichment data:`, msg);
      }
    }

    try {
      const [bizForGoogle] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (bizForGoogle && !bizForGoogle.googlePlaceId) {
        const cityState = [bizForGoogle.city, bizForGoogle.state].filter(Boolean).join(" ");
        if (!bizForGoogle.address && !cityState) {
          console.log(`[CAPTURE→LISTING] Skipping Google Places match for ${businessName} — no address or city context`);
        }
        const searchQuery = bizForGoogle.address
          ? `${businessName} ${bizForGoogle.address} ${cityState}`
          : cityState ? `${businessName} ${cityState}` : null;
        if (searchQuery) {
          const results = await textSearchPlaces(searchQuery.trim(), 3);
          if (results.length > 0) {
            const match = results[0];
            const details = await fetchPlaceDetails(match.place_id);
            if (details) {
              const updateFields: any = {
                googlePlaceId: match.place_id,
              };
              if (details.rating != null) updateFields.googleRating = String(details.rating);
              if (details.user_ratings_total != null) updateFields.googleReviewCount = details.user_ratings_total;
              if (details.types) {
                let { l2Slugs } = mapGoogleTypesToCategories(details.types);
                if (l2Slugs.length === 0) {
                  const { aiFallbackCategorize } = await import("./google-places");
                  l2Slugs = await aiFallbackCategorize(details.name || bizForGoogle.name, details.types);
                }
                if (l2Slugs.length > 0) {
                  const allCategories = await db.select().from(categories);
                  const resolvedIds = allCategories
                    .filter((c: any) => l2Slugs.includes(c.slug))
                    .map((c: any) => c.id);
                  if (resolvedIds.length > 0) updateFields.categoryIds = resolvedIds;
                }
                if (isVenueScreenLikelyFromGoogleTypes(details.types)) {
                  updateFields.venueScreenLikely = true;
                }
              }
              if (!bizForGoogle.imageUrl && details.photos?.length) {
                updateFields.imageUrl = googlePlacePhotoUrl(details.photos[0].photo_reference, 800);
                if (details.photos[0].html_attributions?.length) {
                  updateFields.photoAttribution = details.photos[0].html_attributions[0];
                }
              }
              if (!bizForGoogle.phone && details.formatted_phone_number) updateFields.phone = details.formatted_phone_number;
              if (!bizForGoogle.websiteUrl && details.website) updateFields.websiteUrl = details.website;
              await storage.updateBusiness(businessId, updateFields);
              console.log(`[CAPTURE→LISTING] Google Places matched: ${businessName} → ${match.place_id}`);
            }
          }
        }
      }
    } catch (gpErr) {
      const msg = gpErr instanceof Error ? (gpErr as Error).message : String(gpErr);
      enrichmentErrors.push(`Google Places: ${msg}`);
      console.error(`[CAPTURE→LISTING] Google Places matching failed for ${businessId}:`, msg);
    }

    if (enrichmentErrors.length > 0) {
      try {
        await createInboxItemIfNotOpen({
          itemType: "pipeline_processing_failed",
          relatedTable: "businesses",
          relatedId: businessId,
          title: `Enrichment errors: ${businessName}`,
          summary: `Background enrichment had ${enrichmentErrors.length} failure(s):\n${enrichmentErrors.map(e => `• ${e}`).join("\n")}`,
          priority: "med",
          tags: ["Enrichment", "Error"],
          triageCategory: "exception",
          links: [
            { label: "Review Listing", urlOrRoute: `/admin/businesses?openBiz=${businessId}` },
          ],
        });
      } catch (inboxErr) {
        console.error(`[CAPTURE→LISTING] Failed to create enrichment error inbox item for business=${businessId}:`, inboxErr);
      }
    }

    try {
      const summaryParts: string[] = [];
      if (contactName) summaryParts.push(`Contact: ${contactName}${contactTitle ? ` (${contactTitle})` : ""}`);
      if (websiteUrl) summaryParts.push(`Website: ${websiteUrl}`);
      if (captureMethod) summaryParts.push(`Captured via: ${captureMethod}`);

      await createInboxItemIfNotOpen({
        itemType: "capture_listing_review",
        relatedTable: "businesses",
        relatedId: businessId,
        title: `New Capture: ${businessName}`,
        summary: summaryParts.join(" | ") || `Auto-created from field capture.`,
        priority: "med",
        tags: ["Capture", "Auto-listing"],
        links: [
          { label: "Review Listing", urlOrRoute: `/admin/businesses?openBiz=${businessId}` },
          ...(contactId ? [{ label: "View Contact", urlOrRoute: `/admin/crm-contacts?openContact=${contactId}` }] : []),
        ],
      });
    } catch (err) {
      console.error(`[CAPTURE→LISTING] Inbox item creation failed for ${businessId}:`, err);
    }
  })();
}

export function registerCaptureRoutes(app: Express, requireAdmin: any) {

  app.get("/api/article-approval/:token", async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      if (!token || token.length < 16) return res.status(400).json({ error: "Invalid token" });

      const [capture] = await db.select().from(crmContacts).where(eq(crmContacts.storyApprovalToken, token)).limit(1);
      if (!capture) return res.status(404).json({ error: "Not found" });
      if (!capture.linkedArticleId) return res.status(404).json({ error: "No article linked" });

      const { articles: articlesTable, cities: citiesTable } = await import("@shared/schema");
      const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, capture.linkedArticleId)).limit(1);
      if (!article) return res.status(404).json({ error: "Article not found" });

      const cityList = await storage.getAllCities();
      let city = cityList[0];
      if (capture.capturedWithHubId) {
        const hubCity = cityList.find(c => c.id === capture.capturedWithHubId);
        if (hubCity) city = hubCity;
      }
      let brandShort = "Metro Hub";
      if (city) {
        const [cityRecord] = await db.select().from(citiesTable).where(eq(citiesTable.id, city.id)).limit(1);
        if (cityRecord) {
          const { buildCityBranding } = await import("@shared/city-branding");
          brandShort = buildCityBranding(cityRecord).brandShort;
        }
      }

      res.json({
        contactName: capture.name || "there",
        companyName: capture.company || capture.name || "Your Business",
        articleTitle: article.title,
        articleExcerpt: article.excerpt || "",
        articleBody: article.content || "",
        brandShort,
        status: capture.outreachStatus || "STORY_CREATED",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[APPROVAL] Fetch error:", msg);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/article-approval/:token/approve", async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      if (!token || token.length < 16) return res.status(400).json({ error: "Invalid token" });

      const [capture] = await db.select().from(crmContacts).where(eq(crmContacts.storyApprovalToken, token)).limit(1);
      if (!capture) return res.status(404).json({ error: "Not found" });
      if (!capture.linkedArticleId) return res.status(404).json({ error: "No article linked" });

      if (capture.outreachStatus === "APPROVED") {
        return res.json({ success: true, message: "Already approved" });
      }
      if (capture.outreachStatus === "CORRECTIONS_REQUESTED") {
        return res.status(400).json({ error: "Corrections have been requested — this article is under review and cannot be approved at this time." });
      }

      const { articles: articlesTable } = await import("@shared/schema");
      await db.update(articlesTable).set({
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(articlesTable.id, capture.linkedArticleId));

      await db.update(crmContacts).set({
        outreachStatus: "APPROVED",
        storyApprovalToken: null,
        updatedAt: new Date(),
      }).where(eq(crmContacts.id, capture.id));

      console.log(`[APPROVAL] Article approved and published for capture ${capture.id}`);
      res.json({ success: true, message: "Article published" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[APPROVAL] Approve error:", msg);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/article-approval/:token/corrections", async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      if (!token || token.length < 16) return res.status(400).json({ error: "Invalid token" });

      const { notes } = req.body || {};
      if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
        return res.status(400).json({ error: "Please provide correction notes" });
      }

      const [capture] = await db.select().from(crmContacts).where(eq(crmContacts.storyApprovalToken, token)).limit(1);
      if (!capture) return res.status(404).json({ error: "Not found" });

      if (capture.outreachStatus === "APPROVED") {
        return res.json({ success: true, message: "Article was already approved" });
      }

      const { reviseStoryWithCorrections } = await import("./services/capture-story-generator");
      const result = await reviseStoryWithCorrections(capture.id, notes.trim());

      console.log(`[APPROVAL] Corrections processed for capture ${capture.id}: ${result.message}`);
      res.json({ success: result.success, message: result.message, revised: result.revised });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[APPROVAL] Corrections error:", msg);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/capture/transcribe", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { audio } = req.body;
      if (!audio || typeof audio !== "string") {
        return res.status(400).json({ error: "Missing audio data" });
      }

      const base64Match = audio.match(/^data:[^;]+;base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ error: "Invalid audio format" });
      }

      const audioBuffer = Buffer.from(base64Match[1], "base64");
      const { buffer: compatibleBuffer, format } = await ensureCompatibleFormat(audioBuffer);
      const transcript = await speechToText(compatibleBuffer, format);

      let signals: Record<string, string> = {};
      if (transcript && openai) {
        try {
          const extraction = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Extract contact/business details from this interview transcript. Return a JSON object with only the fields you find evidence for. Possible fields: name, company, phone, email, website, jobTitle, address. Only include fields with clear evidence. Return valid JSON only.`,
              },
              { role: "user", content: transcript },
            ],
            response_format: { type: "json_object" },
          });
          const parsed = JSON.parse(extraction.choices[0]?.message?.content || "{}");
          signals = parsed;
        } catch (extractErr) {
          console.error("[CAPTURE] Signal extraction failed:", extractErr);
        }
      }

      res.json({ transcript, signals });
    } catch (err: unknown) {
      console.error("[CAPTURE] Transcription error:", err);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  app.post("/api/share-target", shareUpload.array("files", 5), (req: Request, res: Response) => {
    try {
      const title = (req.body?.title || "").trim().slice(0, 500);
      const text = (req.body?.text || "").trim().slice(0, 2000);
      const url = (req.body?.url || "").trim().slice(0, 2000);
      const files = (req.files as Express.Multer.File[]) || [];

      let fileType = "";
      const filenames: string[] = [];
      for (const f of files) {
        filenames.push(f.filename);
        if (!fileType) {
          if (f.mimetype.startsWith("image/")) fileType = "image";
          else if (f.mimetype === "text/vcard" || f.mimetype === "text/x-vcard" || f.originalname.endsWith(".vcf")) fileType = "vcard";
          else fileType = "document";
        }
      }

      const token = crypto.randomBytes(16).toString("hex");
      sharePayloads.set(token, {
        title, text, url,
        files: filenames,
        fileType,
        createdAt: Date.now(),
      });

      res.redirect(303, `/capture?shared=${token}`);
    } catch (err: any) {
      console.error("[ShareTarget] Error:", err);
      res.redirect(303, "/capture");
    }
  });

  app.get("/api/share-target/payload/:token", requireAdmin, (req: Request, res: Response) => {
    const payload = sharePayloads.get(req.params.token);
    if (!payload) return res.status(404).json({ error: "Share payload not found or expired" });
    res.json(payload);
  });

  app.get("/api/share-target/file/:token/:filename", requireAdmin, (req: Request, res: Response) => {
    const payload = sharePayloads.get(req.params.token);
    if (!payload) return res.status(404).json({ error: "Share payload not found or expired" });
    const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!payload.files.includes(filename)) {
      return res.status(403).json({ error: "File not associated with this share" });
    }
    const filePath = path.join(shareUploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    res.sendFile(filePath);
  });

  app.post("/api/capture/analyze-card", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = analyzeCardSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "image and mimeType required", details: parsed.error.flatten() });
      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });
      const { image, mimeType } = parsed.data;

      const extracted = await extractFromImage("business_card", `data:${mimeType};base64,${image}`);
      res.json(extracted);
    } catch (err: any) {
      console.error("[CAPTURE] analyze-card error:", err);
      res.status(500).json({ error: "Card analysis failed" });
    }
  });

  app.post("/api/capture/transcribe-voice", requireAdmin, upload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "audio file required" });

      const rawBuffer = req.file.buffer;
      const { buffer: compatBuffer, format } = await ensureCompatibleFormat(rawBuffer);
      const transcript = await speechToText(compatBuffer, format);

      let extractedName = "";
      const namePatterns = [
        /(?:my name is|i'm|i am|this is|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/m,
      ];
      for (const pattern of namePatterns) {
        const match = transcript.match(pattern);
        if (match) {
          extractedName = match[1].trim();
          break;
        }
      }

      res.json({ transcript, extractedName });
    } catch (err: any) {
      console.error("[CAPTURE] transcribe-voice error:", err);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  app.post("/api/capture/parse-vcard", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = parseVcardSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "vcardText required" });

      const result = sharedParseVcard(parsed.data.vcardText);
      res.json(result);
    } catch (err: any) {
      console.error("[CAPTURE] parse-vcard error:", err);
      res.status(500).json({ error: "vCard parsing failed" });
    }
  });

  app.post("/api/capture/analyze-handwriting", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = analyzeHandwritingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "image and mimeType required", details: parsed.error.flatten() });
      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });
      const { image, mimeType } = parsed.data;

      const extracted = await extractFromImage("handwritten_note", `data:${mimeType};base64,${image}`);
      res.json(extracted);
    } catch (err: any) {
      console.error("[CAPTURE] analyze-handwriting error:", err);
      res.status(500).json({ error: "Handwriting analysis failed" });
    }
  });

  app.post("/api/capture/analyze-ad", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = analyzeAdSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "image and mimeType required", details: parsed.error.flatten() });
      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });
      const { image, mimeType } = parsed.data;

      const raw = await extractFromImage("ad_photo", `data:${mimeType};base64,${image}`);

      const validMediums = new Set(["billboard", "flyer", "magazine", "vehicle_wrap", "social_media", "window_sign", "poster", "banner", "newspaper", "direct_mail", "other"]);
      const safeStr = (v: unknown, maxLen = 500): string => {
        if (typeof v !== "string") return "";
        return v.trim().slice(0, maxLen);
      };
      const safeUrl = (v: unknown): string => {
        const s = safeStr(v, 2000);
        if (!s) return "";
        try {
          const u = new URL(s.startsWith("http") ? s : `https://${s}`);
          if (!["http:", "https:"].includes(u.protocol)) return "";
          return u.toString();
        } catch {
          return "";
        }
      };

      const extracted = {
        businessName: safeStr(raw.businessName, 200),
        website: safeUrl(raw.website),
        phone: safeStr(raw.phone, 30),
        email: safeStr(raw.email, 200),
        address: safeStr(raw.address, 300),
        adMedium: validMediums.has(raw.adMedium) ? raw.adMedium : "other",
        adDescription: safeStr(raw.adDescription, 1000),
        tagline: safeStr(raw.tagline, 300),
      };

      res.json(extracted);
    } catch (err: any) {
      console.error("[CAPTURE] analyze-ad error:", err);
      res.status(500).json({ error: "Ad analysis failed" });
    }
  });

  app.post("/api/capture/save", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const parsed = captureSaveSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

      const data = parsed.data;
      const duplicates = await checkDuplicates(userId, data.name, data.email, data.phone, data.company, data.website);

      const [contact] = await db.insert(crmContacts).values({
        userId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        preferredChannel: resolvePreferredChannel(data.email, data.phone),
        company: data.company || null,
        jobTitle: data.jobTitle || null,
        website: data.website || null,
        address: data.address || null,
        notes: data.notes || null,
        status: "inbox",
        captureMethod: data.captureMethod || null,
        intakeType: data.intakeType || null,
        connectionSource: data.connectionSource || null,
        whyCaptured: data.whyCaptured || null,
        businessCardImageUrl: data.businessCardImageUrl || null,
        businessCardBackImageUrl: data.businessCardBackImageUrl || null,
        documentImageUrl: data.documentImageUrl || null,
        handwritingImageUrl: data.handwritingImageUrl || null,
        audioTranscription: data.audioTranscription || null,
        audioRecordingUrl: data.audioRecordingUrl || null,
        qrLinkUrl: data.qrLinkUrl || null,
        qrRawText: data.qrRawText || null,
        vcardData: data.vcardData || null,
        documentCategory: data.documentCategory || null,
        documentTitle: data.documentTitle || null,
        capturedWithHubId: data.capturedWithHubId || null,
        aiExtracted: data.intakeType === "ad_spot"
          ? { ...(data.aiExtracted || {}), adMedium: data.adMedium || data.aiExtracted?.adMedium || null, adPhotoUrl: data.adPhotoUrl || null }
          : (data.aiExtracted || null),
        captureOrigin: data.captureOrigin || null,
        preferredLanguage: data.preferredLanguage || null,
        pendingSync: false,
        category: (data.category as any) || (data.company?.trim() ? "potential_client" : "not_sure"),
      }).returning();

      const enrichUrl = data.qrLinkUrl || data.website;
      if (enrichUrl && contact?.id) {
        enrichFromUrl(enrichUrl, "contact", contact.id, userId).catch((err) => {
          console.error("[CAPTURE] URL enrichment failed:", err);
        });
      }

      let listing: { businessId: string | null; action: "created" | "linked" | "skipped"; businessName?: string } = { businessId: null, action: "skipped" };
      let businessDuplicates: { id: string; name: string; slug: string; websiteUrl: string | null }[] = [];
      try {
        if (data.intakeType === "ad_spot" && data.company?.trim()) {
          const slug = slugify(data.company.trim());
          if (slug) {
            const cityList = await storage.getAllCities();
            for (const city of cityList) {
              const existing = await storage.getBusinessBySlug(city.id, slug);
              if (existing) {
                businessDuplicates.push({ id: existing.id, name: existing.name, slug: existing.slug, websiteUrl: existing.websiteUrl });
              }
            }
          }
        }

        listing = await autoCreateListingFromCapture(contact, data, userId);
        if (listing.action !== "skipped") {
          console.log(`[CAPTURE→LISTING] ${listing.action}: ${listing.businessName} (${listing.businessId})`);
        }
      } catch (err) {
        console.error("[CAPTURE→LISTING] Auto-listing failed:", err);
      }

      let fieldCaptureId: string | undefined;
      if (data.intakeType === "ad_spot") {
        try {
          const { pool } = await import("./db");
          const cityList = await storage.getAllCities();
          const cityId = data.capturedWithHubId || (cityList.length > 0 ? cityList[0].id : null);
          if (cityId) {
            const operatorName = (req.session as any)?.operatorName || (req.session as any)?.userName || "Field Operator";
            const rawData = {
              ...(data.aiExtracted || {}),
              adMedium: data.adMedium || data.aiExtracted?.adMedium || null,
              adPhotoUrl: data.adPhotoUrl || data.documentImageUrl || null,
              website: data.website || null,
              seedSourceType: "AD_SPOT",
              businessId: listing.businessId,
              businessAction: listing.action,
            };
            const fcResult = await pool.query(
              `INSERT INTO field_captures (city_id, capture_type, title, notes, contact_name, contact_phone, contact_email, business_name, photo_urls, raw_data, captured_by_user_id, captured_by_name, status, converted_entity_id, converted_entity_table)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
               RETURNING id`,
              [
                cityId,
                "ad_spot",
                `Competitor Ad: ${data.company || "Unknown"}`,
                data.notes || null,
                data.name || null,
                data.phone || null,
                data.email || null,
                data.company || null,
                data.documentImageUrl ? [data.documentImageUrl] : null,
                JSON.stringify(rawData),
                userId || null,
                operatorName,
                listing.businessId ? "converted" : "new",
                listing.businessId || null,
                listing.businessId ? "businesses" : null,
              ]
            );
            fieldCaptureId = fcResult.rows[0]?.id;
            console.log(`[CAPTURE→FIELD] Ad spot field capture created: ${fieldCaptureId} for ${data.company}`);

            if (listing.businessId && fieldCaptureId) {
              const enrichWebsite = data.website || null;
              enrichListingInBackground(listing.businessId, enrichWebsite, cityId, data.company || "Unknown", contact?.id, data.name, data.jobTitle, data.captureMethod, userId, fieldCaptureId);
            }
          }
        } catch (fcErr: any) {
          console.warn("[CAPTURE→FIELD] Failed to create field capture record:", fcErr.message);
        }
      }

      if (data.intakeType === "stock_photo") {
        const photoUrls = data.stockPhotoUrls && data.stockPhotoUrls.length > 0
          ? data.stockPhotoUrls
          : (data.documentImageUrl ? [data.documentImageUrl] : (data.businessCardImageUrl ? [data.businessCardImageUrl] : []));
        const tagsList = (data.stockTags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
        let resolvedHubSlug: string | null = null;

        try {
          const { pool } = await import("./db");
          const cityList = await storage.getAllCities();
          const cityId = data.capturedWithHubId || (cityList.length > 0 ? cityList[0].id : null);
          const matchedCity = cityList.find(c => c.id === cityId || c.slug === cityId);
          resolvedHubSlug = matchedCity?.slug || null;
          if (cityId) {
            const operatorName = (req.session as any)?.operatorName || (req.session as any)?.userName || "Field Operator";
            const rawData = {
              stockTags: data.stockTags || null,
              photoUrls,
              seedSourceType: "STOCK_PHOTO",
            };
            const fcResult = await pool.query(
              `INSERT INTO field_captures (city_id, capture_type, title, notes, photo_urls, raw_data, captured_by_user_id, captured_by_name, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
               RETURNING id`,
              [
                cityId,
                "stock_photo",
                data.name || `Stock Photo — ${(data.stockTags || "").split(",")[0]?.trim() || new Date().toLocaleDateString()}`,
                data.notes || null,
                photoUrls.length > 0 ? photoUrls : null,
                JSON.stringify(rawData),
                userId || null,
                operatorName,
                "new",
              ]
            );
            fieldCaptureId = fcResult.rows[0]?.id;
            console.log(`[CAPTURE→FIELD] Stock photo field capture created: ${fieldCaptureId} (${photoUrls.length} photos)`);
          }
        } catch (fcErr: any) {
          console.warn("[CAPTURE→FIELD] Failed to create stock photo field capture:", fcErr.message);
        }

        try {
          await createInboxItemIfNotOpen({
            itemType: "stock_photo_capture",
            relatedTable: fieldCaptureId ? "field_captures" : "crm_contacts",
            relatedId: fieldCaptureId || contact?.id || "stock_photo_fallback",
            title: data.name || `Stock Photo — ${tagsList[0] || "Untitled"}`,
            summary: `${photoUrls.length} photo${photoUrls.length !== 1 ? "s" : ""} captured${tagsList.length > 0 ? ` — tags: ${tagsList.join(", ")}` : ""}`,
            priority: "low",
            tags: tagsList.length > 0 ? tagsList : undefined,
            triageCategory: "needs_review",
            triageReason: "Stock photo captured in the field",
            triageMetadata: {
              photoUrls,
              stockTags: data.stockTags || null,
              notes: data.notes || null,
              hubId: data.capturedWithHubId || null,
              hubSlug: resolvedHubSlug,
              contactId: contact?.id,
              fieldCaptureId: fieldCaptureId || null,
            },
          });
        } catch (inboxErr: any) {
          console.warn("[CAPTURE→INBOX] Failed to create stock photo inbox item:", inboxErr.message);
        }
      }

      if (listing.businessId && data.captureOrigin) {
        generateCaptureOutreachDraft(
          listing.businessId,
          data.captureOrigin,
          data.email,
          data.name
        ).catch((err) => {
          console.error("[CAPTURE→OUTREACH] Draft generation failed:", err);
        });
      }

      if (data.intakeType !== "stock_photo" && contact?.id) {
        try {
          await createInboxItemIfNotOpen({
            itemType: "capture_listing_review",
            relatedTable: "crm_contacts",
            relatedId: contact.id,
            title: `Capture: ${data.name || data.company || "Unknown"}`,
            summary: `${data.intakeType || "person"} capture via ${data.captureMethod || "manual"}${data.company ? ` — ${data.company}` : ""}`,
            priority: "med",
            triageCategory: "needs_review",
            triageReason: `Field capture (${data.intakeType || "person"}) submitted for review`,
            triageMetadata: {
              intakeType: data.intakeType,
              captureMethod: data.captureMethod,
              contactId: contact.id,
              businessId: listing.businessId,
              fieldCaptureId: fieldCaptureId || null,
            },
          });
        } catch (inboxErr: any) {
          console.warn("[CAPTURE→INBOX] Failed to create inbox item for capture:", inboxErr.message);
        }
      }

      if (contact?.id && data.intakeType !== "stock_photo") {
        (async () => {
          try {
            const { generateStoryForCapture } = await import("./services/capture-story-generator");
            const storyResult = await generateStoryForCapture(contact.id);
            if (storyResult) {
              console.log(`[CAPTURE→STORY] Auto-generated article for capture ${contact.id}: "${storyResult.title}"`);
            }
          } catch (storyErr: any) {
            console.error("[CAPTURE→STORY] Auto story generation failed:", storyErr.message);
          }
        })();
      }

      res.status(201).json({ contact, duplicates, listing, businessDuplicates });
    } catch (err: any) {
      console.error("[CAPTURE] save error:", err);
      res.status(500).json({ error: "Save failed" });
    }
  });

  app.post("/api/capture/sync-batch", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const parsed = syncBatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid batch data", details: parsed.error.flatten() });

      const results: { localId?: string; contact: any; duplicates: any[] }[] = [];

      for (const capture of parsed.data.captures) {
        try {
          const duplicates = await checkDuplicates(userId, capture.name, capture.email, capture.phone, capture.company, capture.website);

          const needsAiExtraction = !capture.aiExtracted && (
            capture.businessCardImageUrl ||
            capture.documentImageUrl ||
            capture.handwritingImageUrl ||
            capture.audioRecordingUrl
          );

          let aiExtracted = capture.aiExtracted || null;

          if (needsAiExtraction && capture.businessCardImageUrl && openai) {
            try {
              aiExtracted = await extractFromImage("business_card", capture.businessCardImageUrl);
            } catch (e) {
              console.error("[CAPTURE] Batch AI extraction failed for card:", e);
            }
          }

          if (needsAiExtraction && capture.audioRecordingUrl && !aiExtracted) {
            try {
              const audioData = capture.audioRecordingUrl.replace(/^data:[^;]+;base64,/, "");
              const audioBuffer = Buffer.from(audioData, "base64");
              const { buffer: compatBuffer, format } = await ensureCompatibleFormat(audioBuffer);
              const transcript = await speechToText(compatBuffer, format);
              aiExtracted = { transcript };
              if (!capture.audioTranscription) {
                capture.audioTranscription = transcript;
              }
            } catch (e) {
              console.error("[CAPTURE] Batch audio transcription failed:", e);
            }
          }

          const [contact] = await db.insert(crmContacts).values({
            userId,
            name: capture.name,
            email: capture.email || null,
            phone: capture.phone || null,
            preferredChannel: resolvePreferredChannel(capture.email, capture.phone),
            company: capture.company || null,
            jobTitle: capture.jobTitle || null,
            website: capture.website || null,
            address: capture.address || null,
            notes: capture.notes || null,
            status: "inbox",
            captureMethod: capture.captureMethod || null,
            intakeType: capture.intakeType || null,
            connectionSource: capture.connectionSource || null,
            whyCaptured: capture.whyCaptured || null,
            businessCardImageUrl: capture.businessCardImageUrl || null,
            businessCardBackImageUrl: capture.businessCardBackImageUrl || null,
            documentImageUrl: capture.documentImageUrl || null,
            handwritingImageUrl: capture.handwritingImageUrl || null,
            audioTranscription: capture.audioTranscription || null,
            audioRecordingUrl: capture.audioRecordingUrl || null,
            qrLinkUrl: capture.qrLinkUrl || null,
            qrRawText: capture.qrRawText || null,
            vcardData: capture.vcardData || null,
            documentCategory: capture.documentCategory || null,
            documentTitle: capture.documentTitle || null,
            capturedWithHubId: capture.capturedWithHubId || null,
            aiExtracted: aiExtracted,
            captureOrigin: capture.captureOrigin || null,
            preferredLanguage: (capture as any).preferredLanguage || null,
            pendingSync: false,
            category: (capture.category as any) || (capture.company?.trim() ? "potential_client" : "not_sure"),
          }).returning();

          const enrichUrl = capture.qrLinkUrl || capture.website;
          if (enrichUrl && contact?.id) {
            enrichFromUrl(enrichUrl, "contact", contact.id, userId).catch((err) => {
              console.error("[CAPTURE] Batch URL enrichment failed:", err);
            });
          }

          let listing: { businessId: string | null; action: string; businessName?: string } = { businessId: null, action: "skipped" };
          try {
            listing = await autoCreateListingFromCapture(contact, capture, userId);
          } catch (err) {
            console.error("[CAPTURE→LISTING] Batch auto-listing failed:", err);
          }

          if (capture.intakeType === "ad_spot") {
            try {
              const { pool } = await import("./db");
              const cityList = await storage.getAllCities();
              const cityId = capture.capturedWithHubId || (cityList.length > 0 ? cityList[0].id : null);
              if (cityId) {
                const operatorName = (req.session as any)?.operatorName || (req.session as any)?.userName || "Field Operator";
                const rawData = {
                  ...(aiExtracted || {}),
                  adMedium: capture.adMedium || aiExtracted?.adMedium || null,
                  adPhotoUrl: capture.adPhotoUrl || capture.documentImageUrl || null,
                  website: capture.website || null,
                  seedSourceType: "AD_SPOT",
                  businessId: listing.businessId,
                  businessAction: listing.action,
                };
                const fcResult = await pool.query(
                  `INSERT INTO field_captures (city_id, capture_type, title, notes, contact_name, contact_phone, contact_email, business_name, photo_urls, raw_data, captured_by_user_id, captured_by_name, status, converted_entity_id, converted_entity_table)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                   RETURNING id`,
                  [
                    cityId,
                    "ad_spot",
                    `Competitor Ad: ${capture.company || "Unknown"}`,
                    capture.notes || null,
                    capture.name || null,
                    capture.phone || null,
                    capture.email || null,
                    capture.company || null,
                    capture.documentImageUrl ? [capture.documentImageUrl] : null,
                    JSON.stringify(rawData),
                    userId || null,
                    operatorName,
                    listing.businessId ? "converted" : "new",
                    listing.businessId || null,
                    listing.businessId ? "businesses" : null,
                  ]
                );
                const fieldCaptureId = fcResult.rows[0]?.id;
                if (fieldCaptureId && listing.businessId) {
                  enrichListingInBackground(listing.businessId, capture.website || null, cityId, capture.company || "Unknown", contact?.id, capture.name, capture.jobTitle, capture.captureMethod, userId, fieldCaptureId);
                }
              }
            } catch (fcErr: any) {
              console.warn("[CAPTURE→FIELD] Batch ad spot field capture failed:", fcErr.message);
            }
          }

          if (capture.intakeType === "stock_photo") {
            const photoUrls = capture.stockPhotoUrls && capture.stockPhotoUrls.length > 0
              ? capture.stockPhotoUrls
              : (capture.documentImageUrl ? [capture.documentImageUrl] : (capture.businessCardImageUrl ? [capture.businessCardImageUrl] : []));
            const tagsList = (capture.stockTags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
            let batchFieldCaptureId: string | null = null;
            let batchHubSlug: string | null = null;

            try {
              const { pool } = await import("./db");
              const cityList = await storage.getAllCities();
              const cityId = capture.capturedWithHubId || (cityList.length > 0 ? cityList[0].id : null);
              const matchedCity = cityList.find(c => c.id === cityId || c.slug === cityId);
              batchHubSlug = matchedCity?.slug || null;
              if (cityId) {
                const operatorName = (req.session as any)?.operatorName || (req.session as any)?.userName || "Field Operator";
                const fcResult = await pool.query(
                  `INSERT INTO field_captures (city_id, capture_type, title, notes, photo_urls, raw_data, captured_by_user_id, captured_by_name, status)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                   RETURNING id`,
                  [
                    cityId,
                    "stock_photo",
                    capture.name || `Stock Photo — ${tagsList[0] || new Date().toLocaleDateString()}`,
                    capture.notes || null,
                    photoUrls.length > 0 ? photoUrls : null,
                    JSON.stringify({ stockTags: capture.stockTags || null, photoUrls, seedSourceType: "STOCK_PHOTO" }),
                    userId || null,
                    operatorName,
                    "new",
                  ]
                );
                batchFieldCaptureId = fcResult.rows[0]?.id;
              }
            } catch (fcErr: any) {
              console.warn("[CAPTURE→FIELD] Batch stock photo field capture failed:", fcErr.message);
            }

            try {
              await createInboxItemIfNotOpen({
                itemType: "stock_photo_capture",
                relatedTable: batchFieldCaptureId ? "field_captures" : "crm_contacts",
                relatedId: batchFieldCaptureId || contact?.id || "stock_photo_batch_fallback",
                title: capture.name || `Stock Photo — ${tagsList[0] || "Untitled"}`,
                summary: `${photoUrls.length} photo${photoUrls.length !== 1 ? "s" : ""} captured${tagsList.length > 0 ? ` — tags: ${tagsList.join(", ")}` : ""}`,
                priority: "low",
                tags: tagsList.length > 0 ? tagsList : undefined,
                triageCategory: "needs_review",
                triageReason: "Stock photo captured in the field (batch sync)",
                triageMetadata: {
                  photoUrls,
                  stockTags: capture.stockTags || null,
                  notes: capture.notes || null,
                  hubId: capture.capturedWithHubId || null,
                  hubSlug: batchHubSlug,
                  contactId: contact?.id,
                  fieldCaptureId: batchFieldCaptureId || null,
                },
              });
            } catch (inboxErr: any) {
              console.warn("[CAPTURE→INBOX] Batch stock photo inbox item failed:", inboxErr.message);
            }
          }

          if (capture.intakeType !== "stock_photo" && contact?.id) {
            try {
              await createInboxItemIfNotOpen({
                itemType: "capture_listing_review",
                relatedTable: "crm_contacts",
                relatedId: contact.id,
                title: `Capture: ${capture.name || capture.company || "Unknown"}`,
                summary: `${capture.intakeType || "person"} capture via ${capture.captureMethod || "manual"} (batch sync)${capture.company ? ` — ${capture.company}` : ""}`,
                priority: "med",
                triageCategory: "needs_review",
                triageReason: `Field capture (${capture.intakeType || "person"}) submitted for review`,
                triageMetadata: {
                  intakeType: capture.intakeType,
                  captureMethod: capture.captureMethod,
                  contactId: contact.id,
                  businessId: listing.businessId,
                },
              });
            } catch (inboxErr: any) {
              console.warn("[CAPTURE→INBOX] Batch capture inbox item failed:", inboxErr.message);
            }
          }

          if (listing.businessId && capture.captureOrigin) {
            generateCaptureOutreachDraft(
              listing.businessId,
              capture.captureOrigin,
              capture.email,
              capture.name
            ).catch((err) => {
              console.error("[CAPTURE→OUTREACH] Batch draft generation failed:", err);
            });
          }

          results.push({ localId: capture.localId, contact, duplicates, listing });
        } catch (e: any) {
          console.error("[CAPTURE] Batch item save error:", e);
          results.push({ localId: capture.localId, contact: null, duplicates: [] });
        }
      }

      res.json({ results });
    } catch (err: any) {
      console.error("[CAPTURE] sync-batch error:", err);
      res.status(500).json({ error: "Batch sync failed" });
    }
  });

  app.get("/api/capture/preview-confirm-email", requireAdmin, (req: Request, res: Response) => {
    const contactName = (req.query.contactName as string) || "there";
    const operatorName = (req.query.operatorName as string) || "An operator";
    const includeCard = req.query.includeCard === "true";
    const cardSlug = req.query.cardSlug as string || "";
    const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
    const cardLink = cardSlug ? `${appUrl}/card/${cardSlug}` : "";

    const cardBlock = includeCard && cardLink
      ? `<p style="text-align: center; margin: 16px 0;">
          <a href="${cardLink}" style="display: inline-block; padding: 12px 28px; background: transparent; color: #5B1D8F; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; border: 1px solid #e5e5e5;">View ${operatorName}'s Digital Card</a>
        </p>`
      : "";

    const subject = `${operatorName} shared their contact info with you`;
    const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #5B1D8F 0%, #7B2FBF 100%); padding: 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">CLT Metro Hub</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">Charlotte's Neighborhood-First Platform &bull; English + Español</p>
      </div>
      <div style="padding: 32px 32px 24px;">
        <p style="color: #1a1a2e; font-size: 18px; font-weight: 600; line-height: 1.4; margin: 0 0 16px;">Hi ${contactName},</p>
        <p style="color: #555; line-height: 1.7; margin: 0 0 16px; font-size: 15px;"><strong>${operatorName}</strong> from CLT Metro Hub recently captured your contact information. We'd like to make sure everything looks right.</p>
        <p style="color: #555; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">By confirming, you consent to CLT Metro Hub storing your contact details. You can request removal at any time.</p>
        <p style="text-align: center; margin: 0 0 16px;">
          <a href="#" style="display: inline-block; padding: 16px 40px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">Confirm My Info</a>
        </p>${cardBlock}
      </div>
      <div style="background: #f9f7fc; padding: 20px 32px; border-top: 1px solid #f0ecf5;">
        <p style="color: #777; font-size: 12px; margin: 0; text-align: center;">If you didn't expect this email, you can safely ignore it.</p>
      </div>
      <div style="padding: 16px 32px; text-align: center; color: #aaa; font-size: 11px;">
        <p style="margin: 0 0 4px;">CLT Metro Hub &bull; Charlotte, NC</p>
        <p style="margin: 0;">Reply to this email to opt out of future communications.</p>
      </div>
    </div>`;

    res.json({ subject, html });
  });

  app.get("/api/field/nearby-businesses", requireAdmin, async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat and lng are required" });
      }
      const radiusMiles = Math.min(parseFloat(req.query.radius as string) || 0.5, 5);
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

      const result = await db.execute(sql`
        SELECT b.id, b.name, b.slug, b.address, b.city, b.state,
          b.phone, b.owner_email, b.claim_status, b.presence_status_2,
          b.activation_source, b.seed_source_type, b.venue_screen_likely,
          b.latitude, b.longitude, b.google_rating, b.google_review_count,
          b.description, b.website_url, b.presence_type,
          z.name as zone_name,
          (SELECT c2.name FROM categories c2 WHERE c2.id = ANY(b.category_ids) LIMIT 1) as category_name,
          (
            3958.8 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS(CAST(b.latitude AS DOUBLE PRECISION) - ${lat}) / 2), 2) +
              COS(RADIANS(${lat})) * COS(RADIANS(CAST(b.latitude AS DOUBLE PRECISION))) *
              POWER(SIN(RADIANS(CAST(b.longitude AS DOUBLE PRECISION) - ${lng}) / 2), 2)
            ))
          ) as distance_miles
        FROM businesses b
        LEFT JOIN zones z ON z.id = b.zone_id
        WHERE b.latitude IS NOT NULL AND b.longitude IS NOT NULL
          AND (
            3958.8 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS(CAST(b.latitude AS DOUBLE PRECISION) - ${lat}) / 2), 2) +
              COS(RADIANS(${lat})) * COS(RADIANS(CAST(b.latitude AS DOUBLE PRECISION))) *
              POWER(SIN(RADIANS(CAST(b.longitude AS DOUBLE PRECISION) - ${lng}) / 2), 2)
            ))
          ) <= ${radiusMiles}
        ORDER BY distance_miles ASC
        LIMIT ${limit}
      `);

      const nearby = (result.rows as any[]).map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        phone: r.phone,
        ownerEmail: r.owner_email,
        claimStatus: r.claim_status,
        presenceStatus: r.presence_status_2,
        activationSource: r.activation_source,
        seedSourceType: r.seed_source_type,
        venueScreenLikely: !!r.venue_screen_likely,
        zoneName: r.zone_name,
        categoryName: r.category_name,
        latitude: r.latitude,
        longitude: r.longitude,
        distance: Math.round(parseFloat(r.distance_miles) * 100) / 100,
        googleRating: r.google_rating ? parseFloat(r.google_rating) : null,
        googleReviewCount: r.google_review_count,
        description: r.description,
        websiteUrl: r.website_url,
        presenceType: r.presence_type,
      }));

      res.json({ businesses: nearby, total: nearby.length, radiusMiles });
    } catch (err: any) {
      console.error("[FIELD] Nearby businesses error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/field/businesses/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
      if (!biz) return res.status(404).json({ error: "Business not found" });

      const allowedFields = ["name", "phone", "ownerEmail", "websiteUrl", "address", "city", "state", "description"];
      const updates: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          const dbField = field === "ownerEmail" ? "ownerEmail" : field;
          updates[dbField] = req.body[field];
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.update(businesses).set(updates).where(eq(businesses.id, id));
      }

      const session = req.session as any;
      const operatorName = session.operatorName || session.userName || "Field Operator";
      const operatorId = session.operatorId || session.userId;

      const operatorNotes = req.body.operatorNotes ? ` | Notes: ${req.body.operatorNotes}` : "";
      await db.insert(crmContacts).values({
        name: operatorName,
        company: biz.name,
        linkedBusinessId: id,
        captureMethod: "manual",
        captureOrigin: "stopped_by_location",
        notes: `Field update: ${Object.keys(updates).join(", ")} updated${operatorNotes}`,
        operatorId: operatorId || null,
      });

      res.json({ success: true, updated: Object.keys(updates) });
    } catch (err: any) {
      console.error("[FIELD] Update business error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/field/businesses/:id/activate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
      if (!biz) return res.status(404).json({ error: "Business not found" });

      const updates: any = {
        activationSource: "field",
        presenceStatus2: "DRAFT",
      };

      if (biz.claimStatus === "UNCLAIMED") {
        updates.claimStatus = "CLAIM_SENT";
      }

      if (req.body.phone) updates.draftContactPhone = req.body.phone;
      if (req.body.email) updates.ownerEmail = req.body.email;
      if (req.body.role) updates.claimantRole = req.body.role;

      await db.update(businesses).set(updates).where(eq(businesses.id, id));

      if (req.body.sendCode && (req.body.email || biz.ownerEmail)) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const target = req.body.email || biz.ownerEmail;
        const method = req.body.codeMethod === "sms" ? "SMS" : "EMAIL";
        const smsTarget = req.body.phone || biz.phone || biz.draftContactPhone;

        await db.insert(verificationCodes).values({
          entityId: id,
          code,
          type: method,
          target: method === "SMS" ? smsTarget : target,
          expiresAt,
        });

        if (method === "EMAIL") {
          await sendTerritoryEmail({
            cityId: biz.cityId || undefined,
            to: target,
            subject: "CLT Metro Hub - Verification Code",
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #5B1D8F; margin-bottom: 16px;">Verify Your Presence</h2>
                <p style="color: #333; font-size: 16px;">Your verification code is:</p>
                <div style="background: #f4f0ff; border: 2px solid #5B1D8F; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #5B1D8F;">${code}</span>
                </div>
                <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
              </div>
            `,
            metadata: { type: "verification_code", entityId: id },
          });
        } else if (smsTarget) {
          await sendTerritorySms({
            cityId: biz.cityId || undefined,
            to: smsTarget,
            body: `CLT Metro Hub verification code: ${code}. Expires in 10 minutes.`,
            metadata: { type: "verification_code", entityId: id },
          });
        }
      }

      const session = req.session as any;
      const operatorName = session.operatorName || session.userName || "Field Operator";

      createInboxItemIfNotOpen({
        itemType: "new_activation",
        relatedTable: "businesses",
        relatedId: id,
        title: `Field Activation: ${biz.name}`,
        summary: `Field activation by ${operatorName}. Business: ${biz.name}.`,
        tags: ["Activation", "Field"],
        links: [{ label: "Review Presence", urlOrRoute: `/admin/businesses?openBiz=${id}` }],
      }).catch(err => console.error("[INBOX] Failed:", err));

      res.json({ success: true, businessId: id, businessName: biz.name });
    } catch (err: any) {
      console.error("[FIELD] Activate business error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/capture/field", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { pool } = await import("./db");
      const body = req.body;
      const session = req.session as any;

      const captureSchema = z.object({
        cityId: z.string().min(1),
        zoneId: z.string().optional(),
        captureType: z.enum(["business", "event", "job_lead", "creator_lead", "marketplace", "flyer", "community_update", "correction", "story_lead", "photo", "voice_note", "document", "quick_note", "ad_spot", "other"]),
        title: z.string().min(1).max(500),
        notes: z.string().max(5000).optional(),
        contactName: z.string().max(200).optional(),
        contactPhone: z.string().max(50).optional(),
        contactEmail: z.string().max(200).optional(),
        businessName: z.string().max(300).optional(),
        eventName: z.string().max(300).optional(),
        locationText: z.string().max(500).optional(),
        sourceUrl: z.string().max(2000).optional(),
        photoUrls: z.array(z.string()).optional(),
        fileUrls: z.array(z.string()).optional(),
        rawData: z.record(z.any()).optional(),
      });

      const parsed = captureSchema.parse(body);
      const operatorName = session?.operatorName || session?.userName || "Field Operator";
      const operatorId = session?.operatorId || session?.userId;

      const result = await pool.query(
        `INSERT INTO field_captures (city_id, zone_id, capture_type, title, notes, contact_name, contact_phone, contact_email, business_name, event_name, location_text, source_url, photo_urls, file_urls, raw_data, captured_by_user_id, captured_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          parsed.cityId,
          parsed.zoneId || null,
          parsed.captureType,
          parsed.title,
          parsed.notes || null,
          parsed.contactName || null,
          parsed.contactPhone || null,
          parsed.contactEmail || null,
          parsed.businessName || null,
          parsed.eventName || null,
          parsed.locationText || null,
          parsed.sourceUrl || null,
          parsed.photoUrls || null,
          parsed.fileUrls || null,
          JSON.stringify(parsed.rawData || {}),
          operatorId || null,
          operatorName,
        ]
      );

      const capture = result.rows[0];

      const typeLabels: Record<string, string> = {
        business: "Business Lead",
        event: "Event Info",
        job_lead: "Job Lead",
        creator_lead: "Creator Lead",
        marketplace: "Marketplace Opportunity",
        flyer: "Flyer / Promo",
        community_update: "Community Update",
        correction: "Listing Correction",
        story_lead: "Story Lead",
        photo: "Photo Capture",
        voice_note: "Voice Note",
        document: "Document",
        quick_note: "Quick Note",
        other: "Other",
      };

      await createInboxItemIfNotOpen({
        itemType: "field_capture_review" as any,
        relatedTable: "field_captures",
        relatedId: capture.id,
        title: `Field Capture: ${parsed.title}`,
        summary: `Type: ${typeLabels[parsed.captureType] || parsed.captureType} | By: ${operatorName}${parsed.businessName ? ` | Business: ${parsed.businessName}` : ""}${parsed.locationText ? ` | Location: ${parsed.locationText}` : ""}`,
        priority: "med",
        tags: ["field-capture", parsed.captureType],
        links: [
          { label: "Review Capture", urlOrRoute: `/admin?section=field-captures&id=${capture.id}` },
        ],
      });

      res.json({ success: true, capture });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      console.error("[FIELD_CAPTURE] Save error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/field-captures", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { pool } = await import("./db");
      const cityId = req.query.cityId as string;
      const status = req.query.status as string;
      const captureType = req.query.captureType as string;

      let query = `SELECT * FROM field_captures WHERE 1=1`;
      const params: any[] = [];
      let idx = 1;

      if (cityId) {
        query += ` AND city_id = $${idx++}`;
        params.push(cityId);
      }
      if (status) {
        query += ` AND status = $${idx++}`;
        params.push(status);
      }
      if (captureType) {
        query += ` AND capture_type = $${idx++}`;
        params.push(captureType);
      }

      query += ` ORDER BY created_at DESC LIMIT 200`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      console.error("[FIELD_CAPTURE] List error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/field-captures/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { pool } = await import("./db");
      const { id } = req.params;

      const updateSchema = z.object({
        status: z.enum(["new", "reviewing", "ready_to_convert", "converted", "discarded", "needs_followup"]).optional(),
        targetType: z.string().optional(),
        reviewNotes: z.string().max(5000).optional(),
        captureType: z.enum(["business", "event", "job_lead", "creator_lead", "marketplace", "flyer", "community_update", "correction", "story_lead", "photo", "voice_note", "document", "quick_note", "ad_spot", "other"]).optional(),
      });

      const parsed = updateSchema.parse(req.body);

      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (parsed.status) {
        sets.push(`status = $${idx++}`);
        params.push(parsed.status);
      }
      if (parsed.targetType !== undefined) {
        sets.push(`target_type = $${idx++}`);
        params.push(parsed.targetType);
      }
      if (parsed.reviewNotes !== undefined) {
        sets.push(`review_notes = $${idx++}`);
        params.push(parsed.reviewNotes);
      }
      if (parsed.captureType) {
        sets.push(`capture_type = $${idx++}`);
        params.push(parsed.captureType);
      }

      sets.push(`updated_at = NOW()`);

      if (sets.length <= 1) return res.status(400).json({ error: "No fields to update" });

      params.push(id);
      const result = await pool.query(
        `UPDATE field_captures SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );

      if (!result.rows.length) return res.status(404).json({ error: "Capture not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      console.error("[FIELD_CAPTURE] Update error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/field-captures/:id/convert", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { pool } = await import("./db");
      const convertSchema = z.object({
        targetType: z.enum(["business", "event", "article", "submission"]),
      });
      const { targetType } = convertSchema.parse(req.body);

      const captureResult = await pool.query(`SELECT * FROM field_captures WHERE id = $1`, [id]);
      if (!captureResult.rows.length) return res.status(404).json({ error: "Capture not found" });

      const capture = captureResult.rows[0];

      if (capture.status === "converted") {
        return res.status(400).json({ error: "Already converted" });
      }

      let convertedEntityId: string | null = null;
      let convertedEntityTable: string | null = null;

      if (targetType === "business") {
        const bizResult = await pool.query(
          `INSERT INTO businesses (city_id, zone_id, name, phone, email, website, address, tier, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'FREE', 'draft')
           RETURNING id`,
          [
            capture.city_id,
            capture.zone_id || null,
            capture.business_name || capture.title,
            capture.contact_phone || null,
            capture.contact_email || null,
            capture.source_url || null,
            capture.location_text || null,
          ]
        );
        convertedEntityId = bizResult.rows[0].id;
        convertedEntityTable = "businesses";
      } else if (targetType === "event") {
        const evResult = await pool.query(
          `INSERT INTO events (city_id, title, description, status, source)
           VALUES ($1, $2, $3, 'draft', 'field_capture')
           RETURNING id`,
          [
            capture.city_id,
            capture.event_name || capture.title,
            capture.notes || "",
          ]
        );
        convertedEntityId = evResult.rows[0].id;
        convertedEntityTable = "events";
      } else if (targetType === "article") {
        const artResult = await pool.query(
          `INSERT INTO articles (city_id, title, body, status, source)
           VALUES ($1, $2, $3, 'draft', 'field_capture')
           RETURNING id`,
          [
            capture.city_id,
            capture.title,
            capture.notes || "",
          ]
        );
        convertedEntityId = artResult.rows[0].id;
        convertedEntityTable = "articles";
      } else if (targetType === "submission") {
        const subResult = await pool.query(
          `INSERT INTO submissions (city_id, type, payload, status, submitter_name, submitter_email)
           VALUES ($1, 'BUSINESS', $2, 'PENDING', $3, $4)
           RETURNING id`,
          [
            capture.city_id,
            JSON.stringify({
              name: capture.business_name || capture.title,
              phone: capture.contact_phone,
              email: capture.contact_email,
              notes: capture.notes,
              location: capture.location_text,
              sourceUrl: capture.source_url,
            }),
            capture.captured_by_name || "Field Capture",
            capture.contact_email || "field@capture.local",
          ]
        );
        convertedEntityId = subResult.rows[0].id;
        convertedEntityTable = "submissions";
      } else {
        await pool.query(
          `UPDATE field_captures SET status = 'ready_to_convert', target_type = $1, updated_at = NOW() WHERE id = $2`,
          [targetType || "other", id]
        );
        return res.json({ success: true, status: "ready_to_convert", message: "Marked for manual conversion" });
      }

      await pool.query(
        `UPDATE field_captures SET status = 'converted', target_type = $1, converted_entity_id = $2, converted_entity_table = $3, updated_at = NOW() WHERE id = $4`,
        [targetType, convertedEntityId, convertedEntityTable, id]
      );

      res.json({
        success: true,
        status: "converted",
        convertedEntityId,
        convertedEntityTable,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid target type", details: err.errors });
      }
      console.error("[FIELD_CAPTURE] Convert error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/field/businesses/:id/log-visit", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
      if (!biz) return res.status(404).json({ error: "Business not found" });

      const session = req.session as any;
      const operatorName = session.operatorName || session.userName || "Field Operator";
      const operatorId = session.operatorId || session.userId;

      await db.insert(crmContacts).values({
        name: operatorName,
        company: biz.name,
        linkedBusinessId: id,
        captureMethod: "manual",
        captureOrigin: "stopped_by_location",
        notes: req.body.notes || `Walk-in visit by ${operatorName}`,
        operatorId: operatorId || null,
      });

      res.json({ success: true, logged: true });
    } catch (err: any) {
      console.error("[FIELD] Log visit error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  function requireAdminSession(req: Request, res: Response, next: Function) {
    const session = req.session as Record<string, unknown>;
    if (!session.userId) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  }

  const outreachStatusSchema = z.object({
    status: z.enum(["NEW", "STORY_CREATED", "STORY_SENT", "APPROVED", "CORRECTIONS_REQUESTED", "INVITE_SENT", "OPENED", "BOOKED", "NO_RESPONSE", "FOLLOWUP_SENT", "COMPLETED"]),
  });

  const bookingUrlSchema = z.object({
    bookingUrl: z.string().url().optional().or(z.literal("")),
  });

  app.get("/api/outreach/captures", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const cityId = typeof req.query.cityId === "string" ? req.query.cityId : undefined;

      const conditions = [isNull(crmContacts.deletedAt)];
      if (cityId) {
        conditions.push(eq(crmContacts.capturedWithHubId, cityId));
      }

      const rows = await db
        .select()
        .from(crmContacts)
        .where(and(...conditions))
        .orderBy(sql`${crmContacts.createdAt} DESC`)
        .limit(200);

      const statusCounts: Record<string, number> = {};
      for (const r of rows) {
        const s = r.outreachStatus || "NEW";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }

      res.json({ captures: rows, statusCounts });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[OUTREACH] List error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/outreach/captures/:id/generate-story", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Capture not found" });

      const { generateStoryForCapture } = await import("./services/capture-story-generator");
      const result = await generateStoryForCapture(req.params.id);
      if (!result) return res.status(400).json({ error: "Story generation failed or no valid data" });
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[OUTREACH] Generate story error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/outreach/captures/:id/send-intro", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Capture not found" });

      const { sendBeckyIntroEmail } = await import("./services/becky-outreach");
      const result = await sendBeckyIntroEmail(req.params.id);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[OUTREACH] Send intro error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/outreach/captures/:id/status", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const parsed = outreachStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status", details: parsed.error.errors });
      }

      const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Capture not found" });

      const updates: Record<string, unknown> = {
        outreachStatus: parsed.data.status,
        updatedAt: new Date(),
      };
      if (parsed.data.status === "BOOKED") {
        updates.calendarBookedAt = new Date();
      }

      await db.update(crmContacts).set(updates).where(eq(crmContacts.id, req.params.id));
      res.json({ success: true, status: parsed.data.status });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[OUTREACH] Status update error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/outreach/captures/:id/booking-url", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const parsed = bookingUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid booking URL", details: parsed.error.errors });
      }

      const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Capture not found" });

      await db.update(crmContacts).set({
        bookingUrl: parsed.data.bookingUrl || null,
        updatedAt: new Date(),
      }).where(eq(crmContacts.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[OUTREACH] Booking URL update error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/outreach/captures/:id/resend-invite", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Capture not found" });

      const { sendBeckyIntroEmail } = await import("./services/becky-outreach");
      const result = await sendBeckyIntroEmail(req.params.id);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[OUTREACH] Resend invite error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/outreach/captures/:id/mark-complete", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Capture not found" });

      await db.update(crmContacts).set({
        outreachStatus: "COMPLETED",
        updatedAt: new Date(),
      }).where(eq(crmContacts.id, req.params.id));
      res.json({ success: true, status: "COMPLETED" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[OUTREACH] Mark complete error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/capture-sessions", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { createCaptureSession } = await import("./charlotte-batch-processor");
      const session = await createCaptureSession({
        metroId: req.body.metroId || (req.session as any).cityId || process.env.DEFAULT_METRO_ID || "b0d970f5-cfd6-475b-8739-cfd5352094c4",
        eventName: req.body.eventName || null,
        eventDate: req.body.eventDate || null,
        location: req.body.location || null,
        operatorUserId: userId,
        operatorName: req.body.operatorName || (req.session as any).operatorName || null,
        notes: req.body.notes || null,
      });
      res.json(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CaptureSession] Create error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  const captureItemSchema = z.object({
    localId: z.string().optional(),
    captureType: z.enum(["business_card", "badge_scan", "manual_entry", "photo", "qr_code", "voice_note"]),
    inputName: z.string().max(500).optional(),
    inputEmail: z.string().email().max(500).optional().or(z.literal("")),
    inputPhone: z.string().max(50).optional(),
    inputCompany: z.string().max(500).optional(),
    inputJobTitle: z.string().max(300).optional(),
    inputWebsite: z.string().max(1000).optional(),
    inputAddress: z.string().max(1000).optional(),
    inputNotes: z.string().max(5000).optional(),
    photoUrls: z.array(z.string().url()).max(10).optional(),
    rawData: z.record(z.unknown()).optional(),
  });

  app.post("/api/admin/capture-sessions/:id/items", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const { addItemsToSession } = await import("./charlotte-batch-processor");
      const items = req.body.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items array required" });
      }
      if (items.length > 200) {
        return res.status(400).json({ error: "Maximum 200 items per request" });
      }
      const validationErrors: string[] = [];
      const validatedItems = [];
      for (let i = 0; i < items.length; i++) {
        const parsed = captureItemSchema.safeParse(items[i]);
        if (!parsed.success) {
          validationErrors.push(`Item ${i}: ${parsed.error.issues.map(e => e.message).join(", ")}`);
        } else {
          validatedItems.push(parsed.data);
        }
      }
      if (validationErrors.length > 0 && validatedItems.length === 0) {
        return res.status(400).json({ error: "All items failed validation", details: validationErrors });
      }
      const result = await addItemsToSession(req.params.id, validatedItems);
      if (validationErrors.length > 0) {
        return res.json({ ...result, skippedErrors: validationErrors });
      }
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CaptureSession] Add items error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/capture-sessions/:id/process", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const { processCaptureBatch } = await import("./charlotte-batch-processor");
      const result = await processCaptureBatch(req.params.id);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CaptureSession] Process error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/capture-sessions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { listCaptureSessions } = await import("./charlotte-batch-processor");
      const metroId = (req.query.metroId as string) || (req.session as any).cityId || undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await listCaptureSessions(metroId, limit, offset);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CaptureSession] List error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/capture-sessions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { getCaptureSession, getSessionItems } = await import("./charlotte-batch-processor");
      const session = await getCaptureSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      const items = await getSessionItems(req.params.id);
      res.json({ session, items });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CaptureSession] Get error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/capture-sessions/:id/execute", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const { getCaptureSession } = await import("./charlotte-batch-processor");
      const session = await getCaptureSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!session.proposalId) return res.status(400).json({ error: "No proposal generated for this session. Process the session first." });

      const { executeProposal, confirmAllProposalItems } = await import("./charlotte-proposal-engine");

      if (req.body.confirmAll) {
        await confirmAllProposalItems(session.proposalId);
      } else if (req.body.itemIds && Array.isArray(req.body.itemIds)) {
        const { confirmProposalItems } = await import("./charlotte-proposal-engine");
        await confirmProposalItems(session.proposalId, req.body.itemIds, "confirm");
      }

      const execResult = await executeProposal(session.proposalId);

      const { pool: execPool } = await import("./db");
      const newStatus = execResult.failed === 0 ? "completed" : "partially_executed";
      await execPool.query(
        `UPDATE capture_sessions SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, req.params.id]
      );

      res.json({ ...execResult, sessionStatus: newStatus });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CaptureSession] Execute error:", msg);
      res.status(500).json({ error: msg });
    }
  });
}
