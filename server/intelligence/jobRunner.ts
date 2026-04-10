import { db } from "../db";
import {
  metroSources,
  sourcePullRuns,
  sourceRawRows,
  rssItems,
  businesses,
  events,
  jobs,
  zones,
  categories,
  type MetroSource,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { normalizeCategory, resolveGeoAssignment, getZoneType } from "../services/content-normalizer";
import { normalizeSourceName } from "../services/feed-service";
import { computeIntegrityFlags, deriveQueueStatus, evaluateContentRouting } from "../services/content-routing-evaluator";

import { getConnector, type ConnectorConfig } from "./connectors";
import { aiRewriteSummary, aiGenerateLocalArticle, findSupplementarySources } from "../lib/ai-content";
import { evaluateSeoChecksServer, evaluateAeoChecksServer, passesQualityGate } from "../lib/content-scoring";
import { geoTagAndClassify, resolveContentZone } from "../services/geo-tagger";
import { checkDuplicate, checkAiSlugDuplicate } from "../services/content-dedup";
import { updateAllSourceTrustScores } from "../services/source-trust";
import { runDiversityFlagPass } from "../services/content-diversity";

function computeHash(payload: any): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

const DEAL_COUPON_BLOCKLIST = [
  "hottest amazon deals", "amazon deals", "best deals", "deal alert",
  "coupon code", "promo code", "discount code", "use code",
  "affiliate link", "shop now", "buy now", "limited time offer",
  "flash sale", "clearance sale", "doorbuster",
  "price drop", "lowest price", "save up to",
  "on the cheap", "on a budget", "for cheap",
  "gift card deal", "gift card offer",
  "samsung galaxy phone", "automatic cat litter",
  "groupon", "living social", "retailmenot",
  "ofertas de amazon", "codigo de descuento", "codigo promocional",
  "oferta limitada", "venta flash",
];

const DEAL_SOURCE_BLOCKLIST = [
  "charlotte on the cheap",
  "charlotteonthecheap",
  "groupon",
  "living social",
  "retailmenot",
  "slickdeals",
  "dealnews",
];

const NEGATIVE_BLOCKLIST = [
  "crime", "shooting", "murder", "stabbing", "robbery", "arrest",
  "homicide", "assault", "fatal", "killed", "death toll", "manslaughter",
  "carjacking", "arson", "kidnapping", "gunshot", "gunfire",
  "crimen", "tiroteo", "asesinato", "apunalamiento", "robo", "arresto",
  "homicidio", "agresion", "muerto", "muertes", "homicidio involuntario",
  "secuestro", "incendio provocado", "disparo", "disparos",
  "balacera", "feminicidio", "mataron", "fallecido", "victima mortal",
];

const POLITICAL_BLOCKLIST = [
  "politics", "political", "election day", "election results", "midterm election",
  "primary election", "general election", "voter registration",
  "congress ", "congressional", "senate ", "senator ",
  "republican party", "republican candidate", "democrat party", "democratic party",
  "trump", "biden", "legislation", "partisan",
  "gop ", " dnc", " rnc", "impeach", "filibuster", "caucus",
  "white house", "capitol hill",
  "politica", "politico", "eleccion", "elecciones", "resultados electorales",
  "congreso ", "senado ", "senador ",
  "partido republicano", "partido democrata",
  "legislacion", "partidista", "casa blanca", "capitolio",
];

const EDUCATION_BLOCKLIST = [
  "school board", "board of education", "school district", "education board",
  "pta meeting", "pta event", "parent teacher", "school calendar",
  "classroom", "school lunch", "school bus", "superintendent",
  "school closure", "snow day", "teacher workday", "staff development day",
  "standardized test", "end of grade", "school enrollment",
  "reunión de la junta escolar", "distrito escolar", "calendario escolar",
];

const EVENT_IRRELEVANT_BLOCKLIST = [
  "pal session", "peer-led session", "study session", "review session",
  "grades due", "grading deadline", "last day to drop", "last day to add",
  "last day to withdraw", "registration deadline", "registration opens",
  "registration closes", "census date", "academic calendar",
  "faculty meeting", "faculty senate", "staff meeting", "board meeting",
  "commencement rehearsal", "orientation session", "advising period",
  "reading day", "study day", "exam period", "final exam", "midterm exam",
  "exam review",
  "spring break", "fall break", "winter break", "summer break",
  "classes begin", "classes end", "classes resume",
  "no classes", "university closed", "campus closed", "office closed",
  "holiday break", "recess", "convocation",
  "half term", "first half term", "second half term",
  "tuition due", "fee payment", "financial aid deadline",
  "drop deadline", "add deadline", "withdrawal deadline",
  "administrative", "payroll", "human resources",
  "weekly meeting", "monthly meeting", "bi-weekly meeting", "biweekly meeting",
  "club meeting", "chapter meeting", "committee meeting",
  "general body meeting", "rsa general body",
  "info session", "information session", "orientation event",
  "practice schedule", "tryout schedule", "game schedule", "season schedule",
  "tournament schedule",
  "sunday service", "worship service", "bible study", "prayer meeting",
  "sunday school", "church service", "mass schedule",
  "syllabus", "course registration", "dean's list", "honor roll",
  "student government", "academic senate", "faculty development",
  "campus tour", "parent orientation", "homecoming court", "pep rally",
  "class schedule", "lab hours", "office hours", "tutoring session",
  "drop-in hours", "walk in hours", "walk-in hours",
  "study group", "thesis defense", "dissertation", "capstone presentation",
  "board of directors meeting", "staff development", "professional development day",
  "in-service day", "department meeting", "division meeting",
  "team meeting", "standup meeting",
  "procrastination workshop", "time management", "effective communication",
  "self-accountability", "decision making", "bystander intervention",
  "safer drinking", "effective decision",
  "graduate research symposium", "research symposium",
];

const LOW_INTEREST_BLOCKLIST = [
  "weekly meeting", "monthly meeting", "club meeting", "chapter meeting",
  "committee meeting", "bi-weekly meeting", "biweekly meeting",
  "call for volunteers", "volunteers needed", "volunteer opportunity",
  "agenda posted", "minutes posted", "meeting minutes", "meeting agenda",
  "sign-up deadline", "signup deadline", "early bird registration",
  "registration now open", "registration is open",
  "newsletter", "e-newsletter", "email blast",
  "obituary", "obituaries", "in memoriam", "funeral service", "memorial service",
  "for sale", "price reduced", "open house", "just listed", "mls#",
  "new listing", "price cut", "reduced price", "asking price",
  "zoning hearing", "planning commission", "public comment period",
  "code enforcement", "variance request", "rezoning",
  "public hearing", "budget hearing", "city council agenda",
  "practice schedule", "tryout schedule", "game schedule", "season schedule",
  "tournament schedule", "preseason schedule",
  "high school baseball", "high school basketball", "high school football",
  "high school soccer", "high school softball", "high school volleyball",
  "high school tennis", "high school track", "high school wrestling",
  "high school swimming", "high school golf", "high school lacrosse",
  "jv schedule", "varsity schedule", "junior varsity",
  "sports analytics club", "analytics club meeting",
];

const LOCAL_KEYWORDS = [
  "charlotte", "clt", "queen city", "north carolina", " nc ", " nc,", " sc ",
  "mecklenburg", "cabarrus", "gaston", "iredell", "union county", "lincoln county",
  "rowan", "stanly", "york county", "lancaster county", "chester county",
  "cleveland county", "catawba", "alexander county", "burke county",
  "caldwell county", "mcdowell county", "chesterfield county", "anson county",

  "uptown", "noda", "plaza midwood", "south end", "dilworth", "myers park",
  "elizabeth", "southpark", "cotswold", "university city", "steele creek",
  "ballantyne", "loso", "west end", "northlake",

  "rock hill", "lake wylie", "fort mill", "tega cay", "clover", "york sc",
  "gastonia", "belmont", "mount holly", "cramerton", "lowell", "mcadenville", "ranlo",
  "huntersville", "cornelius", "davidson", "matthews", "mint hill", "pineville",
  "mooresville", "statesville", "troutman", "lake norman",
  "concord", "kannapolis", "harrisburg", "midland", "mount pleasant",
  "indian trail", "waxhaw", "weddington", "stallings", "monroe", "marvin", "wesley chapel",
  "salisbury", "china grove", "albemarle", "locust",
  "chester sc", "great falls", "indian land", "lancaster sc",
  "denver nc", "lincolnton",
  "wadesboro", "polkton", "peachland", "morven", "lilesville",
  "shelby", "kings mountain", "boiling springs", "lawndale",
  "hickory", "newton nc", "conover", "maiden",
  "taylorsville", "hiddenite",
  "morganton", "valdese", "glen alpine",
  "lenoir", "granite falls", "hudson nc",
  "marion nc", "old fort",
  "cheraw", "chesterfield sc", "pageland",
];

const LOCAL_SOURCE_NAMES = [
  "cornelius today", "davidson news", "lake norman citizen", "fort mill times",
  "south charlotte weekly", "matthews mint hill", "ballantyne magazine",
  "charlotte is creative", "charlotte center city", "charlotte magazine",
  "charlotte stories", "charlotte parent", "charlotte ledger", "charlotte five",
  "unpretentious palate", "off the eaten path", "queen city nerve", "scoop charlotte",
  "blumenthal", "discovery place", "hickory record", "independent tribune",
  "mooresville tribune", "salisbury post", "shelby star", "taylorsville times",
  "statesville", "anson record", "stanly news", "york county", "the link",
  "patch charlotte", "patch fort mill", "patch rock hill", "patch huntersville",
  "patch concord", "patch matthews", "patch monroe", "patch cornelius",
  "patch mooresville", "patch ballantyne", "patch gastonia", "patch indian trail",
  "patch waxhaw", "patch lake norman", "patch pineville", "patch mint hill",
  "wfae", "wcnc", "wsoc", "clt today",
];

interface FeedFilterResult {
  passed: boolean;
  reason?: string;
  matchedTerm?: string;
}

function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function checkCommunityContentFilter(title: string, summary: string, sourceName?: string): FeedFilterResult {
  const text = stripDiacritics(`${title} ${summary}`.toLowerCase());
  const titleLower = stripDiacritics(title.toLowerCase());

  if (sourceName) {
    const srcLower = stripDiacritics(sourceName.toLowerCase());
    for (const blocked of DEAL_SOURCE_BLOCKLIST) {
      if (srcLower.includes(blocked)) {
        return { passed: false, reason: "deal_source_blocked", matchedTerm: blocked };
      }
    }
  }

  for (const term of DEAL_COUPON_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "deal_coupon_content", matchedTerm: term };
    }
  }

  for (const term of NEGATIVE_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "negative_content", matchedTerm: term };
    }
  }

  for (const term of POLITICAL_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "political_content", matchedTerm: term };
    }
  }

  for (const term of EDUCATION_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "education_content", matchedTerm: term };
    }
  }

  for (const term of LOW_INTEREST_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "low_interest_content", matchedTerm: term };
    }
  }

  if (title.trim().length < 20) {
    return { passed: false, reason: "title_too_short", matchedTerm: title.trim() };
  }

  if (title.length > 10 && title === title.toUpperCase() && /[A-Z]/.test(title)) {
    return { passed: false, reason: "all_caps_title", matchedTerm: title };
  }

  const hasLocalRef = LOCAL_KEYWORDS.some((kw) => text.includes(kw));
  const sourceIsLocal = sourceName ? LOCAL_SOURCE_NAMES.some((s) => stripDiacritics(sourceName.toLowerCase()).includes(s)) : false;
  if (!hasLocalRef && !sourceIsLocal) {
    return { passed: false, reason: "non_local", matchedTerm: undefined };
  }

  if (!hasLocalRef && sourceIsLocal) {
    const NATIONAL_WIRE_PATTERNS = [
      "ncaa", "nfl draft", "nba finals", "super bowl", "world series", "olympics",
      "march madness", "final four", "college basketball", "college football",
      "ap poll", "associated press", "wire report",
      "white house", "congress ", "senate ", "supreme court",
      "wall street", "dow jones", "nasdaq", "s&p 500",
    ];
    const titleLower = stripDiacritics(title.toLowerCase());
    const isWireContent = NATIONAL_WIRE_PATTERNS.some((p) => titleLower.includes(p));
    if (isWireContent) {
      return { passed: false, reason: "non_local", matchedTerm: "national_wire_from_local_source" };
    }
  }

  return { passed: true };
}

function checkEventContentFilter(
  title: string,
  description: string,
  sourceName?: string,
  locationInfo?: { locationName?: string | null; address?: string | null; venue?: string | null }
): FeedFilterResult {
  const text = stripDiacritics(`${title} ${description}`.toLowerCase());

  for (const term of NEGATIVE_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "negative_content", matchedTerm: term };
    }
  }

  for (const term of EVENT_IRRELEVANT_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "academic_administrative", matchedTerm: term };
    }
  }

  for (const term of EDUCATION_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "education_content", matchedTerm: term };
    }
  }

  for (const term of LOW_INTEREST_BLOCKLIST) {
    if (text.includes(term)) {
      return { passed: false, reason: "low_interest_content", matchedTerm: term };
    }
  }

  const COURSE_CODE_RX = /\b(ACCT|CHEM|PHYS|MATH|ENGR|ECON|PSYC|BIOL|COMM|PHIL|EXER|ITSC|ITIS|STAT|SOCY|POLS|HIST|GEOG|ANTH|MGMT|FINN|MKTG|INFO|LBST|ENGL|NURS|KNES|AERO|MSCI|EDUC|SOWK|MUSC|THEA|DANC|ARTH|ARCH|ELED|ECGR|MECH|MINE|CIVL|BINF|BIOE|SENG|GEOL|ATMS|MBAD|MACC|MHIT|MNGT|OPMT|DSBA)\s*\d{3,4}\b/i;
  if (COURSE_CODE_RX.test(title)) {
    return { passed: false, reason: "academic_course_code", matchedTerm: title };
  }

  if (title.trim().length < 15) {
    return { passed: false, reason: "event_title_too_short", matchedTerm: title.trim() };
  }

  if (title.length > 10 && title === title.toUpperCase() && /[A-Z]/.test(title)) {
    return { passed: false, reason: "all_caps_title", matchedTerm: title };
  }

  const hasLocalRef = LOCAL_KEYWORDS.some((kw) => text.includes(kw));
  const sourceIsLocal = sourceName ? LOCAL_SOURCE_NAMES.some((s) => stripDiacritics(sourceName.toLowerCase()).includes(s)) : false;
  if (!hasLocalRef && !sourceIsLocal) {
    return { passed: false, reason: "non_local", matchedTerm: undefined };
  }

  if (locationInfo) {
    const hasLocation = !!(locationInfo.locationName?.trim() || locationInfo.address?.trim() || locationInfo.venue?.trim());
    if (!hasLocation) {
      return { passed: false, reason: "no_location", matchedTerm: undefined };
    }
  }

  return { passed: true };
}

function extractField(row: any, fieldPath: string | undefined): string | undefined {
  if (!fieldPath) return undefined;
  const parts = fieldPath.split(".");
  let val: any = row;
  for (const p of parts) {
    if (val == null) return undefined;
    val = val[p];
  }
  return val != null ? String(val) : undefined;
}

const DEFAULT_SOURCE_INGESTION_CAP = parseInt(process.env.SOURCE_INGESTION_CAP || "25", 10);

const EVENT_KEYWORDS = [
  "workshop", "seminar", "conference", "webinar", "concert", "festival",
  "fair", "parade", "meetup", "meet-up", "grand opening", "open house",
  "fundraiser", "gala", "rally", "race", "marathon", "5k", "10k",
  "tournament", "exhibit", "exhibition", "show", "screening",
  "book club", "trivia", "comedy night", "karaoke", "open mic",
  "food truck", "farmers market", "block party", "celebration",
  "ribbon cutting", "art walk", "first friday", "cleanup",
  "volunteer", "free clinic", "blood drive", "job fair", "career fair",
  "town hall", "community meeting", "registration", "sign up",
];

const DATE_PATTERNS = [
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)/i,
  /\b(?:this|next|coming)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b/i,
  /\bfrom\s+\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)/i,
  /\b\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)/i,
];

function looksLikeEvent(title: string, description: string | null): { isEvent: boolean; extractedDate: Date | null; extractedVenue: string | null } {
  const text = `${title} ${description || ""}`.toLowerCase();
  const hasEventKeyword = EVENT_KEYWORDS.some(kw => text.includes(kw));
  const hasDate = DATE_PATTERNS.some(p => p.test(text));
  if (!hasEventKeyword || !hasDate) return { isEvent: false, extractedDate: null, extractedVenue: null };

  let extractedDate: Date | null = null;
  const months: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
  const monthMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i);
  if (monthMatch) {
    const m = months[monthMatch[1].toLowerCase()];
    const d = parseInt(monthMatch[2], 10);
    const y = monthMatch[3] ? parseInt(monthMatch[3], 10) : new Date().getFullYear();
    const candidate = new Date(y, m, d, 18, 0, 0);
    if (!isNaN(candidate.getTime()) && candidate > new Date()) extractedDate = candidate;
  }
  if (!extractedDate) {
    const numericMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (numericMatch) {
      const mm = parseInt(numericMatch[1], 10) - 1;
      const dd = parseInt(numericMatch[2], 10);
      let yy = parseInt(numericMatch[3], 10);
      if (yy < 100) yy += 2000;
      const candidate = new Date(yy, mm, dd, 18, 0, 0);
      if (!isNaN(candidate.getTime()) && candidate > new Date()) extractedDate = candidate;
    }
  }

  let extractedVenue: string | null = null;
  const atMatch = (description || "").match(/\bat\s+(?:the\s+)?([A-Z][A-Za-z\s'&]+?)(?:\s*[,.\n]|\s+on\s+|\s+from\s+)/);
  if (atMatch) extractedVenue = atMatch[1].trim();

  return { isEvent: true, extractedDate, extractedVenue };
}

async function detectAndCreateEventFromRss(
  rssItemId: string,
  cityId: string,
  title: string,
  summary: string | null,
  localBody: string | null,
  zoneSlug: string | null,
): Promise<void> {
  const plainBody = localBody ? localBody.replace(/<[^>]*>/g, " ") : null;
  const { isEvent, extractedDate, extractedVenue } = looksLikeEvent(title, plainBody || summary);
  if (!isEvent) return;

  const existing = await db.select({ id: events.id }).from(events)
    .where(and(eq(events.cityId, cityId), eq(events.seedSourceType, "RSS"), eq(events.seedSourceExternalId, rssItemId)))
    .limit(1);
  if (existing.length > 0) return;

  if (!extractedDate) return;

  let resolvedZoneId: string | null = null;
  if (zoneSlug) {
    const [z] = await db.select({ id: zones.id }).from(zones).where(and(eq(zones.slug, zoneSlug), eq(zones.cityId, cityId))).limit(1);
    if (z) resolvedZoneId = z.id;
  }
  if (!resolvedZoneId) {
    const [dz] = await db.select({ id: zones.id }).from(zones)
      .where(and(eq(zones.cityId, cityId), eq(zones.type, "DISTRICT")))
      .limit(1);
    if (dz) resolvedZoneId = dz.id;
  }
  if (!resolvedZoneId) return;

  const slug = `rss-evt-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 60)}-${rssItemId.substring(0, 8)}`;
  const startDateTime = extractedDate;
  const description = plainBody || summary || title;

  let evtLat: string | null = null;
  let evtLng: string | null = null;
  try {
    const { geocodeFromParts, getZoneCentroid } = await import("../services/geocoding");
    if (extractedVenue) {
      const coords = await geocodeFromParts({ locationName: extractedVenue, city: "Charlotte", state: "NC" });
      if (coords) { evtLat = coords.latitude; evtLng = coords.longitude; }
    }
    if (!evtLat && resolvedZoneId) {
      const centroid = await getZoneCentroid(resolvedZoneId);
      if (centroid) { evtLat = centroid.latitude; evtLng = centroid.longitude; }
    }
  } catch {}

  const [evt] = await db.insert(events).values({
    cityId,
    title,
    description: description.substring(0, 2000),
    startDateTime,
    locationName: extractedVenue,
    slug,
    zoneId: resolvedZoneId,
    seedSourceType: "RSS",
    seedSourceExternalId: rssItemId,
    imageUrl: null,
    ...(evtLat && evtLng && { latitude: evtLat, longitude: evtLng }),
  }).returning({ id: events.id });

  if (evt) {
    console.log(`[RssEventDetect] Created event "${title}" (id: ${evt.id}) from RSS item ${rssItemId}`);
    try {
      await geoTagAndClassify("event", evt.id, cityId, { title, description }, { existingZoneId: resolvedZoneId || undefined });
    } catch {}
  }
}

interface IngestionRow {
  _externalId?: string;
  _title?: string;
  _link?: string;
  _pubDate?: string;
  _summary?: string;
  _author?: string;
  _imageUrl?: string;
  _categories?: string[];
  _feedTitle?: string;
  _raw?: Record<string, unknown>;
  _dedupResult?: import("../services/content-dedup").DedupResult;
  _softDedupSuppress?: boolean;
  _softDedupExistingId?: string;
}

async function handleRssRows(
  source: MetroSource,
  rows: IngestionRow[]
): Promise<{ inserted: number; updated: number; filtered: number }> {
  let inserted = 0;
  let updated = 0;
  let filtered = 0;
  let sourceInsertedThisRun = 0;

  for (const row of rows) {
    const externalId = row._externalId;
    if (!externalId) continue;

    let publishedAt: Date | null = null;
    if (row._pubDate) {
      const parsed = new Date(row._pubDate);
      if (!isNaN(parsed.getTime())) publishedAt = parsed;
    }

    const existing = await db
      .select({ id: rssItems.id })
      .from(rssItems)
      .where(
        and(
          eq(rssItems.metroSourceId, source.id),
          eq(rssItems.externalId, externalId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // existing same-source item → update, skip dedup
    } else {
      const url = row._link || "";
      const dedupResult = await checkDuplicate(
        url,
        externalId,
        source.id,
        row._title || "",
        publishedAt
      );
      if (dedupResult.isDuplicate) {
        console.log(
          `[Dedup] Skipped hard duplicate: "${(row._title || "").slice(0, 80)}" (${dedupResult.duplicateType}, existing: ${dedupResult.existingItemId})`
        );
        filtered++;
        continue;
      }
      if (dedupResult.duplicateType === "soft_title" && dedupResult.existingItemId) {
        const [existingItem] = await db.select({ localArticleBody: rssItems.localArticleBody }).from(rssItems).where(eq(rssItems.id, dedupResult.existingItemId)).limit(1);
        if (existingItem?.localArticleBody && existingItem.localArticleBody.length > 0) {
          row._softDedupSuppress = true;
          row._softDedupExistingId = dedupResult.existingItemId;
        }
      }
      row._dedupResult = dedupResult;
    }

    const filterResult = checkCommunityContentFilter(
      row._title || "",
      row._summary || "",
      row._feedTitle || source.name
    );
    if (!filterResult.passed) {
      const reason = filterResult.matchedTerm
        ? `${filterResult.reason}: matched "${filterResult.matchedTerm}"`
        : filterResult.reason;
      console.log(
        `[FeedFilter] Skipped: "${(row._title || "").slice(0, 80)}" (reason: ${reason})`
      );
      filtered++;
      continue;
    }

    if (existing.length > 0) {
      await db
        .update(rssItems)
        .set({
          title: row._title,
          url: row._link,
          publishedAt,
          summary: row._summary || null,
          author: row._author || null,
          imageUrl: row._imageUrl || null,
          categoriesJson: row._categories?.length ? row._categories : null,
          rawJson: row._raw || {},
          updatedAt: new Date(),
        })
        .where(eq(rssItems.id, existing[0].id));
      updated++;
    } else {
      const rawSourceName = row._feedTitle || source.name;
      const sourceName = normalizeSourceName(rawSourceName) || rawSourceName;
      const title = row._title;
      const summary = row._summary || null;

      const isThrottled = sourceInsertedThisRun >= DEFAULT_SOURCE_INGESTION_CAP;
      const isSoftDedupSuppressed = !!row._softDedupSuppress;

      const initialReviewStatus = "APPROVED";
      const initialPublishStatus = isSoftDedupSuppressed ? "SUPPRESSED" : "PUBLISHED";
      const initialPolicyStatus = isSoftDedupSuppressed ? "SUPPRESS" : "ALLOW";
      const initialQueueStatus = isThrottled ? "QUEUE_DELAYED" : undefined;

      const initialFlags: string[] = [];
      const storedDedup = row._dedupResult;
      if (storedDedup?.flags && storedDedup.flags.length > 0) initialFlags.push(...storedDedup.flags);
      if (isThrottled) initialFlags.push("throttled");
      if (isSoftDedupSuppressed) initialFlags.push("soft_dedup_suppressed");

      const isFromEventSource = source.isEventSource === true;
      const [insertedRow] = await db.insert(rssItems).values({
        cityId: source.cityId,
        metroSourceId: source.id,
        externalId,
        sourceName,
        title,
        url: row._link,
        publishedAt,
        summary,
        author: row._author || null,
        imageUrl: row._imageUrl || null,
        categoriesJson: row._categories?.length ? row._categories : null,
        rawJson: row._raw || {},
        reviewStatus: initialReviewStatus,
        contentType: isFromEventSource ? "event" : "story",
        categoryCoreSlug: isFromEventSource ? "arts-culture" : undefined,
        processingStage: "INGESTED",
        publishStatus: initialPublishStatus,
        policyStatus: initialPolicyStatus,
        queueStatus: initialQueueStatus,
        pulseEligible: isSoftDedupSuppressed ? false : true,
        suppressionReason: isSoftDedupSuppressed ? "soft_title_auto_suppressed" : undefined,
        dedupMeta: isSoftDedupSuppressed ? { originalItemId: row._softDedupExistingId, matchType: "soft_title_auto" } : undefined,
        integrityFlags: initialFlags.length > 0 ? initialFlags : undefined,
      }).returning({ id: rssItems.id });

      if (isSoftDedupSuppressed) {
        console.log(
          `[Dedup] Persisted & suppressed soft duplicate: "${(row._title || "").slice(0, 80)}" → existing ${row._softDedupExistingId}`
        );
        filtered++;
        continue;
      }

      sourceInsertedThisRun++;

      try {
        const { observeRssItemIngested } = await import("../services/article-observation");
        observeRssItemIngested({ title, sourceName, summary, categories: row._categories || undefined }).catch(e =>
          console.error(`[ArticleObservation] RSS observation failed for "${(title || "").slice(0, 60)}":`, e instanceof Error ? e.message : e)
        );
      } catch (e) {
        console.error("[ArticleObservation] Import failed:", e instanceof Error ? e.message : e);
      }

      try {
        const rewriteResult = await aiRewriteSummary(title, summary, sourceName);
        if (rewriteResult.skip) {
          await db.update(rssItems).set({
            reviewStatus: "SKIPPED",
            rewrittenSummary: rewriteResult.reason || null,
            reviewedAt: new Date(),
            updatedAt: new Date(),
            publishStatus: "SUPPRESSED",
            policyStatus: "SUPPRESS",
            processingStage: "REWRITTEN",
          }).where(eq(rssItems.id, insertedRow.id));
        } else {
          const geoResult = await resolveContentZone(source.cityId, {
            title,
            description: rewriteResult.rewritten || summary,
            sourceName,
            sourceUrl: row._link,
            categoriesJson: row._categories?.length ? row._categories : null,
          });
          let zoneSlug = geoResult.zoneSlug;
          let zoneName = geoResult.zoneName;
          let secondaryZoneSlug: string | null = null;
          let countySlug: string | null = null;
          let additionalZoneSlugs: string[] = [];

          let localSlug: string | null = null;
          let localBody: string | null = null;
          let articleSeoTitle: string | null = null;
          let articleExcerpt: string | null = null;
          try {
            const supplementary = await findSupplementarySources(title, summary, sourceName, insertedRow.id);
            if (supplementary.length > 0) {
              console.log(`[MultiSource] Found ${supplementary.length} supplementary sources for "${title}"`);
            }
            const article = await aiGenerateLocalArticle(title, summary, sourceName, row._link, zoneName, supplementary);
            localSlug = article.slug;
            localBody = article.body;
            articleSeoTitle = article.seoTitle || null;
            articleExcerpt = article.excerpt || null;
            if (localSlug) {
              const aiDedupResult = await checkAiSlugDuplicate(localSlug, insertedRow.id);
              if (aiDedupResult.duplicateType === "ai_slug" || aiDedupResult.duplicateType === "ai_slug_near") {
                localSlug = `${localSlug}-${insertedRow.id.substring(0, 8)}`;
                initialFlags.push("ai_duplicate_candidate");
                const dedupMeta = {
                  originalItemId: aiDedupResult.existingItemId,
                  matchType: aiDedupResult.duplicateType,
                };
                await db.update(rssItems).set({
                  integrityFlags: initialFlags,
                  dedupMeta,
                  updatedAt: new Date(),
                }).where(eq(rssItems.id, insertedRow.id));
              }
            }
          } catch (artErr: any) {
            console.error(`[LocalArticle] Generation failed for "${title}":`, artErr.message);
          }

          try {
            const { aiExtractZoneSlugs } = await import("../lib/ai-content");
            const multiZone = await aiExtractZoneSlugs(title, rewriteResult.rewritten || summary, localBody);
            if (multiZone.zoneSlugs.length > 0) {
              const [matched] = await db.select({ id: zones.id, name: zones.name, slug: zones.slug }).from(zones).where(eq(zones.slug, multiZone.zoneSlugs[0])).limit(1);
              if (matched) {
                zoneSlug = matched.slug;
                zoneName = matched.name;
              }
              if (multiZone.zoneSlugs.length > 1) {
                secondaryZoneSlug = multiZone.zoneSlugs[1];
              }
              additionalZoneSlugs = multiZone.zoneSlugs.slice(1);
              countySlug = multiZone.countySlug;
            }
            if (!countySlug && zoneSlug) {
              const [zoneRow] = await db.select({ county: zones.county }).from(zones).where(eq(zones.slug, zoneSlug)).limit(1);
              if (zoneRow?.county) {
                countySlug = zoneRow.county.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-county";
              }
            }
          } catch (aiZoneErr: unknown) {
            console.error(`[GeoTagger] AI multi-zone extraction failed for "${title}":`, aiZoneErr instanceof Error ? aiZoneErr.message : aiZoneErr);
          }

          let finalReviewStatus = initialReviewStatus;
          if (localBody) {
            const seoScore = evaluateSeoChecksServer({
              title,
              metaDescription: rewriteResult.rewritten,
              content: localBody,
              slug: localSlug || undefined,
              cityKeyword: "Charlotte",
            });
            const aeoScore = evaluateAeoChecksServer({ title, content: localBody, metaDescription: rewriteResult.rewritten });
            const passes = passesQualityGate(seoScore, aeoScore);
            if (!passes) {
              console.log(`[QualityGate] Article "${title}" low quality but auto-approved: SEO ${seoScore.passed}/${seoScore.total}, AEO ${aeoScore.passed}/${aeoScore.total}`);
            } else {
              console.log(`[QualityGate] Article "${title}" auto-approved: SEO ${seoScore.passed}/${seoScore.total}, AEO ${aeoScore.passed}/${aeoScore.total}`);
            }
          }

          try {
            const { buildWriteback, classifyContent } = await import("../services/ai-classifier");
            const aiResult = await classifyContent({
              title,
              summary: rewriteResult.rewritten || summary,
              body: localBody,
              sourceName,
              sourceUrl: row._link,
              categoriesJson: row._categories?.length ? row._categories : null,
            });
            if (aiResult) {
              const { aiFields, routingUpdates } = buildWriteback(aiResult, {
                categoryCoreSlug: null,
                categorySubSlug: null,
                geoPrimarySlug: zoneSlug || null,
                geoSecondarySlug: secondaryZoneSlug,
                hubSlug: null,
                countySlug: countySlug,
                venueName: null,
                contentType: "story",
                policyStatus: null,
                lastEditedBy: null,
              });
              await db.update(rssItems).set({
                ...aiFields,
                ...routingUpdates,
                updatedAt: new Date(),
              }).where(eq(rssItems.id, insertedRow.id));
              if (routingUpdates.geoPrimarySlug && !zoneSlug) {
                zoneSlug = routingUpdates.geoPrimarySlug;
              }
              if (aiResult.policyStatus === "SUPPRESS" && aiResult.confidence.policy >= 0.7) {
                console.log(`[AI Classifier] Policy SUPPRESS for "${title}" — keeping APPROVED (auto-approve mode)`);
              }
              if (aiResult.policyStatus === "REVIEW_NEEDED" && aiResult.confidence.policy >= 0.7) {
                console.log(`[AI Classifier] Policy REVIEW_NEEDED for "${title}" — keeping APPROVED (auto-approve mode)`);
              }
            }
          } catch (classifyErr: unknown) {
            console.error(`[AI Classifier] Classification failed for "${title}":`, classifyErr instanceof Error ? classifyErr.message : classifyErr);
          }

          await db.update(rssItems).set({
            reviewStatus: finalReviewStatus,
            rewrittenSummary: rewriteResult.rewritten,
            zoneSlug: zoneSlug || null,
            geoPrimarySlug: zoneSlug || null,
            geoSecondarySlug: secondaryZoneSlug || null,
            countySlug: countySlug || null,
            localArticleSlug: localSlug,
            localArticleBody: localBody,
            aiGeneratedTitle: articleSeoTitle || null,
            aiGeneratedSummary: articleExcerpt || null,
            reviewedAt: new Date(),
            updatedAt: new Date(),
            processingStage: zoneSlug ? "ROUTED" : (rewriteResult.rewritten ? "REWRITTEN" : "INGESTED"),
            publishStatus: finalReviewStatus === "APPROVED" ? "PUBLISHED" : (finalReviewStatus === "PENDING" ? "DRAFT" : "SUPPRESSED"),
            policyStatus: finalReviewStatus === "APPROVED" ? "ALLOW" : (finalReviewStatus === "PENDING" ? "REVIEW_NEEDED" : "SUPPRESS"),
          }).where(eq(rssItems.id, insertedRow.id));

          if (finalReviewStatus === "APPROVED" && localBody && localSlug) {
            try {
              const { createCmsFromRssItem } = await import("../lib/ai-content");
              await createCmsFromRssItem({
                rssItemId: insertedRow.id,
                cityId: source.cityId,
                title,
                slug: localSlug,
                body: localBody,
                excerpt: articleExcerpt,
                seoTitle: articleSeoTitle,
                imageUrl: row._imageUrl || null,
                sourceName,
                sourceUrl: row._link,
                zoneSlug: zoneSlug || null,
                rewrittenSummary: rewriteResult.rewritten,
                categories: row._categories?.length ? row._categories : null,
              });
            } catch (cmsErr: unknown) {
              console.error(`[CMS Bridge] Pipeline CMS creation failed for "${title}":`, cmsErr instanceof Error ? cmsErr.message : cmsErr);
            }
          }

          if (finalReviewStatus === "APPROVED") {
            try {
              await geoTagAndClassify("rss_item", insertedRow.id, source.cityId, {
                title,
                description: rewriteResult.rewritten || summary,
                sourceName,
                sourceUrl: row._link,
                categoriesJson: row._categories?.length ? row._categories : null,
              }, { existingZoneSlug: zoneSlug || undefined });
            } catch (tagErr: unknown) {
              console.error(`[GeoTagger] Tag classification failed for "${title}":`, tagErr instanceof Error ? tagErr.message : tagErr);
            }
          }

          try {
            const { applyFullTagStack } = await import("../services/content-tagger");
            await applyFullTagStack("rss_item", insertedRow.id, {
              cityId: source.cityId,
              zoneSlug: zoneSlug || undefined,
              additionalZoneSlugs: additionalZoneSlugs.length > 0 ? additionalZoneSlugs : undefined,
              countySlug: countySlug || undefined,
              categoriesJson: row._categories?.length ? row._categories : undefined,
              title,
            });
          } catch (taggerErr: unknown) {
            console.error(`[ContentTagger] Failed for RSS "${title}":`, taggerErr instanceof Error ? taggerErr.message : taggerErr);
          }

          if (finalReviewStatus === "APPROVED" && localBody) {
            try {
              const { extractAndCreateEventsFromArticle } = await import("../lib/ai-content");
              const eventIds = await extractAndCreateEventsFromArticle({
                rssItemId: insertedRow.id,
                cityId: source.cityId,
                title,
                summary: rewriteResult.rewritten || summary,
                articleBody: localBody,
                sourceUrl: row._link,
                sourceName,
                primaryZoneSlug: zoneSlug || null,
              });
              if (eventIds.length > 0) {
                console.log(`[JobRunner] Extracted ${eventIds.length} calendar events from "${title}"`);
              }
              const evtFlags: string[] = ((insertedRow as Record<string, unknown>).integrityFlags as string[]) || [];
              if (!evtFlags.includes("events_extracted")) {
                await db.update(rssItems).set({
                  integrityFlags: [...new Set([...evtFlags, "events_extracted"])],
                }).where(eq(rssItems.id, insertedRow.id));
              }
            } catch (evtErr: unknown) {
              console.error(`[EventExtract] Pipeline event extraction failed for "${title}":`, evtErr instanceof Error ? evtErr.message : evtErr);
            }
          }

          if (finalReviewStatus === "APPROVED" && localBody) {
            try {
              const venueFlags: string[] = ((insertedRow as Record<string, unknown>).integrityFlags as string[]) || [];
              if (!venueFlags.includes("venues_discovered")) {
                const { aiExtractVenuesFromArticle } = await import("../lib/ai-content");
                const { resolveOrCreateVenuePresence } = await import("../lib/venue-discovery");
                const venueResult = await aiExtractVenuesFromArticle(title, rewriteResult.rewritten || summary, localBody);
                let venuesCreated = 0;
                for (const venue of venueResult.venues) {
                  try {
                    const result = await resolveOrCreateVenuePresence(
                      venue.name,
                      venue.address,
                      venue.city || "Charlotte",
                      venue.state || "NC",
                      source.cityId,
                    );
                    if (result?.created) venuesCreated++;
                  } catch (vErr: unknown) {
                    console.warn(`[VenueDiscovery] Failed to resolve venue "${venue.name}":`, vErr instanceof Error ? vErr.message : vErr);
                  }
                }
                if (venuesCreated > 0) {
                  console.log(`[JobRunner] Discovered ${venuesCreated} new venues from "${title}"`);
                }
                const freshVenueFlags: string[] = await db.select({ f: rssItems.integrityFlags })
                  .from(rssItems).where(eq(rssItems.id, insertedRow.id)).limit(1)
                  .then(r => ((r[0]?.f || []) as string[]));
                await db.update(rssItems).set({
                  integrityFlags: [...new Set([...freshVenueFlags, "venues_discovered"])],
                }).where(eq(rssItems.id, insertedRow.id));
              }
            } catch (venueErr: unknown) {
              console.error(`[VenueDiscovery] Pipeline venue extraction failed for "${title}":`, venueErr instanceof Error ? venueErr.message : venueErr);
            }
          }

          if (finalReviewStatus === "APPROVED" && localBody) {
            try {
              const { aiClassifyEvergreen } = await import("../lib/ai-content");
              const evergreenResult = await aiClassifyEvergreen(title, rewriteResult.rewritten || summary, localBody);
              if (evergreenResult.isEvergreen && evergreenResult.confidence >= 0.7) {
                await db.update(rssItems).set({
                  isEvergreen: true,
                  updatedAt: new Date(),
                }).where(eq(rssItems.id, insertedRow.id));
              }
            } catch (egErr: unknown) {
              console.error(`[EvergreenClassify] Pipeline classification failed for "${title}":`, egErr instanceof Error ? egErr.message : egErr);
            }
          }

          try {
            const { autoTranslateRssItem } = await import("../services/auto-translate");
            autoTranslateRssItem(insertedRow.id).catch((e: unknown) =>
              console.error(`[AutoTranslate] RSS translate failed for "${title}":`, e instanceof Error ? e.message : e)
            );
          } catch {}

          try {
            const [freshItem] = await db.select().from(rssItems).where(eq(rssItems.id, insertedRow.id));
            if (freshItem) {
              const itemRecord = freshItem as Record<string, unknown>;
              const integrityUpdates: Record<string, unknown> = {};

              let categoryNeedsReview = false;
              if (!freshItem.categoryCoreSlug) {
                const catResult = await normalizeCategory(itemRecord);
                if (catResult.categoryCoreSlug) {
                  integrityUpdates.categoryCoreSlug = catResult.categoryCoreSlug;
                  if (catResult.categorySubSlug) integrityUpdates.categorySubSlug = catResult.categorySubSlug;
                }
                if (catResult.confidence < 1.0) {
                  const existingConf = (freshItem.aiConfidence || {}) as Record<string, number>;
                  integrityUpdates.aiConfidence = { ...existingConf, category: catResult.confidence };
                }
                categoryNeedsReview = catResult.needsReview;
              }

              let geoIsLowPrecision = false;
              let geoNeedsReview = false;
              if (!freshItem.geoPrimarySlug) {
                const geoResult = await resolveGeoAssignment(itemRecord, source.cityId);
                if (geoResult.geoPrimarySlug) {
                  integrityUpdates.geoPrimarySlug = geoResult.geoPrimarySlug;
                  if (geoResult.geoSecondarySlug) integrityUpdates.geoSecondarySlug = geoResult.geoSecondarySlug;
                  if (geoResult.hubSlug) integrityUpdates.hubSlug = geoResult.hubSlug;
                  if (geoResult.countySlug) integrityUpdates.countySlug = geoResult.countySlug;
                }
                geoIsLowPrecision = geoResult.isLowPrecision;
                geoNeedsReview = geoResult.needsReview;
              } else {
                const existingPrecision = await getZoneType(freshItem.geoPrimarySlug as string, source.cityId);
                geoIsLowPrecision = existingPrecision === "METRO" || existingPrecision === "NONE";
              }

              const mergedItem = { ...itemRecord, ...integrityUpdates, _geoIsLowPrecision: geoIsLowPrecision };
              const routing = evaluateContentRouting(mergedItem);
              const flags = computeIntegrityFlags(mergedItem);
              const existingIngestFlags = ((freshItem.integrityFlags || []) as string[]).filter(f =>
                f === "duplicate_candidate" || f === "ai_duplicate_candidate" ||
                f === "throttled" || f === "low_trust_source" ||
                f === "events_extracted" || f === "zone_retagged" || f === "venues_discovered"
              );
              for (const f of existingIngestFlags) {
                if (!flags.includes(f)) flags.push(f);
              }
              integrityUpdates.integrityFlags = flags;
              integrityUpdates.lastIntegrityPassAt = new Date();
              integrityUpdates.updatedAt = new Date();

              const needsEnforcedReview = categoryNeedsReview || geoNeedsReview || routing.hasRoutingIssues || flags.includes("MISSING_CATEGORY") || flags.includes("MISSING_GEO");
              if (needsEnforcedReview) {
                const currentQs = freshItem.queueStatus as string;
                if (currentQs !== "SUPPRESSED" && currentQs !== "ARCHIVED") {
                  integrityUpdates.queueStatus = "REVIEW_REQUIRED";
                }
              } else if (!freshItem.queueStatus) {
                const ps = (mergedItem.publishStatus as string) || "DRAFT";
                const pol = (mergedItem.policyStatus as string) || "REVIEW_NEEDED";
                const pe = mergedItem.pulseEligible !== false;
                integrityUpdates.queueStatus = deriveQueueStatus(ps, pol, pe, undefined);
              }

              if (Object.keys(integrityUpdates).length > 0) {
                await db.update(rssItems).set(integrityUpdates).where(eq(rssItems.id, insertedRow.id));
              }
            }
          } catch (integrityErr: unknown) {
            console.error(`[Integrity] Post-ingest integrity check failed for "${title}":`, integrityErr instanceof Error ? integrityErr.message : integrityErr);
          }

          // Legacy heuristic event detection removed — AI event extraction (above) handles this
        }
      } catch (aiErr: unknown) {
        console.error(`[AutoApprove] AI processing failed for "${title}":`, aiErr instanceof Error ? aiErr.message : aiErr);
        await db.update(rssItems).set({
          reviewStatus: initialReviewStatus,
          rewrittenSummary: summary || title,
          reviewedAt: new Date(),
          updatedAt: new Date(),
          publishStatus: initialPublishStatus,
          policyStatus: initialPolicyStatus,
        }).where(eq(rssItems.id, insertedRow.id));
      }

      inserted++;
    }
  }

  try {
    await db.update(metroSources).set({
      lastIngestedItemCount: sourceInsertedThisRun,
      updatedAt: new Date(),
    }).where(eq(metroSources.id, source.id));
  } catch (err: unknown) {
    console.error(`[Throttle] Failed to update lastIngestedItemCount for source ${source.id}:`, err instanceof Error ? err.message : err);
  }

  if (inserted > 0) {
    try {
      await runDiversityFlagPass(source.cityId);
    } catch (err: unknown) {
      console.error(`[Diversity] Post-batch diversity check failed for city ${source.cityId}:`, err instanceof Error ? err.message : err);
    }
  }

  return { inserted, updated, filtered };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function seedSlug(name: string, externalId: string): string {
  const hash = crypto.createHash("md5").update(externalId).digest("hex").slice(0, 6);
  return slugify(name).slice(0, 100) + "-" + hash;
}

async function resolveDefaultZone(cityId: string): Promise<string> {
  const [zone] = await db
    .select({ id: zones.id })
    .from(zones)
    .where(eq(zones.cityId, cityId))
    .limit(1);
  if (zone) return zone.id;
  const [created] = await db.insert(zones).values({
    cityId,
    name: "City-Wide",
    slug: `city-wide-${cityId.slice(0, 8)}`,
    type: "CITY",
    isActive: true,
  }).returning();
  return created.id;
}

async function resolveZoneByZip(zip: string | null, cityId: string): Promise<string | null> {
  if (!zip) return null;
  const cleaned = zip.trim().replace(/-.*$/, "");
  if (!cleaned) return null;
  const results = await db
    .select({ id: zones.id })
    .from(zones)
    .where(
      and(
        eq(zones.cityId, cityId),
        sql`${zones.slug} = ${cleaned} OR ${zones.name} = ${cleaned}`
      )
    )
    .limit(1);
  return results[0]?.id || null;
}

async function resolveCategoryId(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return cat?.id || null;
}

async function handleBusinessSeedRows(
  source: MetroSource,
  rows: any[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const defaultZoneId = await resolveDefaultZone(source.cityId);

  for (const row of rows) {
    const externalId = row._externalId;
    if (!externalId) continue;

    const name = row._name;
    if (!name) continue;

    const seedSourceType = source.sourceType;
    const zip = row._zip || null;
    const zoneId = (await resolveZoneByZip(zip, source.cityId)) || defaultZoneId;
    const slug = seedSlug(name, externalId);
    const categoryId = await resolveCategoryId(row._categorySlug);
    const categoryIds = categoryId ? [categoryId] : [];

    const existing = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, source.cityId),
          eq(businesses.seedSourceType, seedSourceType),
          eq(businesses.seedSourceExternalId, externalId)
        )
      )
      .limit(1);

    const values = {
      name,
      address: row._address || null,
      city: row._city || null,
      state: row._state || row._stateCode || null,
      zip: row._zip || null,
      phone: row._phone || null,
      websiteUrl: row._website || null,
      latitude: row._latitude != null ? String(row._latitude) : null,
      longitude: row._longitude != null ? String(row._longitude) : null,
      presenceType: row._presenceType || "commerce",
      isNonprofit: row._isNonprofit || false,
      categoryIds,
      listingTier: "FREE" as const,
      claimStatus: "UNCLAIMED" as const,
      presenceStatus: "ACTIVE" as const,
      licenseNote: row._licenseNote || null,
      seedSourceType,
      seedSourceExternalId: externalId,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(businesses).set(values).where(eq(businesses.id, existing[0].id));
      try {
        await geoTagAndClassify("business", existing[0].id, source.cityId, {
          title: name,
          description: row._description || null,
          address: row._address || null,
          zip: row._zip || null,
          categoryIds,
        }, { existingZoneId: zoneId });
      } catch (tagErr: any) {
        console.error(`[GeoTagger] Business tag failed for "${name}":`, tagErr.message);
      }
      updated++;
    } else {
      const geoResult = await resolveContentZone(source.cityId, {
        title: name,
        description: row._description || null,
        address: row._address || null,
        zip: row._zip || null,
      });
      const resolvedZoneId = geoResult.zoneId || zoneId;

      const [inserted_biz] = await db.insert(businesses).values({
        ...values,
        cityId: source.cityId,
        zoneId: resolvedZoneId,
        slug,
      }).returning({ id: businesses.id });
      try {
        await geoTagAndClassify("business", inserted_biz.id, source.cityId, {
          title: name,
          description: row._description || null,
          address: row._address || null,
          zip: row._zip || null,
          categoryIds,
        }, { existingZoneId: resolvedZoneId });
      } catch (tagErr: any) {
        console.error(`[GeoTagger] Business tag failed for "${name}":`, tagErr.message);
      }
      inserted++;
    }
  }

  return { inserted, updated };
}

async function handleEventSeedRows(
  source: MetroSource,
  rows: any[]
): Promise<{ inserted: number; updated: number; filtered: number }> {
  let inserted = 0;
  let updated = 0;
  let filtered = 0;
  const defaultZoneId = await resolveDefaultZone(source.cityId);

  for (const row of rows) {
    const externalId = row._externalId;
    if (!externalId) continue;

    const title = row._title;
    if (!title) continue;

    const filterResult = checkEventContentFilter(
      title,
      row._description || "",
      source.sourceName || undefined,
      { locationName: row._locationName || null, address: row._address || null, venue: row._venue || null }
    );
    if (!filterResult.passed) {
      const reason = filterResult.matchedTerm
        ? `${filterResult.reason}: matched "${filterResult.matchedTerm}"`
        : filterResult.reason;
      console.log(`[EventFilter] Skipped: "${title.slice(0, 80)}" (reason: ${reason})`);
      filtered++;
      continue;
    }

    const seedSourceType = source.sourceType;
    const zip = row._zip || null;
    const zoneId = (await resolveZoneByZip(zip, source.cityId)) || defaultZoneId;
    const slug = seedSlug(title, externalId);

    let startDateTime: Date | null = null;
    if (row._startDateTime) {
      const d = new Date(row._startDateTime);
      if (!isNaN(d.getTime())) startDateTime = d;
    }
    let endDateTime: Date | null = null;
    if (row._endDateTime) {
      const d = new Date(row._endDateTime);
      if (!isNaN(d.getTime())) endDateTime = d;
    }

    if (!startDateTime) startDateTime = new Date();

    const existing = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.cityId, source.cityId),
          eq(events.seedSourceType, seedSourceType),
          eq(events.seedSourceExternalId, externalId)
        )
      )
      .limit(1);

    const values = {
      title,
      description: row._description || null,
      startDateTime,
      endDateTime,
      locationName: row._locationName || null,
      address: row._address || null,
      city: row._city || null,
      state: row._state || null,
      zip,
      costText: row._costText || null,
      imageUrl: row._imageUrl || null,
      seedSourceType,
      seedSourceExternalId: externalId,
      sourceUrl: row._sourceUrl || null,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(events).set(values).where(eq(events.id, existing[0].id));
      try {
        await geoTagAndClassify("event", existing[0].id, source.cityId, {
          title,
          description: row._description || null,
          address: row._address || null,
          zip,
          venue: row._locationName || row._venue || null,
        }, { existingZoneId: zoneId });
      } catch (tagErr: any) {
        console.error(`[GeoTagger] Event tag failed for "${title}":`, tagErr.message);
      }
      updated++;
    } else {
      const geoResult = await resolveContentZone(source.cityId, {
        title,
        description: row._description || null,
        address: row._address || null,
        zip,
        venue: row._locationName || row._venue || null,
      });
      const resolvedZoneId = geoResult.zoneId || zoneId;

      const [inserted_evt] = await db.insert(events).values({
        ...values,
        cityId: source.cityId,
        zoneId: resolvedZoneId,
        slug,
      }).returning({ id: events.id });
      try {
        await geoTagAndClassify("event", inserted_evt.id, source.cityId, {
          title,
          description: row._description || null,
          address: row._address || null,
          zip,
          venue: row._locationName || row._venue || null,
        }, { existingZoneId: resolvedZoneId });
      } catch (tagErr: any) {
        console.error(`[GeoTagger] Event tag failed for "${title}":`, tagErr.message);
      }
      inserted++;
    }
  }

  return { inserted, updated, filtered };
}

async function handleJobSeedRows(
  source: MetroSource,
  rows: any[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const externalId = row._externalId;
    if (!externalId) continue;

    const title = row.title;
    if (!title) continue;

    const seedSourceType = source.sourceType;
    const slug = seedSlug(title, externalId);

    let postedAt: Date | null = null;
    if (row.postedAt) {
      const d = new Date(row.postedAt);
      if (!isNaN(d.getTime())) postedAt = d;
    }
    let closesAt: Date | null = null;
    if (row.closesAt) {
      const d = new Date(row.closesAt);
      if (!isNaN(d.getTime())) closesAt = d;
    }

    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.cityId, source.cityId),
          eq(jobs.seedSourceType, seedSourceType),
          eq(jobs.seedSourceExternalId, externalId)
        )
      )
      .limit(1);

    const values = {
      title,
      employer: row.employer || null,
      department: row.department || null,
      employmentType: row.employmentType || null,
      payMin: row.payMin != null ? String(row.payMin) : null,
      payMax: row.payMax != null ? String(row.payMax) : null,
      payUnit: row.payUnit || null,
      locationText: row.locationText || null,
      city: row.city || null,
      stateCode: row.stateCode || null,
      zipCode: row.zipCode || null,
      remoteType: row.remoteType || null,
      description: row.description || null,
      postedAt,
      closesAt,
      applyUrl: row.applyUrl || null,
      detailsUrl: row.detailsUrl || null,
      seedSourceType,
      seedSourceExternalId: externalId,
      sourceUrl: row.sourceUrl || null,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(jobs).set(values).where(eq(jobs.id, existing[0].id));
      updated++;
    } else {
      const [inserted_job] = await db.insert(jobs).values({
        ...values,
        cityId: source.cityId,
        slug,
      }).returning({ id: jobs.id });
      try {
        await geoTagAndClassify("job", inserted_job.id, source.cityId, {
          title,
          description: row.description || null,
          address: row.locationText || null,
          zip: row.zipCode || null,
        }, { skipAi: true });
      } catch (tagErr: any) {
        console.error(`[GeoTagger] Job tag failed for "${title}":`, tagErr.message);
      }
      inserted++;
    }
  }

  return { inserted, updated };
}

const SEED_SOURCE_TYPES = new Set(["OSM_OVERPASS", "IRS_EO", "EVENTBRITE", "USAJOBS"]);

async function handleStandardRows(
  source: MetroSource,
  rows: any[],
  params: Record<string, any>
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const externalId = extractField(row, params.externalIdField) || row._externalId || null;
    const recordTs = extractField(row, params.dateField);
    const zip = extractField(row, params.zipField) || null;
    const lat = extractField(row, params.latField) || null;
    const lng = extractField(row, params.lngField) || null;
    const hash = computeHash(row);

    let recordTimestamp: Date | null = null;
    if (recordTs) {
      const parsed = new Date(recordTs);
      if (!isNaN(parsed.getTime())) recordTimestamp = parsed;
    }

    if (externalId) {
      const existing = await db
        .select({ id: sourceRawRows.id })
        .from(sourceRawRows)
        .where(
          and(
            eq(sourceRawRows.metroSourceId, source.id),
            eq(sourceRawRows.externalId, externalId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(sourceRawRows)
          .set({
            payloadJson: row,
            hash,
            recordTimestamp,
            zipCode: zip,
            lat,
            lng,
            updatedAt: new Date(),
          })
          .where(eq(sourceRawRows.id, existing[0].id));
        updated++;
      } else {
        await db.insert(sourceRawRows).values({
          cityId: source.cityId,
          metroSourceId: source.id,
          externalId,
          recordTimestamp,
          zipCode: zip,
          lat,
          lng,
          payloadJson: row,
          hash,
        });
        inserted++;
      }
    } else {
      const existing = await db
        .select({ id: sourceRawRows.id })
        .from(sourceRawRows)
        .where(
          and(
            eq(sourceRawRows.metroSourceId, source.id),
            eq(sourceRawRows.hash, hash)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        updated++;
      } else {
        await db.insert(sourceRawRows).values({
          cityId: source.cityId,
          metroSourceId: source.id,
          externalId: null,
          recordTimestamp,
          zipCode: zip,
          lat,
          lng,
          payloadJson: row,
          hash,
        });
        inserted++;
      }
    }
  }

  return { inserted, updated };
}

export async function runPull(source: MetroSource): Promise<{
  rowsFetched: number;
  rowsInserted: number;
  rowsUpdated: number;
  error?: string;
}> {
  const [pullRun] = await db
    .insert(sourcePullRuns)
    .values({
      metroSourceId: source.id,
      startedAt: new Date(),
      status: "SUCCESS",
      rowsFetched: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
    })
    .returning();

  try {
    const connector = getConnector(source.sourceType);
    const config: ConnectorConfig = {
      baseUrl: source.baseUrl || "",
      datasetId: source.datasetId || undefined,
      layerUrl: source.layerUrl || undefined,
      paramsJson: (source.paramsJson as Record<string, any>) || {},
      lastCursor: source.lastCursor || undefined,
      lastPulledAt: source.lastPulledAt || undefined,
    };

    const result = await connector.pull(config);
    const params = (source.paramsJson as Record<string, any>) || {};

    let inserted = 0;
    let updated = 0;

    if (source.sourceType === "RSS") {
      const rssResult = await handleRssRows(source, result.rows);
      inserted = rssResult.inserted;
      updated = rssResult.updated;
      if (rssResult.filtered > 0) {
        console.log(`[FeedFilter] ${source.name}: ${rssResult.filtered} items filtered out of ${result.rows.length} total`);
      }
    } else if (source.sourceType === "ICAL") {
      const icalResult = await handleEventSeedRows(source, result.rows);
      inserted = icalResult.inserted;
      updated = icalResult.updated;
      if (icalResult.filtered > 0) {
        console.log(`[EventFilter] ${source.name}: ${icalResult.filtered} events filtered out of ${result.rows.length} total`);
      }
    } else if (source.sourceType === "OSM_OVERPASS" || source.sourceType === "IRS_EO") {
      const seedResult = await handleBusinessSeedRows(source, result.rows);
      inserted = seedResult.inserted;
      updated = seedResult.updated;
    } else if (source.sourceType === "EVENTBRITE") {
      const seedResult = await handleEventSeedRows(source, result.rows);
      inserted = seedResult.inserted;
      updated = seedResult.updated;
      if (seedResult.filtered > 0) {
        console.log(`[EventFilter] ${source.name}: ${seedResult.filtered} events filtered out of ${result.rows.length} total`);
      }
    } else if (source.sourceType === "USAJOBS") {
      const seedResult = await handleJobSeedRows(source, result.rows);
      inserted = seedResult.inserted;
      updated = seedResult.updated;
    } else {
      const stdResult = await handleStandardRows(source, result.rows, params);
      inserted = stdResult.inserted;
      updated = stdResult.updated;
    }

    await db
      .update(sourcePullRuns)
      .set({
        finishedAt: new Date(),
        status: "SUCCESS",
        rowsFetched: result.rows.length,
        rowsInserted: inserted,
        rowsUpdated: updated,
        nextCursor: result.nextCursor || null,
      })
      .where(eq(sourcePullRuns.id, pullRun.id));

    await db
      .update(metroSources)
      .set({
        lastPulledAt: new Date(),
        lastCursor: result.nextCursor || null,
        status: "OK",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(metroSources.id, source.id));

    return { rowsFetched: result.rows.length, rowsInserted: inserted, rowsUpdated: updated };
  } catch (error: any) {
    const errMsg = error.message || String(error);

    await db
      .update(sourcePullRuns)
      .set({
        finishedAt: new Date(),
        status: "FAILED",
        errorMessage: errMsg,
      })
      .where(eq(sourcePullRuns.id, pullRun.id));

    await db
      .update(metroSources)
      .set({
        status: "ERROR",
        lastError: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(metroSources.id, source.id));

    return { rowsFetched: 0, rowsInserted: 0, rowsUpdated: 0, error: errMsg };
  }
}

const FREQ_MS: Record<string, number> = {
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

export async function runAllDue(): Promise<{ ran: number; results: any[] }> {
  const sources = await db
    .select()
    .from(metroSources)
    .where(
      and(eq(metroSources.enabled, true), sql`${metroSources.status} != 'DISABLED'`)
    );

  const now = Date.now();
  const results: any[] = [];

  for (const src of sources) {
    const interval = FREQ_MS[src.pullFrequency] || FREQ_MS.DAILY;
    const lastPull = src.lastPulledAt ? new Date(src.lastPulledAt).getTime() : 0;

    if (now - lastPull >= interval) {
      console.log(`[JobRunner] Pulling: ${src.name} (${src.sourceType})`);
      const r = await runPull(src);
      results.push({ sourceId: src.id, name: src.name, ...r });
    }
  }

  if (results.length > 0) {
    try {
      await updateAllSourceTrustScores();
    } catch (err: unknown) {
      console.error("[JobRunner] Trust score update failed:", err instanceof Error ? err.message : err);
    }
  }

  return { ran: results.length, results };
}
