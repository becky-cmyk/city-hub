import fs from "fs";
import path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { businessFaqs, businessExpertQa, contentTags, tags, regions, hubZipCoverage, entityMicroMap, categories, reviews, posts, publicUsers, cmsContentRelations, events, jobs, marketplaceListings, businesses, jobListings } from "@shared/schema";
import type { City, Event, Job, MarketplaceListing } from "@shared/schema";
import { pool } from "./db";
import { eq, asc, and, inArray, sql, desc } from "drizzle-orm";

interface SeriesRow { id: string; title: string; description: string | null; slug: string }
interface OccurrenceRow { id: string; title: string | null; slug: string; start_date_time: string; end_date_time: string | null; location_name: string | null; description: string | null; updated_at: string | null }
interface JsonLdObject { [key: string]: unknown }
import { getOgImageUrl } from "./og-image";
import { getCityBranding, getBrandForContext, type PageBrandContext } from "@shared/city-branding";

function computeCombinedAggregateRating(
  googleRating: string | null | undefined,
  googleReviewCount: number | null | undefined,
  hubAvgRating: number,
  hubCount: number,
): { ratingValue: number; reviewCount: number } | null {
  const gRating = googleRating ? parseFloat(googleRating) : 0;
  const gCount = googleReviewCount || 0;
  const totalCount = gCount + hubCount;
  if (totalCount === 0) return null;
  const combinedAvg = (gRating * gCount + hubAvgRating * hubCount) / totalCount;
  return { ratingValue: Number(combinedAvg.toFixed(1)), reviewCount: totalCount };
}

async function getApprovedReviewStats(businessId: string): Promise<{ avgRating: number; count: number }> {
  const [row] = await db
    .select({
      avgRating: sql<number>`COALESCE(AVG(${reviews.rating})::numeric(3,2), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.businessId, businessId), eq(reviews.status, "APPROVED")));
  return { avgRating: Number(row?.avgRating || 0), count: Number(row?.count || 0) };
}

let cachedTemplate: string | null = null;
const serverDir = typeof import.meta.dirname === "string" ? import.meta.dirname : __dirname;

function loadIndexHtmlTemplate(): string {
  if (cachedTemplate) return cachedTemplate;

  const candidates = [
    path.resolve(serverDir, "public", "index.html"),
    path.resolve(serverDir, "..", "dist", "client", "index.html"),
    path.resolve(serverDir, "..", "dist", "index.html"),
    path.resolve(serverDir, "..", "client", "index.html"),
    path.resolve(serverDir, "..", "index.html"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[SEO-SNAPSHOT] Loaded template from: ${p}`);
      cachedTemplate = fs.readFileSync(p, "utf-8");
      return cachedTemplate;
    }
  }

  console.error("[SEO-SNAPSHOT] Could not find index.html. Searched:", candidates);
  throw new Error("Could not find index.html template");
}

function resolvePublicBaseUrl(req?: Request, city?: any): string {
  if (city?.siteUrl) return city.siteUrl.replace(/\/$/, "");
  if (req) {
    const fwdHost = req.headers["x-forwarded-host"];
    const hostname = (typeof fwdHost === "string" ? fwdHost : req.hostname).split(":")[0].toLowerCase().replace(/^www\./, "");
    if (hostname && !hostname.includes("replit") && !hostname.includes("localhost") && !hostname.includes("127.0.0.1")) {
      return `https://${hostname}`;
    }
  }
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const port = process.env.PORT || "5000";
  return `http://127.0.0.1:${port}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface SeoFields {
  title: string;
  description: string;
  canonical: string;
  jsonLd: object | object[];
  rootHtml: string;
  ogImage?: string;
  keywords?: string;
  ogSiteName?: string;
  rssUrl?: string;
  rssTitle?: string;
}

function resolveBrand(citySlug: string, context: PageBrandContext) {
  const branding = getCityBranding(citySlug);
  if (!branding) {
    const fallbackName = citySlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) + " Metro Hub";
    return { ogSiteName: fallbackName, titleSuffix: `| ${fallbackName}`, jsonLdName: fallbackName, descriptionBrand: fallbackName, sameAs: [] as string[] };
  }
  return getBrandForContext(branding, context);
}

function buildHreflangTags(canonical: string): string {
  const enUrl = canonical.includes("?")
    ? canonical.replace(/[?&]lang=[^&]*/g, "").replace(/\?$/, "")
    : canonical;
  const separator = enUrl.includes("?") ? "&" : "?";
  const esUrl = `${enUrl}${separator}lang=es`;
  return [
    `<link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}">`,
    `<link rel="alternate" hreflang="es" href="${escapeHtml(esUrl)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(enUrl)}">`,
  ].join("\n");
}

function buildSeoHtml(template: string, fields: SeoFields): string {
  let html = template;

  html = html.replace(/<title[^>]*>.*?<\/title>/gi, '');
  html = html.replace(/<meta[^>]+name=["']description["'][^>]*>/gi, '');
  html = html.replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/<link[^>]+rel=["']alternate["'][^>]+hreflang[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+property=["']og:[^"']*["'][^>]*>/gi, '');
  html = html.replace(/<meta[^>]+name=["']twitter:[^"']*["'][^>]*>/gi, '');
  html = html.replace(/<script type=["']application\/ld\+json["']>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*>[\s\S]*?document\.documentElement\.classList\.add\('js'\)[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?html\.js #seo-snapshot[\s\S]*?<\/style>/gi, '');

  const ogTags: string[] = [
    `<meta property="og:title" content="${escapeHtml(fields.title)}">`,
    `<meta property="og:description" content="${escapeHtml(fields.description)}">`,
    `<meta property="og:url" content="${escapeHtml(fields.canonical)}">`,
    `<meta property="og:site_name" content="${escapeHtml(fields.ogSiteName || "CLT Metro Hub")}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(fields.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(fields.description)}">`,
  ];
  if (fields.ogImage) {
    ogTags.push(`<meta property="og:image" content="${escapeHtml(fields.ogImage)}">`);
    ogTags.push(`<meta property="og:image:width" content="1200">`);
    ogTags.push(`<meta property="og:image:height" content="630">`);
    ogTags.push(`<meta name="twitter:image" content="${escapeHtml(fields.ogImage)}">`);
  }

  const headInjection = [
    `<title>${escapeHtml(fields.title)}</title>`,
    `<meta name="description" content="${escapeHtml(fields.description)}">`,
    ...(fields.keywords ? [`<meta name="keywords" content="${escapeHtml(fields.keywords)}">`] : []),
    `<link rel="canonical" href="${escapeHtml(fields.canonical)}">`,
    buildHreflangTags(fields.canonical),
    ...ogTags,
    ...(fields.rssUrl ? [`<link rel="alternate" type="application/rss+xml" title="${escapeHtml(fields.rssTitle || "RSS Feed")}" href="${escapeHtml(fields.rssUrl)}">`] : []),
    `<script type="application/ld+json">${JSON.stringify(fields.jsonLd)}</script>`,
    `<script>document.documentElement.classList.add('js')</script>`,
    `<style>html.js #seo-snapshot{display:none}</style>`,
  ].join("\n");

  html = html.replace("</head>", `${headInjection}\n</head>`);

  html = html.replace(/<div id="root">[^]*?<\/div>/, `<div id="root"><div id="seo-snapshot">${fields.rootHtml}</div></div>`);

  return html;
}

const seoCache = new Map<string, { html: string; ts: number }>();
const CACHE_TTL = 60_000;

function getCached(key: string): string | null {
  const entry = seoCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.html;
  return null;
}

function setCache(key: string, html: string) {
  if (seoCache.size > 200) seoCache.clear();
  seoCache.set(key, { html, ts: Date.now() });
}

export function registerSeoSnapshotRoutes(app: Express) {
  app.get("/:citySlug/coming-soon", seoHandler);
  app.get("/:citySlug/pulse/post/:postId", seoHandler);
  app.get("/:citySlug/events/series/:seriesSlug", seoHandler);
  app.get("/:citySlug/events/:slug", seoHandler);
  app.get("/:citySlug/events", seoHandler);
  app.get("/:citySlug/jobs/:jobId", seoHandler);
  app.get("/:citySlug/jobs", seoHandler);
  app.get("/:citySlug/relocation/housing", seoHandler);
  app.get("/:citySlug/marketplace/:listingId", seoHandler);
  app.get("/:citySlug/marketplace", seoHandler);
  app.get("/:citySlug", seoHandler);
  app.get("/:citySlug/directory", seoHandler);
  app.get("/:citySlug/directory/:businessSlug", seoHandler);
  app.get("/:citySlug/presence/:slug", seoHandler);
  app.get("/:citySlug/neighborhoods/:code", seoHandler);
  app.get("/:citySlug/neighborhoods/:code/:categorySlug", seoHandler);
  app.get("/:citySlug/food", seoHandler);
  app.get("/:citySlug/arts-entertainment", seoHandler);
  app.get("/:citySlug/commerce", seoHandler);
  app.get("/:citySlug/senior", seoHandler);
  app.get("/:citySlug/seniors", seoHandler);
  app.get("/:citySlug/family", seoHandler);
  app.get("/:citySlug/families", seoHandler);
  app.get("/:citySlug/pets", seoHandler);
  app.get("/:citySlug/relocation", seoHandler);
  app.get("/:citySlug/speakers", seoHandler);
  app.get("/:citySlug/sources", seoHandler);
  app.get("/:citySlug/:hubSlug/food", seoHandler);
  app.get("/:citySlug/:hubSlug/arts-entertainment", seoHandler);
  app.get("/:citySlug/:hubSlug/commerce", seoHandler);
  app.get("/:citySlug/:hubSlug/senior", seoHandler);
  app.get("/:citySlug/:hubSlug/family", seoHandler);
  app.get("/:citySlug/:hubSlug/pets", seoHandler);
  app.get("/:citySlug/:hubSlug/relocation", seoHandler);
  app.get("/:citySlug/:hubSlug/speakers", seoHandler);
  app.get("/:citySlug/:hubSlug/sources", seoHandler);
  app.get("/:citySlug/:categorySlug/:businessSlug", seoHandler);
  app.get("/:citySlug/:categorySlug", seoHandler);
}

const CRAWLER_UA_RE = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|rogerbot|ia_archiver|sogou|exabot|petalbot|seznambot|archive\.org_bot/i;

function isCrawler(req: Request): boolean {
  const ua = req.headers["user-agent"] || "";
  return CRAWLER_UA_RE.test(ua);
}

async function seoHandler(req: Request, res: Response, next: NextFunction) {
  const citySlug = req.params.citySlug as string;

  if (!citySlug || citySlug === "admin" || citySlug === "api" || citySlug === "preview" || citySlug.includes(".")) {
    return next();
  }

  if (!isCrawler(req)) {
    return next();
  }

  const cacheKey = req.originalUrl;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.status(200).set({ "Content-Type": "text/html" }).end(cached);
  }

  try {
    const city = await storage.getCityBySlug(citySlug);
    if (!city) return next();

    let template: string;
    try {
      template = loadIndexHtmlTemplate();
    } catch {
      return next();
    }

    const baseUrl = resolvePublicBaseUrl(req, city);
    const businessSlug = req.params.businessSlug as string | undefined;
    const categorySlug = req.params.categorySlug as string | undefined;
    const zoneSlug = (Array.isArray(req.query.zone) ? req.query.zone[0] : req.query.zone) as string | undefined;
    const routePath = req.route?.path as string;

    let seoFields: SeoFields | null = null;

    if (routePath === "/:citySlug/events/series/:seriesSlug" && req.params.seriesSlug) {
      seoFields = await buildEventSeriesDetail(city, req.params.seriesSlug as string, baseUrl);
    } else if (routePath === "/:citySlug/events/:slug" && req.params.slug) {
      seoFields = await buildEventDetail(city, req.params.slug as string, baseUrl);
    } else if (routePath === "/:citySlug/events") {
      seoFields = await buildEventLanding(city, baseUrl);
    } else if (routePath === "/:citySlug/jobs/:jobId" && req.params.jobId) {
      seoFields = await buildJobDetail(city, req.params.jobId as string, baseUrl);
    } else if (routePath === "/:citySlug/jobs") {
      seoFields = await buildJobsLanding(city, baseUrl);
    } else if (routePath === "/:citySlug/relocation/housing") {
      seoFields = await buildHousingLanding(city, baseUrl);
    } else if (routePath === "/:citySlug/marketplace/:listingId" && req.params.listingId) {
      seoFields = await buildMarketplaceDetail(city, req.params.listingId as string, baseUrl);
    } else if (routePath === "/:citySlug/marketplace") {
      seoFields = await buildMarketplaceLanding(city, baseUrl);
    } else if (routePath === "/:citySlug/pulse/post/:postId" && req.params.postId) {
      seoFields = await buildPulsePostSeo(city, req.params.postId as string, baseUrl);
    } else if (routePath === "/:citySlug/directory/:businessSlug" && businessSlug) {
      seoFields = await buildBusinessDetail(city, businessSlug, baseUrl);
    } else if (routePath === "/:citySlug/directory") {
      if (zoneSlug) {
        seoFields = await buildZoneDirectory(city, zoneSlug, baseUrl);
      } else {
        seoFields = await buildDirectory(city, baseUrl);
      }
    } else if (routePath === "/:citySlug/presence/:slug" && req.params.slug) {
      seoFields = await buildMicrositePresence(city, req.params.slug as string, baseUrl);
    } else if (routePath === "/:citySlug/neighborhoods/:code/:categorySlug" && req.params.code && categorySlug) {
      seoFields = await buildNeighborhoodCategoryCross(city, req.params.code as string, categorySlug, baseUrl);
    } else if (routePath === "/:citySlug/neighborhoods/:code" && req.params.code) {
      seoFields = await buildNeighborhoodHub(city, req.params.code as string, baseUrl);
    } else if (routePath === "/:citySlug/food" || routePath === "/:citySlug/arts-entertainment" || routePath === "/:citySlug/commerce" || routePath === "/:citySlug/senior" || routePath === "/:citySlug/seniors" || routePath === "/:citySlug/family" || routePath === "/:citySlug/families" || routePath === "/:citySlug/pets" || routePath === "/:citySlug/relocation" || routePath === "/:citySlug/speakers" || routePath === "/:citySlug/sources") {
      const rawKey = routePath.replace("/:citySlug/", "");
      const vKey = rawKey === "seniors" ? "senior" : rawKey === "families" ? "family" : rawKey;
      seoFields = buildVerticalLanding(city, vKey, null, baseUrl);
    } else if (routePath === "/:citySlug/:hubSlug/food" || routePath === "/:citySlug/:hubSlug/arts-entertainment" || routePath === "/:citySlug/:hubSlug/commerce" || routePath === "/:citySlug/:hubSlug/senior" || routePath === "/:citySlug/:hubSlug/family" || routePath === "/:citySlug/:hubSlug/pets" || routePath === "/:citySlug/:hubSlug/relocation" || routePath === "/:citySlug/:hubSlug/speakers" || routePath === "/:citySlug/:hubSlug/sources") {
      const vKey = routePath.replace("/:citySlug/:hubSlug/", "");
      const hubSlug = req.params.hubSlug as string;
      seoFields = buildVerticalLanding(city, vKey, hubSlug, baseUrl);
    } else if (routePath === "/:citySlug/:categorySlug" && categorySlug) {
      seoFields = await buildCategoryHub(city, categorySlug, baseUrl);
      if (!seoFields) return next();
    } else if (routePath === "/:citySlug/coming-soon") {
      seoFields = buildComingSoon(city, baseUrl);
    } else if (routePath === "/:citySlug") {
      seoFields = await buildCityHome(city, baseUrl);
    }

    if (!seoFields) return next();

    const finalHtml = buildSeoHtml(template, seoFields);
    setCache(cacheKey, finalHtml);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
  } catch (err) {
    console.error("[SEO-SNAPSHOT] Error:", err);
    return next();
  }
}

async function loadLinkModules(city: any): Promise<{ categories: any[]; zones: any[]; featured: any[] }> {
  const [categories, zones, featured] = await Promise.all([
    storage.getAllCategories(),
    storage.getZonesByCityId(city.id),
    storage.getFeaturedBusinesses(city.id, 5).then(f =>
      f.length > 0 ? f : storage.getBusinessesByCityId(city.id).then(all => all.slice(0, 5))
    ),
  ]);
  return { categories, zones: zones.slice(0, 12), featured };
}

function renderLinkModules(city: any, modules: { categories: any[]; zones: any[]; featured: any[] }): string {
  const catLinks = modules.categories.map(c =>
    `<li><a href="/${city.slug}/${c.slug}">${escapeHtml(c.name)}</a></li>`
  ).join("\n");
  const zoneLinks = modules.zones.map(z =>
    `<li><a href="/${city.slug}/directory?zone=${z.slug}">${escapeHtml(z.name)}</a></li>`
  ).join("\n");
  const featLinks = modules.featured.map(b =>
    buildBusinessLinkHtml(city.slug, b, modules.categories)
  ).join("\n");
  return `<nav><h2>Explore Categories</h2><ul>${catLinks}</ul></nav>
<nav><h2>Explore Zones</h2><ul>${zoneLinks}</ul></nav>
<nav><h2>Featured Businesses</h2><ul>${featLinks}</ul></nav>`;
}

function makeBreadcrumbs(baseUrl: string, items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

function makeItemList(name: string, items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

const VERTICAL_SEO_META: Record<string, { label: string; description: string }> = {
  food: { label: "Food & Dining", description: "Discover the best restaurants, cafes, breweries, and food trucks." },
  "arts-entertainment": { label: "Arts & Entertainment", description: "Explore live music venues, theaters, galleries, museums, and cultural events." },
  commerce: { label: "Commerce & Business", description: "Find local businesses, professional services, and retail shops." },
  senior: { label: "Senior Living & Wellness", description: "Resources, health providers, and community programs for seniors." },
  family: { label: "Family & Kids", description: "Kid-friendly activities, schools, camps, and family fun." },
  pets: { label: "Pets & Animals", description: "Vets, groomers, dog parks, and pet-friendly businesses." },
  relocation: { label: "Relocation & Moving", description: "Neighborhood guides, real estate, and moving services for newcomers." },
  speakers: { label: "Speakers & Experts", description: "Local keynote speakers, panelists, and thought leaders." },
  sources: { label: "Local Sources", description: "Expert voices and community leaders available for media and interviews." },
};

function buildVerticalLanding(city: any, verticalKey: string, hubSlug: string | null, baseUrl: string): SeoFields {
  const vm = VERTICAL_SEO_META[verticalKey] || { label: verticalKey, description: "" };
  const brand = resolveBrand(city.slug, "landing");
  const hubLabel = hubSlug ? hubSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null;
  const titleParts = [vm.label];
  if (hubLabel) titleParts.push(`in ${hubLabel}`);
  titleParts.push(city.name);
  const title = `${titleParts.join(" — ")} ${brand.titleSuffix}`;
  const desc = `${vm.description} ${hubLabel ? `Serving ${hubLabel} and` : "Across"} the ${city.name} metro area. Powered by ${brand.descriptionBrand}.`;
  const canonPath = hubSlug ? `/${city.slug}/${hubSlug}/${verticalKey}` : `/${city.slug}/${verticalKey}`;
  const canonical = `${baseUrl}${canonPath}`;

  const howToSteps = [
    { name: `Visit the ${vm.label} page`, text: `Go to ${canonical} to browse ${vm.label.toLowerCase()} listings.` },
    { name: "Filter by neighborhood", text: `Use neighborhood filters to find ${vm.label.toLowerCase()} options near you.` },
    { name: "View details and connect", text: "Click any listing for full details, contact info, and reviews." },
  ];

  const locationName = hubLabel || city.name;
  const faqItems = [
    { q: `What ${vm.label.toLowerCase()} are available in ${locationName}?`, a: `${brand.descriptionBrand} lists ${vm.label.toLowerCase()} options across ${locationName} and the surrounding ${city.name} metro area. Browse by neighborhood to find what is closest to you.` },
    { q: `How do I find ${vm.label.toLowerCase()} near me in ${city.name}?`, a: `Visit ${canonical} and use the neighborhood filters to narrow results to your area. Each listing includes contact info, reviews, and directions.` },
    { q: `Is ${brand.descriptionBrand} free to use?`, a: `Yes, browsing and discovering local ${vm.label.toLowerCase()} on ${brand.descriptionBrand} is completely free for residents and visitors.` },
  ];

  const breadcrumbItems: { name: string; url: string }[] = [
    { name: city.name, url: `${baseUrl}/${city.slug}` },
  ];
  if (hubLabel) breadcrumbItems.push({ name: hubLabel, url: `${baseUrl}/${city.slug}/${hubSlug}` });
  breadcrumbItems.push({ name: vm.label, url: canonical });

  const faqHtml = faqItems.map(f =>
    `<div><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></div>`
  ).join("\n");

  return {
    title,
    description: desc,
    canonical,
    ogSiteName: brand.ogSiteName,
    keywords: `${vm.label}, ${city.name}, local businesses, events, ${verticalKey}`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description: desc,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: brand.jsonLdName, url: baseUrl },
        speakable: {
          "@type": "SpeakableSpecification",
          cssSelector: [".hub-description", ".faq-answer"],
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: `How to find ${vm.label.toLowerCase()} in ${locationName}`,
        description: `Use ${brand.descriptionBrand} to discover ${vm.label.toLowerCase()} across the ${city.name} metro area.`,
        step: howToSteps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      makeBreadcrumbs(baseUrl, breadcrumbItems),
    ],
    rootHtml: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(desc)}</p><section><h2>Frequently Asked Questions</h2>${faqHtml}</section>`,
  };
}

function buildComingSoon(city: any, baseUrl: string): SeoFields {
  const neighborhoods = [
    "Uptown", "South End", "NoDa", "Plaza Midwood", "Dilworth", "Myers Park", "Elizabeth",
    "Camp North End", "Steele Creek", "Ballantyne", "SouthPark", "University City", "Cotswold",
    "Huntersville", "Cornelius", "Davidson", "Matthews", "Mint Hill", "Pineville",
    "Concord", "Kannapolis", "Harrisburg", "Gastonia", "Belmont", "Mount Holly",
    "Rock Hill", "Fort Mill", "Tega Cay", "Lake Wylie", "Mooresville", "Statesville",
    "Waxhaw", "Indian Trail", "Monroe", "Salisbury", "Hickory", "Shelby",
    "Kings Mountain", "Morganton", "Lenoir", "Wadesboro", "Newton", "Cheraw",
  ];
  const neighborhoodLinks = neighborhoods.map(n =>
    `<li>${escapeHtml(n)}</li>`
  ).join("\n");

  const cltBranding = getCityBranding(city.slug);
  const homeBrand = resolveBrand(city.slug, "home");

  const faqItems = [
    { q: "What is CLT Metro Hub?", a: "CLT Metro Hub is Charlotte's neighborhood-first platform for discovering local businesses, events, community organizations, and real-time updates across 140+ Charlotte metro communities." },
    { q: "What Charlotte neighborhoods does CLT Metro Hub cover?", a: `CLT Metro Hub covers ${neighborhoods.length}+ communities including ${neighborhoods.slice(0, 10).join(", ")}, and more across 19 counties in NC and SC.` },
    { q: "How is CLT Metro Hub different from CLT Today or Charlotte's Got a Lot?", a: "Unlike newsletter-based platforms, CLT Metro Hub is organized geographically by neighborhood with a moderated Pulse feed where local businesses, events, and updates rotate for visibility." },
    { q: "How can my Charlotte business get listed?", a: "Local businesses can claim their presence through the Digital Card system, organized by neighborhood and category with featured placement options." },
  ];
  const faqHtml = faqItems.map(f =>
    `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`
  ).join("\n");

  return {
    title: `${homeBrand.ogSiteName} — Neighborhood Guide to Local Businesses, Events & Community | Charlotte NC`,
    description: `Discover Charlotte by neighborhood. ${homeBrand.descriptionBrand} connects you to local businesses, events, community organizations, and real-time updates across 140+ Charlotte metro communities in 19 counties — from NoDa to South End to Ballantyne.`,
    canonical: `${baseUrl}/${city.slug}/coming-soon`,
    ogSiteName: homeBrand.ogSiteName,
    ogImage: `${baseUrl}/favicon.png`,
    keywords: "Charlotte NC things to do, Charlotte local businesses, Charlotte neighborhoods, Charlotte events, Charlotte community, NoDa Charlotte, South End Charlotte, Plaza Midwood Charlotte, Ballantyne Charlotte, Charlotte NC directory, Charlotte local news, Charlotte business directory, Charlotte community events, Charlotte neighborhood guide, Charlotte NC local feed, Charlotte metro events, Charlotte restaurants, Charlotte arts culture, directorio de negocios Charlotte, eventos locales Charlotte NC, comunidad latina Charlotte, negocios hispanos Charlotte, plataforma bilingüe Charlotte, guía de vecindarios Charlotte, negocios locales Charlotte, eventos en Charlotte, qué hacer en Charlotte NC, directorio bilingüe Charlotte",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: homeBrand.jsonLdName,
        alternateName: homeBrand.ogSiteName !== homeBrand.jsonLdName ? homeBrand.ogSiteName : undefined,
        url: `${baseUrl}/${city.slug}`,
        description: "Charlotte's neighborhood-first platform for discovering local businesses, events, community organizations, and stories across the Charlotte metro.",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${baseUrl}/${city.slug}/directory?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: homeBrand.jsonLdName,
        alternateName: cltBranding ? cltBranding.brandVariants.filter(v => v !== homeBrand.jsonLdName) : ["CLT Metro Hub"],
        url: `${baseUrl}/${city.slug}`,
        logo: `${baseUrl}/favicon.png`,
        description: "Charlotte's neighborhood-first community platform connecting local businesses, events, and organizations across 140+ communities in 19 counties of the Charlotte metro region.",
        sameAs: homeBrand.sameAs,
        areaServed: { "@type": "City", name: "Charlotte", addressRegion: "NC", addressCountry: "US" },
        knowsAbout: ["Charlotte NC local businesses", "Charlotte events", "Charlotte neighborhoods", "Charlotte community organizations"],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      makeBreadcrumbs(baseUrl, [
        { name: city.name || city.slug, url: `${baseUrl}/${city.slug}` },
        { name: "Coming Soon", url: `${baseUrl}/${city.slug}/coming-soon` },
      ]),
    ],
    rootHtml: `<h1>CLT Metro Hub — Charlotte's Neighborhood-First Platform for Local Businesses, Events & Community</h1>
<p>Discover Charlotte by neighborhood. CLT Metro Hub connects you to local businesses, events, community organizations, and real-time updates across 140+ communities in 19 counties of the Charlotte metro region.</p>
<h2>What We Are</h2>
<p>CLT Metro Hub is where we stay connected to what's actually happening in our neighborhoods, corridors, and communities — without the noise of traditional social media. Instead of chasing scattered posts across different platforms, we scroll a moderated Pulse that brings together rotating business updates, upcoming events, organization highlights, and real local movement in one structured place.</p>
<h2>Charlotte Neighborhoods We Cover</h2>
<ul>${neighborhoodLinks}</ul>
<h2>Frequently Asked Questions</h2>
${faqHtml}
<p><a href="/${city.slug}">CLT Metro Hub</a> — Explore Charlotte's neighborhoods, local businesses, events, and community.</p>`,
  };
}

async function buildCityHome(city: any, baseUrl: string): Promise<SeoFields> {
  const modules = await loadLinkModules(city);
  const allBiz = modules.featured;
  const brand = resolveBrand(city.slug, "home");

  const bizLinks = allBiz.map(b =>
    buildBusinessLinkHtml(city.slug, b, modules.categories)
  ).join("\n");

  return {
    title: `${brand.ogSiteName} — Local Business Hub | ${city.name}`,
    description: `Discover businesses, events, and local highlights in ${city.name}. Powered by ${brand.descriptionBrand}.`,
    canonical: `${baseUrl}/${city.slug}`,
    ogSiteName: brand.ogSiteName,
    rssUrl: `${baseUrl}/api/cities/${city.slug}/rss`,
    rssTitle: `${city.name} Metro Hub RSS`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: brand.jsonLdName,
        url: baseUrl,
        sameAs: brand.sameAs,
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: brand.jsonLdName,
        url: `${baseUrl}/${city.slug}`,
        potentialAction: {
          "@type": "SearchAction",
          target: `${baseUrl}/${city.slug}/directory?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
      ]),
    ],
    rootHtml: `<h1>${escapeHtml(brand.ogSiteName)} — Local Business Hub</h1>
<p>Discover businesses, events, and local highlights in ${escapeHtml(city.name)}, ${escapeHtml(city.state || "")}.</p>
<ul>${bizLinks}</ul>
${renderLinkModules(city, modules)}`,
  };
}

async function buildDirectory(city: any, baseUrl: string): Promise<SeoFields> {
  const [allBiz, modules] = await Promise.all([
    storage.getBusinessesByCityId(city.id),
    loadLinkModules(city),
  ]);
  const businesses = allBiz.slice(0, 10);
  const total = allBiz.length;

  const bizLinks = businesses.map(b =>
    buildBusinessLinkHtml(city.slug, b, modules.categories)
  ).join("\n");

  const bizItems = businesses.map(b => {
    const cat = b.categoryIds?.length ? modules.categories.find((c: any) => b.categoryIds.includes(c.id)) : undefined;
    return { name: b.name, url: buildBusinessUrl(baseUrl, city.slug, b.slug, cat?.slug) };
  });

  const dirBrand = resolveBrand(city.slug, "category");
  return {
    title: `Directory | ${city.name} ${dirBrand.titleSuffix}`,
    description: `Browse businesses in ${city.name} by category and area. Powered by ${dirBrand.descriptionBrand}.`,
    canonical: `${baseUrl}/${city.slug}/directory`,
    ogSiteName: dirBrand.ogSiteName,
    jsonLd: [
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Directory", url: `${baseUrl}/${city.slug}/directory` },
      ]),
      makeItemList(`Businesses in ${city.name}`, bizItems),
    ],
    rootHtml: `<h1>${escapeHtml(city.name)} Business Directory</h1>
<p>Browse ${total} businesses in ${escapeHtml(city.name)} by category and area.</p>
<ul>${bizLinks}</ul>
${renderLinkModules(city, modules)}`,
  };
}

async function buildZoneDirectory(city: any, zoneSlug: string, baseUrl: string): Promise<SeoFields | null> {
  const zone = await storage.getZoneBySlug(city.id, zoneSlug);
  if (!zone) return null;

  const [businesses, modules] = await Promise.all([
    storage.getBusinessesByCityId(city.id, { zoneSlug }).then(b => b.slice(0, 10)),
    loadLinkModules(city),
  ]);

  const bizLinks = businesses.map(b =>
    buildBusinessLinkHtml(city.slug, b, modules.categories)
  ).join("\n");

  const bizItems = businesses.map(b => {
    const cat = b.categoryIds?.length ? modules.categories.find((c: any) => b.categoryIds.includes(c.id)) : undefined;
    return { name: b.name, url: buildBusinessUrl(baseUrl, city.slug, b.slug, cat?.slug) };
  });

  const zoneBrand = resolveBrand(city.slug, "hub");
  return {
    title: `${zone.name} Directory | ${city.name} ${zoneBrand.titleSuffix}`,
    description: `Businesses in ${zone.name}, ${city.name}. Find local listings on ${zoneBrand.descriptionBrand}.`,
    canonical: `${baseUrl}/${city.slug}/directory?zone=${zoneSlug}`,
    ogSiteName: zoneBrand.ogSiteName,
    jsonLd: [
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Directory", url: `${baseUrl}/${city.slug}/directory` },
        { name: zone.name, url: `${baseUrl}/${city.slug}/directory?zone=${zoneSlug}` },
      ]),
      makeItemList(`Businesses in ${zone.name}`, bizItems),
    ],
    rootHtml: `<h1>${escapeHtml(zone.name)} — ${escapeHtml(city.name)} Directory</h1>
<p>Businesses in ${escapeHtml(zone.name)}, ${escapeHtml(city.name)}.</p>
<ul>${bizLinks}</ul>
${renderLinkModules(city, modules)}`,
  };
}

async function buildNeighborhoodHub(city: any, code: string, baseUrl: string): Promise<SeoFields | null> {
  const upperCode = code.toUpperCase();
  const [hub] = await db.select().from(regions).where(
    and(eq(regions.code, upperCode), eq(regions.regionType, "hub"))
  );
  if (!hub) return null;

  const coverageRows = await db.select().from(hubZipCoverage).where(eq(hubZipCoverage.hubRegionId, hub.id));
  const hubZips = coverageRows.map(r => r.zip);

  const [allBiz, modules, allHubs, hubEvents, hubArticles] = await Promise.all([
    storage.getBusinessesByCityId(city.id),
    loadLinkModules(city),
    db.select().from(regions).where(eq(regions.regionType, "hub")),
    storage.getEventsByCityId(city.id).then(evts => evts.filter((e: any) => e.zip && hubZips.includes(e.zip)).slice(0, 5)).catch(() => []),
    storage.getArticlesByCityId(city.id).then(arts => arts.filter((a: any) => {
      const mIds = (a as any).mentionedBusinessIds || [];
      return mIds.length > 0;
    }).slice(0, 5)).catch(() => []),
  ]);

  const hubBizAll = allBiz.filter(b => b.zip && hubZips.includes(b.zip));
  const businesses = hubBizAll.slice(0, 10);
  const bizCount = hubBizAll.length;

  const parent = hub.parentRegionId
    ? (await db.select().from(regions).where(eq(regions.id, hub.parentRegionId)))[0] || null
    : null;

  const bizLinks = businesses.map(b =>
    buildBusinessLinkHtml(city.slug, b, modules.categories)
  ).join("\n");

  const bizItems = businesses.map(b => {
    const cat = b.categoryIds?.length ? modules.categories.find((c: any) => b.categoryIds.includes(c.id)) : undefined;
    return { name: b.name, url: buildBusinessUrl(baseUrl, city.slug, b.slug, cat?.slug) };
  });

  const canonical = `${baseUrl}/${city.slug}/neighborhoods/${code}`;

  const hubLat = hub.centerLat ? parseFloat(hub.centerLat) : null;
  const hubLng = hub.centerLng ? parseFloat(hub.centerLng) : null;
  const nearbyHubs = allHubs.filter(h => {
    if (h.id === hub.id) return false;
    if (hub.parentRegionId && h.parentRegionId === hub.parentRegionId) return true;
    if (hubLat != null && hubLng != null && h.centerLat && h.centerLng) {
      const dLat = hubLat - parseFloat(h.centerLat);
      const dLng = hubLng - parseFloat(h.centerLng);
      const rough = Math.sqrt(dLat * dLat + dLng * dLng) * 69;
      return rough < 15;
    }
    return false;
  }).slice(0, 8);

  const rootParts: string[] = [];
  rootParts.push(`<h1>Things to Do in ${escapeHtml(hub.name)}, ${escapeHtml(city.name)}</h1>`);
  rootParts.push(`<p class="hub-description">Explore ${escapeHtml(hub.name)} in ${escapeHtml(city.name)}. Discover ${bizCount} local businesses, upcoming events, and community stories in ${escapeHtml(hub.name)}.</p>`);
  if (hub.description) {
    rootParts.push(`<p class="hub-description">${escapeHtml(hub.description)}</p>`);
  }
  if (parent) {
    rootParts.push(`<p>${escapeHtml(parent.name)} County, ${escapeHtml(city.name)} Metro</p>`);
  }
  rootParts.push(`<ul>${bizLinks}</ul>`);

  if (nearbyHubs.length > 0) {
    const nearbyLinks = nearbyHubs.map(h =>
      `<li><a href="/${city.slug}/neighborhoods/${(h.code || "").toLowerCase()}">${escapeHtml(h.name)}</a></li>`
    ).join("\n");
    rootParts.push(`<nav aria-label="Nearby Neighborhoods"><h2>Nearby Neighborhoods</h2><ul>${nearbyLinks}</ul></nav>`);
  }

  rootParts.push(`<nav><h2>Explore More</h2><ul>`);
  rootParts.push(`<li><a href="/${city.slug}/directory">${escapeHtml(city.name)} Directory</a></li>`);
  rootParts.push(`<li><a href="/${city.slug}/neighborhoods">All Neighborhoods</a></li>`);
  rootParts.push(`<li><a href="/${city.slug}">${escapeHtml(city.name)} Home</a></li>`);
  rootParts.push(`</ul></nav>`);
  rootParts.push(renderLinkModules(city, modules));

  let authorityJsonLd: any[] = [];
  try {
    const { getTopAuthoritiesForHub } = await import("./services/hub-authority");
    const authorities = await getTopAuthoritiesForHub(city.id, upperCode, 5);
    if (authorities.length > 0) {
      authorityJsonLd = [{
        "@type": "ItemList",
        name: `Top Categories in ${hub.name}`,
        itemListElement: authorities.map((auth, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          item: {
            "@type": "Thing",
            name: auth.categoryName,
            url: `${baseUrl}/${city.slug}/neighborhoods/${code}/${auth.categorySlug}`,
            description: `#${auth.rank} in ${city.name} metro for ${auth.categoryName} with ${auth.bizCount} businesses`,
          },
        })),
      }];
      const authHtml = authorities.map(auth =>
        `<li><a href="/${city.slug}/neighborhoods/${code}/${auth.categorySlug}">#${auth.rank} ${escapeHtml(auth.categoryName)} (${auth.bizCount} businesses)</a></li>`
      ).join("");
      rootParts.push(`<nav><h2>Top Ranked Categories</h2><ul>${authHtml}</ul></nav>`);
    }
  } catch (e) {
    console.error("[SEO] Hub authority fetch failed:", e instanceof Error ? e.message : e);
  }

  const hubBrand = resolveBrand(city.slug, "hub");

  const placeJsonLd: any = {
    "@context": "https://schema.org",
    "@type": ["Place", "AboutPage"],
    "@id": canonical,
    name: hub.name,
    description: hub.description || `${hub.name} neighborhood in ${city.name}`,
    url: canonical,
    containedInPlace: {
      "@type": "City",
      name: city.name,
    },
    sameAs: canonical,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".hub-description", ".faq-answer"],
    },
  };
  if (Number.isFinite(hubLat) && Number.isFinite(hubLng)) {
    placeJsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: hubLat,
      longitude: hubLng,
    };
  }
  if (hub.address || city.name) {
    placeJsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: hub.name,
      addressRegion: city.state || "NC",
      addressCountry: "US",
    };
  }

  const catCounts: Record<string, number> = {};
  for (const b of hubBizAll) {
    for (const cid of (b.categoryIds || [])) {
      catCounts[cid] = (catCounts[cid] || 0) + 1;
    }
  }
  const datasetJsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${hub.name} Area Facts & Business Data`,
    description: `Aggregate business counts, category rankings, and area data for ${hub.name} in ${city.name}. ${bizCount} businesses across ${Object.keys(catCounts).length} categories.`,
    spatialCoverage: {
      "@type": "Place",
      name: hub.name,
      ...(Number.isFinite(hubLat) && Number.isFinite(hubLng) ? {
        geo: { "@type": "GeoCoordinates", latitude: hubLat, longitude: hubLng },
      } : {}),
    },
    temporalCoverage: "2024/2026",
    distribution: {
      "@type": "DataDownload",
      contentUrl: `${baseUrl}/api/cities/${city.slug}/neighborhoods/${code}`,
      encodingFormat: "application/json",
    },
  };

  const eventCrossLinkJsonLd: any[] = [];
  const bizById = new Map(hubBizAll.map(b => [b.id, b]));
  for (const evt of hubEvents) {
    const evtLd: any = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: evt.title,
      url: `${baseUrl}/${city.slug}/events/${evt.slug}`,
      ...(evt.startDateTime && { startDate: new Date(evt.startDateTime).toISOString() }),
      ...(evt.endDateTime && { endDate: new Date(evt.endDateTime).toISOString() }),
    };
    if ((evt as any).sourceUrl) evtLd.sameAs = (evt as any).sourceUrl;
    const hostBiz = (evt as any).hostBusinessId ? bizById.get((evt as any).hostBusinessId) : null;
    if (hostBiz) {
      const hostCat = hostBiz.categoryIds?.length ? modules.categories.find((c: any) => hostBiz.categoryIds.includes(c.id)) : undefined;
      const hostUrl = buildBusinessUrl(baseUrl, city.slug, hostBiz.slug, hostCat?.slug);
      evtLd.organizer = { "@type": "LocalBusiness", name: hostBiz.name, "@id": hostUrl };
      evtLd.location = { "@type": "Place", name: hostBiz.name, address: hostBiz.address || "" };
    } else if ((evt as any).locationName) {
      evtLd.location = { "@type": "Place", name: (evt as any).locationName };
    }
    eventCrossLinkJsonLd.push(evtLd);
  }

  const articleCrossLinkJsonLd: any[] = [];
  for (const art of hubArticles) {
    const mentionedIds: string[] = (art as any).mentionedBusinessIds || [];
    const mentions = mentionedIds.map(mid => bizById.get(mid)).filter(Boolean).map((mb: any) => {
      const mbCat = mb.categoryIds?.length ? modules.categories.find((c: any) => mb.categoryIds.includes(c.id)) : undefined;
      return { "@type": "LocalBusiness", name: mb.name, "@id": buildBusinessUrl(baseUrl, city.slug, mb.slug, mbCat?.slug) };
    });
    if (mentions.length > 0) {
      articleCrossLinkJsonLd.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: art.title,
        url: `${baseUrl}/${city.slug}/articles/${art.slug}`,
        mentions,
      });
    }
  }

  return {
    title: `Things to Do in ${hub.name}, ${city.name} ${hubBrand.titleSuffix}`,
    description: `Explore ${hub.name} in ${city.name}. Discover ${bizCount} local businesses, upcoming events, and community stories in ${hub.name}. ${hubBrand.descriptionBrand}.`,
    canonical,
    ogSiteName: hubBrand.ogSiteName,
    rssUrl: `${baseUrl}/api/cities/${city.slug}/hubs/${code}/rss`,
    rssTitle: `${hub.name} — ${city.name} Metro Hub RSS`,
    jsonLd: [
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Neighborhoods", url: `${baseUrl}/${city.slug}/neighborhoods` },
        { name: hub.name, url: canonical },
      ]),
      makeItemList(`Businesses in ${hub.name}, ${city.name}`, bizItems),
      ...authorityJsonLd,
      placeJsonLd,
      datasetJsonLd,
      ...eventCrossLinkJsonLd,
      ...articleCrossLinkJsonLd,
    ],
    rootHtml: rootParts.join("\n"),
  };
}

async function buildCategoryHub(city: any, categorySlug: string, baseUrl: string): Promise<SeoFields | null> {
  const category = await storage.getCategoryBySlug(categorySlug);
  if (!category) return null;

  const [allCatBiz, modules, allCategories] = await Promise.all([
    storage.getBusinessesByCategory(city.id, category.id),
    loadLinkModules(city),
    storage.getAllCategories(),
  ]);
  const businesses = allCatBiz.slice(0, 10);
  const totalBiz = allCatBiz.length;
  const stateName = city.state || "NC";

  const parentCategory = category.parentCategoryId
    ? allCategories.find((c: any) => c.id === category.parentCategoryId)
    : null;
  const siblingCategories = category.parentCategoryId
    ? allCategories.filter((c: any) => c.parentCategoryId === category.parentCategoryId && c.id !== category.id)
    : allCategories.filter((c: any) => !c.parentCategoryId && c.id !== category.id);

  const bizLinks = businesses.map(b =>
    buildBusinessLinkHtml(city.slug, b, allCategories)
  ).join("\n");

  const bizItems = businesses.map(b => {
    return { name: b.name, url: buildBusinessUrl(baseUrl, city.slug, b.slug, categorySlug) };
  });

  const siblingLinks = siblingCategories.slice(0, 8).map((c: any) =>
    `<li><a href="/${city.slug}/${c.slug}">${escapeHtml(c.name)}</a></li>`
  ).join("\n");

  const breadcrumbItems: { name: string; url: string }[] = [
    { name: city.name, url: `${baseUrl}/${city.slug}` },
    { name: "Directory", url: `${baseUrl}/${city.slug}/directory` },
  ];
  if (parentCategory) {
    breadcrumbItems.push({ name: parentCategory.name, url: `${baseUrl}/${city.slug}/${parentCategory.slug}` });
  }
  breadcrumbItems.push({ name: category.name, url: `${baseUrl}/${city.slug}/${categorySlug}` });

  const rootParts: string[] = [];
  rootParts.push(`<h1>${escapeHtml(category.name)} in ${escapeHtml(city.name)}</h1>`);
  rootParts.push(`<p>Find the best ${escapeHtml(category.name.toLowerCase())} in ${escapeHtml(city.name)}. Browse ${totalBiz} local ${escapeHtml(category.name.toLowerCase())} listings with reviews, photos, and more.</p>`);
  if (parentCategory) {
    rootParts.push(`<p>Part of <a href="/${city.slug}/${parentCategory.slug}">${escapeHtml(parentCategory.name)}</a></p>`);
  }
  rootParts.push(`<ul>${bizLinks}</ul>`);
  if (siblingLinks) {
    rootParts.push(`<nav><h2>Related Categories</h2><ul>${siblingLinks}</ul></nav>`);
  }
  rootParts.push(renderLinkModules(city, modules));

  const catBrand = resolveBrand(city.slug, "category");
  return {
    title: `Best ${category.name} in ${city.name}, ${stateName} ${catBrand.titleSuffix}`,
    description: `Find the best ${category.name.toLowerCase()} in ${city.name}. Browse ${totalBiz} local ${category.name.toLowerCase()} listings with reviews, photos, and more. ${catBrand.descriptionBrand}.`,
    canonical: `${baseUrl}/${city.slug}/${categorySlug}`,
    ogSiteName: catBrand.ogSiteName,
    jsonLd: [
      makeBreadcrumbs(baseUrl, breadcrumbItems),
      makeItemList(`${category.name} in ${city.name}`, bizItems),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

const CATEGORY_SCHEMA_MAP: Record<string, string> = {
  "restaurants": "Restaurant",
  "food": "FoodEstablishment",
  "food-drink": "FoodEstablishment",
  "bars": "BarOrPub",
  "cafes": "CafeOrCoffeeShop",
  "bakeries": "Bakery",
  "health": "HealthAndBeautyBusiness",
  "health-beauty": "HealthAndBeautyBusiness",
  "beauty": "HealthAndBeautyBusiness",
  "spa": "HealthAndBeautyBusiness",
  "fitness": "HealthAndBeautyBusiness",
  "dental": "Dentist",
  "medical": "MedicalBusiness",
  "legal": "LegalService",
  "attorneys": "LegalService",
  "law": "LegalService",
  "automotive": "AutomotiveBusiness",
  "auto": "AutomotiveBusiness",
  "car-dealers": "AutoDealer",
  "auto-repair": "AutoRepair",
  "real-estate": "RealEstateAgent",
  "realtors": "RealEstateAgent",
  "home-services": "HomeAndConstructionBusiness",
  "plumbing": "Plumber",
  "electricians": "Electrician",
  "roofing": "RoofingContractor",
  "hvac": "HVACBusiness",
  "hotels": "Hotel",
  "lodging": "LodgingBusiness",
  "insurance": "InsuranceAgency",
  "accounting": "AccountingService",
  "pet-services": "PetStore",
  "veterinary": "Veterinarycare",
  "education": "EducationalOrganization",
  "childcare": "ChildCare",
  "shopping": "Store",
  "retail": "Store",
  "clothing": "ClothingStore",
  "jewelry": "JewelryStore",
  "electronics": "ElectronicsStore",
  "grocery": "GroceryStore",
  "florists": "Florist",
  "travel": "TravelAgency",
  "entertainment": "EntertainmentBusiness",
  "nightlife": "NightClub",
  "financial": "FinancialService",
  "banking": "BankOrCreditUnion",
};

const RESTAURANT_SLUGS = new Set(["restaurants", "food", "food-drink", "cafes", "bakeries", "bars"]);

function resolveSchemaType(categories: any[], categoryIds: string[], isNonprofit?: boolean): string {
  if (isNonprofit) return "NGO";
  const matched = categories.filter(c => categoryIds.includes(c.id));
  for (const cat of matched) {
    if (CATEGORY_SCHEMA_MAP[cat.slug]) return CATEGORY_SCHEMA_MAP[cat.slug];
  }
  return "LocalBusiness";
}

const DAY_MAP: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

function convertTimeTo24(t: string): string {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return t.trim();
  let h = parseInt(m[1]);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${min}`;
}

function buildOpeningHoursSpec(hoursData: Record<string, string> | null | undefined): any[] {
  if (!hoursData) return [];
  return Object.entries(hoursData)
    .filter(([, val]) => val && val.toLowerCase() !== "closed")
    .map(([day, val]) => {
      const dayName = DAY_MAP[day.toLowerCase()] || day;
      const parts = val.split(/\s*[-–]\s*/);
      if (parts.length === 2) {
        return {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: dayName,
          opens: convertTimeTo24(parts[0]),
          closes: convertTimeTo24(parts[1]),
        };
      }
      return null;
    }).filter(Boolean);
}

function buildGeoSchema(biz: any): any | null {
  if (Number.isFinite(parseFloat(biz.latitude)) && Number.isFinite(parseFloat(biz.longitude))) {
    return {
      "@type": "GeoCoordinates",
      latitude: parseFloat(biz.latitude),
      longitude: parseFloat(biz.longitude),
    };
  }
  return null;
}

function buildVideoSchema(biz: any): any | null {
  const youtubeUrl = biz.youtubeUrl;
  if (!youtubeUrl) return null;
  const match = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (!match) return null;
  const embedUrl = `https://www.youtube.com/embed/${match[1]}`;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${biz.name} Video`,
    description: biz.description?.slice(0, 200) || `Video for ${biz.name}`,
    embedUrl,
    contentUrl: youtubeUrl,
    ...(biz.imageUrl && { thumbnailUrl: biz.imageUrl }),
    uploadDate: biz.createdAt ? new Date(biz.createdAt).toISOString() : new Date().toISOString(),
  };
}

function applySchemaEnhancements(jsonLdBiz: any, biz: any): void {
  const hoursSpec = buildOpeningHoursSpec(biz.hoursOfOperation);
  if (hoursSpec.length > 0) {
    jsonLdBiz.openingHoursSpecification = hoursSpec;
  }

  const geo = buildGeoSchema(biz);
  if (geo) {
    jsonLdBiz.geo = geo;
  }

  if (biz.googleMapsUrl) {
    jsonLdBiz.hasMap = biz.googleMapsUrl;
  }

  const langs: string[] = biz.languagesSpoken || [];
  if (langs.length > 0) {
    jsonLdBiz.knowsLanguage = langs;
  }
}

function isRestaurantBusiness(categories: any[], categoryIds: string[]): boolean {
  return categories.some(c => categoryIds.includes(c.id) && RESTAURANT_SLUGS.has(c.slug));
}

async function buildMicrositePresence(city: any, slug: string, baseUrl: string): Promise<SeoFields | null> {
  const biz = await storage.getBusinessBySlug(city.id, slug);
  if (!biz) return null;

  const [categories, zones, faqs, services, expertQas, bizContentTags] = await Promise.all([
    storage.getAllCategories(),
    storage.getZonesByCityId(city.id),
    db.select().from(businessFaqs).where(eq(businessFaqs.businessId, biz.id)).orderBy(asc(businessFaqs.sortOrder)),
    storage.getPresenceServices(biz.id),
    db.select().from(businessExpertQa).where(and(eq(businessExpertQa.businessId, biz.id), eq(businessExpertQa.isPublished, true))).orderBy(asc(businessExpertQa.sortOrder)),
    db.select({ tagName: tags.name }).from(contentTags).innerJoin(tags, eq(contentTags.tagId, tags.id)).where(and(eq(contentTags.contentType, "business"), eq(contentTags.contentId, biz.id))),
  ]);

  const category = biz.categoryIds?.length ? categories.find(c => biz.categoryIds.includes(c.id)) : undefined;
  const zone = zones.find(z => z.id === biz.zoneId);

  const descText = biz.description || "";
  const tagline = (biz as any).micrositeTagline || "";
  const metaDesc = tagline
    ? `${tagline.slice(0, 140)}${zone ? ` — ${zone.name}` : ""}`
    : descText
      ? `${descText.slice(0, 140)}${zone ? ` — ${zone.name}` : ""}`
      : `${biz.name} in ${zone?.name || city.name}. Find details, services, and FAQs.`;

  const canonical = `${baseUrl}/${city.slug}/presence/${slug}`;

  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(biz.name)}</h1>`);
  if (tagline) parts.push(`<p>${escapeHtml(tagline)}</p>`);
  if (descText) parts.push(`<p>${escapeHtml(descText.slice(0, 500))}</p>`);
  if (biz.address) parts.push(`<p>Address: ${escapeHtml(biz.address)}</p>`);
  if (biz.phone) parts.push(`<p>Phone: ${escapeHtml(biz.phone)}</p>`);
  if (biz.websiteUrl) parts.push(`<p><a href="${escapeHtml(biz.websiteUrl)}">Visit website</a></p>`);
  if (category) parts.push(`<p>Category: <a href="/${city.slug}/${category.slug}">${escapeHtml(category.name)}</a></p>`);
  if (zone) parts.push(`<p>Neighborhood: <a href="/${city.slug}/directory?zone=${zone.slug}">${escapeHtml(zone.name)}</a></p>`);

  if (services.length > 0) {
    const svcItems = services.map(s => `<li>${escapeHtml(s.serviceName)}</li>`).join("\n");
    parts.push(`<section><h2>Services</h2><ul>${svcItems}</ul></section>`);
  }

  const allFaqItems: { question: string; answer: string }[] = [...faqs];

  const micrositeBlocks = (biz as any).micrositeBlocks as any[] | null;
  if (micrositeBlocks && Array.isArray(micrositeBlocks)) {
    const faqBlock = micrositeBlocks.find((b: any) => b.type === "faq" && b.enabled);
    if (faqBlock?.content?.items) {
      const existingQuestions = new Set(allFaqItems.map(f => f.question.toLowerCase().trim()));
      for (const item of faqBlock.content.items) {
        const rawQ = item.question ?? item.q ?? "";
        const rawA = item.answer ?? item.a ?? "";
        const q = typeof rawQ === "string" ? rawQ.trim() : (typeof rawQ === "object" && rawQ?.en ? String(rawQ.en).trim() : "");
        const a = typeof rawA === "string" ? rawA.trim() : (typeof rawA === "object" && rawA?.en ? String(rawA.en).trim() : "");
        const normalizedQ = q.toLowerCase();
        if (q && a && !existingQuestions.has(normalizedQ)) {
          existingQuestions.add(normalizedQ);
          allFaqItems.push({ question: q, answer: a });
        }
      }
    }
  }

  for (const eqa of expertQas) {
    if (eqa.question && eqa.answer) {
      const normalizedQ = eqa.question.toLowerCase().trim();
      const existingQuestions = new Set(allFaqItems.map(f => f.question.toLowerCase().trim()));
      if (!existingQuestions.has(normalizedQ)) {
        allFaqItems.push({ question: eqa.question, answer: eqa.answer });
      }
    }
  }

  if (allFaqItems.length > 0) {
    const faqHtml = allFaqItems.filter(f => f.question && f.answer).map(f =>
      `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer!)}</p></div>`
    ).join("\n");
    parts.push(`<section><h2>Frequently Asked Questions about ${escapeHtml(biz.name)}</h2>${faqHtml}</section>`);
  }

  if (expertQas.length > 0) {
    const expertHtml = expertQas.filter(e => e.answer).map(e =>
      `<div><h3>${escapeHtml(e.question)}</h3><p>${escapeHtml(e.answer!)}</p>${e.askedByName ? `<p>Asked by ${escapeHtml(e.askedByName)}</p>` : ""}</div>`
    ).join("\n");
    if (expertHtml) parts.push(`<section><h2>Expert Q&amp;A</h2>${expertHtml}</section>`);
  }

  parts.push(`<nav><h2>Explore More</h2><ul>`);
  parts.push(`<li><a href="/${city.slug}/directory">Back to Directory</a></li>`);
  if (zone) parts.push(`<li><a href="/${city.slug}/directory?zone=${zone.slug}">${escapeHtml(zone.name)} Directory</a></li>`);
  if (category) parts.push(`<li><a href="/${city.slug}/${category.slug}">${escapeHtml(category.name)} Hub</a></li>`);
  parts.push(`</ul></nav>`);

  const micrositeSchemaType = resolveSchemaType(categories, biz.categoryIds || [], (biz as any).isNonprofit);
  const micrositeIsRestaurant = isRestaurantBusiness(categories, biz.categoryIds || []);

  const jsonLdBiz: any = {
    "@context": "https://schema.org",
    "@type": micrositeSchemaType,
    name: biz.name,
    url: canonical,
  };
  if (biz.address) {
    jsonLdBiz.address = {
      "@type": "PostalAddress",
      streetAddress: biz.address,
      addressLocality: biz.city || city.name,
      addressRegion: biz.state || "",
      postalCode: biz.zip || "",
      addressCountry: "US",
    };
  }
  if (biz.phone) jsonLdBiz.telephone = biz.phone;
  {
    const sameAsUrls: string[] = [];
    if (biz.websiteUrl) sameAsUrls.push(biz.websiteUrl);
    if ((biz as any).googleProfileUrl) sameAsUrls.push((biz as any).googleProfileUrl);
    if ((biz as any).googlePlaceId) sameAsUrls.push(`https://www.google.com/maps/place/?q=place_id:${(biz as any).googlePlaceId}`);
    if ((biz as any).sourceUrl) sameAsUrls.push((biz as any).sourceUrl);
    if (sameAsUrls.length === 1) jsonLdBiz.sameAs = sameAsUrls[0];
    else if (sameAsUrls.length > 1) jsonLdBiz.sameAs = sameAsUrls;
  }
  if (descText) jsonLdBiz.description = descText.slice(0, 300);
  if (biz.updatedAt) jsonLdBiz.dateModified = new Date(biz.updatedAt).toISOString();
  {
    const hubStats = await getApprovedReviewStats(biz.id);
    const combined = computeCombinedAggregateRating(
      (biz as any).googleRating,
      (biz as any).googleReviewCount,
      hubStats.avgRating,
      hubStats.count,
    );
    if (combined) {
      jsonLdBiz.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: combined.ratingValue,
        reviewCount: combined.reviewCount,
      };
    }
  }
  if ((biz as any).priceRange) {
    jsonLdBiz.priceRange = "$".repeat((biz as any).priceRange);
  }
  if ((biz as any).isServiceArea && (biz as any).serviceAreaZoneIds?.length) {
    const serviceZones = zones.filter((z: any) => (biz as any).serviceAreaZoneIds.includes(z.id));
    if (serviceZones.length > 0) {
      jsonLdBiz.areaServed = serviceZones.map((z: any) => ({ "@type": "City", name: z.name }));
    }
  }
  if (micrositeIsRestaurant && biz.websiteUrl) {
    jsonLdBiz.hasMenu = biz.websiteUrl;
  }
  applySchemaEnhancements(jsonLdBiz, biz);

  jsonLdBiz.speakable = {
    "@type": "SpeakableSpecification",
    cssSelector: [".biz-description", ".faq-answer"],
  };

  const microMappings = await db.select().from(entityMicroMap).where(eq(entityMicroMap.entityId, biz.id));
  let microTagNames: string[] = [];
  if (microMappings.length > 0) {
    const microCatIds = microMappings.map(m => m.categoryId);
    const microCats = await db.select().from(categories).where(inArray(categories.id, microCatIds));
    microTagNames = microCats.map(c => c.name);
  }

  const allServiceNames = [
    ...microTagNames,
    ...((biz as any).micrositeServices || []),
    ...services.map(s => s.serviceName),
  ];

  if (allServiceNames.length > 0) {
    jsonLdBiz.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `${biz.name} Services`,
      itemListElement: allServiceNames.map(name => ({
        "@type": "OfferCatalog",
        name,
        itemListElement: [{
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name,
          },
        }],
      })),
    };
  }

  if (microTagNames.length > 0) {
    const tagItems = microTagNames.map(name => `<li>${escapeHtml(name)}</li>`).join("\n");
    parts.push(`<section><h2>Services &amp; Specialties</h2><ul>${tagItems}</ul></section>`);
  }

  const expertTopics = bizContentTags.map(ct => ct.tagName);
  if (expertTopics.length > 0) {
    jsonLdBiz.knowsAbout = expertTopics;
    const topicItems = expertTopics.map(t => `<li>${escapeHtml(t)}</li>`).join("\n");
    parts.push(`<section><h2>Expert In</h2><ul>${topicItems}</ul></section>`);
  }

  const jsonLd: any[] = [jsonLdBiz];

  const videoSchema = buildVideoSchema(biz);
  if (videoSchema) jsonLd.push(videoSchema);

  if (allFaqItems.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: allFaqItems.map(f => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
    });
  }

  const breadcrumbItems: { name: string; url: string }[] = [
    { name: city.name, url: `${baseUrl}/${city.slug}` },
  ];
  if (zone) breadcrumbItems.push({ name: zone.name, url: `${baseUrl}/${city.slug}/directory?zone=${zone.slug}` });
  if (category) breadcrumbItems.push({ name: category.name, url: `${baseUrl}/${city.slug}/${category.slug}` });
  breadcrumbItems.push({ name: biz.name, url: canonical });
  jsonLd.push(makeBreadcrumbs(baseUrl, breadcrumbItems));

  const micrositeBlocks2 = (biz as any).micrositeBlocks as any[] | null;
  if (micrositeBlocks2 && Array.isArray(micrositeBlocks2)) {
    const expertBlock = micrositeBlocks2.find((b: any) => b.type === "expert" && b.enabled);
    if (expertBlock) {
      const personLd: any = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: biz.name,
      };
      const meta = (expertBlock as any).metadata || {};
      const creds = (meta.credentials || []) as string[];
      if (creds.length > 0) personLd.hasCredential = creds.map((c: string) => ({ "@type": "EducationalOccupationalCredential", credentialCategory: c }));
      const topics = (expertBlock.content?.items || []) as any[];
      if (topics.length > 0) personLd.knowsAbout = topics.map((t: any) => t.topic || "").filter(Boolean);
      if (zone) personLd.areaServed = { "@type": "Place", name: zone.name };
      if ((biz as any).executiveDirectorTitle) personLd.jobTitle = (biz as any).executiveDirectorTitle;
      personLd.worksFor = { "@type": "Organization", name: biz.name, url: canonical };
      jsonLd.push(personLd);
    }
  }

  if ((biz as any).charlotteVerificationStatus === "verified") {
    const hubBrandCr = resolveBrand(city.slug, "hub");
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      claimReviewed: `${biz.name} is a verified local business at ${biz.address || city.name}`,
      reviewRating: {
        "@type": "Rating",
        ratingValue: 5,
        bestRating: 5,
        worstRating: 1,
        alternateName: "Verified",
      },
      author: {
        "@type": "Organization",
        name: hubBrandCr.jsonLdName,
        url: baseUrl,
      },
      itemReviewed: { "@type": "LocalBusiness", name: biz.name, "@id": canonical },
    });
  }

  const brand = resolveBrand(city.slug, "hub");
  const titleZone = zone ? ` — ${zone.name}` : "";

  return {
    title: `${biz.name}${titleZone} ${brand.titleSuffix}`,
    description: metaDesc,
    canonical,
    ogSiteName: brand.ogSiteName,
    ogImage: getOgImageUrl(baseUrl, "business", slug),
    jsonLd,
    rootHtml: parts.join("\n"),
  };
}

function buildBusinessUrl(baseUrl: string, citySlug: string, bizSlug: string, catSlug?: string): string {
  if (catSlug) return `${baseUrl}/${citySlug}/${catSlug}/${bizSlug}`;
  return `${baseUrl}/${citySlug}/directory/${bizSlug}`;
}

function buildBusinessLinkHtml(citySlug: string, biz: any, categories: any[]): string {
  const cat = biz.categoryIds?.length ? categories.find((c: any) => biz.categoryIds.includes(c.id)) : undefined;
  const catSlug = cat?.slug;
  const href = catSlug ? `/${citySlug}/${catSlug}/${biz.slug}` : `/${citySlug}/directory/${biz.slug}`;
  return `<li><a href="${href}">${escapeHtml(biz.name)}</a></li>`;
}

async function buildBusinessDetail(city: any, businessSlug: string, baseUrl: string, routeCategorySlug?: string): Promise<SeoFields | null> {
  const biz = await storage.getBusinessBySlug(city.id, businessSlug);
  if (!biz) return null;

  const categories = await storage.getAllCategories();
  const category = biz.categoryIds?.length ? categories.find(c => biz.categoryIds.includes(c.id)) : undefined;
  const effectiveCatSlug = routeCategorySlug || category?.slug;
  const zones = await storage.getZonesByCityId(city.id);
  const zone = zones.find(z => z.id === biz.zoneId);

  const descText = biz.description || "";
  const metaDesc = descText
    ? descText.slice(0, 160)
    : `Details, location, and contact info for ${biz.name} in ${city.name}.`;

  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(biz.name)}</h1>`);
  if (descText) parts.push(`<p>${escapeHtml(descText.slice(0, 300))}</p>`);
  if (biz.address) parts.push(`<p>Address: ${escapeHtml(biz.address)}</p>`);
  if (biz.phone) parts.push(`<p>Phone: ${escapeHtml(biz.phone)}</p>`);
  if (category) parts.push(`<p>Category: ${escapeHtml(category.name)}</p>`);
  if (zone) parts.push(`<p>Zone: ${escapeHtml(zone.name)}</p>`);
  if (biz.websiteUrl) parts.push(`<p><a href="${escapeHtml(biz.websiteUrl)}">Visit website</a></p>`);

  if (category) {
    const sameCat = (await storage.getBusinessesByCategory(city.id, category.id))
      .filter(b => b.id !== biz.id).slice(0, 5);
    if (sameCat.length > 0) {
      const links = sameCat.map(b => buildBusinessLinkHtml(city.slug, b, categories)).join("\n");
      parts.push(`<nav><h2>More in ${escapeHtml(category.name)}</h2><ul>${links}</ul></nav>`);
    }
  }

  if (zone) {
    const sameZone = (await storage.getBusinessesByCityId(city.id, { zoneSlug: zone.slug }))
      .filter(b => b.id !== biz.id).slice(0, 5);
    if (sameZone.length > 0) {
      const links = sameZone.map(b => buildBusinessLinkHtml(city.slug, b, categories)).join("\n");
      parts.push(`<nav><h2>More in ${escapeHtml(zone.name)}</h2><ul>${links}</ul></nav>`);
    }
  }

  if (effectiveCatSlug) {
    parts.push(`<p><a href="/${city.slug}/${effectiveCatSlug}">Back to ${escapeHtml(category?.name || effectiveCatSlug)}</a></p>`);
  }
  parts.push(`<p><a href="/${city.slug}/directory">Back to Directory</a></p>`);

  const schemaType = resolveSchemaType(categories, biz.categoryIds || [], (biz as any).isNonprofit);
  const isRestaurant = isRestaurantBusiness(categories, biz.categoryIds || []);

  const jsonLdBiz: any = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: biz.name,
    url: buildBusinessUrl(baseUrl, city.slug, biz.slug, effectiveCatSlug),
  };
  if (biz.address) {
    jsonLdBiz.address = {
      "@type": "PostalAddress",
      streetAddress: biz.address,
      addressLocality: biz.city || city.name,
      addressRegion: biz.state || "",
      postalCode: biz.zip || "",
      addressCountry: "US",
    };
  }
  if (biz.phone) jsonLdBiz.telephone = biz.phone;
  {
    const sameAsUrls: string[] = [];
    if (biz.websiteUrl) sameAsUrls.push(biz.websiteUrl);
    if ((biz as any).googleProfileUrl) sameAsUrls.push((biz as any).googleProfileUrl);
    if ((biz as any).googlePlaceId) sameAsUrls.push(`https://www.google.com/maps/place/?q=place_id:${(biz as any).googlePlaceId}`);
    if ((biz as any).sourceUrl) sameAsUrls.push((biz as any).sourceUrl);
    if (sameAsUrls.length === 1) jsonLdBiz.sameAs = sameAsUrls[0];
    else if (sameAsUrls.length > 1) jsonLdBiz.sameAs = sameAsUrls;
  }
  if (descText) jsonLdBiz.description = descText.slice(0, 300);
  if (biz.updatedAt) jsonLdBiz.dateModified = new Date(biz.updatedAt).toISOString();
  {
    const hubStats = await getApprovedReviewStats(biz.id);
    const combined = computeCombinedAggregateRating(
      (biz as any).googleRating,
      (biz as any).googleReviewCount,
      hubStats.avgRating,
      hubStats.count,
    );
    if (combined) {
      jsonLdBiz.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: combined.ratingValue,
        reviewCount: combined.reviewCount,
      };
    }
  }
  if ((biz as any).priceRange) {
    jsonLdBiz.priceRange = "$".repeat((biz as any).priceRange);
  }
  if ((biz as any).isServiceArea && (biz as any).serviceAreaZoneIds?.length) {
    const serviceZones = zones.filter((z: any) => (biz as any).serviceAreaZoneIds.includes(z.id));
    if (serviceZones.length > 0) {
      jsonLdBiz.areaServed = serviceZones.map((z: any) => ({ "@type": "City", name: z.name }));
    }
  }
  if (isRestaurant && biz.websiteUrl) {
    jsonLdBiz.hasMenu = biz.websiteUrl;
  }
  applySchemaEnhancements(jsonLdBiz, biz);

  jsonLdBiz.speakable = {
    "@type": "SpeakableSpecification",
    cssSelector: [".biz-description", ".faq-answer"],
  };

  let relatedBiz: any[] = [];
  const allBizForRelated = await storage.getBusinessesByCityId(city.id);
  try {
    const graphRelatedIds = new Set<string>();
    const graphRows = await db.select({
      contentItemId: cmsContentRelations.contentItemId,
      relatedId: cmsContentRelations.relatedId,
    }).from(cmsContentRelations)
      .where(eq(cmsContentRelations.relationType, "presence"));
    const contentToPresences = new Map<string, string[]>();
    for (const r of graphRows) {
      if (!contentToPresences.has(r.contentItemId)) contentToPresences.set(r.contentItemId, []);
      contentToPresences.get(r.contentItemId)!.push(r.relatedId);
    }
    for (const presences of contentToPresences.values()) {
      if (presences.includes(biz.id)) {
        for (const pid of presences) {
          if (pid !== biz.id) graphRelatedIds.add(pid);
        }
      }
    }
    if (graphRelatedIds.size > 0) {
      relatedBiz = allBizForRelated.filter(b => graphRelatedIds.has(b.id)).slice(0, 6);
    }
  } catch {}
  if (relatedBiz.length < 6) {
    const existingIds = new Set([biz.id, ...relatedBiz.map(b => b.id)]);
    const heuristic = allBizForRelated.filter((b: any) => !existingIds.has(b.id) && (
      (b.categoryIds || []).some((cid: string) => (biz.categoryIds || []).includes(cid)) || b.zoneId === biz.zoneId
    )).slice(0, 6 - relatedBiz.length);
    relatedBiz.push(...heuristic);
  }
  if (relatedBiz.length > 0) {
    jsonLdBiz.relatedTo = relatedBiz.map((rb: any) => ({
      "@type": "LocalBusiness",
      name: rb.name,
      url: buildBusinessUrl(baseUrl, city.slug, rb.slug, effectiveCatSlug),
    }));
    const relLinks = relatedBiz.map((rb: any) =>
      `<li><a href="${buildBusinessUrl("", city.slug, rb.slug, effectiveCatSlug)}">${escapeHtml(rb.name)}</a></li>`
    ).join("");
    parts.push(`<nav><h2>Related Businesses</h2><ul>${relLinks}</ul></nav>`);
  }

  const bizCanonical = buildBusinessUrl(baseUrl, city.slug, biz.slug, effectiveCatSlug);

  const [expertQaRows, topicRows] = await Promise.all([
    db.select().from(businessExpertQa).where(and(eq(businessExpertQa.businessId, biz.id), eq(businessExpertQa.isPublished, true))).orderBy(asc(businessExpertQa.sortOrder)),
    db.select({ tagName: tags.name }).from(contentTags).innerJoin(tags, eq(contentTags.tagId, tags.id)).where(and(eq(contentTags.contentType, "business"), eq(contentTags.contentId, biz.id))),
  ]);

  if (topicRows.length > 0) {
    jsonLdBiz.knowsAbout = topicRows.map(r => r.tagName);
    parts.push(`<section><h2>Expert In</h2><ul>${topicRows.map(r => `<li>${escapeHtml(r.tagName)}</li>`).join("")}</ul></section>`);
  }

  const jsonLdItems: any[] = [jsonLdBiz];

  const validQaRows = expertQaRows.filter(r => r.question && r.answer);
  if (validQaRows.length > 0) {
    const faqEntries = validQaRows.map(row => ({
      "@type": "Question" as const,
      name: row.question,
      acceptedAnswer: { "@type": "Answer" as const, text: row.answer! },
    }));
    jsonLdItems.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqEntries });
    parts.push(`<section><h2>Expert Q&amp;A</h2>${validQaRows.map(r => `<div><h3>${escapeHtml(r.question)}</h3><p>${escapeHtml(r.answer!)}</p></div>`).join("")}</section>`);
  }

  const videoSchema = buildVideoSchema(biz);
  if (videoSchema) jsonLdItems.push(videoSchema);

  const breadcrumbItems = effectiveCatSlug
    ? [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: category?.name || effectiveCatSlug, url: `${baseUrl}/${city.slug}/${effectiveCatSlug}` },
        { name: biz.name, url: bizCanonical },
      ]
    : [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Directory", url: `${baseUrl}/${city.slug}/directory` },
        { name: biz.name, url: bizCanonical },
      ];

  if (topicRows.length > 0 || (biz as any).executiveDirectorName) {
    const personLd: any = {
      "@context": "https://schema.org",
      "@type": "Person",
    };
    if ((biz as any).executiveDirectorName) {
      personLd.name = (biz as any).executiveDirectorName;
      if ((biz as any).executiveDirectorTitle) personLd.jobTitle = (biz as any).executiveDirectorTitle;
    } else {
      personLd.name = biz.name;
    }
    if (topicRows.length > 0) personLd.knowsAbout = topicRows.map(r => r.tagName);
    if (zone) personLd.areaServed = { "@type": "Place", name: zone.name };
    personLd.worksFor = { "@type": "Organization", name: biz.name, url: bizCanonical };
    jsonLdItems.push(personLd);
  }

  if ((biz as any).charlotteVerificationStatus === "verified") {
    const claimBrand = resolveBrand(city.slug, "hub");
    jsonLdItems.push({
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      claimReviewed: `${biz.name} is a verified local business at ${biz.address || city.name}`,
      reviewRating: {
        "@type": "Rating",
        ratingValue: 5,
        bestRating: 5,
        worstRating: 1,
        alternateName: "Verified",
      },
      author: {
        "@type": "Organization",
        name: claimBrand.jsonLdName,
        url: baseUrl,
      },
      itemReviewed: { "@type": "LocalBusiness", name: biz.name, "@id": bizCanonical },
    });
  }

  const activeJobs = await db.select().from(jobListings)
    .where(and(eq(jobListings.businessId, biz.id), eq(jobListings.status, "ACTIVE" as any)))
    .limit(5)
    .then(rows => rows, () => [] as any[]);
  for (const job of activeJobs) {
    const jobLd: any = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: job.description || `${job.title} at ${biz.name}`,
      datePosted: job.createdAt ? new Date(job.createdAt).toISOString().split("T")[0] : undefined,
      employmentType: job.employmentType || "FULL_TIME",
      hiringOrganization: {
        "@type": "LocalBusiness",
        name: biz.name,
        "@id": bizCanonical,
        ...(biz.address ? { address: biz.address } : {}),
      },
      jobLocation: {
        "@type": "Place",
        address: job.location || biz.address || city.name,
      },
    };
    if (job.compensationMin || job.compensationMax) {
      jobLd.baseSalary = {
        "@type": "MonetaryAmount",
        currency: "USD",
        value: {
          "@type": "QuantitativeValue",
          ...(job.compensationMin ? { minValue: job.compensationMin } : {}),
          ...(job.compensationMax ? { maxValue: job.compensationMax } : {}),
          unitText: job.compensationType === "SALARY" ? "YEAR" : "HOUR",
        },
      };
    }
    jsonLdItems.push(jobLd);
  }

  const bizBrand = resolveBrand(city.slug, "category");

  return {
    title: `${biz.name} | ${city.name} ${bizBrand.titleSuffix}`,
    description: metaDesc,
    canonical: bizCanonical,
    ogSiteName: bizBrand.ogSiteName,
    ogImage: getOgImageUrl(baseUrl, "business", biz.slug),
    jsonLd: [
      ...jsonLdItems,
      makeBreadcrumbs(baseUrl, breadcrumbItems),
    ],
    rootHtml: parts.join("\n"),
  };
}

async function buildNeighborhoodCategoryCross(city: any, code: string, categorySlug: string, baseUrl: string): Promise<SeoFields | null> {
  const upperCode = code.toUpperCase();
  const [hub] = await db.select().from(regions).where(
    and(eq(regions.code, upperCode), eq(regions.regionType, "hub"))
  );
  if (!hub) return null;

  const category = await storage.getCategoryBySlug(categorySlug);
  if (!category) return null;

  const coverageRows = await db.select().from(hubZipCoverage).where(eq(hubZipCoverage.hubRegionId, hub.id));
  const hubZips = coverageRows.map(r => r.zip);

  const [allBiz, allCategories] = await Promise.all([
    storage.getBusinessesByCityId(city.id),
    storage.getAllCategories(),
  ]);

  const filteredBiz = allBiz.filter(b => b.zip && hubZips.includes(b.zip) && b.categoryIds?.includes(category.id));
  const businesses = filteredBiz.slice(0, 15);
  const totalBiz = filteredBiz.length;
  const stateName = city.state || "NC";

  const canonical = `${baseUrl}/${city.slug}/neighborhoods/${code}/${categorySlug}`;

  const bizLinks = businesses.map(b =>
    buildBusinessLinkHtml(city.slug, b, allCategories)
  ).join("\n");

  const bizItems = businesses.map(b => ({
    name: b.name,
    url: buildBusinessUrl(baseUrl, city.slug, b.slug, categorySlug),
  }));

  const rootParts: string[] = [];
  rootParts.push(`<h1>Best ${escapeHtml(category.name)} in ${escapeHtml(hub.name)}, ${escapeHtml(city.name)}</h1>`);
  rootParts.push(`<p>Find the best ${escapeHtml(category.name.toLowerCase())} in ${escapeHtml(hub.name)}, ${escapeHtml(city.name)}. Browse ${totalBiz} local ${escapeHtml(category.name.toLowerCase())} listings.</p>`);
  rootParts.push(`<ul>${bizLinks}</ul>`);
  rootParts.push(`<nav><h2>Explore More</h2><ul>`);
  rootParts.push(`<li><a href="/${city.slug}/neighborhoods/${code}">${escapeHtml(hub.name)} Hub</a></li>`);
  rootParts.push(`<li><a href="/${city.slug}/${categorySlug}">${escapeHtml(category.name)} in ${escapeHtml(city.name)}</a></li>`);
  rootParts.push(`<li><a href="/${city.slug}/directory">${escapeHtml(city.name)} Directory</a></li>`);
  rootParts.push(`</ul></nav>`);

  const crossBrand = resolveBrand(city.slug, "hub");
  return {
    title: `Best ${category.name} in ${hub.name}, ${city.name} ${crossBrand.titleSuffix}`,
    description: `Find the best ${category.name.toLowerCase()} in ${hub.name}, ${city.name}. Browse ${totalBiz} local ${category.name.toLowerCase()} listings with reviews, photos, and more. ${crossBrand.descriptionBrand}.`,
    canonical,
    ogSiteName: crossBrand.ogSiteName,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${category.name} in ${hub.name}, ${city.name}`,
        description: `${totalBiz} ${category.name.toLowerCase()} listings in ${hub.name}, ${city.name}`,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: crossBrand.jsonLdName, url: baseUrl },
      },
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Neighborhoods", url: `${baseUrl}/${city.slug}/neighborhoods` },
        { name: hub.name, url: `${baseUrl}/${city.slug}/neighborhoods/${code}` },
        { name: category.name, url: canonical },
      ]),
      makeItemList(`${category.name} in ${hub.name}, ${city.name}`, bizItems),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

async function buildPulsePostSeo(city: any, postId: string, baseUrl: string): Promise<SeoFields | null> {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post || post.status !== "published") return null;

  const pulseBrand = resolveBrand(city.slug, "article");
  let authorName = pulseBrand.descriptionBrand;
  if (post.authorUserId) {
    const [author] = await db.select().from(publicUsers).where(eq(publicUsers.id, post.authorUserId));
    if (author) authorName = author.displayName;
  }

  const canonical = `${baseUrl}/${city.slug}/pulse/post/${post.id}`;
  const ogImage = getOgImageUrl(baseUrl, "pulse", post.id);

  const mediaLabel = post.mediaType === "reel" ? "Reel" : "Post";
  const bodyText = post.body ? post.body.slice(0, 200) : "";
  const descriptionText = bodyText
    ? `${bodyText} — ${pulseBrand.descriptionBrand}`
    : `${mediaLabel} by ${authorName} on ${pulseBrand.descriptionBrand}`;
  const titleText = post.title || `Pulse ${mediaLabel}`;

  const rootParts: string[] = [];
  rootParts.push(`<h1>${escapeHtml(titleText)}</h1>`);
  rootParts.push(`<p>By ${escapeHtml(authorName)}</p>`);
  if (post.body) {
    rootParts.push(`<p>${escapeHtml(post.body)}</p>`);
  }
  if (post.coverImageUrl) {
    rootParts.push(`<img src="${escapeHtml(post.coverImageUrl)}" alt="${escapeHtml(titleText)}">`);
  }
  rootParts.push(`<p><a href="/${city.slug}/pulse">Back to Pulse</a></p>`);

  return {
    title: `${titleText} | ${authorName} | ${city.brandName || city.name} Pulse ${pulseBrand.titleSuffix}`,
    description: descriptionText,
    canonical,
    ogSiteName: pulseBrand.ogSiteName,
    ogImage,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        headline: titleText,
        author: { "@type": "Person", name: authorName },
        datePublished: post.publishedAt ? post.publishedAt.toISOString() : post.createdAt.toISOString(),
        ...(post.updatedAt ? { dateModified: post.updatedAt.toISOString() } : {}),
        ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
        ...(post.body ? { articleBody: post.body.slice(0, 500) } : {}),
        url: canonical,
        publisher: {
          "@type": "Organization",
          name: pulseBrand.jsonLdName,
          url: baseUrl,
        },
      },
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Pulse", url: `${baseUrl}/${city.slug}/pulse` },
        { name: titleText, url: canonical },
      ]),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

function parseCostText(costText: string): { price?: number; priceCurrency?: string } | null {
  if (!costText) return null;
  if (/free/i.test(costText)) return { price: 0, priceCurrency: "USD" };
  const match = costText.match(/\$\s*([\d,.]+)/);
  if (match) {
    const price = parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(price)) return { price, priceCurrency: "USD" };
  }
  return null;
}

async function buildEventDetail(city: City, slug: string, baseUrl: string): Promise<SeoFields | null> {
  const evt = await storage.getEventBySlug(city.id, slug);
  if (!evt) return null;
  if (evt.visibility && evt.visibility !== "public") return null;

  const brand = resolveBrand(city.slug, "article");
  const canonical = `${baseUrl}/${city.slug}/events/${slug}`;
  const descText = evt.description || "";
  const metaDesc = descText ? descText.slice(0, 160) : `${evt.title} — event in ${city.name}`;

  const locationParts: Record<string, unknown> = {};
  if (evt.locationName) {
    const place: Record<string, unknown> = {
      "@type": "Place",
      name: evt.locationName,
      address: {
        "@type": "PostalAddress",
        addressLocality: evt.city || city.name,
        addressRegion: evt.state || "NC",
        addressCountry: "US",
      } as Record<string, string>,
    };
    const addr = place.address as Record<string, string>;
    if (evt.address) addr.streetAddress = evt.address;
    if (evt.zip) addr.postalCode = evt.zip;
    const lat = parseFloat(String(evt.latitude ?? ""));
    const lng = parseFloat(String(evt.longitude ?? ""));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      place.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
    }
    locationParts.location = place;
  }

  const offers: Record<string, unknown> = {};
  if (evt.costText) {
    const parsed = parseCostText(evt.costText);
    offers.offers = {
      "@type": "Offer",
      url: canonical,
      availability: "https://schema.org/InStock",
      description: evt.costText,
      ...(parsed?.price !== undefined ? { price: parsed.price, priceCurrency: parsed.priceCurrency } : {}),
    };
  }

  let hostBizName: string | null = null;
  if (evt.hostBusinessId) {
    const [host] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, evt.hostBusinessId)).limit(1);
    if (host) hostBizName = host.name;
  }

  let organizerData: Record<string, unknown> = {};
  if (evt.organizerName) {
    organizerData.organizer = { "@type": "Organization", name: evt.organizerName };
  } else if (hostBizName) {
    organizerData.organizer = { "@type": "Organization", name: hostBizName };
  }

  let performerData: Record<string, unknown> = {};
  if (hostBizName) {
    performerData.performer = { "@type": "Organization", name: hostBizName };
  }

  const eventJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evt.title,
    url: canonical,
    startDate: evt.startDateTime instanceof Date ? evt.startDateTime.toISOString() : new Date(evt.startDateTime).toISOString(),
    ...(evt.endDateTime ? { endDate: evt.endDateTime instanceof Date ? evt.endDateTime.toISOString() : new Date(evt.endDateTime).toISOString() } : {}),
    ...(descText ? { description: descText.slice(0, 500) } : {}),
    ...(evt.imageUrl ? { image: evt.imageUrl } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: evt.occurrenceStatus === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    ...locationParts,
    ...offers,
    ...organizerData,
    ...performerData,
    ...(evt.updatedAt ? { dateModified: new Date(evt.updatedAt).toISOString() } : {}),
  };

  const rootParts: string[] = [];
  rootParts.push(`<h1>${escapeHtml(evt.title)}</h1>`);
  if (descText) rootParts.push(`<p>${escapeHtml(descText.slice(0, 500))}</p>`);
  rootParts.push(`<p>Date: ${new Date(evt.startDateTime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>`);
  if (evt.locationName) rootParts.push(`<p>Location: ${escapeHtml(evt.locationName)}</p>`);
  if (evt.address) rootParts.push(`<p>Address: ${escapeHtml(evt.address)}</p>`);
  if (evt.costText) rootParts.push(`<p>Cost: ${escapeHtml(evt.costText)}</p>`);
  rootParts.push(`<p><a href="/api/cities/${city.slug}/events/${slug}/calendar.ics" download="${slug}.ics">📅 Add to Calendar</a></p>`);
  rootParts.push(`<p><a href="/${city.slug}/events">Back to Events</a></p>`);

  return {
    title: `${evt.title} | ${city.name} Events ${brand.titleSuffix}`,
    description: metaDesc,
    canonical,
    ogSiteName: brand.ogSiteName,
    ogImage: evt.imageUrl || undefined,
    jsonLd: [
      eventJsonLd,
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Events", url: `${baseUrl}/${city.slug}/events` },
        { name: evt.title, url: canonical },
      ]),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

async function buildEventSeriesDetail(city: City, seriesSlug: string, baseUrl: string): Promise<SeoFields | null> {
  interface SeriesQueryRow {
    id: string; title: string; description: string | null; slug: string;
    image_url: string | null; host_presence_name: string | null; venue_presence_name: string | null;
    default_location_name: string | null; default_city: string | null; default_state: string | null;
    updated_at: string | null;
  }
  interface OccQueryRow { id: string; title: string | null; slug: string; start_date_time: string }

  const result = await pool.query<SeriesQueryRow>(
    `SELECT es.*, b1.name AS host_presence_name, b2.name AS venue_presence_name
     FROM event_series es
     LEFT JOIN businesses b1 ON b1.id = es.host_presence_id
     LEFT JOIN businesses b2 ON b2.id = es.venue_presence_id
     WHERE es.slug = $1 AND es.city_id = $2 AND es.status = 'active' LIMIT 1`,
    [seriesSlug, city.id]
  );
  if (result.rows.length === 0) return null;
  const series = result.rows[0];

  const brand = resolveBrand(city.slug, "article");
  const canonical = `${baseUrl}/${city.slug}/events/series/${seriesSlug}`;
  const descText = series.description || "";

  const occurrences = await pool.query<OccQueryRow>(
    `SELECT id, title, slug, start_date_time FROM events WHERE event_series_id = $1 AND start_date_time > NOW() AND occurrence_status = 'scheduled' ORDER BY start_date_time ASC LIMIT 20`,
    [series.id]
  );

  const subEvents = occurrences.rows.map((occ) => ({
    "@type": "Event",
    name: occ.title || series.title,
    url: `${baseUrl}/${city.slug}/events/${occ.slug}`,
    startDate: new Date(occ.start_date_time).toISOString(),
  }));

  const seriesJsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    name: series.title,
    url: canonical,
    ...(descText ? { description: descText.slice(0, 500) } : {}),
    ...(series.image_url ? { image: series.image_url } : {}),
    ...(series.host_presence_name ? { organizer: { "@type": "Organization", name: series.host_presence_name } } : {}),
    ...(series.default_location_name ? {
      location: {
        "@type": "Place",
        name: series.default_location_name,
        address: {
          "@type": "PostalAddress",
          addressLocality: series.default_city || city.name,
          addressRegion: series.default_state || "NC",
          addressCountry: "US",
        },
      },
    } : {}),
    ...(subEvents.length > 0 ? { subEvent: subEvents } : {}),
    ...(series.updated_at ? { dateModified: new Date(series.updated_at).toISOString() } : {}),
  };

  const itemListElements = occurrences.rows.map((occ) => ({
    name: `${series.title} — ${new Date(occ.start_date_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    url: `${baseUrl}/${city.slug}/events/${occ.slug}`,
  }));

  const rootParts: string[] = [];
  rootParts.push(`<h1>${escapeHtml(series.title)} — Event Series</h1>`);
  if (descText) rootParts.push(`<p>${escapeHtml(descText.slice(0, 500))}</p>`);
  if (series.default_location_name) rootParts.push(`<p>Location: ${escapeHtml(series.default_location_name)}</p>`);
  if (occurrences.rows.length > 0) {
    const occLinks = occurrences.rows.map((occ) =>
      `<li><a href="/${city.slug}/events/${occ.slug}">${escapeHtml(occ.title || series.title)} — ${new Date(occ.start_date_time).toLocaleDateString("en-US")}</a></li>`
    ).join("\n");
    rootParts.push(`<h2>Upcoming Dates</h2><ul>${occLinks}</ul>`);
  }
  rootParts.push(`<p><a href="/api/cities/${city.slug}/events/series/${seriesSlug}/calendar.ics" download="${seriesSlug}-series.ics">📅 Subscribe to Calendar</a></p>`);
  rootParts.push(`<p><a href="/${city.slug}/events">Back to Events</a></p>`);

  return {
    title: `${series.title} — Event Series | ${city.name} ${brand.titleSuffix}`,
    description: descText ? descText.slice(0, 160) : `${series.title} — recurring event series in ${city.name}`,
    canonical,
    ogSiteName: brand.ogSiteName,
    ogImage: series.image_url || undefined,
    jsonLd: [
      seriesJsonLd,
      ...(itemListElements.length > 0 ? [makeItemList(`${series.title} Upcoming Dates`, itemListElements)] : []),
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Events", url: `${baseUrl}/${city.slug}/events` },
        { name: series.title, url: canonical },
      ]),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

async function buildEventLanding(city: City, baseUrl: string): Promise<SeoFields> {
  const brand = resolveBrand(city.slug, "landing");
  const canonical = `${baseUrl}/${city.slug}/events`;
  const now = new Date();

  const upcomingEvents = await db.select({
    id: events.id,
    title: events.title,
    slug: events.slug,
    startDateTime: events.startDateTime,
    locationName: events.locationName,
    costText: events.costText,
  }).from(events)
    .where(and(
      eq(events.cityId, city.id),
      sql`COALESCE(${events.visibility}, 'public') = 'public'`,
      sql`COALESCE(${events.endDateTime}, ${events.startDateTime} + interval '3 hours') > ${now}`,
      sql`COALESCE(${events.locationName}, '') != ''`,
    ))
    .orderBy(events.startDateTime)
    .limit(20);

  const eventItems = upcomingEvents.map(e => ({
    name: e.title,
    url: `${baseUrl}/${city.slug}/events/${e.slug}`,
  }));

  const eventLinks = upcomingEvents.map(e =>
    `<li><a href="/${city.slug}/events/${e.slug}">${escapeHtml(e.title)} — ${new Date(e.startDateTime).toLocaleDateString("en-US")}</a></li>`
  ).join("\n");

  return {
    title: `Events in ${city.name} ${brand.titleSuffix}`,
    description: `Discover upcoming events in ${city.name}. Find concerts, festivals, community events, and more. Powered by ${brand.descriptionBrand}.`,
    canonical,
    ogSiteName: brand.ogSiteName,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Events in ${city.name}`,
        description: `Upcoming events in ${city.name} metro area`,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: brand.jsonLdName, url: baseUrl },
      },
      makeItemList(`Upcoming Events in ${city.name}`, eventItems),
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Events", url: canonical },
      ]),
    ],
    rootHtml: `<h1>Events in ${escapeHtml(city.name)}</h1>
<p>Discover upcoming events in ${escapeHtml(city.name)} — concerts, festivals, community events, and more.</p>
<ul>${eventLinks}</ul>`,
  };
}

async function buildJobDetail(city: City, jobId: string, baseUrl: string): Promise<SeoFields | null> {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.cityId, city.id), sql`COALESCE(${jobs.jobStatus}, 'active') = 'active'`)).limit(1);
  if (!job) {
    const [bySlug] = await db.select().from(jobs).where(and(eq(jobs.cityId, city.id), eq(jobs.slug, jobId), sql`COALESCE(${jobs.jobStatus}, 'active') = 'active'`)).limit(1);
    if (!bySlug) return null;
    return buildJobDetailInner(city, bySlug, baseUrl);
  }
  return buildJobDetailInner(city, job, baseUrl);
}

async function buildJobDetailInner(city: City, job: Job, baseUrl: string): Promise<SeoFields> {
  const brand = resolveBrand(city.slug, "article");
  const canonical = `${baseUrl}/${city.slug}/jobs/${job.id}`;
  const descText = job.description || "";

  let hiringOrg: JsonLdObject | undefined = undefined;
  if (job.businessId) {
    const [biz] = await db.select({ name: businesses.name, slug: businesses.slug }).from(businesses).where(eq(businesses.id, job.businessId)).limit(1);
    if (biz) {
      hiringOrg = {
        "@type": "Organization",
        name: biz.name,
        sameAs: `${baseUrl}/${city.slug}/directory/${biz.slug}`,
      };
    }
  }
  if (!hiringOrg && job.employer) {
    hiringOrg = { "@type": "Organization", name: job.employer };
  }

  const baseSalaryParts: JsonLdObject = {};
  if (job.payMin || job.payMax) {
    const unitMap: Record<string, string> = { hour: "HOUR", year: "YEAR", month: "MONTH", week: "WEEK" };
    baseSalaryParts.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        ...(job.payMin ? { minValue: parseFloat(job.payMin) } : {}),
        ...(job.payMax ? { maxValue: parseFloat(job.payMax) } : {}),
        unitText: unitMap[job.payUnit?.toLowerCase() ?? ""] || "YEAR",
      },
    };
  }

  const jobLocationParts: JsonLdObject = {};
  if (job.locationText || job.city) {
    const placeObj: JsonLdObject = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city || city.name,
        addressRegion: job.stateCode || "NC",
        addressCountry: "US",
        ...(job.zipCode ? { postalCode: job.zipCode } : {}),
      },
    };
    if (job.businessId) {
      const [bizGeo] = await db.select({ latitude: businesses.latitude, longitude: businesses.longitude }).from(businesses).where(eq(businesses.id, job.businessId)).limit(1);
      if (bizGeo) {
        const lat = parseFloat(String(bizGeo.latitude ?? ""));
        const lng = parseFloat(String(bizGeo.longitude ?? ""));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          placeObj.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
        }
      }
    }
    jobLocationParts.jobLocation = placeObj;
  }

  const jobJsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    url: canonical,
    ...(descText ? { description: descText.slice(0, 2000) } : {}),
    datePosted: job.postedAt ? new Date(job.postedAt).toISOString() : new Date(job.createdAt).toISOString(),
    ...(job.closesAt ? { validThrough: new Date(job.closesAt).toISOString() } : {}),
    ...(hiringOrg ? { hiringOrganization: hiringOrg } : {}),
    ...(job.employmentType ? { employmentType: job.employmentType } : {}),
    ...baseSalaryParts,
    ...jobLocationParts,
    ...(job.remoteType === "remote" ? { jobLocationType: "TELECOMMUTE" } : {}),
    ...(job.updatedAt ? { dateModified: new Date(job.updatedAt).toISOString() } : {}),
  };

  const rootParts: string[] = [];
  rootParts.push(`<h1>${escapeHtml(job.title)}</h1>`);
  if (job.employer) rootParts.push(`<p>Employer: ${escapeHtml(job.employer)}</p>`);
  if (descText) rootParts.push(`<p>${escapeHtml(descText.slice(0, 500))}</p>`);
  if (job.locationText) rootParts.push(`<p>Location: ${escapeHtml(job.locationText)}</p>`);
  if (job.employmentType) rootParts.push(`<p>Type: ${escapeHtml(job.employmentType)}</p>`);
  rootParts.push(`<p><a href="/${city.slug}/jobs">Back to Jobs</a></p>`);

  return {
    title: `${job.title}${job.employer ? ` at ${job.employer}` : ""} | ${city.name} Jobs ${brand.titleSuffix}`,
    description: descText ? descText.slice(0, 160) : `${job.title} job in ${city.name}`,
    canonical,
    ogSiteName: brand.ogSiteName,
    jsonLd: [
      jobJsonLd,
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Jobs", url: `${baseUrl}/${city.slug}/jobs` },
        { name: job.title, url: canonical },
      ]),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

async function buildJobsLanding(city: City, baseUrl: string): Promise<SeoFields> {
  const brand = resolveBrand(city.slug, "landing");
  const canonical = `${baseUrl}/${city.slug}/jobs`;

  const activeJobs = await db.select({
    id: jobs.id,
    title: jobs.title,
    slug: jobs.slug,
    employer: jobs.employer,
  }).from(jobs)
    .where(and(eq(jobs.cityId, city.id), sql`COALESCE(${jobs.jobStatus}, 'active') = 'active'`))
    .orderBy(desc(jobs.createdAt))
    .limit(20);

  const jobItems = activeJobs.map(j => ({
    name: `${j.title}${j.employer ? ` at ${j.employer}` : ""}`,
    url: `${baseUrl}/${city.slug}/jobs/${j.id}`,
  }));

  const jobLinks = activeJobs.map(j =>
    `<li><a href="/${city.slug}/jobs/${j.id}">${escapeHtml(j.title)}${j.employer ? ` — ${escapeHtml(j.employer)}` : ""}</a></li>`
  ).join("\n");

  return {
    title: `Jobs in ${city.name} ${brand.titleSuffix}`,
    description: `Find local job openings in ${city.name}. Browse positions from local employers and community organizations. Powered by ${brand.descriptionBrand}.`,
    canonical,
    ogSiteName: brand.ogSiteName,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Jobs in ${city.name}`,
        description: `Job listings in the ${city.name} metro area`,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: brand.jsonLdName, url: baseUrl },
      },
      makeItemList(`Job Listings in ${city.name}`, jobItems),
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Jobs", url: canonical },
      ]),
    ],
    rootHtml: `<h1>Jobs in ${escapeHtml(city.name)}</h1>
<p>Find local job openings and volunteer opportunities in ${escapeHtml(city.name)}.</p>
<ul>${jobLinks}</ul>`,
  };
}

async function buildHousingDetail(city: City, listingId: string, baseUrl: string): Promise<SeoFields | null> {
  const [listing] = await db.select().from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.id, listingId),
      eq(marketplaceListings.cityId, city.id),
      sql`${marketplaceListings.type} IN ('HOUSING', 'HOUSING_SUPPLY', 'HOUSING_DEMAND')`,
      eq(marketplaceListings.status, "ACTIVE"),
    )).limit(1);
  if (!listing) return null;

  const brand = resolveBrand(city.slug, "article");
  const canonical = `${baseUrl}/${city.slug}/marketplace/${listing.id}`;
  const descText = listing.description || "";

  const isApartment = listing.subtype === "APARTMENT_COMMUNITY" || listing.subtype === "APARTMENT_UNIT";
  const schemaType = isApartment ? "ApartmentComplex" : "Residence";

  const residenceJsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: listing.title,
    url: canonical,
    ...(descText ? { description: descText.slice(0, 500) } : {}),
    ...(listing.bedrooms ? { numberOfBedrooms: listing.bedrooms } : {}),
    ...(listing.bathrooms ? { numberOfBathroomsTotal: listing.bathrooms } : {}),
    ...(listing.squareFeet ? { floorSize: { "@type": "QuantitativeValue", value: listing.squareFeet, unitCode: "FTK" } } : {}),
    ...(listing.petFriendly !== null ? { petsAllowed: listing.petFriendly } : {}),
    ...(listing.availableDate ? { availableAtOrFrom: new Date(listing.availableDate).toISOString() } : {}),
    ...(listing.imageUrl ? { image: listing.imageUrl } : {}),
    ...(listing.updatedAt ? { dateModified: new Date(listing.updatedAt).toISOString() } : {}),
  };

  if (listing.address || listing.addressCity) {
    residenceJsonLd.address = {
      "@type": "PostalAddress",
      ...(listing.address ? { streetAddress: listing.address } : {}),
      addressLocality: listing.addressCity || city.name,
      addressRegion: listing.addressState || "NC",
      addressCountry: "US",
      ...(listing.addressZip ? { postalCode: listing.addressZip } : {}),
    };
  }

  const lat = parseFloat(String(listing.latitude ?? ""));
  const lng = parseFloat(String(listing.longitude ?? ""));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    residenceJsonLd.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
  }

  if (listing.price) {
    residenceJsonLd.offers = {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "USD",
      url: canonical,
    };
  }

  const rootParts: string[] = [];
  rootParts.push(`<h1>${escapeHtml(listing.title)}</h1>`);
  if (descText) rootParts.push(`<p>${escapeHtml(descText.slice(0, 500))}</p>`);
  if (listing.bedrooms) rootParts.push(`<p>Bedrooms: ${listing.bedrooms}</p>`);
  if (listing.bathrooms) rootParts.push(`<p>Bathrooms: ${listing.bathrooms}</p>`);
  if (listing.squareFeet) rootParts.push(`<p>Square Feet: ${listing.squareFeet}</p>`);
  if (listing.price) rootParts.push(`<p>Price: $${listing.price}</p>`);
  if (listing.neighborhood) rootParts.push(`<p>Neighborhood: ${escapeHtml(listing.neighborhood)}</p>`);
  rootParts.push(`<p><a href="/${city.slug}/relocation/housing">Back to Housing</a></p>`);

  return {
    title: `${listing.title} | ${city.name} Housing ${brand.titleSuffix}`,
    description: descText ? descText.slice(0, 160) : `${listing.title} — housing in ${city.name}`,
    canonical,
    ogSiteName: brand.ogSiteName,
    ogImage: listing.imageUrl || undefined,
    jsonLd: [
      residenceJsonLd,
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Housing", url: `${baseUrl}/${city.slug}/relocation/housing` },
        { name: listing.title, url: canonical },
      ]),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

async function buildHousingLanding(city: City, baseUrl: string): Promise<SeoFields> {
  const brand = resolveBrand(city.slug, "landing");
  const canonical = `${baseUrl}/${city.slug}/relocation/housing`;

  const housingListings = await db.select({
    id: marketplaceListings.id,
    title: marketplaceListings.title,
    price: marketplaceListings.price,
    neighborhood: marketplaceListings.neighborhood,
  }).from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.cityId, city.id),
      eq(marketplaceListings.status, "ACTIVE"),
      sql`${marketplaceListings.type} IN ('HOUSING', 'HOUSING_SUPPLY')`,
    ))
    .orderBy(desc(marketplaceListings.createdAt))
    .limit(20);

  const listingItems = housingListings.map(l => ({
    name: l.title,
    url: `${baseUrl}/${city.slug}/marketplace/${l.id}`,
  }));

  const listingLinks = housingListings.map(l =>
    `<li><a href="/${city.slug}/marketplace/${l.id}">${escapeHtml(l.title)}${l.price ? ` — $${l.price}` : ""}</a></li>`
  ).join("\n");

  return {
    title: `Housing & Apartments in ${city.name} ${brand.titleSuffix}`,
    description: `Find apartments, houses for rent, and housing in ${city.name}. Browse listings with photos, pricing, and neighborhood details. Powered by ${brand.descriptionBrand}.`,
    canonical,
    ogSiteName: brand.ogSiteName,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Housing in ${city.name}`,
        description: `Housing and apartment listings in the ${city.name} metro area`,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: brand.jsonLdName, url: baseUrl },
      },
      makeItemList(`Housing Listings in ${city.name}`, listingItems),
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Relocation", url: `${baseUrl}/${city.slug}/relocation` },
        { name: "Housing", url: canonical },
      ]),
    ],
    rootHtml: `<h1>Housing & Apartments in ${escapeHtml(city.name)}</h1>
<p>Find apartments, houses for rent, and housing options in ${escapeHtml(city.name)}.</p>
<ul>${listingLinks}</ul>`,
  };
}

async function buildMarketplaceDetail(city: City, listingId: string, baseUrl: string): Promise<SeoFields | null> {
  const [listing] = await db.select().from(marketplaceListings)
    .where(and(eq(marketplaceListings.id, listingId), eq(marketplaceListings.cityId, city.id), eq(marketplaceListings.status, "ACTIVE")))
    .limit(1);
  if (!listing) return null;

  const isHousing = ["HOUSING", "HOUSING_SUPPLY", "HOUSING_DEMAND"].includes(listing.type);
  if (isHousing) return buildHousingDetail(city, listingId, baseUrl);

  const brand = resolveBrand(city.slug, "article");
  const canonical = `${baseUrl}/${city.slug}/marketplace/${listing.id}`;
  const descText = listing.description || "";

  const isProduct = ["FOR_SALE", "CREATOR_ART", "CREATOR_PRINTS", "CREATOR_PHOTOGRAPHY", "CREATOR_HANDMADE", "CREATOR_DIGITAL", "CREATOR_MUSIC"].includes(listing.type);

  const jsonLdItem: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": isProduct ? "Product" : "Offer",
    name: listing.title,
    url: canonical,
    ...(descText ? { description: descText.slice(0, 500) } : {}),
    ...(listing.imageUrl ? { image: listing.imageUrl } : {}),
    ...(listing.updatedAt ? { dateModified: new Date(listing.updatedAt).toISOString() } : {}),
  };

  if (isProduct && listing.price) {
    jsonLdItem.offers = {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "USD",
      url: canonical,
      availability: "https://schema.org/InStock",
    };
  } else if (!isProduct && listing.price) {
    jsonLdItem.price = listing.price;
    jsonLdItem.priceCurrency = "USD";
  }

  if (listing.condition) {
    const condMap: Record<string, string> = {
      NEW: "https://schema.org/NewCondition",
      LIKE_NEW: "https://schema.org/UsedCondition",
      GOOD: "https://schema.org/UsedCondition",
      FAIR: "https://schema.org/UsedCondition",
    };
    if (isProduct && condMap[listing.condition]) {
      const offersObj = (jsonLdItem.offers || {}) as JsonLdObject;
      offersObj.itemCondition = condMap[listing.condition];
      jsonLdItem.offers = offersObj;
    }
  }

  const rootParts: string[] = [];
  rootParts.push(`<h1>${escapeHtml(listing.title)}</h1>`);
  if (descText) rootParts.push(`<p>${escapeHtml(descText.slice(0, 500))}</p>`);
  if (listing.price) rootParts.push(`<p>Price: $${listing.price}</p>`);
  if (listing.neighborhood) rootParts.push(`<p>Neighborhood: ${escapeHtml(listing.neighborhood)}</p>`);
  rootParts.push(`<p><a href="/${city.slug}/marketplace">Back to Marketplace</a></p>`);

  return {
    title: `${listing.title} | ${city.name} Marketplace ${brand.titleSuffix}`,
    description: descText ? descText.slice(0, 160) : `${listing.title} — marketplace listing in ${city.name}`,
    canonical,
    ogSiteName: brand.ogSiteName,
    ogImage: listing.imageUrl || undefined,
    jsonLd: [
      jsonLdItem,
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Marketplace", url: `${baseUrl}/${city.slug}/marketplace` },
        { name: listing.title, url: canonical },
      ]),
    ],
    rootHtml: rootParts.join("\n"),
  };
}

async function buildMarketplaceLanding(city: City, baseUrl: string): Promise<SeoFields> {
  const brand = resolveBrand(city.slug, "landing");
  const canonical = `${baseUrl}/${city.slug}/marketplace`;

  const listings = await db.select({
    id: marketplaceListings.id,
    title: marketplaceListings.title,
    price: marketplaceListings.price,
    type: marketplaceListings.type,
  }).from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.cityId, city.id),
      eq(marketplaceListings.status, "ACTIVE"),
    ))
    .orderBy(desc(marketplaceListings.createdAt))
    .limit(20);

  const listingItems = listings.map(l => ({
    name: l.title,
    url: `${baseUrl}/${city.slug}/marketplace/${l.id}`,
  }));

  const listingLinks = listings.map(l =>
    `<li><a href="/${city.slug}/marketplace/${l.id}">${escapeHtml(l.title)}${l.price ? ` — $${l.price}` : ""}</a></li>`
  ).join("\n");

  return {
    title: `Marketplace | ${city.name} ${brand.titleSuffix}`,
    description: `Browse the ${city.name} marketplace — classifieds, services, creator work, and more. Powered by ${brand.descriptionBrand}.`,
    canonical,
    ogSiteName: brand.ogSiteName,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${city.name} Marketplace`,
        description: `Community marketplace listings in the ${city.name} metro area`,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: brand.jsonLdName, url: baseUrl },
      },
      makeItemList(`Marketplace Listings in ${city.name}`, listingItems),
      makeBreadcrumbs(baseUrl, [
        { name: city.name, url: `${baseUrl}/${city.slug}` },
        { name: "Marketplace", url: canonical },
      ]),
    ],
    rootHtml: `<h1>${escapeHtml(city.name)} Marketplace</h1>
<p>Browse classifieds, services, creator work, and community listings in ${escapeHtml(city.name)}.</p>
<ul>${listingLinks}</ul>`,
  };
}
