# Hub Presence SEO & AI Discoverability Audit Report

**Date**: February 25, 2026
**Scope**: Hub Presence microsite pages (Charter + Enhanced tiers)
**Codebase**: CLT Metro Hub (CityCoreHub)

---

## A) Implementation Audit

### 1. Page-Level Structure

| Element | Status | Implementation |
|---------|--------|---------------|
| **Unique title tag** | ✅ Implemented | `{Business Name} — {Zone Name} \| CLT Metro Hub` via `usePageMeta` hook (`client/src/pages/microsite.tsx` line ~335) + server-side snapshot injection (`server/seo-snapshot.ts` `buildMicrositePresence()`) |
| **Dynamic meta description** | ✅ Implemented | Uses tagline or first 140 chars of description + zone name. Both client-side and server-side. |
| **Canonical URL** | ✅ Implemented | `{origin}/{citySlug}/presence/{slug}` set via `usePageMeta` and SEO snapshot. |
| **Clean URL structure** | ✅ Implemented | `/charlotte/presence/business-name` — no query parameters, semantic slug. |
| **H1 hierarchy** | ✅ Correct | Single H1 for business name in `HeroHeader`. |
| **H2/H3 hierarchy** | ✅ Correct | H2 for section headers (About, Services, FAQ, Trust Signals, Languages, Explore More). H3 for sub-sections (Contact, Location, individual FAQ questions in snapshot). |
| **No duplicate H1** | ✅ Verified | Only one H1 per page. |

### 2. Structured Data (Schema Markup)

| Schema Type | Status | Location | Fields |
|-------------|--------|----------|--------|
| **LocalBusiness** | ✅ Implemented | `server/seo-snapshot.ts` `buildMicrositePresence()` | `name`, `url` (canonical), `address` (PostalAddress with streetAddress, addressLocality, addressRegion, postalCode), `telephone`, `sameAs` (website), `description` |
| **PostalAddress** | ✅ Implemented | Nested in LocalBusiness | `streetAddress`, `addressLocality` (city), `addressRegion` (state), `postalCode` (zip) |
| **AggregateRating** | ✅ Implemented | Conditional on `googleRating` | `ratingValue`, `reviewCount` |
| **FAQPage** | ✅ Implemented | `server/seo-snapshot.ts` | Full `mainEntity` array with `Question`/`AcceptedAnswer` pairs for each FAQ item |
| **BreadcrumbList** | ✅ Implemented | Server-side snapshot + client-side `JsonLd` component | Home → Zone → Category → Business Name |
| **Geo coordinates** | ❌ Not implemented | N/A | `latitude`/`longitude` fields not in schema — would need Places API data or manual entry |
| **Event schema** | ❌ Not implemented | N/A | Events attached to businesses don't generate `Event` schema on the microsite page |
| **Article schema** | ❌ Not implemented | N/A | Connected Pulse articles don't generate `Article` schema on the microsite |
| **Organization schema** | ⚠️ Partial | Uses `LocalBusiness` for all | Organizations could benefit from `Organization` or `NGO` type instead of `LocalBusiness` |

### 3. Internal Linking Structure

| Link Type | Status | Details |
|-----------|--------|---------|
| **Back to Hub/Directory** | ✅ Implemented | Both client breadcrumbs and snapshot nav links to `/charlotte/directory` |
| **Zone hub link** | ✅ Implemented | Breadcrumbs link to `/charlotte/directory?zone={zoneSlug}`, snapshot has zone directory link |
| **Category hub link** | ✅ Implemented | Category badges in hero now clickable (`Link` to `/{citySlug}/{categorySlug}`). Snapshot links to category hub. |
| **Related Pulses** | ✅ Implemented | "In the Pulse" section in Hub tab links to connected articles |
| **Cross-business linking** | ✅ Implemented | Snapshot includes "More in {Category}" and "More in {Zone}" sections with links to 5 related businesses |
| **Anchor text quality** | ✅ Good | Uses business names, category names, zone names — all meaningful |
| **Contextual vs. nav linking** | ✅ Both | Breadcrumbs (navigational), related businesses (contextual), category badges (contextual) |

### 4. Long-Tail Capture (Expert Q&A)

| Element | Status | Details |
|---------|--------|---------|
| **Indexable HTML** | ✅ Implemented | FAQ questions and answers rendered as full `<h3>`/`<p>` elements in SEO snapshot HTML — crawlers see all content without JavaScript |
| **Client-side rendering** | ⚠️ Accordion | FAQs use a toggle accordion on the client — answer text is hidden until clicked. However, the SEO snapshot serves all FAQ content to crawlers fully expanded. |
| **Anchor links per question** | ❌ Not implemented | Individual FAQ items don't have `id` attributes or anchor links |
| **FAQ schema** | ✅ Implemented | `FAQPage` JSON-LD with `Question`/`AcceptedAnswer` pairs for all FAQ items |
| **Heading structure** | ✅ Correct | H2 "Frequently Asked Questions" → individual items as H3 questions in snapshot |
| **Expert Q&A** | ⚠️ Partial | Expert Q&A renders on the client for Enhanced tier but is NOT included in the SEO snapshot HTML or schema |

### 5. AI Discoverability Readiness

| Element | Status | Details |
|---------|--------|---------|
| **Semantic HTML** | ✅ Good | Proper heading hierarchy, `<nav>`, `<section>`, `<ul>/<li>` for lists. Not div soup. |
| **Section labeling** | ✅ Good | Labeled sections: Services, FAQ, Trust & Credentials, Languages, Contact, Location, Social |
| **Structured content blocks** | ✅ Good | Services as list items, FAQ as Q&A pairs, trust signals with badge icons, contact info with tel/mailto links |
| **Content behind interaction walls** | ⚠️ Minor | FAQ answers hidden behind toggle on client — but fully visible in SEO snapshot for crawlers/LLMs |
| **Server-side rendering** | ✅ Implemented | SEO snapshot system injects full HTML for crawlers including all text content, FAQ, services, and internal links |
| **Snapshot content depth** | ✅ Rich | Includes name, tagline, description (500 chars), address, phone, website, category, neighborhood, services list, full FAQ Q&A, navigation links |

### 6. Content Depth Signals

| Element | Status | Details |
|---------|--------|---------|
| **Specialty sections** | ✅ Implemented | Services, micro-tags, trust signals expand keyword footprint |
| **Town/ZIP context** | ✅ Implemented | Zone name in title tag, meta description, breadcrumbs, and snapshot body text. PostalAddress includes city/state/zip. |
| **Thin-page risk (Charter)** | ⚠️ Low risk | Charter pages have description + services + up to 5 FAQs + trust signals — sufficient content for indexing |
| **Enhanced depth** | ✅ Good | Enhanced adds Expert Q&A (15 items), more FAQs (15), custom theme, gallery, more categories — meaningful additional content |

### 7. Multi-Language Structure

| Element | Status | Details |
|---------|--------|---------|
| **Hreflang tags** | ❌ Not implemented | No `<link rel="alternate" hreflang="es">` tags |
| **Alternate language indexing** | ❌ Not implemented | Spanish content is dynamically translated on the client via `useI18n()` hook — same URL for both languages |
| **Content separation** | ⚠️ Dynamic only | English/Spanish toggled client-side. No separate URLs (`/es/charlotte/presence/...`). Search engines see English only (SEO snapshot renders English). |

### 8. Performance Factors

| Element | Status | Details |
|---------|--------|---------|
| **Page load** | ✅ Fast | Vite-built SPA with code splitting. Crawler path serves static HTML (no JS execution needed). |
| **Image optimization** | ⚠️ Partial | Images served as-is (no WebP conversion, no srcset). Cover images have fixed aspect ratio constraints. |
| **Lazy loading** | ⚠️ Partial | Gallery images not explicitly lazy-loaded. Main cover image loads eagerly (correct for LCP). |
| **Blocking scripts** | ✅ None | Vite bundles are async/deferred. No blocking scripts above the fold. |
| **Snapshot caching** | ✅ Implemented | 60-second TTL cache for SEO snapshots prevents repeated DB queries. |

---

## B) Assessment

### 1. Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Traditional SEO Readiness** | **78/100** | Strong fundamentals: unique titles with geo context, proper heading hierarchy, canonical URLs, LocalBusiness + FAQPage JSON-LD, breadcrumbs, internal linking, server-side pre-rendering for crawlers. Deductions: no hreflang, no geo coordinates, no Event/Article schema, no per-question anchors, Expert Q&A not in snapshot. |
| **AI Answer-Engine Readiness** | **72/100** | Clean semantic HTML, structured FAQ content visible to LLMs, good section labeling, rich snapshot content. Deductions: FAQ answers hidden client-side (mitigated by snapshot), no Schema.org `speakable` markup, no separate language URLs for multilingual LLM retrieval, Expert Q&A not indexed. |

### 2. Gap List

#### Critical (Must Fix)
*All critical items have been fixed in this session:*
- ~~SEO snapshot missing for `/presence/:slug` routes~~ → **FIXED** (T003)
- ~~No FAQPage schema markup~~ → **FIXED** (T004)
- ~~No breadcrumbs on microsite pages~~ → **FIXED** (T005)
- ~~Category badges not linked~~ → **FIXED** (T006)
- ~~Title tag missing geographic context~~ → **FIXED** (T007)

#### High Impact
- **Add Expert Q&A to SEO snapshot**: Enhanced-tier Q&A content not included in snapshot HTML or schema. This is high-value long-tail content.
  - File: `server/seo-snapshot.ts` → `buildMicrositePresence()`
  - Pattern: Query `business_expert_qa` table, render as H3/P in snapshot, add to FAQPage schema
- **Add hreflang tags**: Spanish content exists but search engines don't know about it.
  - File: `client/src/hooks/use-page-meta.ts` → add `hreflang` link elements
  - File: `server/seo-snapshot.ts` → inject `<link rel="alternate" hreflang="es">` for crawler path
- **Add geo coordinates to LocalBusiness schema**: If latitude/longitude data becomes available (via Google Places), add `geo` to JSON-LD.
  - File: `shared/schema.ts` → add `latitude`/`longitude` fields to businesses table
  - File: `server/seo-snapshot.ts` → add `geo: { "@type": "GeoCoordinates", latitude, longitude }`
- **Add per-FAQ anchor links**: Each FAQ question should have an `id` attribute for deep linking (helps AI answer engines cite specific answers).
  - File: `client/src/pages/microsite.tsx` → add `id={faq-${index}}` to FAQ items
- **Organization schema for nonprofits**: Organizations should use `Organization` or `NGO` schema type instead of `LocalBusiness`.
  - File: `server/seo-snapshot.ts` → check `presenceType` and switch `@type` accordingly

#### Nice to Have
- **Event schema on microsites**: When businesses have attached events, generate `Event` JSON-LD.
- **Article schema for connected Pulses**: When Pulse articles mention the business, add `Article` schema.
- **Image optimization**: Add WebP conversion and `srcset` for responsive images.
- **Lazy loading for gallery**: Add `loading="lazy"` to gallery images below the fold.
- **Separate Spanish URLs**: Create `/es/` prefix routes for proper multilingual SEO (significant effort).
- **`speakable` Schema.org markup**: Mark key content blocks as speakable for voice search/AI assistants.
- **Hours of operation in schema**: Add `openingHoursSpecification` to LocalBusiness JSON-LD when hours data exists.
- **Review schema**: Individual reviews (not just aggregate rating) as `Review` schema items.

### 3. Competitiveness Assessment

| Competitor | Can Compete? | Notes |
|------------|-------------|-------|
| **Basic WordPress sites** | ✅ Yes | Superior structured data, better internal linking, pre-rendered content for crawlers, proper heading hierarchy. Most WordPress local business sites don't have FAQPage schema or breadcrumb JSON-LD. |
| **Google Business Profile** | ⚠️ Complementary | GBP dominates the map pack — this platform can't replace that. However, microsites provide deeper content (FAQs, services, trust signals) that GBP doesn't support. The two should work together: GBP for map visibility, microsite for content depth. |
| **AI answer results** | ✅ Yes (with caveats) | Clean semantic HTML, structured FAQ data, and pre-rendered content make these pages citable by LLMs. The FAQ content is particularly strong for question-answering. Adding Expert Q&A to the snapshot and per-question anchors would further strengthen this. |

---

*Report generated after implementing T003-T007 fixes. Pre-fix SEO score would have been ~55/100 (Traditional) and ~50/100 (AI) due to the missing presence snapshot route.*
