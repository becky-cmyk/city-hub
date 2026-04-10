# CityMetroHub - Multi-Tenant City Hub Platform

## Core Identity — "The Modern Local Section"

City Hub is what the local section of a newspaper used to be — rebuilt as a living platform for each community. Traditional metro newspapers included local sections or inserts for specific areas, towns, or districts. City Hub turns that local section into the core platform for the area itself — always updating, searchable, interactive, and multi-channel.

### Engine-to-Newspaper Mapping
Each engine maps to what a local newspaper section used to contain:
- **Hub Presence** → business listing / yellow pages (identity layer)
- **Pulse** → the living stream / heartbeat (what's happening now)
- **Directory + Categories** → yellow pages organized by place, not interest
- **Charlotte Recommendations** → neighbor word-of-mouth / trusted local tips
- **Marketplace** → classifieds section
- **Events** → community calendar
- **Stories / Articles** → local reporting and features
- **Media Network** (radio, podcasts, music, venue TV) → distribution across channels
- **Jobs / Workforce** → help wanted section
- **Print + Digital + TV + Radio + Physical Placements** → multi-channel distribution (not just digital)

### Anti-Drift Guardrails
City Hub is **not** just a directory, just a website, just a feed, or just a marketplace. Those are components or surfaces inside the system, not the core identity. The core identity is: **a modern local section / community newspaper system for each district or micro hub, distributed across print, digital, TV, radio, and real-world placements.**

See `docs/platform-identity.md` for the full positioning reference.

## Platform Architecture — Five-Layer Discovery System

### The Four Equal Discovery Channels
The platform is a four-channel discovery system where every piece of content is equally accessible through all four paths. No channel is more important than any other.

1. **Pulse** (Social Feed) — scroll and discover visually, like TikTok/Instagram. The living stream.
2. **Charlotte AI** (Conversational) — ask and discover through conversation. AI-powered local knowledge.
3. **Search** (Internal Search Engine) — type and find. Platform-native search across all content.
4. **Hub Pages** (Structured Browsing) — browse and navigate organized sections per neighborhood.

### Two-Tier Page Architecture
Every content category follows a two-tier page pattern:

**Tier 1: Landing Pages** (External Traffic Magnets)
- Purpose: SEO/AEO — attract traffic from Google, AI search engines, social media, direct URLs
- Characteristics: Clean URL, focused meta/schema, minimal nav, hero-driven, conversion-optimized
- Pattern: `LandingPageShell` wrapper, standalone marketing page
- Examples: `/charlotte/food`, `/charlotte/events`, `/charlotte/moving-to-charlotte`

**Tier 2: Hub Infrastructure Pages** (In-Platform Experience)
- Purpose: Geo-located discovery within the platform
- Characteristics: Full nav bar with Charlotte context, bottom nav, geo-sorted content sections, cross-links
- Pattern: `DarkPageShell` or equivalent with full hub chrome
- Examples: `/charlotte/explore/food`, `/charlotte/events/browse`, `/charlotte/neighborhoods/noda/food`

**Rule: Every category MUST have both tiers.** The landing page brings traffic in. The hub infrastructure page is where they experience it inside the platform.

### Navigation Architecture
**Mobile bottom nav** (5 tabs, `MobileBottomNav` in `public-layout.tsx`):
- Feed → `/pulse` (social Pulse stream; Home removed since city root redirects to /pulse on mobile — Home accessible via logo tap)
- Hubs → `/neighborhoods` (neighborhood grid)
- Search → opens QuickSearch overlay (universal search across all content types via `open-quick-search` custom event)
- Map → `/map` (discovery map)
- Live → `/live` (live feeds)

**Desktop top nav** (`SiteHeader` in `public-layout.tsx`):
- Core pills: Home, MyHub (auth-only), Feed
- Icon buttons: Neighborhoods, Events, Articles, Map + explore verticals (Food, Arts, Pets, Senior, Family, Jobs, Live, Marketplace, Commerce, Relocation)
- Right side: QuickSearch toggle, language toggle, theme, user menu

**Mobile top bar**: Logo, Charlotte AI guide, "Explore" hamburger dropdown (Home, MyHub, Events, Articles + explore verticals excluding items already in bottom nav), search, language, user menu.

**Custom events**: `open-charlotte-chat` opens Charlotte AI panel, `open-quick-search` opens QuickSearch overlay. Both dispatched via `window.dispatchEvent(new CustomEvent(...))`.

### Categories and Their Two Tiers
| Category | Landing Page (Tier 1) | Hub Infrastructure (Tier 2) | Status |
|----------|----------------------|---------------------------|--------|
| Food | `/charlotte/food` | `/charlotte/explore/food` | Both exist |
| Arts & Entertainment | `/charlotte/arts-entertainment` | `/charlotte/explore/arts-entertainment` | Both exist |
| Events | `/charlotte/events` | `/charlotte/events/browse` | Both exist |
| Jobs | `/charlotte/jobs` | `/charlotte/jobs/browse` | Both exist |
| Marketplace | `/charlotte/marketplace` | `/charlotte/marketplace/browse` | Both exist |
| Pets | `/charlotte/pets` | `/charlotte/explore/pets` | Both exist |
| Family | `/charlotte/family` | `/charlotte/explore/family` | Both exist |
| Senior | `/charlotte/senior` | `/charlotte/explore/senior` | Both exist |
| Commerce | `/charlotte/commerce` | `/charlotte/explore/commerce` | Both exist |
| Relocation | `/charlotte/moving-to-charlotte` | MISSING | Gap |
| Stock Photos/Media | MISSING | `/charlotte/gallery` exists | Gap |
| Speaker's Hub | MISSING | MISSING | Gap |
| Help a Reporter | MISSING | MISSING | Gap |

### Five Architecture Layers
1. **External Traffic** — Landing pages, SEO, AEO, domain URLs, social links
2. **Four Discovery Channels** — Pulse, Charlotte AI, Search, Hub Pages (all equal)
3. **Content & Presences** — Business profiles, events, articles, jobs, marketplace, experts, speakers, media
4. **Geo Intelligence** — Everything sorted/filtered by user location and hub neighborhood
5. **Data & AI** — Structured schema (JSON-LD), Charlotte's knowledge base, engagement signals, internal search

### SEO & AEO Strategy
- **Brand System**: `shared/city-branding.ts` is the single source of truth for all brand names, domains, and per-page brand rotation. Exports: `CityBranding` interface, `PageBrandContext` type, `getCityBranding(slug)`, `getBrandForContext(branding, context)`, `buildCityBranding(city)`, `PARENT_BRAND`, `CLT` shorthand. All `usePageMeta` calls must use `brand?.ogSiteName || "CLT Hub"` pattern.
- **Brand Names**: Five variants for Charlotte, managed in `shared/city-branding.ts` `brandVariants` array:
  1. **CLT Hub** — PRIMARY visible brand (all public UI text, meta titles, fallback default)
  2. CLT Metro Hub — `brandShort`, used in email from-lines and structured data
  3. Charlotte City Hub — search variant
  4. CLT City Hub — domain/search variant
  5. Charlotte Metro Hub — `brandLong`, formal full name, JSON-LD `name` field
- **Brand Rotation**: `getBrandForContext()` rotates variants by page type (home/hub/category/landing/article) for SEO diversity. JSON-LD `alternateName` arrays include all 5 variants.
- **AEO**: Every hub presence needs rich JSON-LD schema, FAQ data, expert topic tags, and neighborhood-specific content
- **Geo-Specificity**: Content tagged to neighborhoods (NoDa, South End, Indian Land), not just "Charlotte"

### Multi-Hub Authority & AEO Layer
Server-side SEO snapshot enrichment (`server/seo-snapshot.ts`) establishes each neighborhood hub as a distinct knowledge graph entity with authority signals:

- **Neighborhood Hub Place Entity**: `buildNeighborhoodHub` emits `@type: ["Place", "AboutPage"]` with `geo`, `containedInPlace`, `sameAs`, and `address`. Nearby hubs injected as crawler-visible `<nav>` in `rootHtml` using degree-distance approximation (69 mi/degree, 15mi radius).
- **Speakable (Voice/AI optimization)**: `SpeakableSpecification` with CSS selectors (`.hub-description`, `.faq-answer`, `.biz-description`) on neighborhood hub, vertical landing, microsite, and business detail pages.
- **Dataset Markup**: Aggregate business counts and category rankings emitted as `schema.org/Dataset` with `spatialCoverage`, `temporalCoverage`, and API distribution endpoint.
- **Person (E-E-A-T)**: Expert/contributor structured data from microsite expert blocks and executive director fields. Includes `knowsAbout`, `areaServed`, `worksFor`, `jobTitle`.
- **ClaimReview**: Verified businesses (`charlotteVerificationStatus === "verified"`) emit `ClaimReview` with `Rating` and `author` referencing the platform brand.
- **sameAs Enrichment**: Businesses build `sameAs` arrays from `websiteUrl`, `googleProfileUrl`, `googlePlaceId` (maps URL), and `sourceUrl`.
- **Entity Cross-Linking**: Events reference hosting businesses via `organizer`/`location`. Articles reference mentioned businesses via `schema.org/mentions`. Job listings emit `JobPosting` with `hiringOrganization` referencing the parent business `LocalBusiness`.

### Geo-Location Rules
- Every page is geo-aware. User location detected and used to sort/filter content.
- Hub pages: Content sections show items nearest to that hub first.
- Pulse feed: Hub circles sorted by proximity to detected location.
- Landing pages: Metro-wide entry points; geo-sorting happens inside the platform.
- User landing preference: Logged-in users can choose Pulse or Hub as default landing.

### Universal Geo Coordinates
- **First-class lat/lng fields** on `events`, `articles`, and `job_listings` tables (numeric columns).
- **Geocoding utility** at `server/services/geocoding.ts`: `geocodeAddress()`, `geocodeFromParts()`, `getZoneCentroid()`, `getBusinessCoordinates()`, plus `toFiniteCoord()` and `hasValidCoords()` helpers for safe numeric validation. Uses Google Geocoding API with 24h in-memory LRU cache.
- **Import pipeline wiring**: Admin event creation, content-intake single/bulk publish, RSS event detection in jobRunner, workforce job listing creation — all auto-geocode with fallback chain: explicit coordinates → address geocode → business coordinates → zone centroid.
- **Unified map** (`server/map-routes.ts`): Events, jobs, and other content types use own lat/lng first, then fall back to business coordinates, then zone centroid. All coordinate parsing uses `toFiniteCoord()` for safe validation.
- **JSON-LD structured data**: Event detail emits `GeoCoordinates` in Place; article detail emits `contentLocation` with `GeoCoordinates`; neighborhood hub emits `Place` schema. All guarded by `Number.isFinite()` checks.
- **SEO snapshot** (`server/seo-snapshot.ts`): Neighborhood hub builder adds `Place` schema with `GeoCoordinates` from region centroid.

### Events Phase 2 — Native Ticketing & Check-in
- **Native Stripe-powered ticket purchases**: `POST /api/events/:eventId/checkout` creates Stripe Checkout sessions for paid tickets. Webhook handler `handleEventTicketPurchase` in `server/stripe/webhook.ts` creates `ticket_purchases` rows with QR tokens on fulfillment.
- **Revenue split**: 40% platform / 30% operator / 30% organizer. **DO NOT CHANGE THIS FORMULA.** Split is computed in webhook and displayed in admin/owner dashboards.
- **QR code check-in**: Each purchase gets a UUID `qr_token`. Check-in via `POST /api/events/:eventId/checkin/:token`. Scanner page at `/:citySlug/events/:slug/checkin`. Supports camera scanning (BarcodeDetector API) and manual token entry.
- **Waitlist management**: `POST /api/events/:eventId/waitlist` for public signup. Admin can notify waitlisted users via `POST /api/admin/events/:eventId/waitlist/:entryId/notify` which sends email via Resend.
- **Custom registration fields**: `event_ticket_types.custom_fields` (JSONB) stores field definitions (name, label, type: text/dropdown/checkbox/textarea, options, required). Responses stored in `ticket_purchases.custom_field_responses`.
- **Free RSVP**: `POST /api/events/:eventId/rsvp-free` for free ticket types. Auto-resolves ticket type if none specified.
- **Add to Calendar**: `.ics` file export via `GET /api/events/:eventId/ics` and Google Calendar deep-link on event detail + confirmation pages.
- **Admin attendee management**: Attendees tab in Events Command Center shows ticket purchases, manual check-in buttons, CSV export, waitlist management, and revenue breakdown.
- **Organizer earnings**: Owner dashboard events section has "Earnings" tab showing tickets sold, gross revenue, and organizer share.
- **Key tables**: `ticket_purchases` (with `qr_token`, `checkin_status`, `stripe_session_id`), `event_waitlist` (with `notified_at`, `converted_at`), plus `price_cents` and `custom_fields` columns on `event_ticket_types`.
- **Frontend pages**: `event-checkin.tsx` (scanner), `event-confirmation.tsx` (post-purchase QR display), ticket selector UI on `event-detail.tsx`.

### Strategic Moat Features (Architectural Direction)
1. **Community Knowledge Graph** — Surface existing relationship data (cms_content_relations, content_tags, expert Q&A) to users and AI engines. Show "Related Businesses" and "Connected in [Hub]" on profiles and hub pages.
2. **Cross-Channel Amplification** — Content created in one channel automatically enriches all four. Charlotte learns from new articles. Stories auto-flow to Pulse. Search indexes conversation data.
3. **Neighborhood Authority Scores** — Public-facing scores per hub per category based on content density. "NoDa is Charlotte's #1 hub for Food."
4. **Business Owner Discovery Dashboard** — Real-time cross-channel view: "Discovered 47 times this week — 20 via Pulse, 12 via Search, 10 via Charlotte, 5 via Hub browsing."
5. **Geo Cross-Vertical Neighborhood Context** — Every detail page (business, event, article, marketplace) shows nearby content from OTHER verticals within 1.5 mi. Registry-based (`shared/neighborhood-context.ts`): every vertical (business, event, article, marketplace, attraction, job) declares its table/fields/URL pattern. API: `GET /api/cities/:citySlug/nearby?lat=&lng=&sourceType=&radius=`. Frontend component: `client/src/components/neighborhood-context.tsx`. JSON-LD cross-vertical enrichment on all detail pages via `buildNearbyJsonLd()`. **ARCHITECTURAL RULE**: Every new vertical (tourism, hotels, schools, etc.) MUST register in `shared/neighborhood-context.ts` and include `<NeighborhoodContext>` on its detail page. No special wiring needed — registration auto-participates in cross-referencing.

## Product Vision — "Business in a Box"
City Metro Hub (CMH) is a **complete, all-in-one platform** for running a city-focused media, directory, and licensing business. The vision is that anyone buying a CMH metro or micro license gets **everything they need** — no extra apps, no extra subscriptions, no extra setup. One login, one dashboard, one brand.

### What CMH Provides in One Package
1. **CRM & Relationship Tools** — Contacts, referral tracking (ReferMe triangles), nudge system (8/day budget, 5 types scored), engagement tracking. Built natively, NOT using Living Contacts as a dependency. The organizations (businesses/directory listings) in CMH ARE the CRM spine — contacts attach to them. **Contact/Business Independence**: `business_contacts` has a `crmContactId` FK referencing `crm_contacts.id` (source of truth) and a `source` column (MANUAL/CAPTURE/CRAWL). `communication_log` has a `crmContactId` FK so history travels with the person. Capture flow sets first contact as OWNER/isPrimary. Website crawl auto-creates `business_contacts` + `crm_contacts` records from verified crawl data (confidence >= 80). Low-confidence crawl results create admin inbox review items. Background enrichment failures create structured inbox exception items instead of silently dying.
2. **Catch** — Mobile-first launcher. The field operator's home screen. `/capture` is the primary operator entry point (installable as home screen app via PWA manifest). `/face` is the field tools dashboard with GPS trip tracker, catch/scan, **Nearby Businesses** (geo-lookup), referral wizard, digital cards, hub switcher. **Nearby Businesses**: GPS-based lookup (`GET /api/field/nearby-businesses?lat=&lng=&radius=&limit=`) returns businesses sorted by haversine distance with claim status, category, zone, contact info, Google ratings. Radius selector pills (0.25/0.5/1/2 mi). Each card opens **Field Activation** detail: editable fields (name, phone, email, website, address, description), operator notes (persisted to CRM), three actions: Save Changes (`PATCH /api/field/businesses/:id`), Activate Presence (`POST /api/field/businesses/:id/activate` — sets `activationSource:"field"`, `presenceStatus2:"DRAFT"`, optional verification code), Share Story (opens tell-your-story with activate intent). Visit auto-logged via `POST /api/field/businesses/:id/log-visit`. All field endpoints use `requireAdminOrOperator` auth. Both pages use `FieldAuthGuard` with inline login form (no redirect to separate login pages). Dark gradient background using hub brand colors, amber CTA, haversine distance tracking. PWA manifest (`manifest.json`) enables "Add to Home Screen" — standalone display, purple branding, `start_url: /capture`. **Share Target**: manifest `share_target` config lets operators share URLs/text/images/files from other apps into Catch (Android; iOS pending Apple support). Shared content POSTs to `POST /api/share-target` which saves files to `uploads/share-target/` and redirects to `/capture?shared=1&...`. Capture page detects query params and auto-populates: images → AI card analysis, vCards → parsed contact fields, URLs → website field, text → notes. No service worker / no offline caching. **Card Scan Enhancements**: Camera viewfinder shows card-shaped guide frame (3.5:2 aspect, corner brackets, "Align card within frame" hint) for `person` intake. Photo is cropped to guide area (accounts for object-cover scaling). Import from Phone modal uses custom portal (not Shadcn Dialog) with `onPointerDown` handlers for reliable iOS touch. Card image (`businessCardImageUrl`) flows end-to-end: saved on CRM contact, passed to auto-created business listings as `imageUrl`, and set on existing listings if missing. Review form shows larger card thumbnails (h-32) with labeled "Captured Card" header. **Preview System**: Success screen has preview for all outgoing messages: (1) Claim Email — "Preview" button next to Send fetches `GET /api/admin/businesses/:id/claim-preview` and renders HTML in sandboxed iframe modal; (2) Confirm Info Email — "Preview Email" button fetches `GET /api/capture/preview-confirm-email` with contact/operator names + includeCard flag, renders branded confirmation email in iframe; (3) Text Message — "Preview Text" button builds SMS text client-side, displays in chat-bubble-style modal with character/segment count. All previews share a single z-[110] modal with `onClick` dismissal.
3. **AI-Powered Website Creator** — For Enhanced/Expanded Presence tier businesses. GPT-4o-mini generates complete bilingual microsites from a prompt. Block-based architecture, 12 block types, 4 templates. Admin Site Builder (`client/src/pages/admin/admin-site-builder.tsx`) allows admins to build/edit microsites for any business via admin API routes (`/api/admin/presence/:id/blocks|template|generate-site|regenerate-block`). Accessible from "AI Site Builder" in admin sidebar under Hub Operations.
4. **Tiered Directory Listings (3-Tier Public Model)** — Three public-facing tiers: **FREE** (browse-only, 0 credits, directory listing + basic profile, no distribution), **VERIFIED** ($1 one-time, 5 credits/mo, claim management + community posting + badges, 1 hub/1 cat/3 micro), **ENHANCED** (retail $699/yr intro $99/yr, 15 credits/mo, full microsite + gallery + media blocks + priority ranking + custom domain + FAQ + expert Q&A + video embed + reviews, 2 hub/3 cat/5 micro, feed visibility + featured eligible). The `listing_tier` pgEnum includes additional values (PREMIUM, CHARTER, NONPROFIT, ORGANIZATION, HEALTHCARE_PROVIDER) — Charter/Chamber normalize to VERIFIED in all code paths; others are special-purpose internal tiers, not public upgrade targets. There is NO ENTERPRISE tier in the database enum. Package Matrix admin panel under Tools & Settings. `server/access-config.ts` defines `TIER_INCLUSIONS`, `ACTION_MATRIX` (26 actions with minTier/addon/credit gates), `DISTRIBUTION_RIGHTS` per tier, and `resolveActionAccess()`. `tier_change_log` table tracks all tier transitions with old/new/changedBy/note/timestamp. **Module Gating UX**: `client/src/hooks/use-business-access.ts` provides `useBusinessAccess()` hook that fetches full access resolution from `GET /api/cities/:citySlug/owner/:slug/access-check` (resolves all modules + all actions with tier/addon/credit status). `tierAtLeast(current, min)` helper for tier comparison. `client/src/components/gated-section.tsx` provides `GatedSection` (wraps content, shows locked card with upgrade paths when access denied), `GatedButton` (disabled with lock icon when denied), `TierBadge` (color-coded). `client/src/components/credit-confirm-dialog.tsx` provides credit spend confirmation modal (shows cost, current balance, balance after). `server/entitlements.ts` exports `requireTier(minTier)` middleware for backend API protection. All frontend tier checks use `tierAtLeast()` instead of hardcoded `=== "VERIFIED"` comparisons. `TierComparisonSection` shows upgrades above current tier (not just VERIFIED→ENHANCED).
5. **CMS & Content Pipeline** — Headless CMS with draft→review→publish workflow. Content auto-feeds in from RSS, iCal, Google Places, photo capture, URL extraction, CSV import. Auto-categorization via AI. **CORE RULE: Pulse is the unified discovery surface for ALL engines.** Any engine that produces a valid, published, active object is eligible to appear in Pulse. RSS items auto-approve (no manual review bottleneck). Articles/Stories page and Vertical Hub stories also include RSS items alongside hand-written articles. Events calendar includes RSS event-source items (e.g., Blumenthal Arts) as a filterable "Shows & Performances" layer. All businesses (not just paid tiers) are eligible for Pulse. Content sources: RSS feeds (AI-rewritten), author/contributor written, user-submitted (approval gate), capture-to-AI generated.
6. **Public Registration & Personal Hubs** — Public users register, manage their personal micro/hub (Home/Work/Play contexts with ZIP and radius). Save items, submit content, write reviews.
7. **Backend Management** — Full admin panel with CMS, content moderation, CRM, revenue tracking, operator management. Charlotte AI assistant for admin tasks. **Two-Mode Admin Experience**: Admin dashboard has Platform HQ mode (franchise headquarters view) and Metro mode (city-specific local admin). Mode state persisted in localStorage (`adminMode`), exported from `useAdminCitySelection()` in `client/src/hooks/use-city.ts`. Only SUPER_ADMIN users can access Platform mode — non-super admins are force-redirected to Metro mode. **Platform HQ** (`client/src/pages/admin/platform-hq-dashboard.tsx`): company-wide overview with active metros, MRR, total businesses, operators, territories sold/available, metro pipeline funnel, revenue by metro, pending license deals. Backend: `GET /api/admin/platform/stats` (platformGuard). **Sidebar** (`client/src/pages/admin/admin-sidebar.tsx`): mode switcher buttons in header (violet for Platform, primary for Metro), sidebar groups filter by mode — Platform shows Overview/Sales/Operations/Finance/Governance groups, Metro shows existing metro-scoped groups. City switcher only visible in Metro mode. **CRM Scope**: `crm_contacts.contact_scope` column (platform/metro/both, default metro) — `/api/crm/contacts` accepts `?scope=platform|metro` query param to filter contacts by admin mode.
8. **Revenue & Licensing** — Stripe-integrated. Every transaction tracks which Metro or Micro operator sold it. Revenue splits calculated dynamically. Territory hierarchy: City Metro Hub → Metro → Micro. **ITEX Barter Network**: Businesses can be tagged as ITEX members (barterNetworks text[], barterMemberId admin-only). ITEX badge shown on business cards and detail pages. Directory filterable by ITEX acceptance. Admin can record ITEX trades for platform services (ads, listings, licenses) via "ITEX Barter Trades" panel — creates revenue_transactions with paymentMethod="itex". For listing tier trades, entitlements are auto-created. Payment methods (acceptedPayments text[]) also tracked per business with icon display on detail pages. **Revenue Control & Pricing Enforcement Layer**: Centralized pricing via `platform_prices` table (linked to `platform_products`, billing interval, price amount, currency, Stripe price ID). `metro_pricing_overrides` table (inheritance ON by default, overrides OFF) allows per-metro pricing. `user_entitlements` table provides unified user-scoped entitlement records with metro awareness and source tracking (stripe/manual/promo/migration). `getEffectivePrice({ productId, metroId, billingInterval })` helper resolves correct price (metro override first, then platform). `stripeSyncService` (`server/stripe/stripeSyncService.ts`) validates DB↔Stripe alignment without auto-creating/modifying Stripe objects. Admin Pricing panel under Platform Finance shows products, prices, Stripe IDs, audit results, and metro inheritance status. Cora CFO hat answers pricing queries, shows platform vs metro pricing, and routes change requests through plan/approve workflow.
    **Content Sponsorships & Boosts** (`server/revenue-routes.ts`, `client/src/pages/admin/revenue-controls-panel.tsx`): CMS content items can be flagged as sponsored (`is_sponsored`, `sponsor_id`, `sponsorship_type` TEXT — NATIVE/BRANDED/AFFILIATE/PROMOTED). `content_boosts` table provides timed visibility boosts (level 1-5, duration in days, ACTIVE/EXPIRED/CANCELLED status). Admin Revenue Controls panel with Sponsorships, Boosts, and Ad Slots Overview tabs. Public endpoints: `GET /api/sponsored-content?cityId=`, `GET /api/active-boosts?cityId=`. Stripe priceMap entries: `CONTENT_BOOST`, `CONTENT_SPONSORSHIP`.
    **Communication Expansion Layer** (`server/communication-routes.ts`, `client/src/pages/admin/communications-hub.tsx`): Multi-channel communication framework. `comms_channel` enum extended with VOICE (EMAIL/SMS/VOICE). **SMS Templates** (`sms_templates` table): reusable message templates with category (INTRO/FOLLOW_UP/BOOKING_REMINDER/CLAIM_PROMPT/WELCOME/CUSTOM), char count tracking, active toggle. **Voice Prompts** (`voice_prompts` table): scripted prompts with type (GREETING/VOICEMAIL/IVR_MENU/ESCALATION/FOLLOW_UP), call trigger (INBOUND_CALL/OUTBOUND_CAMPAIGN/MISSED_CALL_CALLBACK/SCHEDULED_FOLLOWUP/MANUAL), optional SSML markup, voice profile link. **Communication Sequences** (`communication_sequences` + `sequence_steps` tables): multi-step automated flows with trigger events (CONTACT_CREATED/LISTING_CLAIMED/BOOKING_CONFIRMED/FOLLOW_UP_DUE/MANUAL), per-step channel selection, delay timing, condition gating (ALWAYS/NO_RESPONSE/NO_OPEN), fallback channels. Sequence lifecycle: DRAFT→ACTIVE→PAUSED→ARCHIVED. **CRM Channel Preference**: `crm_contacts.preferred_channel` auto-resolved on creation (SMS if phone present, EMAIL otherwise). **Admin UI**: Communications Hub expanded with 9 tabs — Channel Health overview (per-channel sent/reachable metrics, template/prompt/sequence counts, delivery failures), Email Templates, Campaigns, SMS Conversations, SMS Templates, Voice Prompts, Sequences, Weekly Digest, Suppression. API: `GET/POST/PATCH /api/admin/comm/sms-templates`, `GET/POST/PATCH /api/admin/comm/voice-prompts`, `GET/POST/PATCH /api/admin/comm/sequences`, `GET /api/admin/comm/channel-health`, `POST /api/admin/comm/trigger-sequence`. `resolvePreferredChannel()` exported for use in CRM contact creation flows.
9. **Your Office Tools** — Trip Tracker/Mileage logging, Receipt Catcher, Route Planner — bundled into the license to increase value.
10. **Digital Cards** — Each person's profile IS their digital card. Three image slots: card image (photo of physical card or designed graphic), person photo (headshot), company/hub logo (auto-populated from hub city data). Shareable with QR codes (client-side generation via `qrcode` package), downloadable vCard (.vcf) files, and trackable views. Public card view at `/card/:slug`. **Built-in Calendar Booking**: Native scheduling system — card owners configure weekly availability (days, hours, slot duration, timezone, buffer between meetings, max days ahead), and visitors book directly from the public card page. Bookings stored in `card_bookings` table. iCal feed at `/api/card/:slug/calendar.ics` for subscribing in Google Calendar / Apple Calendar / Outlook. External calendar URL fallback (`calendarUrl` field) for Calendly/Cal.com users. Admin bookings view with cancel capability. Public booking flow: date picker → time slot grid → guest info form → confirmation with .ics download.
11. **Charlotte AI** — The AI assistant name matches the metro hub (e.g., "Charlotte" for Charlotte hub). CRM-aware (admin side): knows contacts, referrals, nudges. Uses ask-before-acting pattern. **Public-facing**: Charlotte is the public face during pre-launch. Her system prompt in `server/charlotte-public-routes.ts` contains comprehensive knowledge about the platform: Pulse feed, Digital Cards, 19-county coverage (140+ communities), pricing (Verified $1 one-time; Enhanced retail $699/yr / intro $99/yr), competitive differentiators vs CLT Today / Charlotte's Got a Lot, Hub Builder opportunity, participation paths. Fully bilingual greetings and responses. **Charlotte Flows** — modular conversational interview engine (`server/charlotte-flows.ts`, `server/charlotte-public-routes.ts`). Two flows: (1) **Opportunity Profiling** — during activation/claim, Charlotte asks 9 category-aware questions (venue screens, marketing spend, events, growth needs) via OpenAI tool-calling, saves each answer immediately to `charlotte_flow_sessions` + `businesses.opportunityProfile`, computes Revenue Opportunity Scores (Hub TV / Listing Upgrade / Ad Buyer / Event Partner) in `server/opportunity-scoring.ts`, recommends best entry point. Integrated into activate.tsx as "profile" step between confirm and payment. (2) **Story Interview (Conversation Intelligence v2)** — public route `/:citySlug/tell-your-story` (QR destination). Now modular information-target system: 24 `CONVERSATION_MODULES` in `shared/schema.ts` with priorities (core/contextual/opportunistic), example prompts, applicable personas, extraction categories. 7 `CONVERSATION_PERSONAS` (business_owner, long_time_resident, newcomer, event_host, shop_venue_owner, entrepreneur_side_hustle, hiring_business) drive module selection. Engine in `server/charlotte-conversation-modules.ts`. Story depth scoring (0-100) in `server/story-depth-scoring.ts` across 5 topic groups. Tool-calls: `save_conversation_data`, `extract_lead`, `generate_spotlight_article` (~2000-word spotlight or 300-word brief). 8 `EXTRACTION_CATEGORIES` (story_material, lead_generation, community_intelligence, job_board, marketplace, venue_tv, media_sources, entrepreneur_ecosystem). Session fields: `detectedPersona`, `extractedSignals` (JSON), `modulesCompleted` (text[]), `storyDepthScore`. Tell Your Story UI shows 5-topic progress bar. **Admin Conversation Pipeline** (`ConversationPipelinePanel` in dashboard.tsx) under Metro Intelligence: signals grouped by category with action buttons (Create Contact, Flag TV Prospect, Create Marketplace). Signal endpoints: `POST /api/admin/signals/create-contact`, `/flag-tv-prospect`, `/create-marketplace`. Old `STORY_INTERVIEW_QUESTIONS` kept deprecated. Zero friction, no login. **Venue Screen Tracking**: `venueScreenProvider`, `venueScreenProviderOther`, `venueScreenLikely` fields on businesses table. Auto-flag from Google Places types (bar, restaurant, night_club, gym, cafe, etc.) during capture enrichment. Backfill on startup via `backfillVenueScreenLikely()`. Admin can filter by opportunity scores and screen likelihood. Flow Sessions panel in admin sidebar under Intelligence.
    **Visitor Feedback Reliability**: Charlotte public guide uses `report_visitor_feedback` OpenAI tool to save user complaints/bug reports/suggestions to admin inbox (`onVisitorFeedback()` in `server/admin-inbox.ts`). Prompt in `server/ai/prompts/public-guide.ts` mandates tool call before conversational response. **Fallback path**: When OpenAI API is unavailable (429 quota errors, etc.), keyword-based detection in the error handler (`server/charlotte-public-routes.ts`) saves feedback-like messages directly to admin inbox without AI involvement. Categories auto-classified as `bug` or `suggestion`. Admin inbox polls every 30s via `/api/admin/inbox/unified/count`. Items appear under Inbox in admin sidebar.
    **Charlotte Background Tasks & Light Memory**: Admin-only background task system. Schema: `charlotte_tasks` table (id, type via `charlotte_task_type` enum [capture_processing/followup_generation/proposal_generation/story_generation/outreach_drafting/general], title, payload jsonb, status via `charlotte_task_status` enum [awaiting_approval/pending/running/completed/failed/cancelled], progress int, result jsonb, error text, source text, proposedPlan jsonb, operatorFeedback text, approvedAt, completedAt, retryCount int). `charlotte_memory` table (id, scope via `charlotte_memory_scope` enum [admin_ops/admin_chat/system], type via `charlotte_memory_type` enum [context_note/task_result/conversation_summary/system_observation], content text, referenceId, expiresAt — auto 30 days). **Task Worker** (`server/services/charlotte-task-worker.ts`): 10s interval polling, picks up `pending` tasks (limit 3), dispatches to type handlers (capture_processing → processCaptureBatch, proposal_generation → executeProposal, story_generation → generateStoryForCapture, outreach_drafting → runOutreachDrafter), records results to memory. Prunes expired memory every ~1 hour. **Task API** (`server/charlotte-task-routes.ts`): All routes require admin auth. CRUD + approve/reject/retry/feedback/delete/stats. `createCharlotteTask()` exported for internal use. **Charlotte Chat Tools**: `create_background_task` (proposes plan, creates task in awaiting_approval), `get_recent_tasks` (status check), `record_context_note` (saves memory). **Memory Injection**: `getRecentAdminMemory()` + `buildMemoryContext()` inject recent admin memory into Charlotte admin chat system prompt. **Admin UI** (`client/src/pages/admin/charlotte-tasks-panel.tsx`): Task list with status filter tabs, approve/reject/retry/feedback/delete controls, progress bars, expandable plan view. Sidebar entry under Operator group.
    **Charlotte Public Memory & Intelligence Layer**: Aggregates public user interaction patterns (search queries, Charlotte chat questions, flow sessions) and surfaces them to admins. Schema: `charlotte_public_insights` table (id, insightType via `charlotte_insight_type` enum [trending_search/common_question/unanswered_query/demand_signal/hot_neighborhood], content jsonb, timeWindow text [24h/7d/30d], cityId FK, rank int, createdAt). **Aggregation Worker** (`server/services/charlotte-insights-worker.ts`): 30-min interval, per-city per-window aggregation — trending searches from `language_usage_log`, common questions from `charlotte_public_messages` (joined via `charlotte_flow_sessions.chat_session_id` for city scoping), unanswered queries (search terms with zero matching businesses), demand signals (popular searches with few/no listings + location hints), hot neighborhoods (zone-based search activity). **API** (`server/charlotte-insights-routes.ts`): `GET /api/admin/charlotte/insights?type=&timeWindow=&cityId=`, `GET /api/admin/charlotte/insights/stats?timeWindow=&cityId=`, `POST /api/admin/charlotte/insights/refresh` — all behind requireAdmin. **Charlotte Chat Tool**: `get_public_insights` in charlotte-chat-routes.ts — Charlotte can answer "what are people searching for?" with live data. **Admin UI** (`client/src/pages/admin/charlotte-insights-panel.tsx`): 5-tab panel (Trending Searches, Common Questions, Unanswered Queries, Demand Signals, Hot Neighborhoods), time range selector (24h/7d/30d), city-scoped, auto-refresh, manual refresh button. Sidebar entry "Public Intelligence" under Operator group.
    **Charlotte-Based Business Activation** (`?intent=activate` on Tell Your Story page): Charlotte conversationally collects all activation data (business name, type, category, neighborhood/ZIP, phone, email, website, role) instead of the multi-step form. 6-phase flow: (1) Basics, (2) Details, (3) Lookup & Claim via `activate_presence` tool (fuzzy-match or silent create — Charlotte ALWAYS says "I found your listing", NEVER "creating"), (4) Verify via `send_verification_code` + `verify_code` tools (email/SMS 6-digit code typed in chat), (5) Opportunity Profiling, (6) Story Interview Offer. No $1 Stripe payment — the conversation is the spam barrier. Sets `isVerified: true`, `listingTier: "VERIFIED"`, `activationSource: "charlotte"`. Session-bound security: verification tools enforce `businessId === flowSession.businessId`. Tools in `server/charlotte-public-routes.ts`, prompt in `server/charlotte-flows.ts`, schema module `activate_presence` in `shared/schema.ts`. **Intent-aware fallback routing**: When AI fails, each intent routes to its matching form: story→StoryFormFallback, event→`/submit/event`, shout-out→`/submit/shout-out`, nominate→`/submit/article`, activate→`/activate`. CTAs on Coming Soon page and Pulse feed (5th Share with Charlotte option).
12. **Natively Bilingual** — Full EN/ES. Auto-translation via GPT-4o-mini on all saved content. UI has 370+ translation keys. Charlotte responds in user's locale.
13. **City Hub Media Network** — Complete media infrastructure for each city hub:
    - **Music Library** (`server/music-routes.ts`, `client/src/pages/admin/music-library-panel.tsx`, `client/src/pages/music-showcase.tsx`): Local artist submissions with license agreement. Tracks with mood tags (chill/focus/upbeat/nightlife/background), energy levels (low/medium/high), genre filtering. Admin manages artists/tracks (approve/reject/suspend), mood presets, venue audio profiles. Public showcase at `/:citySlug/music`.
    - **Mood Presets**: 8 seeded defaults (Coffee Shop Chill, Nightlife Energy, Office Focus, Gym Pump, Sunday Brunch, Family Dining, Happy Hour, Retail Vibe). Each preset defines mood tags, genre filters, and energy levels. Admin can create/edit/delete presets.
    - **Venue Audio Profiles** (`venue_audio_profiles` table): Each venue (tv_screen) gets a custom audio profile — preset selection or custom mood/genre/energy overrides, excluded genres/artists, volume level, music/talk/ad toggles, music mix percentage. Controls what music plays in their space.
    - **Podcast Directory** (`server/podcast-directory-routes.ts`, `client/src/pages/admin/podcast-directory-panel.tsx`, `client/src/pages/podcast-directory.tsx`): Local podcast submissions with approval workflow. RSS import for episodes. Admin manages podcasts/episodes, toggles featured. Public directory at `/:citySlug/podcasts`. **Podcast-to-Pulse Pipeline**: Approved podcast episodes from `local_podcast_episodes` (joined with `local_podcasts` where `status="approved"`) auto-flow into the Pulse feed as `type:"podcast"` cards with audio player via `projectLocalPodcastEpisode()` in `feed-service.ts`. Integrated into both `queryFeedDirect` and `queryFeedViaTags` paths.
    - **Hub Radio** (`server/radio-routes.ts`, `client/src/pages/admin/radio-management-panel.tsx`, `client/src/pages/radio-player.tsx`): Radio stations (metro/micro/venue types). Segment queue (music/talk/ad/announcement/interview/expert_show). Auto-playlist generation respects venue audio profiles. Public player at `/:citySlug/radio` with now-playing, queue, schedule, live broadcast indicator.
    - **Radio Advertising** (`server/radio-ad-routes.ts`, `client/src/pages/admin/radio-ads-panel.tsx`): 9 seeded ad tiers (metro/micro/venue × prime/standard/overnight, $15-$199/month). Booking lifecycle (pending→approved→active→paused→completed). Audio creative upload/preview. Revenue tracking.
    - **Live Broadcasts** (`server/live-broadcast-routes.ts`, `client/src/pages/admin/live-broadcast-panel.tsx`): Schedule/go-live/end lifecycle. Interview/event/show/breaking types. Recording attachment. Viewer counts.
    - **Venue Opt-In via Charlotte** (`?intent=venue` on Tell Your Story page): QR scan → Charlotte conversation → collects venue name/type/address/foot traffic, music vibe preferences (preset or custom), contact info → `register_venue` tool creates tv_screen + crm_contact + venue_audio_profile. Charlotte says "I found your space" (never "creating").
    - **Radio Revenue Commission Splits** (`server/services/revenue.ts`): 15% global allocation (10% Community/Nonprofit Fund + 5% Hub Growth Fund) deducted first, then: Metro Radio: Core 55%, Metro 15%, Micro Pool 10%, Ambassador 15% (one-time), Ops 5%. Micro Radio: Core 50%, Metro 10%, Micro 20%, Ambassador 15%, Ops 5%. Venue Radio: Venue 30%, Core 30%, Metro 10%, Micro 10%, Ambassador 15%, Ops 5%.
    - **Admin Sidebar**: "Media Network" group with Music Library, Podcast Directory, Hub Radio, Radio Advertising, Live Broadcasts.
    - **Schema tables**: `music_artists`, `music_tracks`, `music_mood_presets`, `venue_audio_profiles`, `local_podcasts`, `local_podcast_episodes`, `radio_stations`, `radio_segments`, `radio_ad_tiers`, `radio_ad_bookings`, `live_broadcasts`.
14. **Phase 1 Creator Economy** — Three public-facing creator economy features:
    - **Public Stock Photo Gallery** (`client/src/pages/gallery.tsx`): Public page at `/:citySlug/gallery`. Displays approved `cms_assets` (images with `status="approved"`) scoped to the city via linked business or hub slug. Grid layout with hover credit overlay, tag filtering, search, lightbox with full credit attribution, linked business, license info. API: `GET /api/cities/:citySlug/gallery` with optional `?tag=&hubSlug=&categoryId=&licenseType=` filters.
    - **Public Expert Directory** (`client/src/pages/expert-directory.tsx`): Public page at `/:citySlug/experts`. Shows businesses with `LOCAL_EXPERT` profile badge enabled. Cards display credentials, topics of expertise, "Available for Quotes" indicator. Topic filtering, search. Links to full business profile. API: `GET /api/cities/:citySlug/experts` returns businesses joined with `profile_badges` metadata. **Expert Pro**: Featured experts (badge metadata `featured: true`) sort to top with gold border + star badge. API returns `featured` flag.
    - Both pages use `DarkPageShell` with amber accent theming, `OpenCityRoute` routing.
15. **Phase 2 Stock Photo Economy** — Per-photo pricing with watermark protection and Stripe checkout:
    - **Schema**: `cms_assets` extended with `priceInCents` (admin-set per-photo price) and `hubUseApproved` (boolean toggle for operator Hub TV/social/ad use). `photo_purchases` table tracks buyer, amount, Stripe session, download token. `photo_download_limits` table enforces monthly download caps (default 10/month per buyer email, keyed by YYYY-MM).
    - **Watermark + Copy Protection**: Gallery uses CSS-only protection — background-image divs (no `<img>` tags), repeating "CLT HUB" watermark overlay at 12% opacity rotated -30deg, `onContextMenu` disabled, `pointer-events: none` on image layer, `userSelect: none`, `draggable: false`, transparent overlay div blocks drag. Applied to both grid thumbnails and lightbox.
    - **Admin Media Library**: Price field (dollars input) and Hub-use checkbox in both upload and edit dialogs. Asset cards show green price badge and blue "Hub Use" badge.
    - **Purchase Flow**: `POST /api/photos/:assetId/purchase` creates Stripe checkout session with `price_data` (dynamic per-photo pricing, no static Stripe price IDs needed). On success redirects to gallery with `?download=TOKEN`. `GET /api/photos/download/:token` verifies Stripe payment status, increments monthly download count, returns unwatermarked file URL.
    - **Monthly Download Limits**: Tracked in `photo_download_limits` table. Enforced at purchase time (429 if limit reached). Default 10 downloads/month per buyer email.
16. **Podcast Pro Tier** — `local_podcasts.proTier` boolean. Pro podcasts get priority score 35 in Pulse feed (vs 28 for featured, 18 for standard). Admin toggle in podcast panel.
17. **Source Request Board** (`client/src/pages/source-requests.tsx`): Public page at `/:citySlug/source-requests`. Journalists/creators post requests for expert quotes, business features, event coverage, community stories, data/research. Cards show type badge, deadline, response count, contact-via-email. Submit dialog with type selector, deadline, contact info. API: `GET /api/cities/:citySlug/source-requests` (public, open requests), `POST /api/cities/:citySlug/source-requests`, `GET /api/admin/source-requests` (requireAdmin), `PATCH /api/admin/source-requests/:id` (requireAdmin, status update). Schema: `source_requests` table with `source_request_status` enum (open/claimed/fulfilled/closed).
18. **Expanded Hub Presence Fields** — `businesses` table extended with: `listingType` (business/org/nonprofit/podcast/creator/speaker/venue), `creatorType` (podcast/artist/photographer/writer/musician/maker/educator), `speakerTopics` (text[]), `expertCategories` (text[]), `acceptingPressRequests` (bool), `acceptingSpeakingRequests` (bool), `acceptingMarketplaceOrders` (bool), `localHubAffiliations` (text[]), `revenueShareEligible` (bool), `roles` (text[]), `speakingFeeRange` (text), `speakingFormats` (text[]), `speakerAvailability` (text).
19. **Expanded Badge System** — `profile_badge_type` enum expanded from 9 to 18 types: original 9 (BUSINESS, ORGANIZATION, NONPROFIT, PODCAST, CREATOR, CONTRIBUTOR, LOCAL_EXPERT, SPEAKER, VENUE) plus 9 new (ARTIST, PHOTOGRAPHER, AUTHOR, MUSICIAN, MAKER, INSTRUCTOR, COMMUNITY_LEADER, EVENT_HOST, PRESS_SOURCE). All display with unique icons in admin badge manager, business detail page, and feed attribution.
20. **Speakers Bureau** (`client/src/pages/speakers-bureau.tsx`): Public page at `/:citySlug/speakers`. Shows businesses with SPEAKER badge. Cards display speaking topics, fee range, formats (keynote/panel/workshop/training/fireside/webinar), availability, "Accepting Requests" indicator. Featured speakers (badge metadata `featured: true`) sort to top with gold border. "Request Speaker" button opens dialog (name, email, event name, date, type, message) → creates CRM contact via `POST /api/cities/:citySlug/speaker-requests`. Topic and format filtering, search. API: `GET /api/cities/:citySlug/speakers`.
21. **Full Self-Service Marketplace** — Hybrid Fiverr/FB Marketplace/Classifieds system. **6 major categories**: HOUSING_SUPPLY (apartments, houses, rooms for rent/FSBO), HOUSING_DEMAND (looking for rental/roommate/housing), COMMERCIAL_PROPERTY (lease/sale/sublease/retail/industrial), SERVICE, FOR_SALE, COMMUNITY, plus legacy types (JOB, CLASSIFIED, HOUSING, WANTED) and 7 CREATOR_ types. **Subtypes**: 20+ marketplace_subtype enum values for granular filtering within each category. **Ownership model**: marketplace_owner_type enum (READER/HUB_PRESENCE); hubPresenceId links listings to apartment communities or businesses. **60+ fields** on marketplace_listings: housing (propertyType, bedrooms, bathrooms, squareFeet, lotSize, furnished, petFriendly, smokingPolicy, availableDate, leaseTerm, roommateOk, utilitiesIncluded, parkingDetails), demand (desiredBudgetMin/Max, desiredAreaText, desiredHubs[], moveInTimeframe, householdSize, petsFlag, roommatePreferenceText, accessibilityNeedsText, demandNotes), commercial (leaseOrSale, commercialType, zoningText, useCaseText, buildoutStatus, parkingCount, signageFlag), service (serviceCategory, serviceAreaType, serviceAreaText, startingPrice, licenseCertText), for-sale (itemCondition, quantity, pickupOnly, shippingAvailable), geo (address, addressLine2, addressCity, addressState, addressZip, latitude, longitude, hubId, districtId). **Reader cap**: 3 active listings max enforced on POST create and renew; returns `code: "READER_CAP_HIT"`. **Status enum**: DRAFT, ACTIVE, EXPIRED, REMOVED, FLAGGED, PENDING_REVIEW, ARCHIVED, REJECTED. **Embeddable listings**: `GET /api/marketplace/embed?hubPresenceId=&hubId=&type=&subtype=&featured=&limit=` for hub presence pages, relocation pages, hub area pages. Reusable `EmbeddableListings` React component at `client/src/components/embeddable-listings.tsx`. **Self-archive**: PUT route allows users to set status=ARCHIVED only. **Admin moderation**: all 8 statuses supported, bulk archive/reject actions. **Dynamic forms**: category-specific field sections in marketplace-post.tsx. **Detail page**: attribute grids for housing, demand, commercial, service, and for-sale specifics. **My-marketplace**: cap status bar, archive button, new status badges. API: full CRUD under `/api/cities/:citySlug/marketplace/listings`, `/api/auth/my-marketplace-listings`, `/api/admin/marketplace/listings`.
22. **Creator Directory** (`client/src/pages/creator-directory.tsx`): Public page at `/:citySlug/creators`. Shows businesses with any creator-type badge (CREATOR, ARTIST, PHOTOGRAPHER, AUTHOR, MUSICIAN, MAKER, INSTRUCTOR). Cards display badge type with color-coded icons, "Accepting Orders" indicator, expert categories. Filter by badge type, search by name/description/category. Featured creators (badge metadata `featured: true`) sort to top with gold border. API: `GET /api/cities/:citySlug/creators`.
23. **Source Requests Admin Panel** (`client/src/pages/admin/source-requests-panel.tsx`): Admin dashboard section under Hub Operations. Shows all source requests with status badges (open/claimed/fulfilled/closed), request type labels, deadline/contact info. Inline status dropdown to update request status via `PATCH /api/admin/source-requests/:id`. Filter by status. CRM auto-capture: submitting a source request with email auto-creates a CRM contact (captureMethod: "source_request", captureOrigin: "source_request_board").
24. **Pulse Videos** (`client/src/pages/admin/pulse-videos-panel.tsx`): Short-form video management. `pulse_videos` table with status enum (draft/review/approved/rejected/archived) and tier enum (free/featured/promoted/ad). Admin CRUD at `/api/admin/pulse-videos`. Approved videos auto-flow into Pulse feed as `type:"pulse_video"` cards via `projectPulseVideo()` in feed-service.ts with tier-based priority scoring (free=22, featured=28, promoted=35, ad=40). Inline autoplay in feed cards.
25. **Community Hub** (`client/src/pages/community-hub.tsx`): Unified discovery page at `/:citySlug/community`. Links to Experts, Speakers, Creators, Press Contacts, Podcasts, Source Requests, Gallery with live counts. API: `GET /api/cities/:citySlug/community-stats`.
26. **Press Directory** (`client/src/pages/press-directory.tsx`): Public page at `/:citySlug/press`. Shows businesses with PRESS_SOURCE badge enabled. Cards display accepting press requests indicator, expert categories, featured badge. Featured press sources (badge metadata `featured: true`) sort to top. API: `GET /api/cities/:citySlug/press-contacts`.
27. **Business Detail Enrichment** (Phase 4): Business profile pages now surface "Accepting Speaking Requests", "Accepting Press Requests", "Accepting Marketplace Orders" indicator badges. Cross-links to Speakers Bureau, Expert Directory, Creator Directory, Press Directory when matching badges are present. Speaker Info card shows topics, formats, fee range. Expert Categories card shows expertise areas. **Discovery Completion**: Jobs section on business-detail shows active jobs/job_listings with Apply links. "Now Hiring" (green) badge appears when business has active positions. "Creator" (purple) badge shows `creatorType` value. "New" (sky blue) badge on businesses added within 14 days. All three badges render on `BusinessCard` in directory and city-home (wired via `/api/cities/:citySlug/hiring-businesses` + `createdAt` check). Feed cards in Pulse also show creator/hiring badges via `FeedCardItem.creatorType`/`isHiring` fields. **Activity Signals**: "Happening Now" section on city-home shows live counts (new businesses, upcoming events, active jobs, new articles, new listings) via `GET /api/cities/:citySlug/activity-signals`. Each counter card links to the relevant browse page.
28. **Field Capture / Local Intake** — Surgical intake system for field operators to capture local discoveries (businesses, events, flyers, job leads, creator leads, marketplace opportunities, corrections, story leads, community updates) with minimal friction. Captures route into admin inbox for review, classification, and conversion to real objects. **Schema**: `field_captures` table (raw SQL in `server/index.ts`) with `field_capture_type` enum (14 types) and `field_capture_status` enum (new/reviewing/ready_to_convert/converted/discarded/needs_followup). `field_capture_review` added to `inbox_item_type` enum. **Backend routes** in `server/capture-routes.ts`: `POST /api/capture/field` (save + auto-create inbox item), `GET /api/admin/field-captures` (list with city/status/type filters), `PATCH /api/admin/field-captures/:id` (update status/notes/classify), `POST /api/admin/field-captures/:id/convert` (convert to business/event/article/submission with draft status). **Frontend**: `client/src/pages/field-capture.tsx` at `/:citySlug/capture/field` — lightweight form with capture type dropdown, title, notes, conditional fields (business name, event name, contact info), location, source URL, zone selector. `client/src/pages/admin/field-captures-panel.tsx` — admin review panel with status/type filters, capture detail dialog, status management, review notes, convert-to-object actions. Accessible via "Field Captures" in admin sidebar under Hub Operations. Traceability: each capture records who captured it, when, how it was classified, and what live object it became.
29. **Ambassador Portal & Tracking System** — Community ambassadors earn referral commissions by sharing unique `?ref=CODE` links. Schema: `ambassadors` (JSONB `feature_flags`, `referral_code` unique, `scope` PLATFORM/METRO/MICRO, `territory_id` optional, `commission_rate_bps` default 1000 = 10%, `assigned_products` text[]), `ambassador_referrals` (click→signup→converted→paid lifecycle), `ambassador_inquiries` (interest form from Coming Soon page). Public dashboard at `/:citySlug/ambassador` (code-gated, localStorage). Coming Soon page tracks `?ref=CODE` clicks automatically. Checkout handler (`server/stripe/checkout.ts`) passes `ambassador_ref` in Stripe metadata. **Multi-level visibility**: Ambassador Program panel visible at Platform level (full CRUD — create, suspend, activate, edit referral codes, manage inquiries) AND Metro level (read-only — view ambassadors, see referral stats, copy links, no create/edit/status changes). Metro sidebar: "Ambassador Program" under Hub Operations group. Platform sidebar: under Operations and Platform (Master) groups. Revenue split type `AMBASSADOR` (15%) in `revenueSplitTypeEnum`. `commissionRateBps` configurable per ambassador (default 10%). API: `GET /api/ambassador/dashboard/:code`, `POST /api/ambassador/track-click`, `GET /api/ambassador/lookup/:code`, `POST /api/cities/:citySlug/ambassador-inquiries`, admin CRUD at `/api/admin/ambassadors`, `/api/admin/ambassador-inquiries`.
29. **Verified Contributor System** — Trust/identity layer for community submissions. Four tiers (Standard $1, Supporter $5, Builder $10, Champion $15) — all unlock same verified status, higher amounts are voluntary community support. Stripe checkout verifies identity, funds go to Community Fund. Schema: `public_users` extended with `is_verified_contributor`, `contributor_status` (free/verified/trusted), `verification_tier`, `verification_amount_cents`, `verification_payment_id`, `verification_completed_at`, `moderation_trust_score`. `community_fund_ledger` tracks all contributions with processing fees. `contributor_submission_stats` tracks per-user submission metrics. Webhook handler in `server/stripe/webhook.ts` auto-verifies on payment (sets trust score 75). Moderation integration: verified contributors with trust >= 75 auto-approve posts (skip moderation queue). Frontend: `VerifiedBadge` component (inline shield icon, tier-colored), `VerificationCTA` component (compact/full variants with tier selection grid). CTA integrated into submit-event, submit-article, submit-shout-out pages. Verification success page at `/verification-success`. Admin panel "Verified Contributors" under Platform (Master) — tabs for contributor management (search, filter by tier, revoke) and Community Fund metrics (total raised, contributor count, tier breakdown). API: `POST /api/contributor/verify-checkout`, `GET /api/contributor/status`, `GET /api/admin/verified-contributors`, `PATCH /api/admin/verified-contributors/:userId` (grant/revoke), `GET /api/admin/community-fund/summary`, `GET /api/admin/community-fund/ledger`.
30. **Live Booking & Provider System** — Portable provider listing model for salons, stylists, barbers, wellness, and independent service professionals. Separate from the existing business/directory model. Schema: `providers` table (display_name, slug, category via `provider_category` enum [HAIR/BARBER/NAILS/LASHES/BROWS/MAKEUP/ESTHETICS/MASSAGE/WELLNESS/FITNESS/TATTOO/OTHER], subcategory, bio, specialties text[], booking fields, contact info, verification, walk-ins flag). `suite_locations` table (shared-location parent entity like Sola Salons, Phenix — `suite_location_type` enum). `provider_services` (service menu with pricing, duration, featured flag). `provider_openings` (live availability slots with `urgency_label` enum [available_today/available_tomorrow/last_minute/this_afternoon/this_evening] and `opening_status` enum). `provider_contact_actions` (analytics: profile_view/booking_click/call_click/text_click/instagram_click/website_click). `booking_platform_configs` (18 seeded platforms: Vagaro, Booksy, Square, GlossGenius, Acuity, Calendly, Fresha, StyleSeat, Schedulicity for service; OpenTable, Resy, Yelp Reservations, Google Reserve, Tock, SevenRooms, Toast for restaurant; Other, None). Six `booking_module_type` render modes: embed_widget, popup_widget, deep_link, call_text_fallback, manual_live_opening, api_connected. Restaurant reservations use existing `businesses` table with new fields (reservationPlatform, reservationEmbedCode, reservationWidgetUrl). Public routes: `/:citySlug/providers` (directory with category/verified/walk-in/booking filters), `/:citySlug/provider/:slug` (profile with services, live openings, booking module), `/:citySlug/suite/:slug` (suite location with tenant providers). Admin: "Providers" in Content & Listings sidebar group — provider CRUD, service manager, opening manager, suite location CRUD, contact action reporting. API: `GET /api/cities/:citySlug/providers`, `GET /api/cities/:citySlug/providers/:slug`, `GET /api/cities/:citySlug/openings`, `GET /api/cities/:citySlug/suite-locations/:slug`, `POST /api/providers/:id/contact-action`, `GET /api/booking-platforms`, admin CRUD at `/api/admin/providers`, `/api/admin/suite-locations`, `/api/admin/provider-services`, `/api/admin/provider-openings`, `/api/admin/provider-reporting`.
31. **Community Engagement System** — Complete backend for community interaction features. Schema: `neighborhood_reviews` (zone-linked reviews with PENDING/APPROVED/REJECTED moderation), `polls` + `poll_options` + `poll_votes` (single/multi-choice with expiration, one-vote-per-user), `voting_campaigns` + `voting_categories` + `voting_nominees` + `voting_ballots` (campaign-based voting with categories/nominees, one-ballot-per-user-per-category), `quizzes` + `quiz_questions` + `quiz_attempts` (multiple-choice with scoring), `surveys` + `survey_questions` + `survey_responses` (text/rating/single_choice/multi_choice, anonymous or authenticated), `content_reactions` (like/love/insightful/funny/helpful on articles/events/posts/businesses, toggle add/remove, unique per user+entity+type). All tables created via raw SQL in `server/index.ts` (same pattern as providers). Routes in `server/community-engagement-routes.ts` — public endpoints for listing/voting/submitting, admin endpoints for creating/managing/moderating. Admin engagement summary endpoint aggregates counts across all features. All entities link to cityId for multi-city support. **Frontend Components**: `ReactionBar` (`client/src/components/community/reaction-bar.tsx`) — reusable reaction bar with 5 emoji-style buttons (like/love/insightful/funny/helpful), optimistic updates, auth prompt for logged-out users. Integrated on article-detail, event-detail, pulse-post-detail, business-detail pages. `NeighborhoodReviews` (`client/src/components/community/neighborhood-reviews.tsx`) — community reviews section with avg rating display, review cards, star-picker write-review form (auth required, PENDING→APPROVED flow), pros/cons fields. Integrated into neighborhood hub pages (gated on cityId + zoneId). Neighborhood hub API (`/api/cities/:citySlug/neighborhoods/:code`) extended to return `cityId` and matched `zoneId` (zone lookup by slug then name). Admin review-moderation page now has tabbed interface: "Business Reviews" + "Neighborhood Reviews" tabs, each with independent status filtering and approve/reject actions.
32. **Community Engagement Admin Hub** (`client/src/pages/admin/engagement-hub.tsx`): Admin panel under Hub Operations > "Engagement Hub" sidebar item. 7-tab interface (Overview / Polls / Surveys / Quizzes / Voting / Reviews / Reactions). **Cross-cutting filters**: All tabs have neighborhood (zone) and date range (from/to) filters that propagate to API queries. Backend admin endpoints (`/api/admin/community/*`) all accept `zoneId`, `dateFrom`, `dateTo` query params. **Overview tab**: Grid of metric cards with active counts (active polls/surveys/quizzes/campaigns, pending reviews), total participation aggregate, top-reacted content panel (top 5), most-reviewed neighborhoods panel (top 5 zones by review count with avg rating). **Polls tab**: List/create/toggle with per-option vote bars, zone filter, CSV export. **Surveys tab**: List/create/toggle, response viewer dialog with aggregated analytics (avg ratings, choice distributions) + per-respondent detail, question reordering (up/down), CSV export for both surveys and responses. **Quizzes tab**: List/create/toggle with attempt count/avg score, correctIndex remapping for filtered options, date filter, CSV export. **Voting tab**: Campaign CRUD with status management (draft/active/closed/archived), scheduling (startsAt/endsAt datetime inputs), inline results expansion with bar charts, category CRUD, nominee CRUD, winner display on closed campaigns, date filter, CSV export. **Reviews tab**: Moderation with status filter + zone filter + date filter, review analytics card (overall avg rating, pending count, top-5 zone breakdown by avg rating and count), approve/reject, CSV export. **Reactions tab**: Full analytics dashboard — reactions-by-type bar chart, reactions-by-content breakdown, top-reacted content list, recent activity feed, date filter, CSV export. Backend: `/api/admin/community/reactions` endpoint for analytics, enhanced `/api/admin/community/engagement-summary` returns `activePolls/activeSurveys/activeQuizzes/activeCampaigns/pendingReviews/topReactedContent/mostReviewedZones`. **Sidebar sub-pages**: Engagement Hub has expandable sidebar sub-items (Overview/Polls/Surveys/Quizzes/Voting/Reviews/Reactions) that navigate directly to the relevant tab via `initialTab` prop with `key`-based remounting. **Recent Activity Feed**: Overview tab includes a `RecentActivityFeed` card aggregating latest reviews, poll votes, quiz attempts, survey responses, and reactions from `/api/admin/community/recent-activity` endpoint. **Hardest Questions Analytics**: Quizzes tab includes `HardestQuestionsCard` showing top 10 questions by wrong-answer percentage from `/api/admin/community/quizzes/hardest-questions` endpoint. **Charlotte Report integration**: Engagement summary card in Charlotte Daily Report, clickable to engagement-hub.
33. **Job Board System** — Full employer self-service job posting with on-platform Easy Apply. `jobs` table extended with `businessId`, `postedByUserId`, `jobStatus` (active/closed/pending_review/rejected). New tables via raw SQL in `server/job-board-routes.ts`: `job_applications` (applicant info, resume URL, cover message, status lifecycle: pending→reviewed→shortlisted→rejected), `saved_jobs` (user bookmarks, unique per user+job), `job_alerts` (saved search criteria with daily/weekly/instant frequency), `user_resumes` (uploaded resume storage with default flag). **Employer Dashboard** (`client/src/pages/employer-dashboard.tsx`): Post jobs with full details (title, description, department, employment type, pay range, location, remote type, deadline). View/edit/close/delete listings. Expand to view applications with status management. Route: `/:citySlug/employer/jobs`. **Public Job Board** (`client/src/pages/jobs-list.tsx`): Easy Apply modal (name, email, phone, cover message) for employer-posted jobs, external Apply link for seeded jobs. Save/bookmark toggle (heart icon). Expandable job descriptions. Alert subscription modal (saves current search filters + frequency). "Post a Job" CTA links to employer dashboard. **Admin Job Moderation** (`client/src/pages/admin/jobs-moderation-panel.tsx`): Stats dashboard (employer posts, active, applications, saves, alerts). Table view of all employer-posted jobs with status management dropdown. Filter by status. Sidebar item "Job Board" under Hub Operations. API: Employer CRUD (`POST/PATCH/DELETE /api/jobs/employer`), `GET /api/jobs/employer/my-jobs`, `GET /api/jobs/employer/:jobId/applications`, `PATCH /api/jobs/employer/applications/:appId/status`. Easy Apply: `POST /api/jobs/:jobId/apply` (deduplicates by user+job). Saved jobs: `POST/DELETE /api/jobs/:jobId/save`, `GET /api/jobs/saved`, `GET /api/jobs/saved-ids`. Alerts: `POST/GET/DELETE /api/jobs/alerts`. Resume: `POST/GET/DELETE /api/jobs/resume`. Admin: `GET /api/admin/jobs`, `PATCH /api/admin/jobs/:jobId`, `GET /api/admin/jobs/stats`. Public listing filters for `jobStatus = active` only.
34. **RSS SEO Content Strategy**: AI generates full original articles (300-500 words) from RSS sources so SEO value stays on the platform. `rss_items` extended with `local_article_slug`, `local_article_body`, `local_article_body_es`. AI function `aiGenerateLocalArticle()` in `server/lib/ai-content.ts` creates Charlotte-angled community journalism pieces. Local URLs: `/:citySlug/news/:localArticleSlug`. Feed cards show "Charlotte Hub" byline with "via {sourceName}" attribution (purple branding, not source colors). Article detail page (`client/src/pages/rss-article-detail.tsx`) shows full local article body, Charlotte Hub author attribution, source citation section ("Originally reported by X") with external link, schema.org `isBasedOn` JSON-LD for proper attribution. Slug uniqueness enforced with ID-suffix fallback. Admin backfill endpoint: `POST /api/admin/rss/backfill-articles` (auth-protected) generates articles in configurable batches. New items auto-generate articles during RSS ingestion in jobRunner.
35. **RSS Content Routing Foundation**: 15 routing fields on `rss_items` table: `contentType` (story/event/job/etc), `categoryCoreSlug` (top-level SEO category), `categorySubSlug` (child subcategory), `geoPrimarySlug`/`geoSecondarySlug` (zone-based geo routing), `hubSlug`/`countySlug` (hub/county routing), `venueName`/`venueSlug`/`venueAddress` (venue precision for calendar/map), `publishStatus` (PUBLISHED/SUPPRESSED/DRAFT), `processingStage` (INGESTED/REWRITTEN/ROUTED), `policyStatus` (ALLOW/SUPPRESS/FLAGGED), `lastEditedBy`/`lastEditedAt` (admin audit trail). **Topic Taxonomy**: 28 core Google-friendly SEO categories with hierarchical parent→child subcategories (e.g., "Food & Dining" → "Restaurants", "Breweries & Taprooms"). Seeded idempotently at startup in `server/index.ts`. **Location Tags**: 642 location-type tags auto-seeded from active zones using plain zone slugs (matching downstream lookup paths). **projectRssItem fix**: Feed projection (`server/services/feed-service.ts`) now uses `categoryCoreSlug` for dynamic `primaryTag` (with human-readable labels) and `geoPrimarySlug`/`geoSecondarySlug` for dynamic `locationTags` instead of hardcoded "news"/empty arrays. `whyShown` now reads zone-aware like "Uptown · via wsoctv.com". **Pipeline integration**: `autoTagContent()` and `backfillContentTags()` in `server/services/tag-backfill.ts` now also write `categoryCoreSlug`/`categorySubSlug`/`geoPrimarySlug` on RSS items when resolving tags. Core/sub derivation correctly resolves parent category when only a child tag matches. RSS ingestion in `server/intelligence/jobRunner.ts` sets routing fields at insert time and after AI processing. Cross-engine pattern: these routing fields establish the pattern that events/jobs/other engines adopt later.
36. **AI Classification & Enrichment Layer**: Single-call GPT-4o-mini classifier (`server/services/ai-classifier.ts`) enriches RSS items with structured routing suggestions. 8 new `aiSuggested*` columns on `rss_items`: `aiSuggestedCategoryCoreSlug`, `aiSuggestedCategorySubSlug`, `aiSuggestedGeoPrimarySlug`, `aiSuggestedGeoSecondarySlug`, `aiSuggestedContentType`, `aiSuggestedPolicyStatus`, `aiConfidence` (JSON with category/geo/contentType/policy/venue scores 0-1), `aiClassifiedAt`. **Classifier**: Uses `response_format: { type: "json_object" }` for structured output enforcement. Accepts title/summary/body/sourceName/sourceUrl/categoriesJson, sends constrained prompt with actual taxonomy slugs + zone slugs, validates output against allowed values, clamps confidence scores. Returns all routing fields: categoryCoreSlug, categorySubSlug, geoPrimarySlug, geoSecondarySlug, hubSlug, countySlug, venueName, contentType, policyStatus. Hub/county resolved from zone→region hierarchy lookup (cached 1hr). Content types: story, event, job, business-update, community-update, listing, deal, announcement. Policy statuses: ALLOW, SUPPRESS, REVIEW_NEEDED. Caches zone slugs, sub-category mappings, and hub/county mappings with 1hr TTL. **Confidence-aware writeback**: `buildWriteback()` only promotes AI suggestions to routing fields when confidence >= 0.7 AND the field is currently empty AND no manual edit exists (`lastEditedBy` null). AI suggestions always stored in `aiSuggested*` columns regardless of confidence. Policy SUPPRESS or REVIEW_NEEDED at high confidence routes items appropriately. **Pipeline integration**: Classifier runs in `jobRunner.ts` after rewrite/geo-resolution, uses `buildWriteback()` to apply only confidence-gated updates (no direct field overwrites). **Batch backfill**: `POST /api/admin/rss/ai-classify-backfill` (admin-role-protected via `users.role` check, configurable batch size up to 200, optional `forceReclassify` flag) processes approved items missing `aiClassifiedAt`.
38. **Content Integrity & Routing Engine**: Centralized content quality enforcement layer. **Shared Routing Evaluator** (`server/services/content-routing-evaluator.ts`): `evaluateContentRouting(item)` returns 6-surface eligibility map (pulse/hub/category/map/article/search) with block reasons and logic summaries. `deriveQueueStatus()` centralizes queue state derivation. `getPulseBlockReasons()` returns human-readable pulse exclusion reasons. `computeIntegrityFlags()` returns array of flag strings: MISSING_CATEGORY, MISSING_GEO, LOW_CATEGORY_CONFIDENCE, LOW_GEO_CONFIDENCE, LOW_POLICY_CONFIDENCE, LOW_GEO_PRECISION, ROUTING_ISSUE. **Category Normalization** (`server/services/content-normalizer.ts`): `normalizeCategory(item)` uses layered resolution — static RSS category map → title keyword matching → AI classifier fallback. Validates against CORE_SLUGS. Returns method/confidence/needsReview. **Geo Assignment** (`resolveGeoAssignment(item, cityId)`): Priority chain — existing geo → geo-tagger resolveContentZone → extended text scan (zone name matching) → metro fallback (city-scoped). Flags LOW_GEO_PRECISION for metro-only assignments. **Content Integrity Pass** (`runContentIntegrityPass(cityId?)`): Idempotent batch scan of rss_items missing category/geo/integrityFlags. Auto-fixes via normalizeCategory + resolveGeoAssignment. Sets REVIEW_REQUIRED for unresolvable items. Admin endpoint: `POST /api/admin/intelligence/content-integrity-pass`. **Schema**: `integrityFlags` (jsonb array) and `lastIntegrityPassAt` (timestamp) columns on `rss_items`. **Pipeline Integration**: jobRunner.ts runs normalizeCategory → resolveGeoAssignment → computeIntegrityFlags → deriveQueueStatus after AI classification on every ingested item. **Soft Enforcement**: Quick-action publish/approve computes integrity flags and returns `integrityWarnings` array; frontend shows destructive toast with warnings. **Editorial Queue Filters**: `lowGeoPrecision` toggle, `integrityFlag` dropdown (7 flag types) in review-queue-tab.tsx.
39. **Content Ranking & Distribution Engine**: Multi-tier geo-weighted scoring system (`server/services/feed-scoring-engine.ts`) replacing flat chronological+boost ranking. **Config**: `server/services/feed-ranking-config.ts` centralizes all tunable constants — geo tier weights (5 tiers: primary=200, secondary=140, hub=100, county=60, metro=10), recency decay (half-life 48h, max bonus 80), diversity params (max 3 consecutive same type/category), random jitter (0-8), event boosts, tier boosts, and per-surface weight multipliers. **Geo scoring**: 5-tier geo relevance scorer computes score from item's geoPrimarySlug/geoSecondarySlug/hubSlug/countySlug against user context. Primary geo match > secondary > hub > county > metro. Hub pages use 1.3x geo weight. **Recency scoring**: Exponential decay function (half-life=48h) ensures newer items rank higher within same geo tier but cannot override geographic relevance. **Surface-specific**: `surface` param (pulse/hub/category/default) adjusts geo/recency weight ratios — Pulse=balanced, Hub=1.3x geo emphasis, Category=1.2x recency. **Diversity reranking**: Post-scoring pass prevents content-type clustering (no more than 3 consecutive same type) and category clustering (no more than 3 consecutive same categoryCoreSlug). **Near-duplicate suppression**: Jaccard similarity on title words prevents back-to-back similar titles in Pulse (threshold 0.6). **FeedItem.geoMeta**: RSS items now carry geoPrimarySlug/geoSecondarySlug/hubSlug/countySlug/categoryCoreSlug metadata for scoring. **Feed route**: `/api/feed` accepts `surface` query param. **Database indexes**: 10 new indexes on rss_items (geo_primary_slug, geo_secondary_slug, hub_slug, county_slug, category_core_slug, publish_status, policy_status, pulse_eligible, city_id+review_status composite, published_at DESC).
37. **Editorial Content Control Layer**: Full operator-facing content management system within Metro Intelligence panel. **Schema additions** (14 columns on `rss_items`): `originalTitle`/`originalSummary`/`originalImageUrl` (preserve originals on first edit), `aiGeneratedTitle`/`aiGeneratedSummary` (AI rewrites), `suppressionReason`/`suppressionBy`/`suppressionAt` (suppression tracking), `imageCredit`/`sourceAttribution` (attribution), `activeUntil`/`isEvergreen` (lifecycle), `queueStatus` (derived state). `pulseEligible` (boolean) controls Pulse feed inclusion; `editHistory` (json array) lightweight change log. **Queue Status Lifecycle**: `deriveQueueStatus(publishStatus, policyStatus, pulseEligible)` centralizes state derivation → REVIEW_REQUIRED, READY_TO_PUBLISH, PUBLISHED, PULSE_SUPPRESSED, UNPUBLISHED, ARCHIVED, SUPPRESSED. Synced in edit handler, quick-action handler, and queue-status handler. **API endpoints**: `PATCH /api/admin/intelligence/rss-items/:id/edit` (edits with original preservation, isEvergreen auto-nulls activeUntil); `GET /api/admin/intelligence/editorial-queue` (filterable by queueStatus with statusCounts); `PATCH /api/admin/intelligence/rss-items/:id/queue-status` (direct status transitions); `GET /api/admin/intelligence/rss-items/:id/routing` (surface eligibility with isEvergreen-aware expiration); `GET /api/admin/intelligence/rss-items/:id/versions` (edit history + audit timeline). **Review Queue tab** (`review-queue-tab.tsx`): 8 status tabs with counts, search/category/sort filters, context-aware action buttons per status. **EditDialog** (`editorial-control-tab.tsx`): 3 tabs — Content (image management with credit, source attribution, lifecycle controls with activeUntil/isEvergreen, suppression with reason tracking), Routing (surface confirmation panel showing Pulse/Hub/Category/Map/Article eligibility with block reasons), History (version comparison showing field-by-field diffs + audit timeline). **Feed service**: `projectRssItem()` filters out `pulseEligible=false`, `policyStatus!=ALLOW`, `publishStatus!=PUBLISHED`. **Routing**: Pulse eligibility respects `isEvergreen` flag — evergreen items never expire by date.

35. **Farm & Local Food Discovery System** — Comprehensive local farm and food source directory. L1 category "Local Farms & Food Sources" (`local-farms-food-sources`) with 10 L2 subcategories (Family Farms & Ranches, Farmers Markets, CSA Programs, Farm Stores, Pick-Your-Own Farms, Specialty Food Producers, Meat & Poultry Farms, Egg Producers, Dairy Farms, Urban Farms & Community Gardens) and full L3 micro-category subtypes. Business schema extended with 7 farm-specific fields: `farmProductTypes` (text[]), `seasonalAvailability` (jsonb), `csaSubscriptionType` (text), `pickupSchedule` (text), `marketDays` (text[]), `orderingMethod` (text[]), `acceptsPreorders` (boolean). Constants: `FARM_PRODUCT_TYPES`, `FARM_ORDERING_METHODS`, `FARM_CSA_TYPES`, `FARM_CATEGORY_SLUG` in `shared/schema.ts`. "Local Food" feed topic seeded. 5 farm-focused micro hub landing pages seeded in territories/regions: CLT Meat, CLT Farm Boxes, CLT Fresh Eggs, CLT Farmers Markets, CLT Local Food (`server/seed-farm-hubs.ts`). Micro hub page (`client/src/pages/micro-hub-page.tsx`) enhanced for farm hubs: green gradient theme, farm breadcrumbs, cross-links between related farm hubs, farm-specific SEO meta titles/descriptions. Category hub (`client/src/pages/category-hub.tsx`) provides farm-specific SEO for L1/L2/L3 farm category pages. Business detail page displays farm info card (products, ordering methods, CSA type, pickup schedule, market days, seasonal availability, preorders badge). Admin dashboard (`client/src/pages/admin/dashboard.tsx`) has "Farm & Local Food" editing section with toggleable product types, ordering methods, CSA subscription dropdown, pickup schedule input, market day selectors, seasonal availability editor, preorders checkbox, and "Save Farm Info" button.

36. **Event Capture & Verified Event Claim** — AI-powered event extraction and organizer claim system mirroring business claim flow. **Schema**: `events` table extended with `eventClaimStatus` (reuses `claimStatusEnum`: UNCLAIMED/CLAIM_SENT/CLAIMED), `eventClaimTokenHash`, `eventClaimTokenExpiresAt`, `eventClaimedAt`, `eventClaimedByUserId`, `organizerName`, `organizerEmail`, `organizerPhone`, `aiExtractedData` (jsonb), `aiConfidenceScores` (jsonb), `aiGapFlags` (text[]), `captureSource`, `capturePhotoUrl`. **Backend** (`server/event-claim-routes.ts`): AI extraction via GPT-4o vision (`POST /api/admin/intake/event-photo-extract` multipart, `POST /api/admin/intake/event-url-extract`), capture publish (`POST /api/admin/intake/event-capture-publish`), admin send claim invite (`POST /api/admin/events/:eventId/send-claim-invite`), public claim flow (`GET /api/event-claim/verify`, `POST /api/event-claim/send-code`, `POST /api/event-claim/verify-code`, `POST /api/event-claim/complete`), self-initiate (`POST /api/event-claim/initiate`), captured events queue (`GET /api/admin/events/captured`). **Frontend**: `claim-event.tsx` at `/:citySlug/claim-event/:token` — multi-step wizard (verify→confirm→verification→complete). Event detail page shows "Claim This Event" card for unclaimed events. Admin events panel (`events-panel.tsx`) has claim status badges, send invite button/dialog, and AI Capture toggle with photo/URL extraction + manual override + publish workflow (`EventCaptureSection` in `field-captures-panel.tsx`).
37. **Venue Event Engine** — Recurring event series, outside event submissions, and venue management dashboard. Schema: `event_series` table (title, slug, description, host/venue presence IDs, recurrence config, default event details, status enum draft/active/paused/archived), `venue_event_submissions` table (outside organizer requests to host at a venue, with approval workflow pending/approved/rejected). `events` table extended with `event_series_id`, `venue_presence_id`, `occurrence_status` (scheduled/skipped/cancelled), `occurrence_index`, `venue_name`. Occurrence generation: `generateOccurrenceDates()` supports weekly (dayOfWeek), monthly (dayOfMonth or weekOfMonth+dayOfWeek), and custom (explicit dates) recurrence rules stored as JSON. Routes in `server/event-series-routes.ts`: public series listing/detail (`/api/event-series`, `/api/event-series/by-slug/:slug` — active-only), admin CRUD (`/api/admin/event-series`), admin occurrence generation (`/api/admin/event-series/:id/generate-occurrences`), owner series CRUD (`/api/owner/event-series`, `/api/owner/event-series/:seriesId/occurrences`), owner submission review (`/api/owner/venue-submissions`), public submission (`POST /api/venue-event-submissions` — PII stripped from public GET), venue events aggregation (`/api/venues/:venueId/events`), Pulse announcement (`/api/admin/event-series/:id/pulse-announce` — creates branded post). Frontend: `event-series-detail.tsx` (public series page at `/:citySlug/events/series/:slug` with upcoming/past occurrences, host/venue cards, share), `venue-events-dashboard.tsx` (owner dashboard at `/:citySlug/owner/:slug/events` with Series/Submissions/Create tabs). Events-block.tsx shows "Recurring" badge for series occurrences. Series occurrences stored as regular `events` rows so they auto-appear in Pulse feed and discovery.

38. **Trust System Public Display UI** — Public-facing trust display components showing stacked trust signals (not a single score). Two components: `TrustCard` (full trust stack for business detail sidebar — Identity/Experience/Activity/Authority/Recognition/Community layers with layered badges) and `TrustSummary` (compact single-row condensed view for content cards and search results). `deriveTrustSignals()` helper derives trust data from existing business fields. Crown status fetched via `GET /api/businesses/:businessId/crown-status` endpoint. Files: `client/src/components/trust-card.tsx`, integrated into `client/src/pages/business-detail.tsx` (sidebar) and `client/src/components/content-card.tsx` (BusinessCard). Mobile-responsive with flex-wrap on all badge rows.

39. **Universal Workflow State Engine** — Foundation layer tracking every onboarding/activation flow through a finite state machine with immutable event logging. Schema: `workflow_sessions` table (id, cityId, source via `workflow_source` enum [activate/claim/story/crown/qr/cta/event/job/publication], currentStep via `workflow_step` enum [14 steps: entry→match→account_check→verification→attach_ownership→identity_router→basic_activation→story_builder→capability_activation→hub_category_setup→trust_signals→trusted_network_check→first_action→complete], status via `workflow_status` enum [active/paused/completed/abandoned/error], entityId, entityType, contactEmail, contactPhone, contactName, businessName, matchedBusinessId, identityRole, presenceType, sessionData jsonb, chatSessionId, flowSessionId). `workflow_events` table (immutable event log: id, sessionId FK, fromStep, toStep, eventType, eventData jsonb, createdAt). `workflow_follow_ups` table (id, sessionId FK, channel enum [email/sms/internal_task/voice], scheduledAt, completedAt, message, status enum [pending/sent/completed/cancelled]). `workflow_action_recommendations` table (id, sessionId FK, actionType, label, description, targetUrl, priority, dismissed). **Engine** (`server/workflow-engine.ts`): `WorkflowEngine` class with FSM step graph per source, `startSession()`, `advanceStep()`, `skipToStep()`, `getSessionWithEvents()`, `matchOrCreateBusiness()`, `setIdentityRole()`, `pauseSession()`/`resumeSession()`, `safeAdvance()` (no-throw), `advanceThroughSteps()` (skip intermediate steps), `generateRecommendations()` (auto-creates up to 3 next-action recommendations based on current state), `scheduleFollowUp()`. **Charlotte Workflow Conductor**: `advanceWorkflowFromChat()` in charlotte-public-routes.ts bridges Charlotte tool-call outcomes to workflow steps: activate_presence→match, verify_code→verification, save_conversation_data→story_builder, set_participation_identity→identity_router, generate_spotlight_article→capability_activation + auto-generates recommendations. flow/start now returns `workflowSessionId` to client. **Story Builder Integration**: story-interview save_conversation_data advances workflow to story_builder step; story depth >= 60 records story_completed event; article generation records article_generated milestone + advances to capability_activation. **API** (`server/workflow-routes.ts`): Rate-limited public endpoints (`POST /api/workflow/start`, `POST /api/workflow/:id/advance`, `POST /api/workflow/:id/skip`, `GET /api/workflow/:id`, `POST /api/workflow/:id/match-business`, `POST /api/workflow/:id/identity`, `POST /api/workflow/:id/pause|resume`, `GET /api/workflow/:id/recommendations`, `POST /api/workflow/:id/recommendations/:recId/dismiss`, `GET /api/workflow/:id/follow-ups`, `POST /api/workflow/:id/follow-ups`, `POST /api/workflow/:id/generate-recommendations`). **Form Fallback** (`client/src/pages/workflow-form.tsx`): Multi-step form at `/:citySlug/get-started` mirroring workflow steps (Find→Account→Verify→Identity→Activate→Story→Capabilities→Category→Complete). Each step writes to same workflow session via advance/skip endpoints. Resume via `?session=UUID`. "Talk to Charlotte instead" handoff at any point. Completion step shows `WorkflowNextActions` component (`client/src/components/workflow-next-actions.tsx`) with dismissible action recommendations. **Admin Panel** (`client/src/pages/admin/workflow-sessions-panel.tsx`): Filterable table (source/status), paginated, expandable event timeline per session. Sidebar: "Workflow Engine" under Charlotte AI group.

### AI Persona & Prompt Architecture
- **Personas** defined in `server/ai/personas.ts`: Charlotte (public-facing), Cora (operator-facing), Shared
- **Prompt Registry** in `server/ai/prompts/`: centralized prompt definitions with `registerPrompt()` from `registry.ts` (NOT `index.ts` — avoids circular deps). Modules: `public-guide.ts`, `content-pipeline.ts`, `classifier.ts`, `outreach.ts`, `platform-services.ts`, `story-flows.ts`
- **Architecture doc**: `AI_PERSONA_BOUNDARY.md` documents persona boundaries, service ownership, and guidelines
- **AI helpers**: `aiRewriteSummary`, `aiExtractZoneSlug`, `aiExtractZoneSlugs`, `aiGenerateLocalArticle`, and `createCmsFromRssItem` live in `server/lib/ai-content.ts` (single source of truth). `aiGenerateLocalArticle` uses gpt-4o-mini with max_tokens 3000, structured prompt targeting 450-500 words with 5 sections (HEADLINE LEAD, FULL STORY, KEY FACTS, COMMUNITY FAQ, SOURCE CREDIT), returns `{body, slug, seoTitle, excerpt}`. `createCmsFromRssItem` creates a CMS content item (published) + legacy article + bridge entry from an RSS item, with idempotency checks and slug deduplication. All AI-generated articles are branded as "CLT Metro Hub" with source citations.
- **Multi-Zone Extraction**: `aiExtractZoneSlugs(title, summary, articleBody)` returns `MultiZoneResult { zoneSlugs: string[], countySlug: string | null, zoneCountyMap }` — up to 4 zone slugs ranked by relevance using `MULTI_ZONE_EXTRACTION_SYSTEM` prompt in `content-pipeline.ts`. Reads full article body (first 2000 chars) for better geo-precision. County auto-derived from zones table `county` field. Legacy `aiExtractZoneSlug` delegates to new function. jobRunner sets `geoPrimarySlug` (1st zone), `geoSecondarySlug` (2nd zone), `countySlug` (from primary zone's county). `autoTagContent` and `applyFullTagStack` in tag-backfill.ts / content-tagger.ts accept `additionalZoneSlugs` and `countySlug` to create content tags for all matched zones + county.
- **Event Extraction from Articles**: `aiExtractEventsFromArticle(title, summary, articleBody)` reads full article text (4000 char cap) and extracts embedded events (name, date/time, venue, address, cost, zones, recurring rules). Returns `EventExtractionResult { events: ExtractedEvent[] }` with confidence scores. Only events with confidence >= 0.6 are created. `extractAndCreateEventsFromArticle()` resolves zone IDs, deduplicates slugs, and creates `events` table entries with `captureSource: "rss_extraction"`, `seedSourceType: "rss_article"`. Wired into jobRunner pipeline after CMS creation for approved items with article bodies. Sets `events_extracted` integrityFlag to prevent double-processing. Backfill mode `event_extract` available via `POST /api/admin/rss/backfill-articles` with `mode: "event_extract"`. Prompt: `EVENT_EXTRACTION_SYSTEM` in `content-pipeline.ts`.
- **RSS-to-CMS Pipeline**: When RSS items are AI-rewritten during ingestion (`server/intelligence/jobRunner.ts`), the pipeline now also creates CMS content entries via `createCmsFromRssItem`. This makes AI articles appear in the stories/blog area and lets admins edit/unpublish them. The `rss_items.cms_content_item_id` column links back to the CMS entry.
- **Venue Discovery from Articles**: `aiExtractVenuesFromArticle(title, summary, articleBody)` reads article text and extracts named venue/business mentions with name, address, city, state, type, confidence. Only venues with confidence >= 0.7 and name length >= 3 chars are processed. `resolveOrCreateVenuePresence(venueName, address, city, state, cityId)` in `server/lib/venue-discovery.ts` handles matching + creation: fuzzy-matches existing businesses by name+city, checks Google Place ID, falls back to Google Places Text Search + Details API. Creates FREE-tier presences with full geo resolution (ZIP from address, zone via `CHARLOTTE_ZIP_ZONE_MAP`, county from zone, hub slug if micro hub zone). Sets `needsZoneReview` flag when ZIP is not in map. Auto-enqueues new presences to `listings_to_claim_queue` (source: google_places, status: ready). Wired into both: (1) event extraction — after creating each event, resolves venue and sets `venuePresenceId`, and (2) jobRunner pipeline — standalone venue extraction step after event extraction, sets `venues_discovered` integrityFlag. Prompt: `VENUE_EXTRACTION_SYSTEM` in `content-pipeline.ts`. Backfill modes: `venue_link` (connects events with `venueName` but no `venuePresenceId`, CITY_ADMIN scoped), `geo_backfill` (fixes businesses missing ZIP/zone/county using address and/or Google Place ID, CITY_ADMIN scoped).
- **Pulse Feed Tier Gate**: Only ENHANCED tier businesses appear in the Pulse feed. FREE and VERIFIED businesses are excluded from all feed business queries (`queryFeedViaTags`, `queryFeedDirect`, `getSponsoredBusinesses`) via `listingTier = 'ENHANCED'`. Both `feed-service.ts` and `feed-v2-service.ts` enforce this. CHARTER was consolidated into ENHANCED (Task #24); PREMIUM is not an active tier.
- **Stale Content Archival**: `server/services/content-archival.ts` runs a daily scheduler (configurable via `STALE_ARCHIVAL_DAYS` env, default 90 days). Archives RSS items older than threshold unless `isEvergreen=true`. Also archives items whose `activeUntil` date has passed. Sets `publishStatus='ARCHIVED'`, `pulseEligible=false`, and records `suppressionReason`. Linked CMS content items are archived with full revision audit trail (CMS revision + workflow event). Scheduler starts on app boot with 30s initial delay. `runStaleArchival()` also available for on-demand use.
- **Evergreen Content Classification**: `aiClassifyEvergreen(title, summary, articleBody)` in `server/lib/ai-content.ts` uses `EVERGREEN_CLASSIFICATION_SYSTEM` prompt to classify articles as evergreen vs time-sensitive. Returns `{ isEvergreen, confidence, reason }`. Only items with confidence >= 0.7 are marked evergreen. Wired into jobRunner pipeline after venue discovery — approved articles with bodies are auto-classified. Evergreen items are protected from stale archival.
- **Article Backfill** (`POST /api/admin/rss/backfill-articles`): Supports 8 modes — `missing` (no article body), `short` (body under 1500 chars), `cms_only` (has article but no CMS entry), `zone_retag` (re-extracts multi-zone + county from full article body), `event_extract` (extracts embedded events from articles and creates calendar entries), `venue_link` (connects events with venue names to business presences via Google Places), `geo_backfill` (resolves missing ZIP/zone/county on existing businesses), `stale_archive` (runs stale content archival on-demand). Admin role required. Batch size up to 50. Progress-safe via integrityFlag markers (`zone_retagged`, `events_extracted`, `venues_discovered`).

### Foundational Architecture — AI-Operated City Hub

CityMetroHub is designed to be operated by **one person launching templated city hubs nationally**. There are no local teams, no boots on the ground. **Charlotte AI and automation ARE the operations team.** Every architectural decision flows from this reality.

#### Core Pillars
1. **Pulse IS the app (Feed-First Pivot)** — Home route (`/:citySlug`) renders the Pulse feed directly. `CityOverview` (marketing page) moved to `/:citySlug/about`. Bottom nav: Feed/Hubs/Search/Live/Profile. Stories Row + context filter pills (For You/Trending/New/Weekend/Near Me) at top. Hub-scoped filtering via Stories Row taps. First-visit hub selector prompt (`HubSelectorPrompt`) with geolocation auto-detect saves to `clt_hub_preference` localStorage key (`__metro__` = all Charlotte). RSS articles (520 approved) boosted in feed with editorial card design. Video + podcast cards in feed. Explore menu routes topics to feed via `?topic=` params. Charlotte AI "Ask Charlotte" cards injected every 20 items in feed scroll. Subscriber profile at `/:citySlug/profile` and `/:citySlug/saved` with hub preference, topic preferences, saved items. Bilingual feed cards use `localized(locale, title, titleEs)` for all rendered text. All SEO URLs preserved. **Unified Dark Cosmic Theme** — All public-facing pages use `DarkPageShell` wrapper (`client/src/components/dark-page-shell.tsx`): `bg-gray-950` base + cosmic background overlay at 20% opacity + `max-w-2xl` (narrow) or `max-w-6xl` (wide) content column. `fillHeight` prop enables contained scrolling for app-style pages. Pages restyled: neighborhoods-index, articles-list, events-list, directory, coming-soon, subscriber-profile, jobs-list, marketplace, live-feeds, local-updates, business-detail, event-detail, article-detail. Glassmorphism cards (`bg-white/10 border-white/10`), white text with opacity hierarchy, purple/amber accent colors. No `backdrop-blur-sm`, no `text-primary` on these pages. **Option C Layout Strategy**: Discovery/browse pages (neighborhoods, events, articles, directory, jobs, live, marketplace, local-updates + feed/pulse) use app-style layout (`h-screen overflow-hidden flex-col`, no footer, DarkPageShell `fillHeight`). Marketing/conversion pages (coming-soon, activate, presence, claim, advertise, legal) and detail pages (business-detail, event-detail, article-detail, rss-article-detail) keep website-style layout (traditional scroll with footer). Controlled by `isAppStyle` boolean in `PublicLayout`.
2. **Handles are identity** — Every user and business gets a brandable `@handle`. Stored without `@`, displayed with `@`. Unique across both `publicUsers` AND `businesses` (shared namespace). Handles are a branding/identity layer — they do NOT replace existing SEO slugs/URLs.
3. **Business listing IS the profile IS the microsite** — One URL, one page, progressively enhanced by tier. No separate microsite route. `/:citySlug/:categorySlug/:businessSlug` serves everything from basic listing to full social-selling microsite.
4. **Posting ability is the product** — What businesses and users CAN DO on the platform is gated by their tier. Upgrades unlock publishing, tagging, promotion, and microsite features.
5. **In-app navigation** — Feed card taps open content in an in-app overlay (never navigate away from the platform). **All content types open in FeedDetail modal** (Facebook-style popup with X to close) — including RSS items. RSS modal shows image, title, summary natively (no iframe — avoids X-Frame-Options blocks) with "Read Full Article" link to source. The underlying pages (`/:citySlug/news/:itemId` for RSS, business/event detail pages) still exist for direct links, SEO, and Google indexing. **Discovery Cards & Related Searches**: 7 rotating instructional card types (Did You Know, Pulse Tip, Explore Near You, Trending Searches, Community Discovery, What's Happening Right Now, Micro Hub Discovery) inserted every 10 items in feed (avoiding Charlotte prompt slots at 20/40/60). Each card has title, body, tappable search pills. Related search chips shown under every 3rd feed card, generated deterministically from item metadata (type, category, neighborhood, date). All search taps navigate to `/:citySlug/directory?q=...`. Components: `client/src/components/feed/discovery-card.tsx`, `client/src/components/feed/related-searches.tsx`, `client/src/lib/search-suggestions.ts`. **RSS Auto-Approve**: During ingestion, Charlotte AI automatically rewrites summaries, geo-tags to neighborhoods, and approves/skips articles — no manual approval step. AI functions in `server/lib/ai-content.ts`. **"Did You Know?" Fact Cards**: `area_facts` table stores hub-tagged facts about 30+ Charlotte metro communities. Facts injected every ~15 items in Pulse feed as branded purple gradient cards with Sparkles icon. No engagement buttons — informational only.
6. **Engagement tracking feeds intelligence** — Every interaction (view, tap, like, save, share) is tracked and rolled up for Charlotte's intelligence analysis.
7. **Charlotte is the operator** — Charlotte AI scans platform activity daily to surface opportunities, solicit reviews, generate content, draft outreach, and recommend actions. The admin wakes up, checks the inbox, approves drafts with one click.

#### Feed Content Rules
- **Businesses ONLY appear in Pulse feed if paid tier** (CHARTER or ENHANCED) or explicitly sponsored. FREE and VERIFIED businesses are filtered out of `queryFeedViaTags` and `queryFeedDirect` and repost rehydration.
- Events, articles, RSS, posts, jobs, marketplace items, etc. remain free in feed.
- Churches/faith-based orgs only appear via their events, not as standalone business cards.
- Businesses still exist in directory, search, Google, and their own pages — just not in the social feed unless paid.

#### Pulse Social Feed Standard
The Pulse feed is a **social media feed**, not a website listing page. Every design and engineering decision must reinforce this.

**Core Principles:**
- **Engagement-driven ranking** — Content is ranked by engagement signals (likes, saves, shares, views), recency, and geo-relevance. Not by database insertion order.
- **Only feed-worthy content** — Every item must pass quality filters before appearing. Academic/institutional content (university sessions, study groups, course-coded events, administrative meetings) is blocked at both ingestion AND feed-serving layers.
- **Past events never shown** — Events with `startDateTime < now()` are excluded at the SQL query level. Cancelled events are also excluded.
- **Two-layer content filtering** — Layer 1: Ingestion blocklist in `jobRunner.ts` (`EVENT_IRRELEVANT_BLOCKLIST`, `EDUCATION_BLOCKLIST`, `LOW_INTEREST_BLOCKLIST`, course code regex). Layer 2: Feed-serving filter in `feed-service.ts` (`isEventFeedWorthy()`) catches anything that slipped through ingestion.
- **Businesses must be paid tier** — Only CHARTER/ENHANCED businesses appear in feed (never FREE/VERIFIED).
- **In-app consumption** — Tapping a card opens content in a modal overlay (FeedDetail). Never navigates away from the feed.
- **Infinite scroll** — Paginated via feed sessions. No "load more" buttons.
- **Social interactions on every card** — Like, save, share, send. Double-tap to like.
- **Content diversity** — Feed mixes businesses, events, articles, RSS, posts, videos, podcasts, marketplace, jobs. No single type dominates.

**ICAL/Event Feed Sources:**
- UNC Charlotte Events feed is **permanently disabled** (source ID `5876f674-4a94-4b84-9173-e46b04ee424a`). University campus events are not community content.
- Remaining ICAL feeds (Sustain Charlotte, Network Charlotte, QC Community Connect, Charlotte City Council) are legitimate community sources.
- All ICAL events pass through `checkEventContentFilter()` at ingestion AND `isEventFeedWorthy()` at feed-serving.

**Key files:** `server/services/feed-service.ts` (ranking, projection, quality filter), `server/intelligence/jobRunner.ts` (ingestion blocklists), `server/feed-routes.ts` (API), `client/src/pages/feed-home.tsx` (frontend), `client/src/components/feed/feed-card.tsx` (card rendering).

#### Submission Rules
- **Account required**: All Charlotte AI flows (tell-your-story, event submission, etc.) require authentication. Server-side enforced (`401` from `/flow/start` for anonymous users). Client-side gate shows AuthDialog before conversation starts.
- **Rate limits**: Stories/articles: 1 per week. Events: 3 per week. Checked both proactively (GET `/flow/rate-limit`) and on session creation (POST `/flow/start` returns 429).
- **PDF/Image upload**: Users can upload PDFs (1 max) and images (up to 5) alongside story submissions. Server validates ownership, type, and quantity. Stored in `charlotteFlowSessions.uploadedFiles` JSON column.
- **Charlotte AI writing is premium**: Free/VERIFIED users can upload content and chat with Charlotte, but `generateSpotlightArticle` is gated behind CHARTER+ tier. Non-premium users see upgrade prompt. Content still goes to editorial review.
- **$1 Community Fund Donation**: After business story completion, Charlotte offers $1 verification framed as "a donation to our community fund" — never "payment", "fee", or "charge". Uses existing Stripe verification checkout. Charlotte says "I found your listing" (activation framing).

#### Business Tier Permissions (listing tier drives what they can DO)
- **Unclaimed**: Static directory listing only. "Claim this business" CTA. RSS mentions. NOT in feed. NO reviews shown.
- **Verified** (claimed, $1 community fund donation): Can submit content for review (fully moderated). Basic profile with `@handle`, contact info, photos. No direct posting, no tags, no promotion. NOT in feed. NO reviews shown — upgrade prompt displayed instead. NO public microsite.
- **Enhanced** (retail $699/yr, intro $99/yr): Full microsite (all block types). Can post directly (auto-approved/fast-tracked). Can tag posts with topics/locations. Charlotte AI writing enabled. Video. Custom theme. Team section. FAQ. Full social selling. APPEARS IN FEED. Reviews visible and collectible. Gallery enabled. Advertising access (min tier for ad opportunities). Charter Postgres enum still exists but is treated identically to Enhanced in all code paths.
- **Badge/Module Upgrades**: Any tier can have profile badges toggled on (BUSINESS, ORGANIZATION, NONPROFIT, PODCAST, CREATOR, CONTRIBUTOR, LOCAL_EXPERT, SPEAKER, VENUE). Each badge unlocks specific microsite block types independent of listing tier. Badge-gated blocks: podcast→podcast section, creator→creator section, contributor→contributor section, local_expert→expert section, speaker→speaker section, venue→venue_info section. BUSINESS/ORGANIZATION/NONPROFIT badges are visual-only (no extra blocks). Admin manages via "Profile Badges" card in business detail panel. Schema: `profile_badges` table with `profile_badge_type` enum, `BADGE_BLOCK_MAP` constant in `shared/schema.ts`. Routes: `server/badge-routes.ts`. Public API: `GET /api/businesses/:id/badges` (enabled only). Admin API: CRUD + bulk-toggle at `/api/admin/businesses/:id/badges/bulk-toggle`.

#### Business Feed Topic
- "Business", "Real Estate", and "Development" are dedicated topic tags in the Pulse feed
- RSS keyword maps expanded: planning, zoning, rezoning, commercial real estate, economic development, small business, entrepreneurship, banking, fintech, permit, office space, warehouse → tagged as "business"
- Planning commission, land use, commercial property → tagged as "real-estate"
- All business-related RSS content automatically routed to Business topic filter in Pulse
- 60+ RSS articles tagged as Business, 14 as Development, 12 as Real Estate after initial backfill

#### Mobile & Home-Based Businesses
- L1 category "Mobile & Home-Based" with L2 subcategories: Food Trucks, Mobile Services, Home-Based Business, Side Hustle / Freelance.
- Physical address is optional for these categories during activation and checkout (`isServiceArea` flag auto-set).
- Maps to existing `location_type` enum values (HOME_BASED, VIRTUAL) and `is_service_area` flag.
- Categories auto-seeded incrementally even on existing databases.

#### Admin QR Code Generator
- Admin panel section "QR Generator" under Tools & Settings in sidebar.
- Supports: custom URL, business listing, event, Tell Your Story page, directory, activate, pulse feed.
- Uses existing `/api/qr/generate` API with branded CLT city code embedded.
- Preview, download (PNG), copy URL, open page actions.
- Component: `client/src/pages/admin/qr-generator-panel.tsx`.

#### AI Site Builder Tier Gating
- Admin can pre-build microsites for any tier (sales tool), but sees amber tier warning for FREE/VERIFIED businesses.
- Public microsite page (`/:citySlug/presence/:slug`) only renders for CHARTER+ tiers. Lower tiers see upgrade CTA.

#### Individual User Tier Permissions (roleTier: user → contributor → verified → author)
- **User** (free): Share/repost, save items, submit tips for moderation. Basic profile at `/:citySlug/u/:handle`.
- **Contributor**: Submit richer content, fast-tracked moderation. "Contributor" badge.
- **Verified**: Auto-approved submissions. "Verified" badge. Trusted community voice.
- **Author**: Publish Spotlight articles directly. "Author" badge.

#### Three Intelligence Layers
1. **Data Intelligence** (already built): Prospect pipeline, website crawling, business filing ingestion, engagement rollups, sales bucket categorization, industry tagging, location classification.
2. **Behavioral Intelligence** (Charlotte Pulse Scanner): Daily scan of feed engagement, user activity patterns, content gaps, trending topics. Surfaces 7 signal types: unclaimed high-demand, upgrade-ready, contributor candidate, neighborhood expert, trending topics, content gap, dormant claimed.
3. **Proactive AI** (Charlotte Automation): Solicits reviews in the feed based on user interactions. Generates draft content from engagement data (trending lists, weekend picks, new business roundups). Drafts outreach emails with real engagement stats. All drafts queue for one-click admin approval.

#### AI-Operated City Launch Workflow
When launching a new city hub template:
1. Charlotte seeds the directory from data sources (Google Places, business filings, OSM)
2. RSS feeds and iCal sources are configured and auto-ingested
3. Content is auto-categorized and auto-tagged
4. Prospect pipeline begins daily scans
5. Charlotte watches engagement patterns and surfaces opportunities to admin inbox
6. Review solicitation begins once users interact with businesses
7. Content generation starts once enough engagement data accumulates
8. Outreach drafting activates based on intelligence signals
The operator reviews the admin inbox daily, approves content and outreach with one click, and monitors the intelligence dashboard — all remotely.

#### Operator Layer (Daily Workflow)
The admin sidebar has an **Operator** group at the top with 3 surfaces — this is where the operator lives daily:

1. **Charlotte Report** (`charlotte-report` admin section) — Single-screen daily briefing. 6 blocks: Sales Pulse (outreach sent/claimed/conversion rate), Hub Signals (top neighborhoods), New Opportunity Activity (24h counts), Top Contactable Leads (scored with contact info), Exceptions (filtered inbox items), Suggested Actions. API: `GET /api/admin/charlotte/daily-report`. Component: `client/src/pages/admin/charlotte-report.tsx`.

2. **Opportunity Radar** (`opportunity-radar` admin section) — Categorized actionable board with 4 tabs: **Ready to Reach** (has email, can send verification outreach), **Phone Outreach** (phone only, call to collect email), **Venue Prospects** (venue_screen_likely, Hub TV pitch), **Walk-in Needed** (no contact info, field visit). Default tab auto-selects first non-empty category. Each card shows name, source badge, hub, contact info, priority score. Category-specific actions: Ready to Reach gets Preview Email + Activate; Phone Outreach gets Call + Log Call + Add Email; Venue Prospects gets Call + Log Venue Pitch + Add Email; Walk-in gets Log Visit + Add Contact. "Activate" (email outreach) only available on Ready to Reach tab. **"Activated" source bucket**: Businesses with `activation_source IS NOT NULL` OR (`claim_status='CLAIM_SENT'` AND `owner_email IS NOT NULL` AND `seed_source_type IS NULL`) appear with source badges "Charlotte Activated" or "Form Activated", opportunity score pills (hubTv/adBuyer/listingUpgrade/eventPartner), and "Activated" filter option in dropdown. Deduplicates against seeded results. **Pull Listings**: "Pull Listings" button opens inline panel with category dropdown (13 categories: Restaurants, Salons & Barbershops, Auto Repair, etc.) + area dropdown (from zones) + count selector (10/20/30/40). Triggers `POST /api/admin/opportunity-radar/pull-listings` which: (1) searches Google Places for `{category} in {hub}, Charlotte NC`, (2) deduplicates by googlePlaceId and presencePlacesSource, (3) creates businesses with full details (phone, website, photos, categories, geo, zone mapping), (4) immediately crawls each website via `crawlEntityWebsite` to extract emails, (5) creates CRM contacts. Bypasses daily API limits (`skipDailyLimit: true`). Returns `{imported, skipped, withEmail, withPhone}`. **Find Emails**: "Find Emails" button triggers `POST /api/admin/opportunity-radar/crawl-for-emails` which crawls up to 50 businesses that have `websiteUrl` but no `ownerEmail` (concurrency: 5). Returns `{crawled, emailsFound}`. Both buttons always visible in the pipeline toolbar bar alongside Boost Pipeline. API: `GET /api/admin/opportunity-radar` (returns `opportunityCategory`, `venueScreenLikely`, `address`, `categoryCounts`), `POST .../activate`, `POST .../log-call` (accepts `type`: call/venue_pitch/visit), `POST .../add-email`, `POST .../pull-listings`, `POST .../crawl-for-emails`. Component: `client/src/pages/admin/opportunity-radar.tsx`. Routes: `server/opportunity-radar-routes.ts`.

3. **Inbox / Exceptions** — Same inbox, but defaults to exception-only view (claims, billing, bounces, submissions, system errors). Routine items (pipeline_needs_review, capture_listing_review, new_review, new_vote) filtered out by default. "Show All" toggle reveals everything. Component: `client/src/pages/admin/inbox-panel.tsx`.

#### Field Capture Pipeline Enhancement
- **`captureOrigin`** field on `crm_contacts` table. Values: `met_in_person`, `stopped_by_location`, `found_business_card`. Set during capture on the Catch page.
- **Deterministic outreach drafts** generated immediately on capture (not waiting for 6-hour Charlotte scan):
  - `capture_met_in_person`: "Great meeting you..." framing
  - `capture_stopped_by`: "I stopped by your location..." framing
  - `capture_found_card`: "I came across your business card..." framing
  - `seeded_unclaimed`: "We noticed [business] is a staple in [neighborhood]..." (for Google Places/OSM imports, triggered from Opportunity Radar Activate)
- Template types added to `outreachTemplateTypeEnum` in schema. Functions: `generateCaptureOutreachDraft()`, `generateSeededOutreachDraft()` in `server/intelligence/outreach-drafter.ts`.

### Design Principles
- **Mobile-first / portrait orientation** for Catch and field tools
- **Amber for warnings** (not red) — people over data, no pressure language
- **"Needs Review" not "Uncategorized"** — respectful language throughout
- **Hub brand colors** — Catch and tools use the Charlotte Hub color palette (primary purple `273 66%`, accent amber `46 88%`), not custom standalone colors
- **Everything is "mine"** — built natively, full control, no external app dependencies
- **One login, one dashboard** — operators should never need to leave CMH to do their job
- **Automation first** — if a task can be done by Charlotte AI or a scheduled job, it should be. Manual operator intervention is the exception, not the rule.
- **Pulse = social feed** (`/pulse`), **Spotlight = editorial/news** (`/articles`). They are distinct but connected through the feed.
- **Social Sharing on Pulse**: Each Pulse post card has a ShareMenu with 10 channels: Copy Link, WhatsApp, Facebook, X/Twitter, LinkedIn, Reddit, TikTok, Nextdoor, Email, SMS (mobile only). Share URLs point to branded permalink pages at `/:citySlug/pulse/post/:postId`. Permalink page has full OG meta tags + dynamically generated OG image (`/api/og-image/pulse/:postId`) with brand colors, post title, author, media type badge. Server-side SEO snapshot (`seo-snapshot.ts`) injects OG tags for social crawlers. ShareMenu also used on Business, Event, Article detail pages. TikTok and Nextdoor use copy-to-clipboard approach (no direct web share URL). ShareMenu supports custom `trigger` prop for inline styling in feed cards.
- **Community storytelling philosophy** — "The Hub isn't advertising. It's the living story of a city." Inspirational quotes from business leaders (Gary V, Seth Godin, Simon Sinek, Peter Drucker) and community builders (MLK, Maya Angelou, Jane Jacobs, Fred Rogers, Cesar Chavez, Dolores Huerta) are woven throughout selling pages and Charlotte's conversations.

### Inspirational Messaging System
- **Quote library**: `shared/inspirational-quotes.ts` — 30+ structured quotes with categories (business_leader, community_builder, local_philosophy), themes (storytelling, community, discovery, social_selling, purpose, relationships, local_media, founder), and page contexts
- **InspirationQuoteBlock component**: `client/src/components/inspiration-quote-block.tsx` — 3 variants (default/dark/subtle), random rotation, personalized by `inspirationName`
- **Personalization**: During story interview/opportunity profiling, Charlotte asks "Who inspires you in business?" → saved as `businesses.businessInspiration`. Selling pages then show quotes from that person.
- **Selling pages with quotes**: presence-pricing.tsx, activate.tsx, claim-business.tsx, hub-screens-promo.tsx, tell-your-story.tsx
- **Platform taglines**: Rotating set of 10 taglines ("Where Local Stories Become Local Discovery", etc.)
- **Messaging Library admin panel**: `messaging-library-panel.tsx` under Platform Master. Admin manages all platform messaging — approve/reject Charlotte-suggested variations, add custom quotes, toggle active/inactive per page. Charlotte AI generates new variations via GPT-4o-mini. DB table: `platform_messaging` (id, category, text, author, pageContexts, status, suggestedBy).
- **Mentor question in interviews**: `mentor_inspiration` module added to CONVERSATION_MODULES (contextual priority, after origin_story). Also `business_inspiration` question in OPPORTUNITY_PROFILE_QUESTIONS (free-text). Answer saved to `businesses.businessInspiration`.

### Teach Charlotte Panel (Updated)
- Panel at admin sidebar "Teach AI" under Platform Master
- **"What Charlotte Knows" section**: Read-only summary of Charlotte's 10 built-in knowledge domains (Platform Features, Coverage, Pricing, Handles, Tiered Permissions, Pulse Intelligence, Inspirational Quotes, Taglines, Bilingual, Community Storytelling). Shows last scan timestamp and quote/tagline counts.
- **Custom Configuration**: Greeting, Additional Instructions, Key Talking Points — these layer on top of built-in knowledge for seasonal/timely overrides
- **Test Charlotte**: Button opens iframe preview of public chat
- Charlotte's system prompt (`DEFAULT_SYSTEM_INSTRUCTIONS` in `server/charlotte-public-routes.ts`) now includes: handles, tiered permissions, Pulse Intelligence capabilities, community storytelling philosophy, inspirational quotes with usage rules

### Marketing & Content Engine (Content Studio / Content Output Engine)
- **Purpose**: Full Content Output Engine. Pick any content source (article, event, business, Pulse post, CMS content item) → generate a complete content package with social post variations (short/medium/long per platform), newsletter block (subject + preview + body), Pulse snippets (A/B variants), and video/script prompts → review/edit/approve/regenerate → copy to clipboard for distribution.
- **Content Studio panel**: `client/src/pages/admin/content-studio-panel.tsx` — "Content Studio" in Marketing & Content sidebar section. Two tabs: Browse Sources (articles, events, businesses, posts, CMS content with search/filter), Packages (generated content packages with expand/collapse deliverables, regenerate per package or per deliverable). Generate button on each source triggers AI generation via Charlotte.
- **CMS Content as Source**: CMS content items (stories, articles, press releases, pages) with status "published" or "in_review" appear as selectable sources alongside existing types. "Generate Content Package" button on CMS content editor page (`client/src/pages/admin/cms-content-editor.tsx`). Auto-generation triggered when CMS item transitions to "published" status via workflow transition endpoint.
- **Backend**: `server/content-studio-routes.ts` — Routes: GET sources (including CMS content), POST generate, POST generate-for-cms/:contentItemId, GET packages (with nested deliverables), PATCH deliverables (edit content/status), PATCH packages (update status), DELETE packages, POST packages/:id/regenerate (full package), POST deliverables/:id/regenerate (single deliverable).
- **DB tables**: `content_packages` (metroId, sourceType, sourceId, sourceTitle, sourceExcerpt, sourceImageUrl, contentItemId, status, createdBy). `content_deliverables` (packageId, type, platform, variant, content, hashtags, imageUrl, status, scheduledAt, publishedExternallyAt). Enums: `content_deliverable_type` includes newsletter, video_script. `content_deliverable_status`.
- **AI generation**: GPT-4o-mini generates 8+ deliverables per source: 3-5 social post variations (short/medium/long for Instagram, short for TikTok, short for Twitter/X), newsletter block (subject + preview + body), 2 Pulse snippets (A/B variants), video/script prompt. Strict tone rules: human-first, local, non-generic, no AI-sounding language. Fallback templates if AI unavailable. Hashtags auto-include #CLT #Charlotte #CharlotteNC #QueenCity.
- **Regeneration**: Full package regeneration (deletes old, re-generates) and single deliverable regeneration (AI rewrites with different angle). Both available via API and UI buttons.
- **Future scheduling**: `scheduledAt` and `publishedExternallyAt` columns on deliverables for future auto-posting (not wired to external APIs yet).
- **Workflow**: Browse source → Generate → Review deliverables → Edit/Approve/Reject each → Regenerate if needed → Copy to clipboard (includes hashtags) → Paste to platform. Future: direct API posting and scheduling.

### Social Publishing System
- **Purpose**: Charlotte repurposes high-performing Pulse content into platform-ready social media posts (YouTube, Facebook, Instagram, TikTok). Copy-to-clipboard workflow — no API connections yet.
- **Generator**: `server/intelligence/social-content-generator.ts` — `generateSocialPosts()` scans last 7 days: top Pulse posts by saves/likes, recently claimed businesses, upcoming popular events, Charlotte-generated articles. GPT-4o-mini rewrites in social-native voice with platform-specific formatting. Runs on Charlotte 6-hour scheduler.
- **DB table**: `social_posts` (id, metroId, sourceType, sourceId, platform, caption, hashtags, imageUrl, videoUrl, scheduledAt, publishedAt, externalUrl, status, createdBy). Enums: `social_platform`, `social_post_status`.
- **API routes**: `server/social-publishing-routes.ts` — CRUD for social posts, batch generation trigger, generate-from-content.
- **Admin panel**: `social-publishing-panel.tsx` under Marketing & Content sidebar section. Stats bar, tab filters (All/Drafts/Approved/Published), post cards with platform icons, caption editor, copy-to-clipboard for captions and hashtags, mark-as-published with external URL input, bulk generate button, create-from-content dialog.
- **Workflow**: Charlotte generates drafts → admin reviews → approves → copies caption/hashtags → pastes to YouTube/Facebook/Instagram/TikTok → marks as published with external URL. When social accounts are set up, direct-publish API adapters can be added.

### Admin Header Bar (Floating Action Bar)
Compact sticky header with brand-colored pill buttons, replaces old mobile dropdown. Layout: `[ ≡ Menu ] [ 📋 Nav Dropdown ] [ 👋 Inbox (badge) ] [ Catch ] [ Search ⌘K ] ... [ Charlotte ]`. Nav dropdown mirrors sidebar menu groups for quick mobile navigation without opening the full sidebar. Inbox navigates to inbox section. Catch links to `/face`. Search opens a command-palette Dialog with fuzzy search across businesses, contacts, events, content via `GET /api/admin/search?q=term` (ILIKE wildcards, 8 results per type). Keyboard shortcut: Cmd/Ctrl+K. Charlotte stays as AI assistant button on far right. Labels hidden on mobile (icons only), shown on sm+ screens. Inbox emoji: 👋 (waving hand) when items pending, 👍 (thumbs up) when clear — shown in both header button and sidebar.

### Admin Quick-Edit FAB (Floating Action Button)
Super admin floating button on all public detail pages. When logged in as admin and viewing any entity page, an amber "Edit [Entity]" FAB appears bottom-right corner. Clicking opens the admin back-office directly on that specific entity — not just the section, but the exact item's edit view. Architecture: `AdminEditProvider` context wraps `PublicLayout`, each detail page calls `useRegisterAdminEdit(section, entityId, label)` to register its entity. The FAB reads from context and links to `/admin/{section}?entityId={id}`. Admin dashboard reads `entityId` from URL params and auto-opens the entity in the corresponding panel (EventsPanel, ArticlesPanel, BusinessesPanel, CmsEditor, etc.).

**Covered pages** (20+): event-detail, business-detail, article-detail, rss-article-detail, marketplace-detail, job-detail, pulse-post-detail, digest-detail, curated-list-detail, event-series-detail, content-page, neighborhood-hub, micro-hub-page, venue-channel, author-profile, provider-profile, public-employer-profile, card-view, shopping-center.

**Files**: `client/src/hooks/use-admin-edit.tsx` (context + hook), `client/src/components/admin-edit-button.tsx` (FAB component), `client/src/components/public-layout.tsx` (provider mount). Admin dashboard `entityId` param handling in `client/src/pages/admin/dashboard.tsx`. New endpoint: `GET /api/admin/events/:id` for event auto-open.

### Business Listing Management
- **Tier badges**: Each business card in the admin list shows a color-coded tier badge: Free (gray), Verified (green), Charter (blue), Enhanced (purple)
- **"Edit Their Site" button**: Charter and Enhanced businesses show a prominent "Edit Their Site" button in the edit dialog that opens the microsite/site-builder in a new tab. Free/Verified shows an upgrade prompt instead.
- **Slug editor**: In the business edit dialog, admins can click "Edit slug" to reveal an inline slug editor with "Clean Up" (strips trailing hex suffixes like `-a3b2c1d4`), "Regenerate" (creates fresh slug from current name), and "Save" buttons. URL preview updates live as slug changes.
- **Enrichment status**: Business edit dialog shows website URL prominently, enrichment badge (Enriched/Pending), "Re-crawl Website" button (`POST /api/admin/businesses/:id/recrawl`), and inline "Send Verification" claim button at the top action area.
- **Claim invite preview & test**: For unclaimed businesses, the edit dialog shows "Preview Invite" (opens modal with rendered email HTML) and "Send Test to Me" (sends to admin's own email with [TEST] prefix). Endpoints: `GET /api/admin/businesses/:id/claim-preview`, `POST /api/admin/businesses/:id/send-claim-test`. Shared `buildClaimEmailHtml()` helper in `server/routes.ts` generates branded email (purple header, amber CTA, CLT Metro Hub branding).
- **Email templates seeded**: 5 starter templates auto-seeded on boot (`server/seed.ts`): claim_invite, welcome, prospecting, weekly_hub, weekend_hub. All active, branded with purple/amber, merge tags ({{businessName}}, {{claimUrl}}, etc.). Idempotent — skips if any templates exist.
- **Visual email builder**: Block-based email template editor (`client/src/components/email-block-editor.tsx`) replaces raw HTML textarea. 8 block types: Header, Text, Button, Image, Divider, Spacer, Two-Column, Footer. Left panel: block list with expand/collapse editing, reorder (up/down), remove. Right panel: live preview via iframe. Brand defaults: purple header (#5B1D8F), amber buttons (#F2C230). Merge tag dropdown inserts {{name}}, {{businessName}}, {{claimUrl}}, {{spanishUrl}}, etc. Toggle between Visual and Code modes. Legacy templates (no blocks JSON) open in Code mode with preview. `blocks` jsonb column on `email_templates` stores block structure alongside generated `htmlBody`. Email HTML uses table-based layout with MSO conditional comments for Outlook compatibility.
- **Bilingual Email System ("Ver en Español")**: Every outgoing email includes a "Ver en Español →" link. When clicked, opens a branded web page (`GET /email/es/:token`) showing the same email content auto-translated to Spanish via GPT-4o-mini. Architecture:
  - **Token system**: `generateSpanishEmailToken(templateKey, businessId)` creates HMAC-signed base64url token encoding `templateKey:businessId`. `buildSpanishUrl(templateKey, businessId, appUrl)` returns the full URL.
  - **Translation page**: `server/email-translate-routes.ts` — validates token, fetches current template by templateKey, translates HTML via `server/services/auto-translate-email.ts` (GPT-4o-mini), wraps in branded page. Always renders from current English template — one source of truth, always in sync.
  - **Language intelligence**: First click sets `businesses.preferredLanguage = "es"` on the linked business record. Admin UI shows amber "ES" badge on businesses with Spanish preference (in BusinessesPanel list cards and inbox send-verification dialog).
  - **Translation cache**: In-memory Map keyed by `templateKey:businessId:templateUpdatedAt`. Auto-invalidates when template is edited (PATCH route calls `clearTranslationCache(templateKey)`). No stale translations.
  - **Merge tag**: `{{spanishUrl}}` available in email block editor merge tag dropdown. Campaign send flow auto-generates per-recipient URLs using recipient's presenceId/userId. Seeded templates include "Ver en Español" in footer.
  - **Hardcoded emails**: Claim invite, claim preview, claim test emails all include the Spanish link via `buildClaimEmailHtml(name, claimUrl, viewUrl, spanishUrl)`.
  - **Schema**: `preferredLanguage` (text, nullable) on `businesses` table.
  - **Files**: `server/email-translate-routes.ts`, `server/services/auto-translate-email.ts`, `server/email-routes.ts` (cache invalidation + campaign merge), `client/src/components/email-block-editor.tsx` (merge tag), `client/src/pages/admin/dashboard.tsx` (ES badge), `client/src/pages/admin/inbox-panel.tsx` (ES badge).
- **ContactsPanel sub-menu**: When navigated from a specific sidebar filter (e.g., "Who Referred You"), the internal side navigation is hidden and only the filtered content shows. Full sub-menu only appears when opening the main "Contacts" item.
- **Tier visual previews**: Shared `TierVisualPreviews` component (`client/src/components/tier-visual-previews.tsx`) renders realistic scaled-down mini-microsites for each tier: Verified = basic directory card (name, address, phone, 1 photo placeholder); Charter = amber-themed tabbed microsite with hero, 3-photo gallery, social icons, reviews, bilingual badge; Enhanced = purple gradient premium microsite with scrolling nav pills (About/Services/Gallery/Team/FAQ/Events), 8-photo grid, video embed, team avatars, custom domain + bilingual callouts. Retail pricing shown with strikethrough: Charter $99/yr (~~$499~~, Save $400), Enhanced $299/yr (~~$699~~, Save $400). Used in: activation flow (`activate.tsx`), presence pricing page (`presence-pricing.tsx`), and claim success page (`claim-business.tsx`). Supports `mode="select"` (click to choose tier) and `mode="checkout"` (click triggers Stripe checkout). `showVerified` controls whether the Verified column is shown.

### Admin Sidebar Organization (Consolidated v2)
All group headings are collapsible/expandable (Radix Collapsible + chevron). Groups auto-expand when they contain the active section. Consolidated into 5 main zones + Command Center + Intelligence + Platform Master.

- **My [CODE] Hub** — First item (standalone, always visible). Dynamic label with city code (e.g. "My CLT Hub"). Default landing page.
- **Command Center** — Catch link, Command Center (stats dashboard), Inbox.
- **CRM** — Contacts, Organizations, Your Referrals, Communications (tabbed hub), Comms Log. Nested **Role Filters** sub-section (collapsed by default, 7 items: People I Want to Meet, Potential Clients, Current Clients, People Trusted to You, Who I Met, Trusted Partners, Who Referred You). Role items use compound IDs (`crm-contacts:trusted`) to pre-filter ContactsPanel via `initialFilter` prop.
- **Content & Listings** — Businesses, Events, Categories, CMS Overview, Content Library, Media Library, Pulse, Pulse Posts, Shop & Deals, Curated Lists, Content Pages.
- **Hub Operations** — Live Feeds, AI Site Builder, Ad Manager, Web TV, Tags, Feed Debug, Moderation (tabbed hub), Content Intake, Places Import, Listings to Claim, Authors, Editorial Calendar.
- **Tools & Settings** — Mileage Log, Digital Cards, Listing Tiers, Tiers & Inquiries, SEO Diagnostic, Feature Audit, Content Journal.
- **Metro Intelligence** — Intelligence Engine, Micro Prospects, Report Requests, Pulse Intelligence, Outreach Queue, Content Drafts.
- **Platform (Master)** — Super Admin only. Hub Management, License CRM, Territories & Operators, Revenue & Payouts, Payout Management, Audit Log, Marketing Site, Teach AI, Messaging Library.

### Communications Hub
Single "Communications" sidebar item opens `communications-hub.tsx` — a 5-tab panel merging previously separate email tools + SMS:
- Tab 1: Email Templates (renders EmailTemplatesPanel)
- Tab 2: Campaigns (renders EmailCampaignsPanel)
- Tab 3: SMS Conversations (renders SmsConversationsPanel — NEW)
- Tab 4: Weekly Digest (renders WeeklyDigestPanel)
- Tab 5: Suppression / Unsubs (renders EmailSuppressionPanel)

### Moderation Hub
Single "Moderation" sidebar item opens `moderation-hub.tsx` — a 3-tab panel merging moderation tools:
- Tab 1: Moderation Queue (renders ModerationPanel)
- Tab 2: Review Moderation (renders ReviewModeration)
- Tab 3: Submissions (self-contained wrapper fetching from /api/admin/submissions)

### Live Feeds (DB-backed)
Live feeds are now stored in the `live_feeds` database table instead of static config files.
- **Schema**: `live_feeds` table — id, title, type (youtube|page), embedUrl, sourceUrl, category, description, organizationSlug, featured, sortOrder, isActive, cityId, createdAt
- **Admin panel**: `live-feeds-panel.tsx` — table view of all feeds, add/edit/delete dialogs, sort order, active toggle
- **API**: `GET/POST /api/admin/live-feeds`, `PATCH/DELETE /api/admin/live-feeds/:id`, `GET /api/cities/:citySlug/live-feeds` (public)
- **Seed**: 16 Charlotte feeds seeded (2 Skyline, 2 Wildlife, 2 Beach, 2 Traffic, 1 Weather, 1 Sports, 3 News, 1 Community, 2 Mountains)
- **Pulse feed integration**: Active YouTube live feeds are automatically injected into the Pulse feed (2 per page, at positions ~4 and ~14) via `injectLiveItems()` in `feed-service.ts`. Pulls from the `live_feeds` DB table (not static data)
- Static configs in `client/src/data/live-feeds.ts` and `server/data/live-feeds.ts` remain as fallback references for the public `/live` page only

### Hub Screens / Web TV (Chive TV Competitor)
Hyper-local neighborhood content on venue/bar TV screens with QR codes. Everything lives under `/tv` routes, ready for CityMetroHub.tv domain.
- **Schema**: 4 enums (tvScreenStatusEnum, tvItemTypeEnum, tvSourceScopeEnum, tvLanguageModeEnum) + 7 tables:
  - `tv_screens` — screen config: name, cityId, metroSlug, hubSlug, locationSlug, status, screenKey (unique token), languageMode (en/es/bilingual), competitorProtection, playlistSettings (jsonb), dayparting, heartbeat, venue contact info, activeScheduleId, activeLoopIds (text array)
  - `tv_items` — content items: title, type (slide/video), sourceScope (metro/hub/location), templateKey, data (jsonb), asset/video/QR URLs, scheduling (startAt/endAt), priority, daypartSlots, paid ad fields, source entity tracking, **contentFamily** (10 families), **narrationText/narrationAudioUrl/narrationEnabled/voiceProfile/captionUrl/captionText**
  - `tv_placements` — paid placement contracts: advertiser, monthly amount, screen/hub targeting, competitor exclusion categories, communityFraming/communityMessage fields
  - `tv_loops` — named 60/90-min programming loops: name, slug, durationTargetMinutes, orderStrategy (fixed/weighted_shuffle/semi_random), narrationStyle (voice profile), venueTypes, daytimeTags
  - `tv_loop_items` — junction: loopId → itemId with position, sectionLabel, weight
  - `tv_schedules` — time-of-day programming: name, startTime, endTime, daysOfWeek, loopId, priority, loopSelection (sequential/weighted_random/alternating)
  - `tv_host_phrases` — bilingual narration intro phrases: category (6 types), phraseEn, phraseEs, voiceProfile, sortOrder
- **Schema (Phase 2 additions)**: `tv_qr_scans` (scan tracking: screenId, hubSlug, itemId, templateKey, redirectUrl, scannedAt, userAgent), `tv_play_logs` (proof of play: screenId, screenKey, itemId, templateKey, playedAt, durationSec, hubSlug)
- **Seed Data** (`server/seed-tv-content.ts`): Idempotent dev seed creates 5 rich loops (Local Pulse Hour, Community Spotlight Hour, Tonight Around You Hour, Info+Entertainment Hour, Weekend Happenings) with 37 content items, 88 loop-item assignments, 3 schedules (weekday daytime/evening/weekend), 24 host phrases (6 categories x 4 bilingual), 6 community-framed placements
- **API** (`server/tv-routes.ts`):
  - `GET /api/tv/playlist` — assembles playlist from tv_items + auto-pulls events (upcoming only), articles (last 30 days only), businesses, live_feeds. Applies dayparting, competitor exclusion, scope cascade (metro→hub→location). Interleaves paid items at adSlotFrequencyMin intervals. Wraps all QR URLs through `/api/tv/qr/:itemId` tracking redirect. Active placements auto-inject linked tv_items. Returns ~20min loop
  - `GET /api/tv/qr/:itemId` — QR scan tracking redirect: logs scan to tv_qr_scans, redirects to destination URL
  - `POST /api/tv/play-log` — proof of play: logs slide/video display (itemId, templateKey, durationSec, screenKey, hubSlug)
  - `POST /api/tv/heartbeat` — screen health check (screenKey → lastHeartbeatAt)
  - `POST /api/tv/onboard` — venue self-signup creates inactive screen + CRM contact, returns screenKey for venue portal access
  - **Venue Portal API**: `GET /api/tv/venue/:screenKey` (screen info + specials), `PATCH /api/tv/venue/:screenKey/settings` (language mode), `POST/PATCH/DELETE /api/tv/venue/:screenKey/specials/:id` (max 3 venue_special items)
  - Admin CRUD: `GET/POST /api/admin/tv/screens|items|placements|loops|schedules|host-phrases`, `GET/PATCH/DELETE /api/admin/tv/screens|items|placements|loops|schedules|host-phrases/:id`, `GET /api/admin/tv/screen-health`, `GET /api/admin/tv/analytics`
  - Loop Items: `GET/POST /api/admin/tv/loops/:id/items`, `PUT /api/admin/tv/loops/:id/items` (bulk replace)
  - TTS/Captions: `POST /api/admin/tv/generate-narration`, `POST /api/admin/tv/generate-captions`
- **18 Slide Templates** (`client/src/components/tv/slide-templates.tsx`): hub_event, pulse_headline, hub_discovery, neighborhood_spotlight, venue_special, live_feed, weather_current, sports_scores, traffic_update, trivia_question, social_proof, qr_cta, sponsor_ad, event_countdown, tonight_around_you, this_weekend, nonprofit_showcase, support_local_spotlight. All 1920x1080 fullscreen, bilingual support (title + titleEs via getText helper), QR codes, "Powered by CityMetroHub.tv" footer. `SlideRenderer` dispatches by templateKey. Event-driven templates: `tonight_around_you` (shows up to 3 tonight events with fallback CTA), `this_weekend` (shows up to 4 weekend events with day labels and fallback CTA). Backend helpers: `server/services/tv-event-helpers.ts` (`getTonightEvents`, `getWeekendEvents`) query real event data by metro/hub scope.
- **Live Data Services** (Phase 3):
  - `server/services/weather-service.ts` — NWS API (free, no key), 30min cache, Charlotte coordinates, returns temp/conditions/high/low/humidity/wind
  - `server/services/sports-service.ts` — ESPN public API, 5min cache, local Charlotte teams (Panthers, Hornets, Charlotte FC, Knights), returns game scores/status/logos
  - Live data auto-injected into playlist: weather always (priority 6), sports when games active (priority 5, 7 if live), traffic during rush hours 7-9am/4-7pm (priority 5)
- **Trivia System** (Phase 3): `trivia_question` slide template + `/tv/trivia/:questionId` mobile landing page. API: `GET /api/tv/trivia/:questionId` (returns question sans answer), `POST /api/tv/trivia/:questionId/answer` (validates, IP-based rate limiting 1 answer/question/IP, optional email → CRM contact with source "trivia"). Answer stored in-memory Map per questionId/IP. Correct answer text returned as `correctAnswer`.
- **Social Proof** (Phase 3): `social_proof` slide template — curated community content (no API, admin-managed). Fields: platform, username, caption, imageUrl, stats.
- **Multi-Screen Sync** (Phase 3): Clock-based (no WebSocket). `screenGroupId` + `screenGroupRole` ("primary"|"secondary") on `tv_screens`. Playlist returns `syncStartTime` (midnight epoch) + `screenGroupOffset` (half loop for secondary). Player `calculateSyncIndex()` on load. Synced screens get `nextRefreshSec: 60`. Admin: `PATCH /api/admin/tv/screens/:id/group`, `GET /api/admin/tv/screen-groups`. Screen group column visible in Screens table with group badge + role indicator.
- **Channel Assembly Engine** (`server/services/channel-engine.ts`): Core playlist assembly that replaces simple 20-min loop with full programmed channel. Steps: resolve schedule → pick loop (weighted/sequential/alternating) → order items (fixed/weighted_shuffle/semi_random by section) → inject venue placements → inject real-time data → apply competitor exclusion → apply narration spacing → anti-fatigue rules. Returns `ChannelPlaylistItem[]` with loopId/loopName context. Backward compatible — falls back to legacy playlist when no schedule assigned.
- **TTS Narration** (`server/services/tts-provider.ts`): OpenAI TTS via direct API (`openai` npm package, `OPENAI_API_KEY` secret). Shared client at `server/lib/openai.ts`. Voice profiles: warm_local_host→nova, upbeat_event_host→echo, calm_waiting_room→alloy, nightlife_host→onyx. Generates MP3 files saved to `uploads/tv-narration/`. Graceful fallback if key missing.
- **Caption Generator** (`server/services/caption-generator.ts`): Auto-generates WebVTT from narration text (word-count based timing). Saved to `uploads/tv-captions/`.
- **Content Families**: Tagging system on `tv_items.contentFamily` — 10 families: tonight_around_you, weekend_happenings, support_local, local_commerce_spotlight, nonprofit_showcase, community_partner, neighborhood_favorite, venue_spotlight, local_pulse, info_now. Filterable in admin and channel engine.
- **TV Player** (`client/src/pages/tv-player.tsx`): Fullscreen kiosk player at `/tv/:citySlug/:hubSlug/:locationSlug`. Crossfade transitions, auto-advance (9s slides, video to end), playlist refresh every 5min (60s for synced screens), heartbeat every 60s, proof-of-play logging on each slide advance, Wake Lock API, cursor hiding, right-click prevention. Fallback "Coming Soon" slide if playlist empty or fetch fails (with 30s retry). Supports clock-based sync via `calculateSyncIndex` for grouped screens. **Audio playback** for narrated segments, **WebVTT caption overlay** with large TV-readable styling, **loop transition indicator** when switching between program loops.
- **Admin Panel** (`client/src/pages/admin/tv-panel.tsx`): 8-tab panel (Screens, Content, Loops, Schedules, Host Phrases, Placements, Preview, Analytics). Visual slide builder with template-specific form fields + live inline preview + Code Mode toggle. Narration tools: text input, voice profile selector, generate audio button, audio preview. Caption tools: auto-generate VTT from narration, upload VTT, subtitle text. Content Family selector (10 families). **Admin help panels** on each tab with concise guidance. **Loops tab**: create/edit 60/90-min loops, assign items with positions/sections/weights, estimated runtime display. **Schedules tab**: time-of-day/day-of-week programming, loop assignment, visual timeline preview, assign to screen. **Host Phrases tab**: CRUD for bilingual narration intro phrases across 6 categories. **Preview Studio**: single item preview, full loop preview, daily programming view, venue preview — all with narration + caption support.
- **Venue Portal** (`client/src/pages/tv-venue-portal.tsx`): Self-service at `/tv/venue/:screenKey`. Dark themed. Shows screen status + heartbeat, manage up to 3 venue specials, language preferences. screenKey acts as access token
- **Promo Page** (`client/src/pages/hub-screens-promo.tsx`): Marketing page at `/tv`. Dark cinematic design. Hero, **live demo player** (mini TV frame cycling through 9 demo slides via `DemoSlidePreview` component — Weather, Trivia, Venue Special, Social, QR CTA, Countdown, Video, Tonight Around You, This Weekend), template showcase, how-it-works steps, comparison vs generic bar TV, venue benefits, **FAQ accordion** (6 common questions), **referral section** ("Know a Venue?" with CTA), final CTA. All sections i18n EN/ES. No specific pricing or revenue share details shown. Demo player uses purpose-built preview cards (NOT SlideRenderer) for consistent ~800px container display.
- **Onboarding** (`client/src/pages/hub-screen-onboard.tsx`): 3-step wizard at `/tv/get-started`. Venue info → screen preferences (language, content interests, competitor blocking) → review & submit. Creates inactive screen + CRM contact. Success state includes "Manage your screen" link to venue portal
- **Domain routing**: `citymetrohub.tv` / `www.citymetrohub.tv` recognized as TV domains. Root `/` redirects to `/tv`. Domain config API returns `isTvSite` flag
- **Route order** in App.tsx: `/tv/get-started` → `/tv/venue/:screenKey` → `/tv/trivia/:questionId` → `/tv/:citySlug/:hubSlug/:locationSlug` → `/tv/:citySlug/:hubSlug` → `/tv/:citySlug` → `/tv` (most specific first for wouter Switch matching)

### Venue Channels + Social Selling
Each business can have a Venue Channel — their media hub, content channel, live stream location, and social selling entry point. YouTube is used for video hosting/streaming only; the Hub handles routing, commerce, and distribution.
- **Schema**: 4 enums (channelStatusEnum, liveSessionStatusEnum, offerProductTypeEnum, transactionStatusEnum) + 5 tables:
  - `venue_channels` — businessId, cityId, channelSlug, channelTitle, channelDescription, youtubePlaylistId, channelStatus (draft/active/paused), liveSessionId
  - `video_content` — venueChannelId, businessId, cityId, youtubeUrl, youtubeVideoId, youtubePlaylistId, title, description, thumbnailUrl, categoryIds, screenEligible, pulseEligible, durationSec, sortOrder
  - `live_sessions` — businessId, cityId, venueChannelId, youtubeLiveUrl, youtubeVideoId, status (scheduled/live/ended/cancelled), title, startTime, endTime, attachedOfferIds
  - `offers` — businessId, cityId, title, description, price (cents), productType (product/event/bundle/gift_card/reservation/promotion), imageUrl, checkoutUrl, liveSessionId, videoContentId, active
  - `transactions` — offerId, businessId, cityId, amount (cents), platformShare, venueShare, status (pending/completed/refunded), buyerEmail, stripePaymentId
- **API** (`server/venue-channel-routes.ts`):
  - Public: `GET /api/venue-channels/:slug` (channel + videos + live + offers), `GET /api/venue-channels/:slug/videos`, `GET /api/venue-channels/:slug/live`, `GET /api/venue-channels/by-business/:businessId`, `GET /api/live` (active sessions by city), `GET /api/offers/:id`
  - Admin CRUD: `GET/POST/PATCH/DELETE /api/admin/venue-channels|video-content|live-sessions|offers`, `GET /api/admin/transactions` (with filters)
- **Venue Channel Page** (`client/src/pages/venue-channel.tsx`): Public page at `/:citySlug/channel/:channelSlug`. Sections: channel header, Live Now banner (YouTube embed + offers), video grid (click-to-play inline), active offers, pulse mentions. SEO + VideoObject structured data.
- **Business Detail Integration** (`client/src/pages/business-detail.tsx`): When business has a channel, shows rich media section with live status, latest videos grid, active offers preview, "View Full Channel" link. Falls back to single youtubeUrl embed if no channel.
- **Admin Panel** (`client/src/pages/admin/venue-channels-panel.tsx`): 5-tab panel (Channels, Videos, Live Sessions, Offers, Transactions). Full CRUD for all entities. YouTube URL auto-extraction. Live session status management. "Venue Channels" in admin sidebar under Hub Operations.
- **Screen Integration**: Channel engine and legacy playlist inject `youtube_live_now` (priority 10) and `youtube_video` (priority 6) slides when venue has active live session or screen-eligible videos. Two new slide templates: `YouTubeLiveNowSlide` (animated red border), `YouTubeVideoSlide`. TV player handles YouTube iframe embeds with timer-based advancement.
- **Pulse Integration** (`server/services/venue-channel-pulse.ts`): Auto-generates pulse posts on video upload (pulseEligible), live session scheduled/started/ended. Uses moderationNotes for tracking/chaining.
- **Social Selling Viewer Experience**: When live sessions have `attachedOfferIds`, viewers see: (1) `ShopNowPanel` on venue-channel page with product cards, prices, "Buy" buttons; (2) `LiveOffersOverlay` on TV player with QR code linking to venue channel; (3) "Shopping" badge on `LiveFeedCard` in Pulse feed. Admin can attach offers when creating/editing live sessions.
- **Core rule**: Hub = routing + commerce + discovery. YouTube = video storage + streaming. QR codes always point to Hub pages, never YouTube.

### Hub TV / Micro Hub TV / Venue TV Media Network
The platform operates as a **hyper-local multimedia network** organized by neighborhoods, NOT a traditional media outlet or news organization.
- **Three Broadcast Layers**: (1) Hub TV — city-wide channel at `/tv/charlotte`; (2) Micro Hub TV — neighborhood channels at `/tv/charlotte/:hubSlug`; (3) Venue TV — location-specific screens at `/tv/charlotte/:hubSlug/:locationSlug` + `/tv/venue/:screenKey`.
- **Channel Engine** (`server/services/channel-engine.ts`): Assembles playlists by resolving schedules (day/time), picking loops (fixed/weighted_shuffle/semi_random), merging venue inserts + placements, injecting dynamic content (weather, sports, events). Anti-fatigue, narration spacing, competitor protection.
- **TV Admin Panel** (`client/src/pages/admin/tv-panel.tsx`): Tabs for Screens, Items (17+ templates), Loops, Schedules, Host Phrases, Expert Shows.
- **Hub TV Widget** (`client/src/components/tv/hub-tv-widget.tsx`): Compact embedded TV player on neighborhood hub and micro hub pages. Auto-advancing slides from Channel Engine playlist. Dark card, "Watch Full Screen" link. No audio in embed mode.
- **Expert Show Slots** (`expert_show_slots` table): Experts/businesses can request airtime. Admin approves. Active slots inject into Channel Engine rotation. Segment types: real_estate_update, health_tips, small_business_strategy, restaurant_highlights, general. API: `GET/POST/PATCH/DELETE /api/admin/expert-shows`, `POST /api/owner/expert-shows/request`, `GET /api/owner/expert-shows`. Owner dashboard has "Request Expert Show" form.
- **Podcast RSS Feed** (`server/podcast-routes.ts`): `GET /api/podcast/:metroSlug/feed.xml` generates valid RSS 2.0 with iTunes namespace. Sources from `video_content` where `podcastEligible=true` AND `audioUrl` is set. `audioUrl` and `podcastEligible` fields on `video_content` table. Feed link in public layout footer and coming-soon page.
- **Content Distribution Model**: One piece of content can appear across Hub TV, Micro Hub TV, Venue screens, Pulse feed, business pages, YouTube replay, and podcast feeds. Tagged by cityId/microHubId/venueId for targeting.
- **Programming Loops**: 5 seeded loops (Pulse Hour, Community Impact, Tonight Around You, Info-Entertainment, Weekend Happenings). 3 schedules with dayparting. Rotation-based programming, not algorithmic ranking.

### Content Pages (Public CMS Pages)
CMS items with `contentType: "page"` render publicly at `/:citySlug/pages/:slug`.
- **Public route**: `/:citySlug/pages/:slug` → `content-page.tsx` fetches from `GET /api/cms/pages/:slug`
- **Admin panel**: `content-pages-panel.tsx` — dedicated admin section under "Content & Listings" for managing pages (About, FAQ, Terms, etc.)
- Pages are created/edited through the CMS Content Editor (same as other CMS content types)

### Relocation Page
Public relocation guide at `/:citySlug/relocation` — helps people moving to the Charlotte metro find their ideal area.
- **API**: `GET /api/cities/:citySlug/relocation` — returns metro info, 19 counties with 86 hubs grouped by county, state (NC/SC) identification
- **Page sections**: Hero with metro stats (population, growth, median home price, sunny days), Housing CTA card (links to housing page), "Why Charlotte" cards (6 reasons), County-by-County Area Guide (expandable cards, searchable, hub links), Essential Resources (schools, DMV, utilities, hospitals, transit, airport)
- **Nav**: Added to `coreNav` and `footerNavMain` in `public-layout.tsx`, i18n key `nav.relocation` (EN: "Relocation", ES: "Reubicaci\u00f3n")
- **Files**: `client/src/pages/relocation.tsx`, `server/routes.ts` (API endpoint)

### Housing & Real Estate Page
Standalone relocation housing directory at `/:citySlug/relocation/housing` — two-tier model competing with apartments.com.
- **Two-Tier Model**: Tier 1 = Hub presences imported FREE via Google Places (apartment communities, realtors, property managers); Tier 2 = PAID marketplace listings for actual availability, linked to hub presences via `postedByBusinessId`.
- **API**: `GET /api/cities/:citySlug/relocation/housing?q=&priceMin=&priceMax=&amenities=` — returns apartments, realEstate, propertyManagement arrays + marketplace listings + neighboring hubs
- **Page sections**: Hero gradient, search + amenity filters panel, interactive neighborhood map (NeighborhoodMap), three grouped sections (Apartment Communities, Real Estate & Realtors, Property Management), marketplace availability cards, neighborhoods carousel, claim CTA
- **Google Places Import**: Guarded by `area_places_import_housing_v1` platform_settings key. 35 searches across Charlotte metro zip codes for apartment communities, real estate agencies, and property management companies. Category IDs resolved from slugs at runtime (apartment-communities, real-estate, residential-real-estate, property-management). Uses `overrideCategoryIds` parameter on `runImportJob`.
- **MLS Embed**: `mls_embed_url` TEXT column added to businesses table (ALTER TABLE migration in server/index.ts startup). Allows realtors to embed MLS search as a paid add-on.
- **Files**: `client/src/pages/housing.tsx`, `server/routes.ts` (API), `server/index.ts` (migration + import), `server/google-places.ts` (override param)
- **Route**: `/:citySlug/relocation/housing` registered before `/:citySlug/relocation` in App.tsx for correct route matching

### Public Access Model — "Social Preview + ScrollWall"
Social-media-style access: anonymous visitors see limited content previews, full browsing requires free account registration. Individual detail pages stay fully open for SEO.
- **ScrollWall** (`client/src/components/scroll-wall.tsx`): Two exports — `ScrollWall` (wraps children array, shows first N items) and `ScrollWallOverlay` (standalone gradient+CTA overlay). Both check `useAuth()` — logged-in users see full content, anonymous users hit the wall. Wall shows gradient fade + "Join CLT Metro Hub to keep exploring" CTA + sign-up/login buttons. i18n keys: `scrollWall.headline`, `scrollWall.subtext`, `scrollWall.signUp`, `scrollWall.logIn` (EN/ES).
- **Feed page limits for anonymous users**: Pulse (3 posts), Stories (4 cards), Events (4 cards), Directory (6 cards), Neighborhood Hub (3 items per section).
- **Open routes** (`OpenCityRoute` in `App.tsx`): Sub-pages (directory, events, stories, neighborhoods, pulse, attractions, jobs, relocation, etc.) are publicly accessible without auth for SEO. Uses `OpenCityRoute` wrapper (no `ComingSoonGuard`).
- **Gated routes**: The **home page** (`/:citySlug` and `/:citySlug/home`), Marketplace, and Live Video are behind `ComingSoonGuard`. Non-admin visitors see the Coming Soon landing page.
- **Interactive feature gating**: On detail pages (open for SEO), Save/Review/Post/Submit buttons prompt anonymous users with `AuthDialog` (register tab). Share buttons remain open.
- **Submit pages**: All submit pages (`submit-event`, `submit-article`, `submit-shout-out`, `submit-press-release`, `submit-media-mention`, `submit-landing`) gate anonymous users with an auth wall card.
- **AuthDialog enhancement**: Added `defaultTab` prop ("signin" | "register") to control which tab opens. Resets to `defaultTab` on each open via useEffect.
- **`useScrollWallGate` hook**: Utility hook for interactive feature gating — `requireAuth(callback)` checks auth, opens AuthDialog if needed, returns boolean.

### My Hub Nav Link
- **"My Hub"** nav pill in `coreNav` (after "Home"), visible only to logged-in users with at least one hub configured.
- Resolves user's active HOME hub ZIP to a neighborhood page URL via `/api/zones/resolve`.
- If user has no hub configured, clicking opens `HubSetupDialog`.
- Falls back to neighborhoods index if zone resolution fails.
- i18n key: `nav.myHub` (EN: "My Hub", ES: "Mi Hub").

### Auth Emails via Resend
- **Password Reset**: `POST /api/auth/forgot-password` now sends branded HTML email via Resend (`sendTerritoryEmail`). Purple CTA button, 1-hour expiry note. Falls back gracefully if email fails.
- **Magic Link**: `POST /api/auth/magic-link` now sends branded HTML email via Resend. 15-minute expiry note. Falls back gracefully.
- Both still log URLs to console as backup.

### Coming Soon (Home + Marketplace/Live)
`ComingSoonGuard` wraps the home page (`/:citySlug`, `/:citySlug/home`), Marketplace, and Live Video routes. Non-admin visitors see the Coming Soon landing page. Sub-pages remain open for SEO.
- **Geolocation Personalization**: Coming soon page uses `useGeoHub` hook (`client/src/hooks/use-geo-hub.tsx`) to detect visitor's location via browser geolocation API. Calls `GET /api/cities/:citySlug/nearest-hub?lat=X&lng=Y` (public endpoint, no auth) which finds the closest HUB-type region using haversine distance (max 50 miles). Returns hub name, county, and distance. On success: Charlotte welcome banner slides in with hub name (e.g., "Hey! Looks like you're near South End"), coverage map auto-expands to visitor's county, tagline personalizes. On denied/error: page unchanged. Result cached per city in sessionStorage (`cch_geo_hub:citySlug`).
- **Preview routes**: `/preview/:accessKey/:citySlug/...` routes bypass Coming Soon via `PreviewGate` access key validation — unaffected by the guard.

### SMS Conversations
Chat-style SMS conversation interface in the CRM Communications Hub (Tab 3).
- **Schema**: `sms_messages` table — id, contactId, direction (inbound|outbound), body, fromNumber, toNumber, status (sent|delivered|failed|received), twilioSid, cityId, operatorId, createdAt
- **API**: `GET /api/admin/sms/conversations` (contact list with last message), `GET /api/admin/sms/conversations/:contactId` (message history), `POST /api/admin/sms/send` (send via Twilio)
- **Webhook**: `POST /api/webhooks/twilio/sms` (incoming SMS auto-matched to CRM contacts by phone)
- **UI**: Split panel — left: contact list with search, right: chat bubbles with compose bar
- All sent SMS logged to `comms_log` table
- VoIP/AI calling = future phase
- **Marketing & Content** — Content Studio, Social Publishing, Pulse Posts, Pulse Videos, Banner Ads, Ad Management, Messaging Library, Web TV, Venue Channels. Content Studio is the unified content creation pipeline.
- **Charlotte AI** — Charlotte AI (formerly "Teach AI"), AI Site Builder. Separated from Platform Master into its own section.
- **Platform (Master)** — Super Admin only, always at bottom: Hub Management, License CRM, Territories & Operators, Revenue & Payouts, Payout Management, Audit Log, Marketing Site.

### Build Phases
- **Phase 1** (Complete): CRM Foundation + Catch — database tables, contacts/referrals/mileage/cards APIs, Catch page, nudge system, sidebar reorganization
- **Phase 2** (Complete): Capture Wizard — full-screen mobile-first capture flow at `/capture`, offline-first with IndexedDB, inbox-first CRM pattern, AI-powered card/voice/handwriting extraction
- **Phase 3** (Complete): Charlotte CRM Mode — 14 new CRM/referral/nudge/content tools, system prompt overhaul as full co-pilot, quick action buttons, ask-before-acting pattern
- **Phase 4** (Complete — Backend): Public Dashboard, Activity Feed, Notification Preferences. Backend APIs for personalized dashboard (`/api/public/dashboard`), hub-aware activity feed (`/api/public/activity-feed`, `/api/public/activity-feed/live`), notification preferences CRUD (`/api/public/notifications/preferences`), saved items details (`/api/public/saved-items/details`), admin activity feed creation (`/api/admin/activity-feed`). Auto-publishes feed items when businesses/events are created. Frontend pending.
- **Phase 5** (Complete): Capture-to-Listing Auto-Pipeline — Card snap → AI extract → save contact → auto-create FREE/UNCLAIMED business listing → enrich (crawl/classify/tag) in background → link contact↔business via `linkedBusinessId` → create `capture_listing_review` inbox item → operator reviews → "Send Verification" opens a dialog with email input + tier selector + email preview → sends claim email → business owner claims via `/:citySlug/claim/:token` → listing becomes CLAIMED. City resolved from `capturedWithHubId`, zone resolved from ZIP. Both new and linked listings get inbox items. Send Verification dialog fetches business data, pre-fills email, lets admin choose tier (Free/Verified/Charter/Enhanced) before sending — important for non-profits getting complimentary Charter listings. Email preview via iframe (srcdoc) before confirming send. Files: `server/capture-routes.ts` (autoCreateListingFromCapture, enrichListingInBackground), inbox-panel.tsx (SendVerificationDialog).
- **"Claim This Listing" CTA**: Unclaimed business detail pages (`claimStatus === "UNCLAIMED"`) show: (1) "Unclaimed" outline badge with AlertCircle icon near the top, (2) bottom CTA card with "Is this your business?" heading, $1 verification pitch, and "Claim This Listing" button linking to `/${citySlug}/activate?claim=${business.id}&name=...`. Neither element shown when business is claimed/verified.
- **Claim Queue Photo Indicators**: Admin "Listings to Claim" panel shows photo status per listing: green camera = Google Places photo or manual upload, yellow camera = stock/fallback image, red image-off = no photo. Source badge label (Google Places / Manual / Fallback / None) shown alongside existing badges.
- **Phase 5E** (Complete): Inbox Redefinition — Triage & Decision System. Converted admin inbox from notification bucket to focused triage system. 5 new DB columns (triage_category, confidence, triage_reason, suggested_action, triage_metadata). 4 triage tabs replacing 7 category tabs. Confidence-based routing (HIGH→auto-queue, LOW→inbox for review). Entity resolution panel for ambiguous matches. New endpoints: triage-counts, approve, dismiss, reprocess, resolve-entity. Files: `server/admin-inbox.ts`, `server/inbox-routes.ts`, `client/src/pages/admin/inbox-panel.tsx`, `server/storage.ts`.
- **Phase 6**: Advanced Digital Cards, org-to-org referrals, analytics
- **Charlotte Launch Build-Out** (Complete):
  - Flipped from Coming Soon → Live CityHome for `/:citySlug` routes
  - 39 hub regions (14 inner-city + 25 outer-metro towns like Huntersville, Fort Mill, Matthews, Concord, Mooresville, etc.)
  - 69 ZIP-to-hub coverage mappings for geolocation-based hub detection
  - Geo-resolve (`/api/zones/geo-resolve`) rewritten to use `zip_geos` table with SQL distance ordering instead of nearest-business approach
  - RSS articles get AI geo-tagging (`zoneSlug` column) on approval — AI extracts neighborhood mentions
  - Bulk-approve-all endpoint (`POST /api/admin/intelligence/rss-items/bulk-approve-all`) processes all pending articles with AI rewrite + geo-tag in batches of 10, streams NDJSON progress
  - Bulk-review endpoint enhanced: APPROVED status now triggers AI rewrite + geo-tag per item
  - Google Places seed import script (`server/seed-places-import.ts`) with admin trigger endpoint (`POST /api/admin/places/seed-import`)
  - Charlotte AI system prompt updated — includes outer-metro towns, marketplace, hub features; currently in "launching soon" mode
  - `isComingSoon` in public layout triggers on `/:citySlug` and `/:citySlug/coming-soon`
  - **Reverted to Coming Soon** — site not ready for live yet, Coming Soon page is the design reference
  - Empty ad placements (`LeaderboardAd`, `InlineAd`) removed from `city-home.tsx`
  - **Content safety filter**: `aiRewriteSummary` now returns JSON `{skip, reason, rewritten}`. Negative/scary news (crime, violence, accidents, tragedy, political controversy) auto-skipped during individual approve, bulk-review, and bulk-approve-all. Skipped items get `[AUTO-SKIPPED] reason` in rewrittenSummary.
  - **Standalone Marketplace page** (`client/src/pages/marketplace.tsx`) at `/:citySlug/marketplace`. Shows real listings from `marketplace_listings` table via public endpoint `GET /api/cities/:citySlug/marketplace/listings`. Falls back to sample data with "PREVIEW" disclaimer. Type filters (All/Jobs/Rentals), inquiry form. Nav links updated from `coming-soon#marketplace` to `/marketplace`.

### Pulse — Geo-First Tag-First Visual Feed (Phase 1 MVP)
A TikTok/Instagram-style geo-first, tag-first visual feed branded as "Pulse" (user-facing name). Internal code still uses "feed" naming. Presentation shift, NOT a replatform.

**Architecture**:
- Extended `tags` table with `type` (location|topic|entity|status), `parentTagId` (hierarchy), `synonyms`, `icon`, `sortOrder`
- `content_tags` join table links content to tags: `contentType` × `contentId` × `tagId` with unique constraint
- Two new pgEnums: `feedTagTypeEnum`, `feedContentTypeEnum`
- Backfill creates ~236 location tags (from zones), ~539 topic tags (from categories), ~50+ content tags from existing data

**Key Files**:
- `server/services/feed-service.ts` — `FeedItem` type, projectors (business/event/article/marketplace/sponsored/post/reel/attraction/curated_list/digest/job/page/rss/enhanced_listing), `queryFeed` with fallback chain + ranking + enhanced listing injection
- `server/services/tag-backfill.ts` — `backfillLocationTags`, `backfillTopicTags`, `backfillContentTags`, `runFullBackfill` (idempotent)
- `server/feed-routes.ts` — API endpoints: `GET /api/feed`, `GET /api/tags/suggest`, `GET /api/tags/:slug`, `GET /api/tags`, `GET /api/admin/feed/stats`. Exports `CORE_FEED_TOPICS` (14 categories: Food & Dining, Nightlife, Arts & Culture, Shopping, Health & Wellness, Sports, Outdoors, Entertainment, Family, Community, Education, Real Estate, Automotive, Pets). `/api/tags/suggest` always merges in all core topics (count=0 if unpopulated).
- `server/engagement-routes.ts` — Like/follow API: `POST/DELETE /api/engagement/like`, `GET /api/engagement/likes`, `POST/DELETE /api/engagement/follow`, `GET /api/engagement/follows`, `GET /api/admin/engagement/stats`
- `client/src/pages/feed-home.tsx` — Main feed page with contained social-media-style scroll. Stories Row at top (neighborhood hub circles). Pull-to-refresh gesture on mobile. Filter bar (geo selector + topic dropdown + refresh/map). IntersectionObserver infinite scroll. "New posts available" pill polls every 60s.
- `client/src/pages/tag-page.tsx` — SEO-friendly tag pages at `/:citySlug/t/:tagSlug` and `/:citySlug/t/:geoSlug/:topicSlug`
- `client/src/components/feed/feed-card.tsx` — Full-bleed cards with social identity layer: profile row (avatar + name + timestamp) above card, engagement bar (likes/shares/saves) below card. Type badges, tappable tags. `presenceType` field distinguishes organizations from businesses.
- `client/src/components/feed/stories-row.tsx` — Horizontal scrollable neighborhood hub circles with gradient rings, tapping sets geo filter.
- `client/src/components/feed/tag-chips.tsx` — Compact dropdown topic filter with search (replaced horizontal scroll chips). Shows "Topics ▾" button, active filter shows label + clear button.
- `client/src/components/feed/geo-selector.tsx` — Dropdown with search, hierarchical location selection
- `client/src/components/feed/feed-detail.tsx` — Full-screen overlay that loads the actual destination page via iframe. Social-media-style: tap card → live page opens in overlay → close returns to feed at same scroll position. Header bar has title, Like/Share/Save/Open External/Close buttons. External URLs (RSS, etc.) open in new tab instead. Reels/videos use dedicated ReelViewer overlay.
- `client/src/components/feed/feed-submit.tsx` — User submission form (Events/Business/News/Shout Out), honeypot protected
- `client/src/pages/admin/feed-debug.tsx` — Admin panel: tag browser, feed simulator, backfill trigger, ranking inspector

**Routes**:
- `/:citySlug/pulse` — Pulse feed (accessible even in Coming Soon mode, like marketplace). Old `/feed` routes redirect here for SEO continuity.
- `/:citySlug/live` — Live Feeds hub (accessible even in Coming Soon mode). Embeds external live streams.
- `/:citySlug/t/:tagSlug` — SEO tag page (single tag filter)
- `/:citySlug/t/:geoSlug/:topicSlug` — SEO tag page (geo + topic combo)
- When Coming Soon turns off, `/:citySlug` can switch from ComingSoon → FeedHome

### Live Feeds Hub
Dedicated page at `/:citySlug/live` embedding live video streams (YouTube + external webcams). Accessible from the "Live" nav pill (red/rose color). Categories: Charlotte Skyline, Wildlife / Raptor, NC Scenic / Beach, Traffic & Transit, Weather, Sports, News & Media, Community, Mountains & More.

**Architecture**:
- `client/src/data/live-feeds.ts` — Static config array of `LiveFeed` objects. Each has `id`, `title`, `type` ("youtube"|"page"), `embedUrl`, `sourceUrl`, `category`, `description`, `organizationSlug`
- `server/data/live-feeds.ts` — Server-side copy (YouTube-only feeds for Pulse injection)
- `client/src/components/feed/live-feed-card.tsx` — Card component. YouTube feeds render inline iframes; page feeds show "Open Live Feed" fallback button (most external sites block iframe embedding)
- `client/src/pages/live-feeds.tsx` — Full page with featured player at top, category filter tabs, responsive grid (1/2/3 cols)
- Live cards injected into Pulse feed at positions ~5 and ~15 via `injectLiveItems()` in `feed-service.ts`. Only YouTube feeds used in Pulse. Cards show pulsing red LIVE badge. Clicking navigates to `/:citySlug/live`.
- 11 organization/business directory listings seeded for feed sources (`ensureLiveFeedOrgsSeeded` in `server/seed.ts`). Slugs match `organizationSlug` in live feeds config.

**Feed Ranking** (`FEED_RANKING_CONFIG` in feed-service.ts):
- Geo proximity: exact tag match = 100, parent = 50, grandparent = 25
- Event boost: happening today = +60, upcoming 7 days = +30
- Article recency: < 3 days = +20
- Fresh community posts: < 3 days = +25
- New job listings: < 3 days = +15
- New marketplace listings: < 3 days = +15
- Tier: CHARTER +10, ENHANCED +50
- Sponsored: inserted every 5 organic cards

**Naming Convention**:
- **Pulse** = social-media-style feed at `/:citySlug/pulse` (the scroll feed). Nav label: "Pulse"
- **Spotlight** = editorial/news tile content at `/:citySlug/articles` (curated stories, features). Nav label: "Spotlight". Route stays `/articles` for backward compatibility

**Social/Engagement Schema**:
- `posts` table — User/community posts + reels. Fields: `title`, `body`, `mediaType` (image/video/reel/gallery), `videoUrl`, `videoEmbedUrl`, `videoDurationSec`, `videoThumbnailUrl`, `coverImageUrl`, `status` (draft/published/archived/flagged), `sourceType` (user/admin/import), `trustScore`, `cityId`, `authorId`. Supports both static posts and video reels.
- `likes` table — Content likes. Unique on (userId, contentType, contentId). ContentType: business/event/article/post/reel/marketplace_listing.
- `follows` table — Follow tags, businesses, orgs, or authors. Unique on (userId, followType, followId). FollowType: tag/business/org/author.
- `reposts` table — Repost amplification. Fields: `userId`, `originalContentType`, `originalContentId`, `caption` (optional, 280 char max), `createdAt`. Repost → moderation queue (auto-approved for already-approved content) → briefly in main feed + permanently on user profile.
- `sponsored_placements` table — Paid ad placements in feed. Tracks impressions/clicks/spend.

**Social-First Feed UX**:
- Right-side action column on every card (TikTok/Instagram style): Heart (like), Paper plane (share), Bookmark (save). No public counts.
- Double-tap to like with heart burst animation overlay.
- Account gates all interactions — logged-out users see buttons but get slide-up auth prompt on tap. `useRequireAuth()` hook manages this.
- FAB = "Create Post" (Camera icon), not "Share". Opens social-style post creation modal.
- No comments, no DMs — controlled social by design.
- **Card Click → Live Overlay**: Tapping a feed card opens the actual destination page in a full-screen iframe overlay (like Facebook/Instagram). Close button returns to feed at exact scroll position. External URLs (RSS, external links) open in new tab. Reels/video use dedicated ReelViewer. Live streams navigate directly.

**Sample Data Policy**:
- Sample/demo data ONLY exists as hardcoded frontend previews on the Coming Soon page (`coming-soon.tsx`) and microsite preview pages (`microsite.tsx`, `article-detail.tsx`, `event-detail.tsx`).
- NO sample data in the database. No seed scripts create fake businesses/events for display purposes.
- If sample records are found in the DB, they must be deleted. They should never appear in the feed, admin panels, or any live content.

**TikTok-Style Reel Viewer** (`client/src/components/feed/reel-viewer.tsx`):
- Full-screen vertical, snap-scroll, auto-play (muted), tap to unmute
- Right-side action column overlaid on video
- Keyboard nav (arrows/j/k/Escape/m), dot indicators
- Route: `/:citySlug/pulse/reels` (old `/feed/reels` redirects)

**Moderation Queue**:
- `moderation_queue` table — Unified queue for all user submissions. Fields: `contentType` (post/event_tip/business_update/photo/repost), `contentId`, `submittedByUserId`, `status` (pending/ai_reviewed/approved/rejected), `aiRecommendation` (approve/reject/flag), `aiReasoning`, `reviewedByAdminId`, `reviewNotes`.
- Charlotte AI moderation: When item enters queue, GPT-4o-mini reviews content against guidelines, writes recommendation + reasoning. Admin sees AI suggestion when reviewing.
- Admin panel: `client/src/pages/admin/moderation-panel.tsx` — unified list, stats cards, one-tap approve/reject.
- Ghost submit: `POST /api/admin/ghost-submit` — admin backdoor for unregistered contacts, low-trust, goes to moderation.

**Social Selling (Shop + Drops)**:
- `shop_items` table — Products/services. Price in cents, compareAtPrice, inventoryCount, type (product/service/experience/gift_card), status (active/sold_out/expired/draft).
- `shop_drops` table — Flash deals. dealType (flash_deal/daily_deal/weekend_special/clearance/bogo/bundle), discountPercent, originalPrice/dealPrice in cents, startAt/endAt, maxClaims.
- `shop_claims` table — User claims. Unique 8-char claimCode, status (claimed/redeemed/expired/cancelled).
- Feed integration: Shop items and drops appear as feed cards. Drops expiring <24h get urgency boost (+20 priority). Amber ring glow on deal cards.
- Inline claim flow: Tap "Claim" → inline expansion with claim code + "Show at business" — no separate page.
- Admin panel: `client/src/pages/admin/shop-management.tsx` — Items/Drops/Claims tabs, stats dashboard.
- API: `server/shop-routes.ts` — Full CRUD for items/drops, claim with code gen + inventory decrement, redeem endpoint.

**Feed Session & Anti-Repetition Caps** (Rule 1):
- In-memory `FeedSession` store (`server/services/feed-session.ts`). Sessions identified by `feedSessionId` (UUID), scoped to `userId` + `metroId` + `geoContext`.
- Auto-expire after 30 min inactivity. Cleanup runs every 5 min.
- `constrainedSelect()` walks the ranked candidate pool and enforces caps before returning paginated results.
- `FEED_CAP_CONFIG` constants (all tunable):
  - `STRICT_PHASE_LENGTH: 40` — items before doom-scroll relaxation kicks in
  - `SPONSORED_CAP_FIRST_15: 2` — max sponsored in first 15 items
  - `SAME_ENTITY_CAP_FIRST_25: 3` — max items from same business in first 25
  - `VIDEO_STREAK_CAP: 4` — max contiguous video items
  - `TYPE_REPEAT_CAP_FIRST_20: 2` — max same-type streak in first 20
  - Relaxed caps after item 40: sponsored 3/25, entity 4/40, video 6, type 3
- Admin debug: `GET /api/admin/feed/debug-caps?feedSessionId=...` returns session state + skipped items with reasons
- `GET /api/admin/feed/session-stats` — active session count or session details by ID

**Geo Context System** (Rule 2 — Hard Refresh):
- 4 geo contexts: `near_me` | `home` | `work` | `metro`
- Geo selector (`geo-selector.tsx`) has context bar (pill buttons) + neighborhood drill-down below
- On any geo context change: clear feed, scroll to top, create new feedSessionId, refetch with fresh caps
- `feedSessionId` stored in React state (not URL) — internal tracking only
- `geoContext` stored in URL param for shareability
- API: `POST /api/feed/session` creates new session, `GET /api/feed` accepts `feedSessionId` + `geoContext`

**TikTok Embed Support**:
- `server/services/tiktok-embed.ts` — `parseTikTokUrl()` handles all TikTok URL formats (`tiktok.com/@user/video/ID`, `vm.tiktok.com/abc`, `tiktok.com/t/abc`), converts to embed URL (`https://www.tiktok.com/embed/v2/{videoId}`). `fetchTikTokOEmbed()` calls TikTok's public oEmbed API for thumbnail/title (no key needed). `processTikTokVideoFields()` auto-converts videoUrl/videoEmbedUrl.
- `client/src/lib/tiktok.ts` — client-side matching `isTikTokEmbed()`, `parseTikTokUrl()`
- Feed cards show TikTok-branded play button (SiTiktok icon). Reel viewer plays TikTok via iframe. Feed detail renders TikTok with badge.
- Feed submit includes "TikTok or Video URL" field with live detection preview.
- `submit-post` endpoint auto-converts TikTok URLs + fetches thumbnail via oEmbed.
- **Admin Pulse Posts panel** (`client/src/pages/admin/pulse-posts-panel.tsx`): Admin sidebar "Pulse Posts" (Video icon) in Hub Operations. Paste TikTok/YouTube/video URL → AI generates caption via GPT-4o-mini (fetches TikTok oEmbed metadata first) → edit title/body → publish immediately or save as draft. Posts created as `sourceType: "staff"`, `trustScore: 80`, status `published` or `draft`. Backend routes: `POST /api/admin/pulse/create-post`, `POST /api/admin/pulse/ai-caption`, `GET /api/admin/pulse/posts`. YouTube URLs also auto-converted to embed format.

**Google Places Data Pipeline**:
- `fetchPlaceDetails()` fields mask includes `types`, `rating`, `user_ratings_total` alongside name/address/phone/website/hours/geometry/photos.
- `runImportJob` auto-maps Google `types[]` to internal category IDs via `mapGoogleTypesToCategories()` → `GOOGLE_TYPES_TO_L2_SLUGS` mapping. Looks up category records by slug and sets `categoryIds` on the created business.
- `GOOGLE_TYPES_TO_L2_SLUGS` maps Google types to DB slugs: restaurant→restaurant-dining, bar→bars-breweries, night_club→music-nightlife, gym→entertainment-recreation, doctor→health-wellness-cat, beauty_salon→beauty-personal-care, etc.
- `googleRating` and `googleReviewCount` saved from Place Details on import.
- Backfill script: `scripts/backfill-business-data.ts` — re-fetches Place Details for businesses with googlePlaceId missing categories/ratings. Rate-limited. Supports `--force-categories` flag.
- Auto-creates CRM contact on import: linked to business via `linkedBusinessId`, category `potential_client`, captureMethod `google_places`. Backfill script: `scripts/backfill-crm-contacts.ts`.
- **Send Claim Invite** from Contacts panel: contacts with `linkedBusinessId` show a "Claim Invite" button. Opens dialog with email, tier selection, personal message, live email preview (iframe), editable subject line. Sends via `/api/admin/businesses/:id/send-claim` with optional `customSubject` and `customMessage` fields.
- `buildClaimEmailHtml` accepts optional `customMessage` param — rendered as a styled block between body text and CTA buttons.

**Capture-to-Claim Pipeline**:
- Business card capture (`/api/capture/save`) auto-sets contact category to `potential_client` when company name is present (was `not_sure`).
- `autoCreateListingFromCapture` creates a business listing and adds it to `listings_to_claim_queue` with source `capture`.
- `enrichListingInBackground` now includes Google Places matching: searches `textSearchPlaces` by name+address, fetches Place Details, updates business with googlePlaceId, rating, categories, photos, phone, website.
- Full pipeline: capture card → CRM contact (potential_client) → auto-create listing → Google Places match → claim queue → "Claim Invite" button in Contacts panel.
- `listingsToClaimSourceEnum` values: `google_places`, `manual`, `import_csv`, `capture`.

**Business Attributes (Feature Tags) — Two-Tier Badge System**:
- `featureAttributes` column on businesses table: `text[]` array of attribute slugs.
- `BUSINESS_ATTRIBUTES` constant in `shared/schema.ts`: 37 predefined attributes with slug, label, icon, and `tier` field ("top" or "detail").
- **Tier 1 (Top/Hero)**: Identity & ownership badges shown in hero area — lgbtq-friendly, veteran-owned, black-owned, women-owned. Individually styled with special gradient/color treatments.
- **Tier 2 (Detail)**: Dietary, amenity, and service badges shown in "Features & Options" card below About section — 33 attributes including vegan-options, vegetarian-options, gluten-free, dairy-free, nut-free, halal, kosher, organic, farm-to-table, keto-friendly, kid-friendly, dog-friendly, pet-friendly, wheelchair-accessible, outdoor-seating, patio-seating, live-music, catering, delivery, curbside-pickup, reservations, free-wifi, happy-hour, brunch, late-night, byob, locally-sourced, sustainable, bilingual-staff, appointment-only, walk-ins-welcome, free-parking, ev-charging.
- Detail badges in `business-detail.tsx` derived from `BUSINESS_ATTRIBUTES.filter(a => a.tier === "detail")` — stays in sync with schema automatically.
- `GET /api/business-attributes?city=<slug>`: returns all attributes with business counts per city.
- Directory filter: `?attribute=<slug>` query param filters businesses by attribute via `@>` array contains.
- Browse pages: `/:citySlug/lists` (index of all attributes) and `/:citySlug/lists/:attributeSlug` (businesses with that attribute).
- Admin: Feature Attributes toggle section in BusinessEditDialog (dashboard.tsx) grouped by tier — saves via existing PATCH endpoint.

**Image Sourcing Pipeline**:
- Google Places photos: `fetchPlaceDetails()` includes `photos` field. New imports auto-get first Google photo as `imageUrl` with `photoAttribution` stored for legal compliance. `backfillGooglePhotos(cityId)` scans businesses with no image + googlePlaceId. Admin trigger: `POST /api/admin/backfill/google-photos`.
- og:image for RSS: `rssConnector.ts` → `extractImage()` falls back to fetching article URL and parsing `<meta property="og:image">` (3s timeout). Only fetches if existing methods return null.
- Image fallback: Simplified to 7 Charlotte hero skyline images only (removed category stock image map that caused cultural mismatches). `getFallbackImage()` uses djb2 hash to pick from CLT hero defaults. `isValidImageUrl()` validates URLs and rejects old category stock paths (`/assets/stock_images/feed_*`) so items with those stored URLs fall through to CLT hero images.
- RSS topic classification: `RSS_CATEGORY_MAP` in `tag-backfill.ts` maps ~100 RSS category strings to internal slugs. Title keyword fallback. `resolveRssTopicSlugs()` chains: slug match → name match → synonym match → category map → title keywords.

**Business Feed View**:
- `GET /api/business/:id/feed` — Returns approved posts/events/shop items/drops from that business.
- Displayed as "Updates" section on business profile pages using standard FeedCard components.

**Author/Influencer Tiers + Inquiries (Scaffold)**:
- `roleTier` field on `publicUsers`: user/contributor/verified/author (default: user)
- `tierApplicationRequests` table — tier upgrade applications
- `inquiryRequests` table — entity-to-entity inquiry gateway (business/org/author targets)
- Admin view: `client/src/pages/admin/tier-inquiry-panel.tsx` — tabbed list view
- Scaffold only — data model ready for future feature build-out.

**Feed Everything — All Content Types in Pulse**:
- Pulse is the central content hub. ALL content types feed into it: businesses, events, articles, marketplace, posts/reels, shop items/drops, reposts, live streams, attractions, curated lists, digests, jobs, CMS pages, RSS items.
- New projectors in `feed-service.ts`: `projectAttraction()`, `projectCuratedList()`, `projectDigest()`, `projectJob()`, `projectCmsPage()`, `projectRssItem()`, `projectEnhancedListing()`
- `queryFeedDirect()` fetches from all tables (attractions, curatedLists, digests, jobs, rssItems, cmsContentItems) in addition to original sources
- New `FeedItem.type` values: `attraction`, `curated_list`, `digest`, `job`, `page`, `rss`, `enhanced_listing`
- Feed card TYPE_CONFIG has visual configs for all new types: Landmark/green (attraction), ListOrdered/teal (curated), BookOpen/purple (digest), Briefcase/blue (job), FileText/gray (page), Rss/orange (rss), Crown/purple-to-gold (enhanced_listing)

**Enhanced Listing Cards (Tier-Based Promotion)**:
- ENHANCED tier businesses get a special "Featured" card in the feed — distinct from regular business cards and paid sponsored cards
- `getEnhancedListingCards()` queries businesses with `listingTier = 'ENHANCED'`, shuffles randomly for fair rotation
- `injectEnhancedListings()` places ~1 enhanced card per 12 organic items, offset from sponsored card positions
- Deduplication: enhanced cards skip if the same business already appears as an organic card
- Visual treatment: Crown icon, purple-to-gold gradient badge, subtle purple ring/glow border, "Featured" label (NOT "Sponsored")
- `sponsorshipMeta` on enhanced cards includes `tier` and `businessName` for session tracking

**Paid Ads vs Tier Promotion (Separation)**:
- `getSponsoredBusinesses()` returns ONLY explicitly sponsored businesses (`isSponsored = true`) — no fallback to Charter/Enhanced
- Charter tier = regular listing only, no special feed card
- Enhanced tier = "Featured" card via `getEnhancedListingCards()` — completely separate system from paid ads
- `insertSponsoredCards()` handles paid "Sponsored" cards (interval-based)
- `injectEnhancedListings()` handles tier "Featured" cards (low rotation, offset positions)

**Enhanced Listing Session Caps** (`FEED_CAP_CONFIG`):
- `ENHANCED_CAP_FIRST_10: 1` — max 1 enhanced listing in first 10 items
- `ENHANCED_CAP_PER_PAGE: 3` — max 3 enhanced listings per page
- `ENHANCED_SPONSORED_MIN_GAP: 3` — min 3 items between enhanced and sponsored cards
- Enhanced listings tracked in `constrainedSelect()` with entity dedup via `getEntityId()`

**Feed Deduplication**: `deduplicateItems()` removes duplicates from multiple query paths. `insertSponsoredCards()` skips sponsored items already in organic list.

**Fallback Chain**: content_tags query → direct table query → empty state with message. Never crashes.

**Backfill**: Idempotent. Re-run via admin panel `POST /api/admin/tags/backfill` or Feed Debug panel button. New content auto-tagged on save.

**Revenue formula**: 40/30/30 — DO NOT CHANGE.

## Overview
CityMetroHub is a multi-tenant platform designed to create city-specific community hubs, starting with "CLT Metro Hub." It structures content hierarchically (City → Zone → Content) to help residents find local businesses (Commerce Hub), events, articles (Pulse), and community digests. The platform supports public content and user submissions with moderation, offering unified public authentication and device-based personalization. It includes a robust Admin CMS with role-based access and an AI Admin Assistant. Monetization is achieved through tiered listings and Stripe integration, featuring advanced SEO, lead attribution, a gated review system, and business presence confirmation. The project aims to be a comprehensive digital hub for urban communities, enhancing local discovery and engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

## Live Implementation Rules (Architectural Constraints)

These rules are **binding** and must be followed in all future work. They reflect the verified state of the platform as of March 2026.

1. **Hub Presence runs through the `businesses` table.** Every presence (commerce, organization, creator, venue, nonprofit) is a row in `businesses`. Do NOT create a separate object table for any presence type.

2. **Creators are NOT a separate object table.** They are `businesses` rows with `creatorType`, `expertCategories`, and related fields set. The marketplace links back via `creatorBusinessId`. Do NOT create a standalone `creators` table.

3. **Pulse is NOT its own table and must remain an aggregation layer.** The feed engine in `server/services/feed-service.ts` projects from `posts`, `businesses`, `events`, `articles`, `rss_items`, and `marketplace_listings`. Every feed item maps to a real object. Do NOT create a separate feed/pulse storage table.

4. **Two geographic hierarchies must BOTH be preserved:**
   - **Regions** (`regions` table): `metro` → `hub` → `county` → `zip` — used for territories, licensing, operator assignments, sales structure.
   - **Zones** (`zones` table): `DISTRICT` → `NEIGHBORHOOD` → `MICRO_HUB` → `ZIP` → `COUNTY` — used for content scoping, discovery filtering, neighborhood pages.
   - Businesses reference `zoneId` (from zones). Territory management uses `regions`. Do NOT collapse these into one model unless explicitly instructed.

5. **All fixes must preserve the real-object architecture.** Improve enforcement, scoping, and connection between existing tables. Do NOT invent parallel systems, shadow tables, or duplicate data models. Staging tables (`import_drafts`) and revision tables (`presence_revisions`, `entity_field_history`) exist only for their specific intake/audit purposes.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite + React SPA).
- **Routing**: Wouter.
- **State Management**: TanStack React Query.
- **UI Components**: shadcn/ui (New York style) built on Radix UI, styled with Tailwind CSS.
- **Forms**: React Hook Form with Zod.
- **Theme**: Light/dark mode support.
- **Personalization**: Anonymous device identity stored locally.

### Backend
- **Runtime**: Node.js with Express 5, TypeScript via `tsx`.
- **API Pattern**: RESTful JSON API (`/api/`).
- **Authentication**: `express-session` with `connect-pg-simple` PostgreSQL session store for persistent cookie-based auth. Sessions survive server restarts. **Google Sign-In**: Uses Google Identity Services (GSI) client-side library + `google-auth-library` server-side token verification. `POST /api/auth/google` verifies ID token, finds/creates user by email, links `googleId` to `publicUsers`. Google-only users have `passwordHash=null`. `GET /api/auth/google-client-id` serves the client ID to the frontend. Google button rendered via GSI `renderButton` in `AuthDialog`, appears above the tabs (shared by both Sign In and Create Account). Three separate session keys: `userId` (admin), `operatorId` (operator/licensee), `publicUserId` (public user). Each role has its own logout endpoint:
  - `/api/auth/logout` — clears public user session only
  - `/api/admin/logout` — clears admin session only
  - `/api/operator/logout` — clears operator session only
  - `/api/field/auth` — unified endpoint returns whoever is logged in (admin or operator) for field tools
- **Field Auth Guard**: Catch (`/face`) and Capture Wizard (`/capture`) require admin or operator login. `FieldAuthGuard` component shows login prompt if unauthenticated. `FieldToolbar` component provides role-aware navigation bar (Dashboard ↔ Field Tools toggle, user name + role badge, logout).
- **Build**: Custom `esbuild` for server, Vite for client.
- **Dev Mode**: Vite dev server as middleware with HMR.
- **Static Serving**: Production serves built files with SPA fallback.

### Database
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Schema**: Defined in `shared/schema.ts`.
- **Migrations**: Drizzle Kit for dev; production uses startup DDL in `server/index.ts`.
- **Production Schema Sync Pattern**: `drizzle-kit push` times out against the production database. All new tables, columns, and enum values MUST have corresponding startup DDL in `server/index.ts` using idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `DO $$ BEGIN ... ALTER TYPE ... ADD VALUE IF NOT EXISTS ... END $$`). Each DDL block is wrapped in its own try/catch so failures are logged but don't crash startup. Any schema object referenced in queries must have a startup DDL entry before deploying.
- **Map Endpoint Resilience**: The unified map endpoint (`GET /api/cities/:citySlug/map`) wraps every query layer (businesses, events, attractions, jobs, crown participants, placements, zones, categories, pulse pickups) in individual try/catch blocks. If any single layer fails (e.g., missing table in production), it returns an empty array for that layer instead of crashing the entire response with a 500 error.
- **Seed Script** (`server/seed.ts`): Seeds infrastructure only — city record, zones (321 across 19 counties in NC/SC), categories (L1/L2/L3 taxonomy), admin account, transit data. No sample businesses, events, articles, curated lists, or digests are seeded. All content comes from real pipeline ingestion or manual creation. Coming Soon page preview content is hardcoded in the component, not from the database.

### Key Data Model and Features
- **Core Entities**: Cities, zones, users, categories, businesses, events, articles, curated lists, submissions.
- **Monetization**: Tiered listings (Verified, Hub Presence, Expanded Hub Presence) with Stripe integration (live mode). Stripe secret key stored as env secret; live price ID in `STRIPE_PRICE_VERIFICATION`.
- **Commerce Taxonomy**: 3-level hierarchy (L1 Category → L2 Subcategory → L3 Micro-tags).
- **Content Rotation Engine**: Weighted shuffle for Commerce Hub listings based on tier and freshness.
- **Personalization**: User and device-based content tailoring, including geolocation boosting.
- **Microsites (AI-Powered Builder)**: Business-specific microsites rendered at `/:citySlug/presence/:slug`. Features an AI-powered site builder (landingsite.ai-style) where Charlotte generates complete bilingual (EN/ES) websites from a text prompt. Block-based architecture with 12 block types (Hero, About, Services, Gallery, Testimonials, CTA, FAQ, Team, Hours, Events, Reviews, Contact). 4 templates (Modern, Classic, Bold, Elegant). Owner site builder at `/:citySlug/owner/:slug/site-builder`. Block data stored as JSON (`micrositeBlocks` column). Charter tier gets AI generation + default template; Enhanced gets full template switching + block editing. All content is bilingual with EN/ES fields. Falls back to tabbed layout for businesses without blocks.
  - **Block Types**: hero, about, services, gallery, testimonials, cta, faq, team, hours, events, reviews, contact
  - **Templates**: modern, classic, bold, elegant — each with distinct font pairings, nav styles, hero layouts, section spacing
  - **AI Endpoints**: `POST /api/owner/presence/:id/generate-site` (full site), `POST /api/owner/presence/:id/regenerate-block` (single block)
  - **Block CRUD**: `GET/PUT /api/owner/presence/:id/blocks`, `PUT /api/owner/presence/:id/template`
  - **Components**: `client/src/components/microsite/` directory with templates.ts, block-renderer.tsx, and individual block components
  - **Types**: `MicrositeBlock`, `MicrositeBlockContent`, `BilingualText`, `MicrositeTemplate`, `MicrositeConfig` in `shared/schema.ts`
- **Commercial Centers**: Enhanced `shopping_centers` table supporting various center types with business linkages.
- **Transit Proximity**: Businesses and centers can link to `transit_stops` for display.
- **Marketplace Backbone**: Backend schema for classifieds, jobs, and business card listings with Admin API.
- **Business FAQ & Expert Q&A**: Tier-based Q&A features for microsites.
- **Trust Signals**: Display `languagesSpoken`, `licensesAndCerts`, `awardsAndHonors` on microsites.
- **Activate Flow**: Multi-step public wizard (`/:citySlug/activate`) for businesses/organizations to claim and verify their presence, including Stripe payment integration and owner account creation. Flow: Entry → Basics → Confirm (AI-generated description, fuzzy DB match for claims) → $1 Payment → Success. Organizations have `isNonprofit` and `isCommunityServing` flags; only 501(c)(3) community-serving nonprofits get a free Hub Presence gift — all others (for-profit orgs, churches) see paid upgrade options.
- **Catch-to-Claim Pipeline**: Full funnel from operator card capture to paid listing. Flow: Operator catches card → listing auto-created → operator taps "Send Claim Email" (with nonprofit toggle) → branded email with styled CTA button → business owner lands on `/:citySlug/claim/:token` → claims listing → selects tier (Hub Presence or Expanded Hub Presence) → Stripe payment (or nonprofit gift activation) → books story interview → admin inbox gets `story_interview_scheduled` item. All public claim endpoints (`/api/claim/upgrade-checkout`, `/api/claim/gift-nonprofit`, `/api/claim/book-story-interview`) require valid claim token for security. The claim page is a multi-step funnel (`claim-business.tsx`) with steps: claim → choose-tier → book-interview → complete. If the listing is already claimed, skips directly to choose-tier. Stripe success URL redirects back to booking step. Nonprofit path: Hub Presence = free gift, Expanded Hub Presence = 3 sponsors at $197 each. "Send Claim Email" button also available in CRM contact card (`crm-contact-card.tsx`). Both capture page and CRM use `requireAdminOrOperator` middleware.
- **Full Spanish Language Pipeline**: End-to-end Spanish support for business owners who don't speak English. Key features: (1) Claim email has "Ver en Español" button; clicking it auto-sets `preferredLanguage=es` on the business. (2) Claim URL supports `?lang=es` param — auto-switches claim page to Spanish on load. (3) Claim page has EN/ES pill toggle on every step. (4) Stripe checkout passes `locale: "es"` so payment page renders in Spanish. (5) When claim is completed in Spanish, `preferredLanguage` saved to business record. (6) Story interview booking sends bilingual confirmation email (primary language first, secondary below divider). (7) Admin inbox `story_interview_scheduled` items show "Preferred language: Spanish" + "Spanish" tag when applicable. (8) `crm_contacts` table has `preferred_language` column; capture page has EN/ES/Not-set language buttons for operators to tag during capture. (9) When sending claim email, if contact is tagged as Spanish, the claim URL gets `?lang=es` appended and `preferredLanguage` is set on the business. (10) Admin business edit dialog shows editable Preferred Language selector.
- **Owner Accounts**: Dedicated owner login/management with session-based authentication.
- **CRM Spine**: Comprehensive CRM for presence management (businesses/organizations) with stages, tasks, and audit trails.
- **Admin Inbox (Phase 5E — Triage & Decision System)**: Converted from general notification bucket to a focused triage + decision system with confidence-based routing. **Schema**: 5 new columns on `admin_inbox_items`: `triage_category` (needs_review/exception/unprocessed/notification), `confidence` (numeric 0-1 match confidence), `triage_reason` (why this item landed in inbox), `suggested_action` (Charlotte's recommended next step), `triage_metadata` (jsonb — entity match candidates, capture item links, extracted data). All 30+ item types classified into 4 triage categories via `ITEM_TYPE_TRIAGE_MAP` in `server/admin-inbox.ts`. **Backend**: `getTriageCounts()` returns per-category counts + resolved-today via raw SQL. `resolveInboxItem()` sets status=resolved with history. `createCaptureTriageItem()` builds inbox items from capture session data with confidence and match metadata. New endpoints in `server/inbox-routes.ts`: `GET /triage-counts`, `POST /:id/approve` (resolve + optionally route to queue with entity selection), `POST /:id/dismiss`, `POST /:id/reprocess` (re-run linked capture item), `POST /:id/resolve-entity` (select_match or create_new — updates capture item entity, resolves inbox item, returns queue-ready item). `triageCategory` filter added to `getInboxItems()` in storage. **Frontend** (`client/src/pages/admin/inbox-panel.tsx`): 4 triage tabs (Needs Review, Exceptions, Unprocessed, Notifications) with count badges. `TriageMetricsHeader` shows counts + resolved-today. Each item row shows type icon, title, triage reason, confidence badge (color-coded), suggested action, inline Approve/Dismiss buttons. Detail view adds triage reason box (amber), suggested action box (blue), Approve/Dismiss/Re-run action buttons. `EntityResolutionPanel` for low-confidence matches: displays captured data, match candidates with confidence scores, Select/Create New actions. **Send Verification dialog** preserved for capture_listing_review items.
- **Parent Brand / Agent Listings**: `parentBrand` text field on businesses table allows independent agents (American Express reps, State Farm agents, etc.) to have their listing show both the parent brand and their name. When set, the listing is created as "{parentBrand} — {agent name}". Available in: capture page (optional field below employer), admin business edit dialog (in Core Info), public business detail page (shows "Independent agent of {brand}" subtitle). Field flows through `captureSaveSchema`, `autoCreateListingFromCapture`, and `storage.updateBusiness`.
- **Google Places Integration**: For importing and deduplicating business data. Charlotte AI can run imports via chat (e.g., "pull 50 restaurants from 28217"). Imports auto-publish with ZIP-to-neighborhood zone matching. API key in `googel_API_Places` env var. Rate limits: 30 RPM, 25 text searches/day, 100 details/day (conservative defaults, override via `PLACES_IMPORT_DAILY_TEXTSEARCH_LIMIT` / `PLACES_IMPORT_DAILY_DETAILS_LIMIT` env vars). After import, newly created businesses are auto-enqueued for website crawl/contact enrichment. **Auto-Seed** (`POST /api/admin/intake/auto-seed`): Searches all 8 L1 categories across all zones. Each category maps to 5-8 Google Places search terms. Limits to 2 search templates per zone to control API usage. **Hub-by-Hub Seed Script**: `npx tsx scripts/seed-hub-businesses.ts <hub-slug> [--dry-run] [--count=10]` — imports real businesses for a specific hub across 10 categories (restaurants, coffee, bars, gyms, salons, auto repair, retail, professional services, medical/dental, real estate). Supports all 74+ hub slugs. Run without arguments to see available slugs. `--dry-run` shows queries without calling API. `--count=N` controls results per category (default 10). Respects daily API limits. **Bulk Seed Script**: `npx tsx scripts/seed-charlotte-places.ts` — imports across 14 major neighborhoods x 5 categories.
- **Charlotte AI Chat**: Full CRM co-pilot for admin tasks and public-facing chat. Admin chat uses OpenAI function calling with 20 tools organized into 4 groups:
  - **Import tools** (6): `start_text_search_import`, `start_nearby_search_import`, `get_import_usage`, `get_import_job_status`, `draft_listing_description`, `list_recent_imports`
  - **CRM tools** (6): `search_contacts` (fuzzy across name/email/phone/company/notes), `get_contact_details` (full record + engagement history + referrals), `create_contact`, `update_contact`, `list_inbox_contacts`, `promote_contacts`
  - **Referral & Nudge tools** (5): `create_referral`, `list_referrals`, `update_referral_status`, `get_todays_nudges`, `log_engagement`
  - **Content tools** (3): `list_pending_drafts`, `publish_drafts`, `find_duplicate_businesses`, `rewrite_content`
  - Charlotte uses ask-before-acting pattern: proposes changes → waits for confirmation. Responds in user's language (EN/ES). Quick action buttons in UI: "Who needs follow-up?", "Review inbox", "Find duplicates", "New referral".
- **Admin Business Merge Tool**: Merge duplicate businesses via admin dashboard checkboxes. Transfers all related records (reviews, leads, owner accounts, etc.) in a DB transaction, then deletes duplicates.
- **Email System**: Resend integration for transactional and marketing emails.
- **Reviews System**: Gated and moderated review system with multi-source support.
- **Voting/Campaigns**: Campaign-based voting for various "Best Of" categories.
- **SEO Authority Foundation** (Pre-Launch Complete):
  - **URL Architecture**: Category-based business URLs `/:citySlug/:categorySlug/:businessSlug` (e.g., `/charlotte/restaurants/joes-pizza`). Old `/directory/:slug` route kept as fallback. Helper: `client/src/lib/business-url.ts` with `getBusinessUrl()` and `getBusinessCanonicalUrl()`.
  - **Schema.org Structured Data**: Category-specific subtypes (Restaurant, HealthAndBeautyBusiness, LegalService, AutomotiveBusiness, RealEstateAgent, HomeAndConstructionBusiness, etc.) instead of generic LocalBusiness. Events have `eventAttendanceMode`, `eventStatus`, `performer`/`organizer`. Category pages have `ItemList` schema. Full `BreadcrumbList` on all pages. `aggregateRating`, `priceRange`, `areaServed`, `hasMenu` on business pages.
  - **Category Hub Pages** (`/:citySlug/:categorySlug`): Meta title "Best {Category} in {City}, {State}", ItemList schema, sibling category links, links to neighborhood cross-pages.
  - **Neighborhood Hub Pages** (`/:citySlug/neighborhoods/:code`): Meta title "Things to Do in {Neighborhood}, {City}", related neighborhood links, "Browse by Category" cross-page links.
  - **Neighborhood + Category Cross-Pages** (`/:citySlug/neighborhoods/:code/:categorySlug`): Hyper-local pages (e.g., "restaurants in South End Charlotte"). Filtered business grid, ItemList schema, breadcrumbs, cross-links. Only generated for combos with actual businesses.
  - **Hreflang Bilingual SEO**: `<link rel="alternate" hreflang="en/es/x-default">` on all public pages via `usePageMeta` hook. Spanish alternate via `?lang=es` query param. Sitemap includes `<xhtml:link>` hreflang entries for every URL.
  - **AI FAQ Generation**: `POST /api/admin/businesses/:id/generate-faqs` uses GPT-4o-mini to generate 5-10 long-tail "People Also Ask" style questions. Tier-gated (Charter: 10, Enhanced: 20). Saved to `business_faqs` table. FAQPage schema auto-renders.
  - **Pulse Article SEO**: Auto-suggest SEO-optimized title, slug (with city + keyword + year), meta description. AI Suggest SEO button calls GPT-4o-mini. Character count indicators for title/description.
  - **Real-Time SEO Scoring**: `SeoScoreCard` component (`client/src/components/seo-score-card.tsx`). Red/yellow/green checklist: title length, meta description length, city keyword, category keyword, content length, H2 subheadings, slug cleanliness, image alt text. Embeddable in article/business/microsite editors.
  - **Slug Cleanup**: SEO-friendly slug generation via shared `server/lib/slug-utils.ts` (`generateBusinessSlug`). Collision strategy: base name → append neighborhood hub slug → append street name → 4-char random fallback. Used by google-places.ts, activate-routes.ts, and routes.ts. Admin "Bulk Clean Slugs" button strips trailing hex suffixes. Inline slug editor with Clean Up / Regenerate / Save.
  - **Internal Linking**: Visible breadcrumb navigation (Home > Category > Business). "More in {Category}" section with related business cards. Category ↔ neighborhood cross-links. All pages interlinked.
  - **SEO Snapshotter** (`server/seo-snapshot.ts`): Server-side pre-rendered HTML for crawlers (Googlebot, Bingbot, etc.). Handles all route patterns: business detail, category hub, neighborhood hub, cross-pages, events, articles. Includes full JSON-LD, meta tags, hreflang, breadcrumbs. Preview routes excluded from snapshots.
  - **Private Preview URL**: Browse the full app before launch at `/preview/:accessKey/:citySlug`. Access key from `PREVIEW_ACCESS_KEY` env var (logged at startup as `[Preview] Access key: ...`). Protected: wrong key shows 404, `<meta name="robots" content="noindex, nofollow">` injected, blocked in robots.txt (`Disallow: /preview`), excluded from sitemap and SEO snapshots. Supports all sub-routes: `/directory/:slug`, `/events/:slug`, `/articles/:slug`, `/pulse`.
  - **Sitemap** (`/sitemap.xml`): Dynamic generation. Includes: city pages, category pages, neighborhood hubs, cross-pages (only with businesses), business detail pages (category-based URLs), events, articles. All entries have hreflang alternates (EN/ES). Priorities: city=1.0, directory=0.9, business=0.8, events/articles=0.7, categories=0.7, neighborhoods=0.6, cross-pages=0.5.
  - **SEO Diagnostic Tool**: Admin endpoint at `/api/seo-diagnostic` — crawls all page types, checks meta tags, JSON-LD, sitemap presence, robots.txt.
  - **Schema.org Completeness**: Opening hours (`openingHoursSpecification`), geo coordinates (`GeoCoordinates`), Google Maps link (`hasMap`), YouTube video (`VideoObject`), languages (`knowsLanguage`), services (`hasOfferCatalog` with `Service` items from L3 micro-tags + micrositeServices), nonprofit type (`NGO`/`Organization` instead of `LocalBusiness`). All applied in both frontend JSON-LD and SEO snapshotter.
  - **Auto-Tagging**: `POST /api/admin/businesses/suggest-tags` — AI-powered category suggestion. Maps Google Places `types` to L2/L3 taxonomy; falls back to GPT-4o-mini categorization. Admin business edit dialog shows "Suggest Tags" button with pre-checked results. L3 micro-tags shown as contextual checkboxes when L2 is selected. ZIP auto-maps to neighborhood zone.
  - **L3 Micro-Tags on Microsites**: Enhanced microsites show L3 tags as "Services & Specialties" cards with CheckCircle icons. Charter microsites show tags as Badge pills. Both feed into `hasOfferCatalog` Schema.org markup.
- **Review System** (Comprehensive):
  - **Review Table**: `reviews` with `businessId`, `userId` (public_users), `rating` (1-5), `comment`, `status` (PENDING/APPROVED/REJECTED), `sourceType` (internal/google/yelp/facebook/other), `ownerResponse`, `ownerRespondedAt`.
  - **Review Aggregation**: Combined `AggregateRating` in Schema.org merges Google rating + internal Hub reviews. Formula: `(googleRating × googleCount + hubAvg × hubCount) / (googleCount + hubCount)`. UI shows combined rating with source breakdown ("Based on X Google reviews and Y Hub reviews"). Applied in business detail, microsites, and SEO snapshotter.
  - **Review Collection**: Shareable review links at `/:citySlug/review/:businessSlug`. Clean public form with star picker + comment. Requires public user login. Submissions go to PENDING + admin inbox. Owner dashboard shows "Get Review Link" button with copy-to-clipboard + QR code generation.
  - **Owner Responses**: Owners respond via `POST /api/cities/:citySlug/owner/:slug/reviews/:reviewId/respond`. Responses displayed below reviews with "Owner" badge and date.
  - **Star Distribution**: Microsite reviews section shows star distribution bar chart (count per rating level).
  - **Moderation**: All internal reviews default to PENDING. Admin approves/rejects via inbox. `new_review` inbox item created on submission.
  - **Cross-Page Links**: Event and article detail pages show "Related Businesses" sections (up to 6 businesses from same category/zone).
  - **Languages Spoken**: Displayed on business detail pages, Charter/Enhanced microsites. Settable during Activate flow (default: English). Editable in admin. `knowsLanguage` in Schema.org.
- **Internationalization (i18n)**: Natively bilingual UI (English/Spanish) — not Google Translate. Architecture: `I18nProvider` in `client/src/lib/i18n.tsx` wraps the app, providing `useI18n()` hook with `t(key)` translation function, `locale` state, `setLocale()`, and `localized(locale, en, es)` for database content. 370+ translation keys covering all public pages, layout, Charlotte AI, activate flow, owner dashboard (including coverage zones, custom domains, subscription status, post-purchase guide), microsites, and sales widget. Locale auto-detected from browser language; toggled via EN/ES button in navbar. Charlotte AI responds in the user's locale — `buildLanguageInstruction(locale)` in `server/charlotte-public-routes.ts` adds language instruction to OpenAI system prompt. Locale passed in API calls (`/api/charlotte-public/chat`, `/api/charlotte-public/config`). Sales widget (`charlotte-sales-widget.tsx`) has bilingual step greetings. Microsite block renderer accepts locale prop for bilingual content blocks.
- **Auto-Translation Service**: `server/services/auto-translate.ts` — AI-powered automatic translation of all user-submitted content. When content is saved (business descriptions, event titles/descriptions, article titles/excerpts/content), the system auto-detects the source language and generates a native-quality translation in the other language using OpenAI (`gpt-4o-mini`). Spanish translations use warm, conversational Latin American Spanish. Translation runs asynchronously in the background via `queueTranslation(type, id)` — does not block the save response. Schema additions: `descriptionEs` on businesses, `titleEs`/`descriptionEs` on events, `titleEs`/`excerptEs`/`contentEs` on articles. Frontend uses `localized(locale, en, es)` helper to display the correct language version. Hooked into: admin business/event/article CRUD, owner presence updates, activate flow (draft creation + claims), CSV import, Charlotte admin description drafting (produces bilingual short/medium variants).
- **Admin Authentication**: Session-based `userId` check via `requireAdmin` middleware. Roles: `SUPER_ADMIN` (Master Admin, no cityId — sees all cities), `CITY_ADMIN` (locked to one city), `ZONE_ADMIN` (locked to one zone). Legacy `admin`/`ADMIN` roles treated as SUPER_ADMIN for backward compatibility.
- **Master Admin / City Switcher**: SUPER_ADMIN users see a city switcher dropdown in the admin sidebar to manage multiple cities. City selection persists in localStorage. `useAdminCitySelection()` hook provides `selectedCityId`, `selectedCitySlug`, `setSelectedCity`, and `adminCities`.
- **Cities Management**: SUPER_ADMIN-only "Cities" panel in admin sidebar for creating/editing city hubs (name, slug, brandName, primaryColor, aiGuideName, siteUrl, emailDomain, isActive). API: `GET/POST /api/admin/cities`, `PATCH /api/admin/cities/:id`. Each city can have its own site URL and email sender domain, managed directly from the admin panel.
- **CityMetro Hub Page**: Parent-brand landing page at `/citymetrohub` explaining multi-city vision, features, and "Start Your City" opportunity. Content fetched from CMS (`contentType="page"`, slug `"citymetrohub"`). API: `GET /api/cms/pages/:slug` (public, no auth).
- **Feature Audit**: Internal tracking of feature implementation status.
- **Email Domains**: Charlotte emails from `cltcityhub.com` (verified Resend domain); platform/master admin emails from `citymetrohub.com`. Legacy alias `cltmetrohub.com` still recognized.

### CRM & Relationship Management (Phase 1)
- **Tables**: `crm_contacts`, `referral_triangles`, `engagement_events`, `mileage_trips`, `digital_cards`.
- **CRM Contacts**: Personal contact network for admin users. Single `name` field (NOT first/last). Categories: personal, business, trusted, met, partners, referred_by, not_sure. Can link to a business/organization via `linkedBusinessId`. Nudge settings per contact: windowDays, snoozeUntil, skippedToday.
- **ReferMe (Referral Triangles)**: Connector (C) introduces Person A ↔ Person B. Types: b2b, b2c. 6-status lifecycle: submitted → contacted → connected → in_progress → completed/declined. Tracking: deliveredToA/B, openedByA/B, nudgeDismissedAt.
- **Engagement Events**: Tracks email opens, link clicks, card views. Source tracking for referral notifications, digital cards, etc. Used by nudge system.
- **Nudge System**: Budget of 8/day. 5 types scored: follow_up (100+), birthday (120), anniversary (110), referral_stale (90+), engagement (130). Computed fresh per request, sorted descending, capped at budget. Skip (today only) and snooze (1-90 days) actions.
- **Mileage Trips**: GPS-tracked trips with haversine distance. Categories: sales, meeting, delivery, personal, other. Waypoints stored as JSON. Summary endpoint with totals by category.
- **Digital Cards**: Shareable business cards with public view at `/card/:slug` (registered route in App.tsx, `card-view.tsx`). Three image fields: `cardImageUrl` (physical card photo / designed card), `personPhotoUrl` (headshot), `companyLogoUrl` (auto-populated from hub city logo on creation). Share dialog: QR code (client-side via `qrcode` npm package, downloadable PNG), vCard download (.vcf with name/title/company/email/phone/website/photo), Copy Link. Public card page shows banner (card image or gradient), centered person photo circle, company logo, contact action buttons (Call/Email/Website), and "Save Contact" vCard download. View count tracking. Theme color customization.
- **Catch** (`/face`): Mobile-first launcher. Full-screen dark gradient using hub brand colors (purple 273/66%). Hub switcher (CMH ↔ active hub). Amber CTA catch/scan button. GPS trip tracker with haversine formula. 5-step referral submission modal. Digital card sharing with Copy/QR/vCard buttons per card + QR share dialog.
- **API Routes**: `server/crm-contacts-routes.ts`, `server/referme-routes.ts`, `server/mileage-routes.ts`, `server/digital-cards-routes.ts`, `server/nudge-routes.ts`.
- **Admin Panels**: Contacts list (search, filter, CRUD), Referrals (filter tabs, status updates), Nudges (today's 8 with skip/snooze), Mileage (trip list + summary stats), Digital Cards (create/edit with theme color, 3 photo uploads, QR share dialog).
- **Admin Sidebar**: Reorganized — Catch link at top of Overview, CRM group (Contacts, Referrals, Nudges + existing accounts/subscribers/leads/vendors), Listings group (businesses + claims + tiers), Your Office (mileage, cards), Content (CMS + editorial), Licensing & Revenue (preserved as-is).

### Capture Wizard & Inbox-First CRM (Phase 2 + 2B Rework)
- **Capture Wizard** (`/capture`): Full-screen, mobile-first capture flow. Same cosmic background as Catch. Launched from Catch's amber "Catch/Scan" button. **Solid buttons** (not glass): all selection tiles use solid dark backgrounds (`bg-[hsl(273,50%,15%)]` purple, `bg-[hsl(173,40%,12%)]` teal, `bg-[hsl(40,30%,12%)]` amber) — no `backdrop-blur-sm` or transparent `bg-white/[0.03]`.
- **Wizard Steps**: type_select → capture_method → camera → scanning → form → confirm. "Saved to Inbox" is a dialog overlay, not a full-screen step.
- **Dialog-Based Capture Methods**: Voice Note, Phone Import (.vcf), QR Scan, and Handwrite all open as Dialog modals overlaying the capture_method screen. Only camera goes full-screen. This matches the Living Contacts reference design.
- **Voice Note Dialog**: 3-state flow (pre-record → recording with amber pulse → review with audio player). Saves directly to inbox — skips the contact form entirely. Charlotte reviews transcription in background.
- **Phone Import Dialog**: Shows iPhone/Android .vcf export instructions + "Upload Contact File (.vcf)" button. Parses up to 5 vCards per file. Single contact → populates form. Multiple → batch saves to inbox.
- **QR Scan Dialog**: Camera feed inside dialog with purple scanning frame. On detect: vCard → parses and goes to form with pre-filled fields. URL → goes to form with clickable QR Link URL field (for HiHello, etc.).
- **Handwrite Dialog**: HTML5 Canvas drawing tool with touch/stylus support. Toolbar: color picker (6 colors), size -/+ buttons, undo, redo, clear. Saves drawing as PNG base64. AI handwriting reading is ON-DEMAND from the inbox ("Read Handwriting" button), NOT during capture.
- **Receipt Form**: Separate form layout with Vendor/Store, Description, Notes. Helper text: "This receipt will land in your inbox." Receipt gets its own capture_method substep with Take Photo / Upload File / Manual Entry tiles.
- **Document/ID Simplified**: 2 category tiles (ID and Document) instead of 10. Both then show Take Photo / Upload File / Manual Entry.
- **Capture Methods**: Business card photo (front+back, AI OCR via GPT-4o-mini Vision), voice note (MediaRecorder, direct-to-inbox), QR code (client-side jsQR in dialog), vCard parsing (.vcf file upload), manual entry, handwriting (canvas drawing), file upload.
- **Offline-First Architecture**: All captures save to IndexedDB (idb-keyval, store "cch-captures") immediately. NO service workers. Raw originals (photos as base64, audio as base64) always stored with record. AI extraction is opportunistic — runs when online, skipped when offline, queued for sync.
- **Sync Engine**: `client/src/lib/capture-store.ts` — `saveCaptureLocally()`, `getPendingCaptures()`, `markCaptureSynced()`, `syncPendingCaptures()`. Auto-sync via `useCaptureSync()` hook.
- **Inbox-First Pattern**: Every capture saves to `crm_contacts` with `status="inbox"`. Promote = PATCH status to "active". Archive = PATCH to "archived".
- **Contacts Panel Side Menu** (ReferMe-style): Replaces old tabs+dropdown. Left side menu with sections matching the ReferMe app:
  - **Inbox** (with count badge) + **All Contacts**
  - **Living Clients**: People I Want to Meet (`want_to_meet`), Potential Clients (`potential_client`), Current Clients (`current_client`)
  - **ReferMe**: People Trusted to You (`trusted`), Who I Met (`met`), Trusted Partners (`partners`), Your Referrals (from referral_triangles), Who Referred You (incoming referrals)
  - Each item shows count. Active item highlighted in brand purple. Section headers in amber/gold.
  - Mobile: slide-out drawer. Desktop: fixed left panel.
- **Contact Categories**: `personal`, `business`, `trusted`, `met`, `partners`, `referred_by`, `not_sure`, `want_to_meet`, `potential_client`, `current_client`
- **Referral View Endpoints**: `GET /api/crm/contacts/your-referrals` (referrals you created), `GET /api/crm/contacts/referred-to-you` (incoming referrals). Both return enriched referral+contact data.
- **Counts Endpoint**: `GET /api/crm/contacts/counts` — returns per-category counts, inbox count, referral counts for menu badges.
- **Contacts Panel Detail View**: Expanded view shows Capture Evidence section (badge + image/audio), clickable QR link URLs (opens in new tab), "Read Handwriting" button for on-demand AI analysis of handwritten notes (updates contact with extracted data), audio playback for voice recordings, AI extraction results.
- **Backend API** (`server/capture-routes.ts`): 6 endpoints — `analyze-card` (Vision OCR), `transcribe-voice` (audio transcription), `parse-vcard`, `analyze-handwriting` (Vision OCR), `save` (inbox creation + duplicate check), `sync-batch` (offline sync with AI extraction queue).
- **Files**: `client/src/pages/capture-page.tsx`, `client/src/lib/capture-store.ts`, `server/capture-routes.ts`, `server/crm-contacts-routes.ts`, `client/src/pages/admin/contacts-panel.tsx`.

### Cold Outreach & Response Flow
- **A/B Email Templates**: `story_outreach_a` (ego/personal spotlight) and `story_outreach_b` (community/impact) in `emailTemplateKeyEnum`. Exact copy from brand spec. Subject lines use newspaper emoji prefix. Signed by "Becky".
- **Email Builder**: `server/services/outreach-email-builder.ts` — generates mobile-friendly HTML emails with clean "Yes" CTA button and small "No thanks" link. No ugly URLs visible.
- **Outreach Tokens**: `outreach_tokens` table tracks each send with token, variant, campaign, batch_id, click tracking (yes/no), status (pending/clicked/responded/declined).
- **Response Form**: Public page at `/:citySlug/respond/:token`. Collects: name, business phone (public), personal phone (private), email (private), zip code (for zone auto-resolution), best contact method, role, submitter vs contact person, story interest, consent (terms + contact + publish). Personal info NOT surfaced on public listing.
- **Zone Auto-Resolution**: When zip is submitted, backend looks up `hub_zip_coverage` table and assigns the matching hub/zone to the business record.
- **Decline Page**: `/:citySlug/respond/:token/decline` — friendly "No problem" message. On page load, records decline status, marks CRM contact as DECLINED, archives listing (`presenceStatus: ARCHIVED`).
- **Redirect Handler**: `GET /outreach/r/:token?cta=yes|no&campaign=...&variant=...&lead_id=...&batch_id=...` — clean redirect with full tracking params. Routes to response form or decline page.
- **CRM Updates on Submit**: Name, email, phone, role/jobTitle written back to CRM contact. Business phone + zip + zone updated on businesses table.
- **Hot Lead Integration**: On form submit, creates high-priority admin inbox item tagged as hot lead for Opportunity Radar follow-up.
- **Token Expiry**: Tokens expire after 30 days. All verify/submit/decline routes enforce expiry.
- **Send Triggers**: "Send Outreach" button in capture page success dialog (after card upload) and contacts panel (replaces old "Send Claim Invite"). A/B variant selection in contacts panel dialog, random assignment in capture flow.
- **Routes**: `server/outreach-routes.ts` (send, redirect, verify, submit, decline). Frontend: `client/src/pages/outreach-respond.tsx`.
- **Tables**: `outreach_tokens`, `outreach_responses` in `shared/schema.ts`.

### Public Dashboard & Activity Feed (Phase 4 — Backend)
- **Tables**: `notification_preferences` (per-user toggle for each notification type), `activity_feed_items` (hub-scoped feed entries with bilingual title/summary, related entity link, metadata).
- **Notification Preferences**: 9 toggles (newBusinesses, newEvents, newArticles, weeklyDigest, savedItemUpdates, reviewResponses, claimUpdates, promotions, emailEnabled). Auto-created on first GET. Unique per userId.
- **Activity Feed**: Items scoped by zoneId → matched to user's hub zones. Types: new_business, new_event, new_article, business_updated, event_upcoming, review_posted, digest_published. Auto-published when businesses/events are created via admin.
- **Personal Dashboard API** (`GET /api/public/dashboard`): Aggregated view — user info, hubs with active flag, stats (saved items breakdown, nearby businesses, upcoming events, recent articles, reviews written).
- **Live Feed API** (`GET /api/public/activity-feed/live`): Real-time data from the active hub — recent businesses, upcoming events, recent articles. Queries actual entity tables, not the feed table.
- **Activity Feed API** (`GET /api/public/activity-feed`): Paginated, hub-zone-filtered feed items with locale support (en/es).
- **Saved Items Details** (`GET /api/public/saved-items/details`): Returns full entity data for all saved businesses/events/articles.
- **Admin Feed Publishing** (`POST /api/admin/activity-feed`): Admin can manually create feed items. Also auto-wired into business/event creation endpoints.
- **Files**: `server/public-dashboard-routes.ts`, `shared/schema.ts` (notification_preferences, activity_feed_items tables).
- **Frontend**: Pending — dashboard page, activity feed component, notification settings UI.

### Hub Management (Backoffice Backbone) — City-First Hierarchy
- **Concept**: Hubs (Metro and Micro territories) are the primary backbone of the backoffice. Everything in the platform is organized under hubs — listings, operators, revenue, coverage areas.
- **City-First Design**: Cities are the top level. Expanding a city reveals its territories (METRO/MICRO) and zones (Districts, Neighborhoods, ZIPs, Counties). Two parallel layers shown together:
  - **Territories** = licensing/revenue layer (METRO/MICRO with operator assignments)
  - **Zones** = content/directory layer (neighborhoods, districts, ZIPs, counties — what users see)
- **City Code** (`cityCode` column on `cities` table): 3-5 letter airport-style identifier (e.g. CLT, IND, ATX). Used in territory codes, QR branding, and hub badges.
- **Auto-Population on City Creation**: `POST /api/admin/cities` now:
  1. Creates the city record with `cityCode`
  2. Auto-creates a METRO territory: `{CODE}-METRO`, linked to city, status ACTIVE
  3. If `initialZips` provided (comma-separated), creates ZIP zones for each and populates metro geoCodes
- **Sidebar**: "My [CODE] Hub" is the first item in the admin sidebar (dynamic label, e.g. "My CLT Hub"). "Hub Management" (full city tree) is in Platform (Master) for Super Admins only.
- **My Hub Panel** (`client/src/pages/admin/my-hub-panel.tsx`):
  - Default landing page for all admin users. Shows the user's assigned hub directly — no city accordion wrapper.
  - Header with city name, code badge, status, brand name
  - Territories section (metro with nested micros) with CRUD
  - Zones section with type summary cards, zone list view, zone CRUD, bulk ZIP import
  - Data from `GET /api/admin/my-hub` — returns single-city hub data (flat, not array)
  - Super Admins see the hub matching their city switcher selection
- **Hub Management Panel** (`client/src/pages/admin/hub-management-panel.tsx`):
  - City-first expandable tree: each city card shows name, code badge, status, territory counts, zone summary
  - Expand city → Territories section (metro with nested micros) + Zones section (grouped by type with counts)
  - Zone type cards link to filtered zone list view with full table (name, type, county, state, ZIPs)
  - CRUD for all levels: Create/Edit/Delete cities, territories, and zones
  - Bulk ZIP import: paste comma-separated ZIPs to batch-create ZIP zones
  - Delete protection: cannot delete metros with micros, or hubs with operator assignments
  - **Mobile-friendly**: All button rows use `flex-wrap`, territory/zone headers stack on small screens, `min-w-0` prevents overflow
- **Backend** (`server/hub-management-routes.ts`):
  - `GET /api/admin/hub-management` — City-first hierarchy: each city with territories (metros+micros), zone summary (counts by type), totals. City-scoped for non-Super Admins.
  - `GET /api/admin/hub-management/city/:cityId/zones` — Zones for a city, filterable by `?type=` (ZIP, DISTRICT, etc.)
  - `POST /api/admin/hub-management/city/:cityId/zones` — Create a zone within a city
  - `POST /api/admin/hub-management/city/:cityId/zones/bulk-zip` — Bulk create ZIP zones from comma-separated list
  - `PATCH /api/admin/hub-management/zones/:id` — Update zone fields
  - `DELETE /api/admin/hub-management/zones/:id` — Delete a zone
  - `POST /api/admin/territories` — Create a new territory (METRO/MICRO)
  - `GET /api/admin/hub-management/:id` — Territory detail with operators, top businesses, children
  - `PATCH /api/admin/hub-management/:id` — Update territory fields
  - `DELETE /api/admin/hub-management/:id` — Delete territory (Super Admin only, with safety checks)
- **Data Model**: `cities` (with cityCode), `territories` (METRO/MICRO), `zones` (DISTRICT/NEIGHBORHOOD/ZIP/COUNTY/MICRO_HUB), `operator_territories`, `territory_listings`.
- **Files**: `client/src/pages/admin/hub-management-panel.tsx`, `server/hub-management-routes.ts`, `client/src/pages/admin/admin-sidebar.tsx`, `client/src/pages/admin/dashboard.tsx`.

### QR Code Generator
- **Endpoints** (protected by `requireAdminOrOperator`):
  - `POST /api/qr/generate` — Generate a single QR code. Accepts `url` (custom URL) or `entityType` + `entityId` (auto-resolves slug-based URL). Options: `format` (png/svg, default svg), `size` (100-2000, default 400), `includeCityCode` (default true), `cityCode` (override), `label`.
  - `POST /api/qr/generate-batch` — Generate up to 100 QR codes at once. Accepts `entityType` + `entityIds[]`. Returns array with per-item results/errors.
- **City Code Branding**: QR codes feature the city's airport identifier (CLT, IND, etc.) rendered in bold text centered on a white rectangle over the QR pattern. Uses high error correction (H level, 30% redundancy) to remain scannable. City code is auto-resolved from the entity's city → metro territory code. Can be overridden via `cityCode` param or disabled via `includeCityCode: false`. SVG format recommended for branded QR codes (city code overlay embedded in SVG). PNG uses H-level correction but no visual text overlay.
- **Supported Entities**: business (`/biz/{slug}`), event (`/events/{slug}`), article (`/articles/{slug}`), zone (`/zone/{slug}`), digital_card (`/card/{slug}`), attraction (`/attractions/{slug}`).
- **Operator Scoping**: Operators can only generate QR codes for entities within their assigned territories/cities. Businesses checked via territory listings; events/articles/zones/attractions checked via city membership.
- **Output**: Returns `{ qrDataUrl, url, label, format, size, cityCode }`. The `qrDataUrl` is a base64 data URL ready for display or download.
- **Dependencies**: `qrcode` npm package (server-side generation).
- **Files**: `server/qr-routes.ts`, registered in `server/routes.ts`.

### Licensing & Revenue Engine
- **Architecture**: City Metro Hub (root owner) → Metro Territories (city-level, e.g. Charlotte/CLT) → Micro Territories (zip/neighborhood, e.g. CLT-28277). All revenue flows through City Metro Hub's single Stripe account.
- **Tables**: `territories`, `operators`, `operator_territories`, `territory_listings`, `revenue_transactions`, `revenue_splits`. Territories have optional `siteUrl` and `emailDomain` fields for domain override at the territory level.
- **Revenue Split Rules (calculated dynamically at transaction time)**:
  - Standard Listing: 40% Micro / 30% Metro / 30% City Core (with active Micro+Metro). Falls to 60/40 if no Micro, 100% Core if neither.
  - Activation Fees: Metro-sourced 50/50 Metro/Core. Metro activation 100% Core (10% referral if Micro-sourced).
  - Referral: 10% of first 12 months from Core share.
- **Revocation**: Operator status change to REVOKED auto-adjusts all future splits dynamically. No manual split rewrite needed.
- **Service Layer**: `server/services/revenue.ts` — `calculateRevenueSplit()`, `handleRevocation()`, `handleReferralCommission()`, `processRevenueFromPayment()`.
- **Routes**: `server/licensing-routes.ts` — full CRUD for territories, operators, assignments, revenue views, payout ledger, split overrides, split preview.
- **Stripe Webhook**: Extended `server/stripe/webhook.ts` to handle `invoice.paid` and `payment_intent.succeeded` — creates revenue transactions and splits when territory listing metadata is present.
- **Admin UI**: Two new panels in admin sidebar under "Licensing & Revenue":
  - **Territories & Operators** (`licensing-panel.tsx`): CRUD for territories (Metro/Micro hierarchy), operators, and territory assignments with exclusivity. Territories support geo codes (ZIP codes, neighborhood names, etc.) via tag-style input — visible as badges on territory cards.
  - **Revenue & Payouts** (`revenue-panel.tsx`): Overview dashboard, by-territory drill-down, payout ledger with status management (Pending → Payable → Paid).
- **Data Ownership**: All data belongs to City Metro Hub. Operators get scoped access only.
- **Multi-City**: Adding a new city = creating a new Metro territory linked to a city record. The system is inherently multi-city ready.

### Operator Auth & License CRM (Phase 1)
- **Operator Auth**: Operators are invited by Super Admin, receive invite email via Resend, set password via invite token, log in at `/operator/login`. Session-based auth (`operatorId` in session). Routes in `server/operator-auth-routes.ts`.
- **Operator Dashboard** (Phase 2B complete): Scoped dashboard at `/operator/dashboard` with sidebar nav adapted to operator type. All sections are live with real data:
  - **Overview**: Summary cards (business count, total revenue, territories, status) with live data from operator-scoped APIs.
  - **Business Pipeline / My Businesses**: Territory-scoped business list with search and territory filter. Shows listing tier, claim status, presence status per business. Expandable CRM detail panel per business: stage selector, add notes (call/email/visit/note), activity/audit timeline.
  - **My Micro Operators** (Metro only): Lists downstream Micro operators assigned to child territories. Shows name, email, territory, status, exclusivity.
  - **My Revenue**: Summary cards (Total Earned, Pending, Payable, Paid) + split history table with date, amount, type, status.
  - **Google Places Import**: Territory-scoped import tool. Operators select search query + ZIP from their territory's geo codes, trigger Google Places import. Job history with status badges. Rate limited to 5 imports/day. Imported businesses auto-assigned to operator's territory.
  - **Communications**: Territory-scoped comms log showing emails and SMS sent within operator's territories. Filterable by channel (Email/SMS).
  - **Territory Overview**: Enhanced with live business counts, geo codes display, siteUrl/emailDomain, and recent activity feed.
- **Operator-Scoped APIs**: `GET /api/operator/businesses`, `GET /api/operator/revenue`, `GET /api/operator/revenue/splits`, `GET /api/operator/micro-operators` (Metro only, 403 for Micro), `GET /api/operator/activity`, `PATCH /api/operator/businesses/:id/stage`, `POST /api/operator/businesses/:id/notes`, `GET /api/operator/businesses/:id/activity`, `POST /api/operator/places/import`, `GET /api/operator/places/jobs`, `GET /api/operator/places/geo-codes`, `GET /api/operator/comms-log`. All use `requireOperator` middleware and filter data to the operator's assigned territories only.
- **License CRM Pipeline**: Super Admin panel for managing operator lifecycle through stages: PROSPECT → CONTACTED → APPLICATION → ONBOARDING → ACTIVE → SUSPENDED. Pipeline view (Kanban) and list view. Activity notes with timestamps. Quick actions: invite, suspend, reactivate.
- **Invite Flow**: Creates invite token (7-day expiry), sends branded email from `citymetrohub.com` via Resend, operator registers at `/operator/register?token=...`. Moves operator to ONBOARDING stage on invite, ACTIVE on registration.
- **Pipeline API**: `GET /api/admin/license-pipeline`, `PATCH /api/admin/operators/:id/pipeline`, `POST /api/admin/operators/:id/invite`.
- **Schema additions**: `pipelineStage`, `pipelineNotes`, `lastContactedAt`, `passwordHash`, `inviteToken`, `inviteExpiresAt`, `lastLoginAt` on operators table. New `pipeline_stage` enum.
- **Files**: `server/operator-auth-routes.ts`, `client/src/pages/operator-login.tsx`, `client/src/pages/operator-register.tsx`, `client/src/pages/operator-dashboard.tsx`, `client/src/pages/admin/license-crm-panel.tsx`, `client/src/hooks/use-operator.ts`.

### Admin Navigation
- **Platform (Master)** *(SUPER_ADMIN only)*: Cities management.
- **Content (CMS)**: Businesses, Events (full CRUD with host-business linking), Categories (L1/L2/L3 tree manager), Articles, Curated Lists, Attractions, Authors.
- **Intake & Review**: Submissions, Content Intake, Reviews.
- **CRM & Sales**: Customer Ops, Subscribers, Leads.
- **Licensing & Revenue**: License CRM, Territories & Operators, Revenue & Payouts.
- **Monetization**: Ads, Listing Tiers, Transfers, Enterprise Reviews, Content Journal.
- **Tools**: AI Assistant, Communications Log, SEO Diagnostic, Regions, Email & Outreach, Vendor CRM, Google Places, Admin Inbox.

### Per-Territory Email & Comms (Phase 3)
- **Territory-Aware Email**: `server/services/territory-email.ts` — `sendTerritoryEmail()` resolves sender domain from territory → city → platform (`citymetrohub.com`) chain. All emails logged to `comms_log` table.
- **Territory-Aware SMS**: `server/services/territory-sms.ts` — `sendTerritorySms()` wraps Twilio client with territory context. All SMS logged to `comms_log` table. Future-proofed for per-territory phone numbers.
- **Communications Log**: `comms_log` table tracks every email and SMS: channel, direction, territory, city, operator, recipient, sender, status, message ID, metadata. Enums: `comms_channel` (EMAIL/SMS), `comms_direction` (OUTBOUND/INBOUND), `comms_status` (QUEUED/SENT/DELIVERED/BOUNCED/FAILED).
- **Admin Comms Panel**: `client/src/pages/admin/comms-log-panel.tsx` — Full communications log with channel/territory filters, expandable rows showing body preview and metadata.
- **Operator Comms Section**: Operators see territory-scoped comms log in their dashboard under "Communications".
- **APIs**: `GET /api/admin/comms-log` (admin, all comms with filters), `GET /api/operator/comms-log` (operator, territory-scoped).
- **Integration**: Activation verification emails/SMS, operator invite emails, SMS OTP login, phone verification, claim notifications, and ownership transfer emails all use territory-aware services, auto-logging to `comms_log`.

### Operator Outreach (Phase 4)
- **Outreach API**: `POST /api/operator/outreach/send` — Send territory-branded outreach emails to businesses. Rate limited 20/day. Merge tag support ({{businessName}}, etc.). `GET /api/operator/outreach/templates` — Available outreach templates. `GET /api/operator/outreach/daily-count` — Daily usage.
- **Outreach UI**: "Send Email" button per business in operator dashboard pipeline. Compose dialog with template selector, merge tag insertion, live preview. Per-business outreach history. Daily send counter badge.
- **SMS OTP Login**: Fully wired — SMS verification codes sent via Twilio, logged to comms_log.
- **Phone Verification**: Full flow — send code, verify code (`/api/auth/verify-phone`), mark phone verified.
- **Claim Notifications**: Claim requests trigger email to business owner with requester info.
- **Ownership Transfers**: Transfer approval sends invitation email to new owner with token link.

### Admin Panel Completions (Phase 4)
- **Curated Lists** (`curated-lists` in admin dashboard): Full CRUD for curated lists (Top 10, Top 25, Custom). Add/remove/reorder businesses within lists. Slug auto-generation. Replaced placeholder.
- **Leads & Attribution** (`leads-panel.tsx`): Summary cards (total leads, new, clicks, conversion rate), attribution by source, filterable leads table with status management, form submissions view, click events timeline. Replaced placeholder.
- **Zone Editor** (`zone-edit-panel.tsx`): Full zone editing with name, slug, type, parent zone, county, state, ZIP codes, active toggle. Search and type filter. Replaced "Zone editing coming soon" placeholder.
- **Coverage Audit** (`coverage-audit-panel.tsx`): Read-only audit view of the full county→town→neighborhood zone hierarchy. Summary stats (counties, towns, neighborhoods, ZIP codes), expandable tree view, search/filter by name/county/type, CSV export for marketing/assignments. Data fetched from `GET /api/admin/zones`. Admin sidebar: Tools & Settings group.
- **Coverage API** (`GET /api/cities/:slug/coverage`): Public endpoint returning structured hierarchy `{ counties: [{ name, county, stateCode, zipCodes, towns: [{ name, slug, neighborhoods: [{ name, slug, zipCodes }] }] }] }`. Used by coming-soon page to render the "Where We Are" section from DB data (no more hardcoded regions array).
- **Zone Accuracy Fixes**: Ranlo separated as own DISTRICT (was listed as Gastonia neighborhood). Removed inaccurate entries: Laureate Park, Brantley Place, Carolina Place, Saddlewood, South Point. Expanded from 11 to 19 counties with full Charlotte MSA/CSA/extended region: added Anson, Cleveland, Catawba, Alexander, Burke, Caldwell, McDowell (NC) + Chesterfield (SC). Total: 19 counties, 74 towns, 125 neighborhoods, 106 ZIP codes, 321 zones in DB.
- **Hub Regions Expansion**: All 74 micro hubs from user's finalized list now exist as hub regions in the `regions` table (`server/seed-hubs-coverage.ts`). 19 county regions, 85 hub regions (14 Charlotte neighborhoods + 71 town hubs), 115 zip_geos entries, 117 hub_zip_coverage mappings. Every hub is findable by county, name, and ZIP code via `/api/zones/resolve`. ZIP geo fallback coordinates hardcoded for all 42 expanded-area ZIPs so seed is reliable without Google Places API key.

### CityCorehub Platform Site
- **Marketing Page**: `/citymetrohub` — Public-facing site for attracting Metro operator prospects. Features platform overview, feature showcase, "How It Works" steps, live hubs section. Bilingual (EN/ES).
- **Start Your City Form**: Inline application form collecting name, email, phone, city, state, and message. Submits to `POST /api/public/start-city` (no auth required). Creates operator record as `PROSPECT` in License CRM pipeline with form details in `pipelineNotes`. Duplicate email detection prevents repeat submissions. Success confirmation shown inline.
- **Files**: `client/src/pages/citymetrohub.tsx`, `server/routes.ts` (public start-city endpoint), `server/storage.ts` (`getOperatorByEmail`).

### Organic Growth Engine
**Philosophy**: Equal visibility for all, rotation-based (nobody stays on top permanently), micro-neighborhood focused, revenue from utility (licensing tiers, event sponsorships) not from selling directory visibility. No pay-for-play directory model.

- **Automated Weekly Digest**: "Charlotte This Week" email auto-sent Mondays at ~9am ET to opted-in subscribers. Content auto-pulled: 5 recent businesses, 5 upcoming events, 1 latest article. Personalized by subscriber's Home hub neighborhood. HTML template with hub branding (purple/amber), mobile-responsive, bilingual (EN/ES). Admin preview + test send + manual trigger. Digest history tracking. Files: `server/digest-scheduler.ts`, `server/email-routes.ts` (digest endpoints), `client/src/pages/admin/weekly-digest-panel.tsx`.
- **Enhanced Share Menu**: Multi-channel sharing dropdown replacing basic share button. 6 channels: Copy Link, WhatsApp, Facebook, X/Twitter, Email, SMS (mobile only). Pre-filled branded bilingual share text. Share tracking via `POST /api/track-share`. Applied to business detail, event detail, article detail, microsites. Files: `client/src/components/share-menu.tsx`.
- **Dynamic OG Share Images**: Server-generated branded Open Graph images for social sharing. Endpoint: `GET /api/og-image/:type/:slug` returns PNG. Uses `satori` + `sharp` for HTML→SVG→PNG. Business/event/article-specific templates with hub branding. 5-minute in-memory cache. HTTP caching (300s client, 3600s CDN). `og:image` meta tags set on all detail pages and SSR snapshotter. Files: `server/og-image.ts`, updates to `server/seo-snapshot.ts`.
- **Content-Commerce Bridge**: Tightened editorial-to-business cross-referencing. `mentionedBusinessIds` array on articles table — admin links businesses when creating articles. `InlineBusinessCard` component renders mid-article (compact horizontal cards). IntersectionObserver tracks views as `ARTICLE_MENTION_VIEW` lead events, clicks as `ARTICLE_MENTION_CLICK`. Bidirectional: business microsites show "Editorial Mentions" section in HubTab. Files: `client/src/pages/article-detail.tsx`, `client/src/pages/admin/articles-panel.tsx`, `client/src/pages/microsite.tsx`.
- **Reader Recognition (Local Explorer Levels)**: 4 levels computed on-the-fly from real activity: L1 "Newcomer" (created account), L2 "Explorer" (5+ saves OR 1 review), L3 "Insider" (3+ reviews OR 2+ submissions), L4 "Local Expert" (10+ reviews AND 30+ days active). Level badges on reviews (social proof). "Your Impact" section on profile page with progress bar. Batch API for efficient level fetching on review pages. Files: `server/public-dashboard-routes.ts`, `client/src/components/review-section.tsx`, `client/src/pages/profile-security.tsx`.
- **Micro-Neighborhood SEO Content**: Neighborhood hub pages show "About {Neighborhood}" (from `description`/`descriptionEs` fields on `regions` table), "Popular Categories" with business counts linking to cross-pages, "Nearby Neighborhoods" with adjacent hubs. Category cross-pages show contextual intro text and related categories. Admin can edit neighborhood descriptions. No thin/duplicate content across neighborhoods. Files: `client/src/pages/neighborhood-hub.tsx`, `client/src/pages/admin/regions-panel.tsx`.
- **Event Sponsorship Display**: `sponsorBusinessIds` array on events table. Event detail shows "Event Sponsors" section with logos/names linking to business listings. Sponsors get "Event Sponsor" badge on their business detail page. Events list shows subtle "Sponsored" indicator. Equal rotation maintained — sponsorship doesn't affect sort order. Admin assigns sponsors in event editor. Impression/click tracking. Files: `client/src/pages/event-detail.tsx`, `client/src/pages/events-list.tsx`, `client/src/pages/business-detail.tsx`, `client/src/pages/admin/events-panel.tsx`.

### Metro Intelligence Engine (Silent Aggregation Mode)
**Philosophy**: Aggregate community data (never personal data) into market intelligence. Multi-tenant by cityId + zoneId. Collect now, monetize later as aggregated indexes. Revenue from data-as-a-service, not from selling personal information.

- **Tables**: `business_filings_log` (NC business filings with outreach tracking), `multifamily_log` (apartment/multifamily inventory with partner tracking), `language_usage_log` (EN/ES usage patterns by page/ZIP), `signals_feed` (unified normalized signal stream for internal analysis).
- **Architecture**: Reuses existing `cities.id` as metro_id and `zones.id` (type=ZIP) as zip_id — no duplicate geography tables. All tables include cityId, zoneId (nullable), source, sourceUrl, timestamps.
- **Ingestion Routes** (`server/intelligence-routes.ts`):
  - `POST /api/admin/intelligence/ingest/business-filings` — JSON array ingestion with normalization, ZIP→zoneId resolution, deduplication by filingExternalId or (name+date+address), auto-generates signals_feed entries
  - `POST /api/admin/intelligence/ingest/multifamily` — JSON array ingestion with address normalization, rent range parsing, deduplication by (name+address)
  - `POST /api/admin/intelligence/ingest/csv/business-filings` — CSV file upload via multer
  - `POST /api/admin/intelligence/ingest/csv/multifamily` — CSV file upload
- **Language/Demand Logging** (public, no auth — fire-and-forget):
  - `POST /api/log/page-view` — logs page views with language + pageType + ZIP
  - `POST /api/log/language-toggle` — logs EN↔ES switches with location context
  - `POST /api/log/search` — logs search queries with language + category
  - Client hooks: language toggle in i18n.tsx, search submit in search-bar.tsx
  - City slug resolved to UUID via cached lookup
- **Query/List Endpoints**: `GET /api/admin/intelligence/business-filings`, `/multifamily`, `/signals`, `/language-stats` — all with pagination, filters, counts
- **Status Management**: `PATCH /api/admin/intelligence/business-filings/:id/status`, `PATCH /api/admin/intelligence/multifamily/:id/status` — inline outreach/partner status updates
- **CSV Export**: `GET /api/admin/intelligence/export/business-filings.csv`, `/multifamily.csv`, `/signals.csv` — filtered exports
- **Normalization** (`server/services/normalize.ts`): `normalizeBusinessFiling()`, `normalizeMultifamily()`, `resolveZipToZoneId()` — trims names, uppercases state codes, parses dates, extracts ZIP from addresses, resolves ZIP→zoneId
- **Admin Panel** (`client/src/pages/admin/intelligence-panel.tsx`): 8-tab UI under "Metro Intelligence" sidebar group:
  - Business Filings: table + filters + inline outreach status + JSON/CSV import + CSV export
  - Multifamily: table + filters + inline partner status + import/export
  - Signals Feed: unified signal stream with type filter + export
  - Language & Demand: summary stats (EN/ES split, event types, top searches, activity by ZIP)
  - Sources: connector registry management (see Metro Sources Framework below)
- **Job Stubs**: `server/jobs/job_pull_business_filings_nc.ts`, `server/jobs/job_pull_multifamily_listings.ts` — disabled by default, check `ENABLE_FILINGS_PULL`/`ENABLE_MULTIFAMILY_PULL` env flags
- **TypeScript Types**: `server/intelligence/metroDataTypes.ts` — enums for StreamId, SignalType, DataSourceType + record interfaces
- **Documentation**: `docs/metro-intelligence/MetroDataInventory_v1.md` + `.json` — comprehensive inventory of all data streams (38 streams in 7 categories), schema plan, 10 future aggregated products, 4-phase build order
- **Files**: `server/intelligence-routes.ts`, `server/services/normalize.ts`, `client/src/pages/admin/intelligence-panel.tsx`, `client/src/hooks/use-page-logger.ts`, `server/intelligence/metroDataTypes.ts`, `server/jobs/`, `docs/metro-intelligence/`

### Metro Sources Framework (Multi-Metro Connector Registry)
**Purpose**: Automated data pipeline that pulls from public government APIs (Census, Socrata, ArcGIS, BLS) per city. Replaces manual CSV imports for standardized data streams. Foundation for licensing expansion.

- **Architecture**: Reuses `cities` table as metro registry (no separate metros table). `cities.id` = metro_id. Each source is scoped by cityId. Raw rows stored with SHA-256 hash dedup.
- **Tables**:
  - `metro_sources` — connector registry: name, sourceType (SOCRATA/ARCGIS/CENSUS/BLS/DOT), baseUrl, datasetId, layerUrl, paramsJson (field mappings + query config), pullFrequency (HOURLY/DAILY/WEEKLY/MONTHLY), enabled, status (OK/ERROR/DISABLED/NEVER_RUN), lastPulledAt, lastCursor, lastError
  - `source_pull_runs` — audit log per pull: metroSourceId, startedAt, finishedAt, status (SUCCESS/FAILED/SKIPPED), rowsFetched/Inserted/Updated, nextCursor, errorMessage
  - `source_raw_rows` — raw storage: cityId, metroSourceId, externalId, recordTimestamp, zipCode, lat/lng, payloadJson (full raw record), hash (SHA-256 for dedup). Unique indexes on (metroSourceId, externalId) and (metroSourceId, hash)
- **Connectors** (`server/intelligence/connectors/`):
  - `connectorTypes.ts`: shared `Connector` interface, `ConnectorConfig`, `PullResult`
  - `socrataConnector.ts`: Socrata SODA API (`/resource/{datasetId}.json`), `$limit/$offset` pagination, incremental date filtering, 500ms rate limiting
  - `arcgisConnector.ts`: ArcGIS REST query (`/query?f=json`), `resultOffset/resultRecordCount` pagination, geometry extraction (point + polygon centroid), 500ms rate limiting
  - `censusConnector.ts`: Census API (`api.census.gov/data/{year}/{dataset}`), free/keyless, computes externalId from geography+year
  - `blsConnector.ts`: BLS public API v2 (POST `api.bls.gov/publicAPI/v2/timeseries/data/`), free (500 req/day), computes externalId from seriesId+period
  - `index.ts`: factory `getConnector(sourceType)` returns correct connector instance
- **Job Runner** (`server/intelligence/jobRunner.ts`):
  - `runPull(source)`: creates pull_run → calls connector → extracts fields via paramsJson mappings (externalIdField, dateField, zipField, latField, lngField) → computes hash → upserts into source_raw_rows → updates source status
  - `runAllDue()`: fetches enabled sources, runs those past their pullFrequency interval
  - Error handling: per-source catch, sets status="ERROR", records error in pull_run
- **Routes** (added to `server/intelligence-routes.ts`):
  - `GET /api/admin/intelligence/sources` — list all sources, optional `?cityId=` filter
  - `POST /api/admin/intelligence/sources` — create source
  - `PATCH /api/admin/intelligence/sources/:id` — update source config
  - `DELETE /api/admin/intelligence/sources/:id` — delete source + its raw rows + pull runs
  - `GET /api/admin/intelligence/sources/:id/runs` — list pull runs (last 20)
  - `GET /api/admin/intelligence/sources/:id/rows` — list raw rows (paginated)
  - `POST /api/admin/intelligence/run-pulls` — trigger pulls: `{ sourceId? }` for single, `{ cityId?, sourceType? }` for batch
- **Admin UI**: "Sources" tab in Intelligence Panel — city selector, source cards with enable/disable toggle, status + type badges, "Run Now" button, run history expandable, raw rows preview, add/edit dialog with JSON params editor
- **Seed Script**: `scripts/seed-metro-sources.ts` — creates Indianapolis city + 38 ZIP zones, seeds 4 sources per city (Charlotte + Indianapolis): Socrata, ArcGIS, Census (enabled), BLS. Idempotent. Run via `npx tsx --tsconfig tsconfig.json scripts/seed-metro-sources.ts`
- **Adding a new metro**: Create city via admin UI → run seed or manually add metro_sources via Sources tab → configure paramsJson with field mappings → enable + run
- **Files**: `server/intelligence/connectors/` (6 files), `server/intelligence/jobRunner.ts`, `server/intelligence-routes.ts` (extended), `client/src/pages/admin/intelligence-panel.tsx` (Sources tab), `scripts/seed-metro-sources.ts`

### Outbound RSS Feed
**Purpose**: Platform generates its own RSS 2.0 feed at `GET /api/cities/:citySlug/rss` so external readers/apps can subscribe to the hub's published content.
- **Content mix**: Up to 50 items — 25 articles, 15 events, 10 new businesses, sorted by date descending.
- **XML structure**: RSS 2.0 with Atom self-link. Channel includes title, description, language (en), lastBuildDate, ttl (30 min). Items have title, link, description, pubDate, category, guid.
- **Caching**: `Cache-Control: public, max-age=300` (5 min).
- **Auto-discovery**: `<link rel="alternate" type="application/rss+xml">` injected into `<head>` via `useEffect` in `PublicLayout`.
- **Footer**: RSS icon/link in site footer linking to the feed.
- **Existing "Copy RSS Feed" button** in coming-soon.tsx copies the feed URL to clipboard.

### Admin Content Sources Panel
**Purpose**: Dashboard view of all data aggregation connectors (`metro_sources` table) feeding the hub.
- **Route**: Admin sidebar → Hub Operations → "Content Sources" (id: `content-sources`).
- **API**: `GET /api/admin/content-sources` — returns all metro sources, city-scoped for operators, all for super-admins.
- **Grouping**: Sources grouped by type — News RSS, Events (Eventbrite/iCal), Government (Socrata/ArcGIS/Census/BLS/DOT), Jobs (USAJobs), Other.
- **Per-source info**: Name, source type, base URL, last pulled time (relative), pull frequency, status badge (OK/Error/Disabled/Never Run).
- **Summary stats**: Total sources, active count, error count.
- **File**: `client/src/pages/admin/content-sources-panel.tsx`

### RSS Content Seeding System
**Purpose**: Pull local news from RSS feeds, admin reviews items (approve/skip/flag), AI rewrites summaries for community tone, then displays approved items as "Local Updates" on the public site. Content belongs to the original publisher — we link back, never host full articles.

- **Workflow**: RSS pull → `rss_items` table (status=PENDING) → admin reviews → on APPROVE: OpenAI rewrites summary (2-3 sentences, community-focused, cites source) → stored in `rewrittenSummary` → public via `/api/content/local-updates`
- **Tables**:
  - `rss_items` — id, cityId, metroSourceId, externalId (sha256 of baseUrl+link), sourceName, title, url, publishedAt, summary, rewrittenSummary, author, imageUrl, categoriesJson, rawJson, reviewStatus (PENDING/APPROVED/SKIPPED/FLAGGED), reviewedAt, reviewedBy, viewCount, createdAt, updatedAt. Unique on (metroSourceId, externalId)
- **RSS Connector** (`server/intelligence/connectors/rssConnector.ts`): Uses `rss-parser`, extracts title/link/pubDate/contentSnippet/author/categories/images (enclosure/media:content/media:thumbnail/inline img tags), computes externalId as sha256(baseUrl+link)
- **Community Content Filter**: Applied at ingestion in `handleRssRows()` before DB insert. Three checks: (1) Negative keywords (crime, shooting, murder, stabbing, robbery, arrest, homicide, assault, fatal, killed, etc.) → skipped as `negative_content`. (2) Political keywords (politics, election, congress, senate, republican, democrat, trump, biden, legislation, etc.) → skipped as `political_content`. (3) Local relevance check — must mention any of the 74 hub areas (all Charlotte neighborhoods, all 19 counties, all town names from Rock Hill to Hickory to Shelby) → skipped as `non_local`. Full keyword list in `LOCAL_KEYWORDS` array. Filtered items logged with `[FeedFilter]` prefix. Summary logged per source.
- **Event Content Filter**: Applied to iCal and Eventbrite event imports via `checkEventContentFilter()` in `handleEventSeedRows()`. Blocks academic/administrative events using `EVENT_IRRELEVANT_BLOCKLIST` (grades due, last day to drop, faculty meeting, exam period, registration deadline, classes begin/end, tuition due, etc.) + negative content keywords. Logged with `[EventFilter]` prefix. This prevents UNC Charlotte academic calendar items (e.g. "Grades Due by for First Half Term") from polluting the community events feed.
- **Category Mapping — Complete Coverage Rule**: "If it exists in the community, it belongs in the directory." Every Google Places type and OSM tag maps to at least one L2 category. Three new L2 categories created: `funeral-memorial` (Funeral & Memorial Services, under Nonprofit & Faith), `travel-lodging` (Travel & Lodging, under Entertainment & Recreation), `transit-transportation` (Transit & Transportation, under Professional Services). Full mapping covers 100+ Google types and 80+ OSM tags. For any Google type not in the static map, an AI fallback (`aiFallbackCategorize()` in `server/google-places.ts`) calls GPT-4o-mini to suggest the best existing L2 category — no business ever imports uncategorized. Unmapped types logged with `[CategoryMap]` prefix for review. Google meta-types (`establishment`, `point_of_interest`, `political`, `geocode`, etc.) are skipped as they have no real-world meaning.
- **Related Businesses Filter**: Organization-type entities (presenceType=organization: churches, schools, parks, municipal buildings) only appear as "related businesses" on event/article detail pages when they have **category overlap** — they no longer match on zone-only. Commercial businesses still match on category OR zone. This prevents irrelevant entities like "Biddleville School" or "Bethel Church" from showing as related to random events.
- **Feed Scheduler**: 2-hour refresh interval (`FEED_INTERVAL_MS = 2h`). Initial run 30s after startup. File: `server/feed-scheduler.ts`.
- **Feed Card Source Credit**: RSS article cards show "Read at [Source Name]" attribution link below the summary, linking to original article URL.
- **Job Runner RSS Path**: When sourceType=RSS, upserts into `rss_items` (not `source_raw_rows`). New items get reviewStatus=PENDING. Items failing community content filter are silently skipped.
- **Admin Routes**:
  - `GET /api/admin/intelligence/rss-items` — list with filters (reviewStatus, cityId, sourceId, search), paginated
  - `PATCH /api/admin/intelligence/rss-items/:id/review` — set status; on APPROVED: triggers AI rewrite via OpenAI gpt-4o-mini
  - `POST /api/admin/intelligence/rss-items/bulk-review` — bulk skip/flag (no AI rewrite on bulk)
  - `POST /api/admin/intelligence/rss-items/:id/rewrite` — manually re-trigger AI rewrite
- **Public Routes**:
  - `GET /api/content/local-updates?citySlug=&limit=12` — APPROVED items only, returns rewrittenSummary
  - `GET /api/content/local-updates/page?citySlug=&page=&limit=&sourceId=` — paginated for full page
  - `POST /api/content/local-updates/:id/view` — increment view counter
  - `GET /api/content/rss-sources?citySlug=` — list RSS sources for filtering
- **Admin UI**: "RSS Review" tab (6th) in Intelligence Panel — filter by status/search, card-based review queue, approve/skip/flag buttons, bulk select, rewrite button, shows AI-rewritten summary in green box
- **Public UI**:
  - `LocalUpdatesModule` (`client/src/components/local-updates-module.tsx`): homepage section, fetches 12 items, picks 6 with weighted rotation (max 2 per source), card grid with title/source/time/excerpt/thumbnail
  - `LocalUpdatesPage` (`client/src/pages/local-updates.tsx`): full paginated page at `/:citySlug/local-updates`, filter by source
- **Seed Script**: `scripts/seed-rss-sources.ts` — seeds 48 RSS sources covering all 19 counties + niche verticals + hyper-local Patch feeds. Run via `npx tsx scripts/seed-rss-sources.ts`
  - **Charlotte-core (10)**: Spectrum Local News, WCNC, WFAE, Charlotte Observer (disabled), WSOC-TV, Charlotte Ledger, CLT Today (6am City), Queen City News (FOX 46), Charlotte Magazine, Axios Charlotte
  - **County papers (16)**: La Noticia (Spanish), Hickory Record (Catawba/Burke), Independent Tribune (Cabarrus), Salisbury Post (Rowan), Lincoln Herald (Lincoln), Shelby Star (Cleveland), Gaston Gazette (Gaston), Mooresville Tribune (Iredell), Statesville R&L (Iredell), McDowell News (McDowell), Lenoir News-Topic (Caldwell), Anson Record (Anson), Taylorsville Times (Alexander), The Link (Chesterfield SC), Stanly News & Press (Stanly), York County Regional Chamber (York SC business content)
  - **Niche verticals (6)**: Charlotte Parent (family), Charlotte Stories (community), Unpretentious Palate (food), Charlotte Five (food/drink), Off the Eaten Path (food/travel), Discovery Place (family/education)
  - **Hyper-local Patch feeds (16)**: Charlotte, Fort Mill (York SC), Rock Hill (York SC), Huntersville, Concord, Matthews-Mint Hill, Monroe (Union), Cornelius-Davidson, Mooresville, Ballantyne, Gastonia, Indian Trail (Union), Waxhaw (Union), Lake Norman, Pineville, Mint Hill — closes York SC and Union NC coverage gaps
- **Event Sources**: `scripts/seed-event-sources.ts` — seeds 3 event-specific sources into metro_sources: UNC Charlotte Events (ICAL, huge catalog), Blumenthal Performing Arts (RSS, major venue), Charlotte City Council Legistar (ICAL, government meetings). Run via `npx tsx scripts/seed-event-sources.ts`
- **Files**: `server/intelligence/connectors/rssConnector.ts`, `server/intelligence/jobRunner.ts`, `server/intelligence-routes.ts`, `client/src/pages/admin/rss-review-tab.tsx`, `client/src/components/local-updates-module.tsx`, `client/src/pages/local-updates.tsx`, `scripts/seed-rss-sources.ts`, `scripts/seed-event-sources.ts`

### Human Intelligence Layer
**Purpose**: Passive, anonymous collection of decision-making signals from real user interactions. No PII — only sessionHash (derived from user agent + date). Fire-and-forget pattern: respond 200 immediately, log asynchronously. All data scoped by cityId for multi-metro licensing.

- **Three Signal Types**:
  1. **Micro-Pulses**: "What mattered most in your decision?" — triggered probabilistically on listing views (10%), lead submissions (20%), direction clicks (15%), saves (15%). Decision factors: PRICE, LOCATION, TRUST, REVIEWS, WORD_OF_MOUTH, LANGUAGE_SUPPORT, SPEED, AVAILABILITY, QUALITY, LOCAL_OWNERSHIP, CONVENIENCE, BRAND, COMMUNITY_REPUTATION, OTHER
  2. **Free-Text Signals**: Optional follow-up to micro-pulse — short text (250 char max)
  3. **Lead Abandonment**: "What stopped you?" — triggered after 15s idle on started-but-incomplete lead forms. Reasons: PRICE_UNCLEAR, NO_AVAILABILITY, DISTANCE, TRUST_CONCERN, LANGUAGE_BARRIER, FOUND_ALTERNATIVE, JUST_BROWSING, WEBSITE_CONFUSING, OTHER
- **Tables**: `human_micro_pulse_log`, `human_free_text_log`, `lead_abandonment_log` — all with cityId, zoneId, sessionHash, language, createdAt
- **Routes** (all public, no auth, fire-and-forget):
  - `POST /api/human/micro-pulse` — body: { citySlug, zoneId?, categoryId?, listingId?, eventContext, decisionFactor, language, sessionHash }
  - `POST /api/human/micro-pulse/free-text` — body: { citySlug, zoneId?, listingId?, shortReasonText, language, sessionHash }
  - `POST /api/human/lead-abandon` — body: { citySlug, zoneId?, categoryId?, abandonmentReason, language, sessionHash }
- **Front-End Components**:
  - `MicroPulse` (`client/src/components/micro-pulse.tsx`): bottom-sheet drawer, decision factor pills, optional text follow-up, localStorage guards (24h cooldown, 1 per session)
  - `LeadAbandonPulse` (`client/src/components/lead-abandon-pulse.tsx`): bottom card, 15s idle timer, one-tap structured responses
- **Integration**: MicroPulse embedded in `business-detail.tsx` on listing_view context

### Community Campaign Engine
**Purpose**: Periodic community check-ins — admin creates campaigns with up to 3 questions, users see a banner on the homepage and respond anonymously. All responses scoped by metro for data product.

- **Tables**: `community_campaigns` (title, dates, isActive), `community_campaign_questions` (questionText, questionType: MULTIPLE_CHOICE/FREE_TEXT/SCALE, optionsJson), `community_campaign_responses` (selectedOption, freeTextResponse, scaleValue, sessionHash)
- **Admin Routes**: CRUD campaigns, add/remove questions, view aggregated responses
- **Public Routes**:
  - `GET /api/community/active-campaign?citySlug=` — returns active campaign + questions
  - `POST /api/human/campaign-response` — submit responses (fire-and-forget)
- **Admin UI**: "Campaigns" tab (7th) in Intelligence Panel — create/edit campaigns, add questions, toggle active, view response aggregates
- **Public UI**: `CampaignBanner` (`client/src/components/campaign-banner.tsx`): appears on city homepage when active campaign exists, shows questions, structured responses, 7-day dismissal in localStorage
- **Files**: `client/src/pages/admin/campaigns-tab.tsx`, `client/src/components/campaign-banner.tsx`

### Intelligence Report Dashboard
**Purpose**: Unified analytics dashboard — the sellable data product. Aggregates all collected signals into actionable metro intelligence. Admin-only, scoped by city.

- **Route**: `GET /api/admin/intelligence/report?cityId=&days=` — returns:
  - Search Intelligence: top queries with counts
  - Language Demand: EN vs ES split
  - Decision Factors: overall + by category
  - Abandonment Patterns: reason distribution
  - Top Content: most-viewed RSS articles
  - Activity by Zone: zone-level engagement
- **Admin UI**: "Intelligence Report" tab (8th) in Intelligence Panel — city selector, time range filter (7d/30d/90d), card-based sections with bar charts, CSV export per section
- **Data Product Vision**: All data aggregated at metro level, anonymous, never individual. Sellable as:
  - Metro Consumer Decision Index (what drives choices)
  - Language Demand Mapping (where bilingual services needed)
  - Local Content Engagement Report (what communities care about)
  - Market Gap Analysis (why leads abandon)
- **Files**: `client/src/pages/admin/intelligence-report-tab.tsx`, `server/intelligence-routes.ts`

### Intelligence Event Log (Unified Per-Entity Behavioral Ledger)
**Purpose**: Single unified event log per entity (BUSINESS or MULTIFAMILY) that consolidates all behavioral signals. Dual-write pattern — existing `lead_events` and `language_usage_log` remain intact, new `intelligence_event_log` captures the same events in a single queryable ledger. Foundation for sellable per-entity Intelligence Reports.

- **Schema** (`shared/schema.ts`):
  - `intelligence_event_log` — unified per-entity event stream. Enums: entity_type (BUSINESS/MULTIFAMILY), intelligence_event_type (PROFILE_VIEW, WEBSITE_CLICK, CALL_CLICK, DIRECTIONS_CLICK, SAVE, LEAD_START/SUBMIT/ABANDON, DECISION_FACTOR, RSS_CLICK, SEARCH_RESULT_CLICK). Indexed on (metroId, entityId) and (entityId, eventType).
  - `intelligence_report_requests` — report request funnel. Enums: requester_role, request_reason, report_request_status (NEW/IN_REVIEW/SENT/DECLINED/NEEDS_INFO)
  - `intelligence_report_tokens` — UUID-based private access tokens for report pages
  - `intelligence_report_snapshots` — cached report data per request
- **Event Collection**: `POST /api/intelligence/log` — public, fire-and-forget (responds 200 immediately). Accepts citySlug or metroId, resolves via resolveCityId().
- **Client Tracker** (`client/src/lib/intelligence-tracker.ts`): `trackIntelligenceEvent()` — sendBeacon-based, same pattern as existing lead-tracking.ts
- **Dual-Write Integration**: business-detail.tsx fires PROFILE_VIEW on mount + CALL_CLICK/DIRECTIONS_CLICK/WEBSITE_CLICK/SAVE alongside existing trackLeadEvent. micro-pulse.tsx fires DECISION_FACTOR with factor metadata.

### "Request Your Intelligence Report" Funnel
**Purpose**: Lead-capture funnel that converts business/entity interest into a sellable data product. Owners request a private Intelligence Report → receive confirmation email → get a private token page → admin reviews and fulfills.

- **CTA Component** (`client/src/components/intelligence-report-cta.tsx`): Card + Dialog form on business-detail.tsx sidebar. Fields: name, email, phone (opt), role, reason, consent. Purple brand styling.
- **Request Endpoint**: `POST /api/intelligence/request-report` — creates request + token + snapshot placeholder, sends 2 emails via sendTerritoryEmail():
  1. Confirmation to requester with private link
  2. Internal ops notification to INTELLIGENCE_OPS_EMAIL (or fallback)
- **Private Token Page** (`/intelligence/report/:token`): `GET /api/intelligence/report/:token` returns request info + teaser stats (30d profile views, top ZIP origin, EN/ES language split). Standalone page, no sidebar. Shows status badge + teaser stat cards.
- **Admin Panel** (`client/src/pages/admin/report-requests-panel.tsx`): Table with filters (status, entity type, search), expandable rows with notes editing, status management (In Review/Sent/Needs Info/Declined), token page links. Under "Metro Intelligence" → "Report Requests" sidebar item.
- **Routes**: `GET /api/admin/intelligence/report-requests` (list + filter), `PATCH /api/admin/intelligence/report-requests/:id` (status + notes)
- **Files**: `client/src/lib/intelligence-tracker.ts`, `client/src/components/intelligence-report-cta.tsx`, `client/src/pages/intelligence-report.tsx`, `client/src/pages/admin/report-requests-panel.tsx`, `server/intelligence-routes.ts`

### National Seeding Pipeline
**Purpose**: Automated data ingestion from free national data sources into metro directories. Seeds businesses, organizations, events, and jobs from structured APIs. Start small (~10 records per source per metro), learn the management flow, then scale.

- **Architecture**: 4 connectors plugged into the existing Metro Sources framework (connector interface → jobRunner dispatch → upsert into entity tables). Each connector is a class implementing `Connector.pull(config) → PullResult`. Provenance fields (`seedSourceType`, `seedSourceExternalId`) on businesses, events, and jobs tables enable dedup and attribution.
- **Connectors**:
  1. **OSM Overpass** (`OSM_OVERPASS`): Free, no API key. Queries OpenStreetMap via Overpass API for named amenities/shops/offices within a BBOX. Maps OSM tags to categories and presenceType. License: ODbL 1.0 (attribution required). Config: `{ bbox: {south,west,north,east}, tags: ["amenity","shop","office"], limit: 10 }`. File: `server/intelligence/connectors/osmOverpassConnector.ts`
  2. **IRS EO** (`IRS_EO`): Free, no API key. Streams IRS Exempt Organizations BMF CSV files (eo1-eo4.csv) filtering by state + ZIP prefix. Maps NTEE codes to categories. Config: `{ stateCode: "NC", zipPrefixes: ["282"], limit: 10 }`. File: `server/intelligence/connectors/irsEoBulkConnector.ts`
  3. **Eventbrite** (`EVENTBRITE`): Requires `EVENTBRITE_TOKEN` env secret. Searches events by lat/lng radius. Config: `{ location, latitude, longitude, withinMiles, limit }`. File: `server/intelligence/connectors/eventbriteConnector.ts`
  4. **USAJOBS** (`USAJOBS`): Requires `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT` env secrets. Searches federal jobs by location name + radius. Config: `{ locationName, radius, limit }`. File: `server/intelligence/connectors/usajobsConnector.ts`
- **Data Flow**: OSM/IRS → `businesses` table (with seedSourceType provenance). Eventbrite → `events` table. USAJOBS → `jobs` table. All dedup on (cityId, seedSourceType, seedSourceExternalId).
- **Jobs Table** (`shared/schema.ts`): New entity table for structured job data — title, slug, employer, department, employmentType, pay range (min/max/unit), location, remoteType, posted/closes dates, apply/details URLs, seedSourceType/ExternalId.
- **Public Jobs Page**: Route `/:citySlug/jobs` — filterable list (search, employment type, remote type), pagination, apply links. API: `GET /api/cities/:citySlug/jobs?q=&department=&employmentType=&remoteType=&page=&pageSize=`.
- **Seed Script**: `scripts/seed-national-sources.ts` — creates metro_sources records for Charlotte (OSM enabled, IRS enabled, Eventbrite/USAJOBS disabled until tokens provided).
- **Adding a New Metro**: Create 4 metro_sources records (one per connector type) with city-specific config (BBOX, ZIP prefixes, location coords). Run pulls via admin Sources panel or `runAllDue()`.
- **Files**: `server/intelligence/connectors/osmOverpassConnector.ts`, `irsEoBulkConnector.ts`, `eventbriteConnector.ts`, `usajobsConnector.ts`, `server/intelligence/connectors/index.ts`, `server/intelligence/jobRunner.ts`, `client/src/pages/jobs-list.tsx`, `scripts/seed-national-sources.ts`

## Jobs & Workforce Module (Data Foundation + Profiles)

### Overview
Workforce data layer for applicant profiles, skill taxonomies, credential tracking, employer hiring profiles, job listings, and applications. All tables live in `shared/schema.ts`; CRUD methods in `server/storage.ts`; API routes in `server/workforce-routes.ts`.

### Tables (12 total)
- **applicantProfiles**: Public user workforce profiles (headline, bio, availability, desired pay, preferred zone, visibility level, remote preference, shift preferences, days available)
- **skillCategories / skillSubcategories / skills**: Three-level skill taxonomy (8 categories → 19 subcategories → 63 skills), seeded on startup
- **applicantSkills**: Junction linking applicants to skills with proficiency levels and `isTopSkill` flag
- **credentialDirectory**: Master catalog of recognized credentials (16 seeded: ServSafe, CDL, CNA, OSHA, etc.)
- **applicantCredentials**: User's earned credentials with status/expiry tracking. Supports custom credentials (`isCustom`, `customName`, `customIssuingBody`) with nullable `credentialId`
- **applicantCredentialJurisdictions**: Multi-jurisdiction support per credential record (state, licenseNumber, status, dates)
- **applicantResumes**: Uploaded resumes with primary flag
- **businessHiringProfiles**: Employer hiring configuration per business (workplace summary, culture description, hiring contact method, verification badges)
- **jobListings**: Job postings by businesses
- **jobApplications**: Applications linking applicants to jobs
- **employerHiringMetrics**: Aggregate hiring stats per business

### Enums
`applicantAvailability`, `proficiencyLevel`, `credentialStatus`, `jobType`, `experienceLevel`, `applicationStatus`, `jobListingStatus`, `visibilityLevel` (PUBLIC/VISIBLE_WHEN_APPLYING/PRIVATE), `remotePreference` (ONSITE/REMOTE/HYBRID/NO_PREFERENCE), `desiredPayUnit` (HOURLY/WEEKLY/MONTHLY/ANNUALLY), `hiringContactMethod` (EMAIL/PHONE/WEBSITE/IN_PERSON/PLATFORM)

### API Routes (`/api/workforce/*`)
- Applicant CRUD: profile, skills (with top-skill toggle via PATCH), credentials (custom + directory), credential jurisdictions, resumes (all ownership-verified, Zod-validated)
- Employer: hiring profiles (with new fields), job listings, applications
- Public: skill taxonomy, credential directory, hiring businesses
- **Public Profiles**: `GET /api/workforce/public/applicant/:id` (respects visibility — only PUBLIC profiles shown), `GET /api/workforce/public/employer/:businessId` (includes active job listings)
- Admin: `GET /api/admin/workforce/overview` (aggregate stats)
- Charlotte AI: `GET /api/admin/charlotte/workforce-query?type=applicant-summary|employer-summary|zone-hiring-activity`

### Frontend Pages
- **Applicant Dashboard** (`client/src/pages/applicant-dashboard.tsx`): Multi-tab at `/:citySlug/workforce/profile` — Profile, Resumes, Skills, Credentials, Preferences, Applications tabs. Charlotte AI placeholder hooks throughout.
- **Public Applicant Profile** (`client/src/pages/public-applicant-profile.tsx`): Read-only at `/:citySlug/workforce/applicant/:id` — shows headline, top skills, credentials, desired roles.
- **Public Employer Profile** (`client/src/pages/public-employer-profile.tsx`): Read-only at `/:citySlug/workforce/employer/:businessId` — shows company info, culture, benefits, active jobs.
- **Employer Hiring Profile Tab**: Added to `client/src/pages/employer-dashboard.tsx` as "Hiring Profile" tab — manages workplace summary, culture, contact method, benefits, typical roles.

### Seed Data
`server/workforce-seed.ts` runs on startup with idempotency checks. Seeds skill taxonomy (63 skills across 8 categories) and credential directory (16 entries).

### Key Files
- `shared/schema.ts` — workforce enums, tables, insert schemas, types
- `server/storage.ts` — IStorage interface + DatabaseStorage CRUD methods
- `server/workforce-routes.ts` — all workforce API endpoints (applicant, employer, job listings, applications, public profiles)
- `server/workforce-seed.ts` — seed data for skills + credentials
- `server/charlotte-intelligence-routes.ts` — Charlotte workforce snapshot endpoint (`/api/admin/charlotte/workforce-snapshot`)

## Central Authority & Governance Layer

### Governance Model
SUPER_ADMIN controls the talent layer: intelligence, data ingestion, scoring, pricing. Operators (METRO/MICRO) sell within their territorial scope. The kill switch ensures suspended/revoked operators are immediately blocked from all portal access.

### Revenue Formula (DO NOT CHANGE — `server/services/revenue.ts`)
**Standard recurring (listings, ads):** Micro+Metro: 40%/30%/30%; Metro only: 60%/40%; Micro only: 40%/60%; No operators: 100% City Core.
**Activation (one-time):** Metro-sourced: 50%/50%; City Core-sourced: 100% City Core. **Referral:** 10% from City Core share.

### Conversion Attribution Flow
1. Operator dashboard → "Copy Upgrade Link" button → generates `/:citySlug/presence/:slug/pricing?ref=<operatorId>`
2. Business owner clicks link → presence pricing page reads `ref` param
3. Checkout API passes `operatorId` → Stripe session `metadata.source_operator_id`
4. Webhook `checkout.session.completed` → creates `conversion_attributions` record with status PAID

### Monthly Payout Ledger
- **Tables**: `payout_ledger` (aggregates `revenue_splits` per operator per month), `conversion_attributions`, `audit_log`
- **Engine**: `server/services/payout-engine.ts` — `generateMonthlyLedger()` sums revenue_splits for each active operator in a month period. Does NOT recalculate percentages — uses the amounts already computed by the revenue formula.
- **Lifecycle**: OPEN (generated) → APPROVED (admin clicks approve) → PAID (admin marks paid)
- **Admin Panel**: "Payout Management" in Platform (Master) group — filters by status/month/operator, summary cards, drill-down to individual splits

### Audit Log
- **Table**: `audit_log` — actorUserId, actorOperatorId, action, entityType, entityId, operatorId, metadataJson, createdAt
- **Service**: `server/services/audit-logger.ts` — fire-and-forget `logAudit()` function
- **Covered Actions**: LICENSE_CREATED, LICENSE_SUSPENDED, LICENSE_REVOKED, LICENSE_REACTIVATED, OPERATOR_REVOKED, TERRITORY_ASSIGNED, TERRITORY_UNASSIGNED, PAYOUT_APPROVED, PAYOUT_PAID, PAYOUT_GENERATED, CHECKOUT_COMPLETED, KILL_SWITCH_BLOCKED
- **Admin Panel**: "Audit Log" in Platform (Master) group — paginated, filterable by action/entity type

### Kill Switch
- `requireOperator` middleware checks `operators.status` on every request
- SUSPENDED or REVOKED status → immediate 403 with audit log entry
- Blocks all `/api/operator/*` endpoints including dashboard, businesses, revenue, outreach

### Intelligence Lockdown
All intelligence routes (`/api/admin/intelligence/*`), source management, and pricing admin routes use `requireAdmin` only. Operators cannot access data ingestion, scoring, connectors, or pricing configuration.

### Verification Crawl + Prospect Scoring (Talent Layer)
Automated system that crawls business websites, verifies contact info, and produces prospect fit ratings.

**Tables**: `entity_contact_verification` (crawl results, detected contacts, schema.org data), `entity_scores` (computed scores + bucket classification), `entity_field_history` (tracks all field changes with source provenance)

**Crawler** (`server/intelligence/crawl/websiteCrawler.ts`):
- Fetches homepage HTML via Node.js fetch + cheerio parsing
- Respects robots.txt (7-day domain cache), throttles 1 req/3s per domain, global concurrency 3, max 3 pages/entity
- Detects: phone, business emails (info@/contact@/etc — blocks personal emails), contact forms, social links, JSON-LD schema.org LocalBusiness, RSS feeds, addresses, hours
- Updates entity fields only when seed value missing OR confidence >= 80; all changes logged in entity_field_history

**Scoring Engine** (`server/intelligence/scoring/entityScoring.ts`):
- data_quality_score (0-100): address+zip(+20), phone(+15), website(+15), crawl OK(+20), schema.org(+15), social(+5), multi-source(+10)
- contact_ready_score (0-100): phone(+35), contact form(+25), business email(+25), address(+15)
- prospect_fit_score (0-100): no website(+20), phone(+20), address(+15), not verified(+15), in scope(+20), engagement(+10), location type bonus (+10 STOREFRONT/OFFICE, +15 if outreach WALK_IN/PHONE_FIRST/MAILER, -20 VIRTUAL with no contact)
- Bucket: TARGET (prospect_fit>=70 AND contact_ready>=40), NEEDS_REVIEW (confidence<40 + unknown location + some contact signals), CONTENT_SOURCE_ONLY (no contact + no address + crawl failed), else VERIFY_LATER

**Job Runner** (`server/intelligence/crawl/crawlJobRunner.ts`):
- `enqueueCrawlJobs()` — finds entities needing crawl (new, stale >30d, website changed)
- `processCrawlQueue(limit)` — processes pending with concurrency control
- `runScoringBatch()` — batch compute scores for all entities

**Admin Routes** (requireAdmin only):
- `POST /api/admin/intelligence/crawl/enqueue` — enqueue crawl jobs
- `POST /api/admin/intelligence/crawl/run` — run crawl queue
- `POST /api/admin/intelligence/scoring/run` — run scoring batch
- `GET /api/admin/intelligence/crawl/stats` — stats + distribution + recent results

**Location Classification** (`server/intelligence/classify/locationClassifier.ts`):
- Deterministic classifier (no ML): OSM tags → STOREFRONT/OFFICE, address heuristics → HOME_BASED (PO Box)/OFFICE (Suite), website cues → VIRTUAL/HOME_BASED
- Confidence scoring: strongest signal base (70-85) + agreement bonus (+10), capped at 100
- Address type flags: PO_BOX, SUITE, UNIT, RESIDENTIAL_HINT, COMMERCIAL_HINT stored as JSON
- `classifyEntityLocation(entityId)` — single entity, `classifyAllLocations(metroId?)` — batch
- Table: `entity_location_profile` (locationType, hasPhysicalAddress, addressQuality, addressTypeFlagsJson, confidenceScore)

**Outreach Recommender** (`server/intelligence/classify/outreachRecommender.ts`):
- Computes ranked outreach methods per entity based on location type + contact signals
- Methods scored: WALK_IN (90 storefront), MAILER (70-75 with address), PHONE_FIRST (80-85 with phone), WEBSITE_FORM (60-85 with form/website), EMAIL (70-80 with email), SOCIAL_DM (50-70 with social)
- Recommended method = highest scored; full ranked list stored in method_rank_json
- `recommendOutreach(entityId)` — single, `recommendAllOutreach(metroId?)` — batch
- Table: `entity_outreach_recommendation` (recommendedMethod, methodRankJson, reasonsJson)

**URL/QR Crawl Enrichment** (`server/intelligence/crawl/urlEnrichment.ts`):
- Auto-enriches contacts/businesses when URLs are captured via QR scan or manual entry
- Extracts: name, phone, email, company, address, social links, job title from page HTML
- Parses Schema.org JSON-LD, meta tags, tel/mailto links, body text
- Only fills empty fields (never overwrites); all changes logged to contact_field_history/entity_field_history with source="CRAWL"
- Triggered asynchronously (fire-and-forget) from capture save, batch sync, and contact website updates

**CRM Living History**:
- Soft-delete on contacts: DELETE sets `deletedAt` + `status='archived'` instead of hard delete
- `contact_field_history` table: tracks every field change with contactId, fieldName, oldValue, newValue, changedBy, source (MANUAL/CAPTURE/CRAWL/IMPORT), changedAt
- `entity_field_history` table: same pattern for business field changes
- GET contacts filters out archived by default; `?showArchived=true` to include

**Operator Targeting** (read-only):
- `GET /api/operator/businesses/scored` — scored businesses with location type, outreach recommendation, method_rank_json
- Operator dashboard "Prospect Targeting" tab: bucket filters (TARGET/VERIFY_LATER/NEEDS_REVIEW/CONTENT_SOURCE_ONLY), location type filter (STOREFRONT/OFFICE/HOME_BASED/VIRTUAL), outreach method filter, "Exclude Virtual" toggle, contact flags, score bars
- Location type badge + outreach method shown per business card
- Operators CANNOT edit scores, run crawls, or export data

**Admin Classification Routes**:
- `POST /api/admin/intelligence/classify/run` — runs location classifier + outreach recommender batch
- `GET /api/admin/intelligence/crawl/stats` — includes classification distribution + outreach method distribution + NEEDS_REVIEW count
- Admin intelligence panel shows: Run Classification button, location type stats cards, outreach method stats cards, NEEDS_REVIEW bucket card

**Automated Prospect Pipeline** (`server/intelligence/pipeline/prospectPipeline.ts`):
- Fully automated seed-to-sales pipeline: enqueue crawl → process crawl → classify locations → recommend outreach → score → auto-promote
- `runProspectPipeline(metroId?, triggeredBy?)` — orchestrates all steps, tracks results in `prospect_pipeline_runs` table
- Auto-promotion: TARGET-bucket entities at CRM stage "intake" with no prior promotion → stage set to "assigned", system note logged with contact info + outreach method + scores
- NEEDS_REVIEW flagging: entities needing manual review get admin inbox items (pipeline_needs_review type)
- Pipeline completion notification: admin inbox item (pipeline_promoted type) with summary of promoted + flagged counts
- Idempotent: re-running won't re-promote already-worked leads (checks pipeline_promoted_at + current stage)
- Scheduler: runs daily at 2am ET (configurable via `PIPELINE_SCHEDULE_HOUR` env var, default 2), checks every 5 minutes, prevents duplicate daily runs
- Admin API: `POST /api/admin/intelligence/pipeline/run` (manual trigger), `GET /api/admin/intelligence/pipeline/runs` (history), `GET /api/admin/intelligence/pipeline/status` (current state + counts)
- Admin UI: Pipeline section in intelligence panel with status banner, run button, result cards, run history table
- Operator "Sales Ready" queue: `GET /api/operator/businesses?stage=assigned` returns promoted leads sorted by prospect fit score, with contact info + outreach method + scores; "Start Working" button moves to "contacted" stage
- Table: `prospect_pipeline_runs` (id, metroId, triggeredBy, startedAt, completedAt, status, resultsJson, errorMessage)
- Column: `entity_scores.pipeline_promoted_at` — timestamp of auto-promotion

**Email Lead Pipeline** (`server/intelligence/email-lead-pipeline.ts`):
- Automated pipeline ensuring 30+ email-ready business leads are available daily (configurable via `EMAIL_LEAD_DAILY_TARGET` env var, currently set to 30)
- Runs every 6 hours (configurable via `EMAIL_LEAD_PIPELINE_INTERVAL_HOURS` env var)
- `CRAWL_CONCURRENCY` set to 5 for faster website crawling and contact discovery
- **NoDa Hub Seed**: 420+ businesses seeded via Google Places across NoDa + adjacent neighborhoods (Plaza Midwood, South End, Elizabeth, etc.). 20 search categories including arts-district-specific ones (art galleries, tattoo shops, music venues, yoga studios, boutiques, bakeries, photography studios, event venues, muralists). 15 NoDa-specific area facts added. Hub-specific extra categories defined in `scripts/seed-hub-businesses.ts` via `HUB_EXTRA_CATEGORIES` map.
- Each run: (1) counts Ready-to-Reach businesses (have email, unclaimed, not contacted), (2) if under target, processes pending website crawl queue, (3) if still under target and crawl queue low, auto-triggers Google Places import for venue-likely categories
- Venue categories rotated randomly: restaurants, bars, barbershops, hair salons, nail salons, gyms, coffee shops, bakeries, auto repair, car washes, laundromats, breweries, pizza
- API endpoints: `GET /api/admin/email-lead-pipeline/status` (pipeline health), `POST /api/admin/email-lead-pipeline/boost` (manual trigger)
- Charlotte Report: "Email Lead Pipeline" section with progress bar, color-coded status (red <5, yellow 5-9, green >=10), pending crawls, recent emails found
- Opportunity Radar: Pipeline health bar at top with progress indicator and "Boost Pipeline" button when under target
- Scheduler: `startEmailLeadPipelineScheduler()` registered in `server/routes.ts` alongside other schedulers

**Industry Tagging** (`server/intelligence/classify/industryTagger.ts`):
- Deterministic rules engine assigns industry tags to businesses based on 3 signal sources:
  1. OSM tags: landuse=industrial, craft=*, amenity=*, shop=*, office=* → mapped to specific industry tags
  2. Name keywords: regex patterns match business names to industries (church→RELIGIOUS_NONPROFIT, roofing→ROOFING_CONTRACTOR, etc.)
  3. Schema.org @type: website crawl schema.org types confirm tags (+20 confidence boost)
  4. Land use: INDUSTRIAL land use class adds INDUSTRIAL_CORRIDOR_LOCATION signal
- 20 industry tags: MANUFACTURING, FABRICATION, INDUSTRIAL_SUPPLY, WHOLESALE_DISTRIBUTION, WAREHOUSE_LOGISTICS, CONSTRUCTION_CONTRACTOR, ROOFING_CONTRACTOR, HVAC_CONTRACTOR, PLUMBING_CONTRACTOR, ELECTRICAL_CONTRACTOR, GENERAL_CONTRACTOR, COMMERCIAL_BUILDOUT_SIGNAL, INDUSTRIAL_CORRIDOR_LOCATION, FOOD_SERVICE, RETAIL_STOREFRONT, PROFESSIONAL_SERVICES, HEALTHCARE_MEDICAL, AUTOMOTIVE_SERVICE, BEAUTY_PERSONAL_CARE, RELIGIOUS_NONPROFIT
- Confidence scoring: base confidence per rule (55-85), multi-source agreement adds +10, Schema.org adds +20; minimum threshold `ECON_TAG_MIN_CONFIDENCE` (default 50)
- Table: `entity_asset_tags` (id, metroId, entityId, tag, confidence, evidenceJson, createdAt, updatedAt); unique on (entityId, tag)
- `tagEntityIndustry(entityId)` — single entity, `tagAllEntities(metroId?)` — batch
- Scoring integration: contractors without website get prospect_fit +25 (prime sales targets); contractors with website +10; industrial/wholesale -15; manufacturing -10; consumer-facing +5
- Bucket impact: entities tagged only as industrial/manufacturing with no contact info auto-bucketed as CONTENT_SOURCE_ONLY
- Pipeline integration: step 4.5 (between outreach and scoring); industry tags included in auto-promotion CRM notes
- Admin API: `POST /api/admin/intelligence/industry/run` (manual trigger), `GET /api/admin/intelligence/industry/stats` (tag distribution), `GET /api/admin/intelligence/industry/entities` (filterable entity list with tag/confidence/phone/website/search filters)
- Admin UI: "Industry Tags" tab in intelligence panel with tag distribution cards (grouped by category: Contractors, Industrial, Consumer-Facing, Other), run button, filterable entity table
- Operator UI: industry tag badges on business cards, industry category filter dropdown, "Contractors w/o Website" quick filter button
- Crawl stats endpoint includes `industryTags` object in response

**Sales Bucket Engine** (`server/intelligence/salesBuckets/salesBucketEngine.ts`):
- Pre-computes named sales targets for operators by category so they can tailor each pitch based on what the platform can offer
- 8 deterministic bucket rules (entity can land in multiple buckets simultaneously):
  1. **CONTACT_READY_NO_WEBSITE**: No website + has phone → priority: +40 no website, +25 phone, +15 physical address, +10 storefront/office, +10 unverified. Sell web presence.
  2. **STOREFRONT_WALKIN_READY**: location_type=STOREFRONT + outreach=WALK_IN → priority: +50 storefront, +20 address quality, +15 unverified, +15 contact ready. Visit in person.
  3. **DIGITAL_GAP_HIGH**: No website/degraded + has phone/address + no social → priority: +40 no website, +20 storefront, +20 phone, +10 unverified. Full digital package.
  4. **WEBSITE_DEGRADED**: Crawl attempted + HTTP 404/410/500-599 → priority: +50 degraded, +20 phone, +15 address, +15 unverified. Offer replacement.
  5. **DATA_INCONSISTENT**: Crawl SUCCESS + phone/email mismatch vs listing → priority: +60 inconsistency, +20 storefront, +20 unverified. Data cleanup.
  6. **DEMAND_PRESENT_NOT_VERIFIED**: Views≥25 or total clicks≥10, not verified → priority: min(60, views×1.2) + min(40, clicks×4). Show them their traffic.
  7. **HIGH_ACTIVITY**: Leads started≥5 or leads submitted≥2 → engagement-scaled priority. Hot prospects.
  8. **CONVERSION_GAP**: Website + crawl SUCCESS + no contact form/email/phone on site → priority: +50 gap, +20 engagement, +30 unverified. Missing conversions.
- Tables: `entity_sales_buckets` (entity_id, bucket enum, priority_score 0-100, reasons_json, computed_at); `entity_engagement_30d` (entity_id, 30-day rollups from intelligence_event_log)
- Engagement stats: `entityEngagementStats.ts` aggregates views, clicks, leads from intelligence_event_log over last 30 days
- `computeSalesBuckets(entityId)` — single entity; `computeAllSalesBuckets(metroId?)` — batch full recompute (delete old + insert new)
- Pipeline integration: Step 7 (after auto-promote) — computes engagement stats + sales buckets nightly
- Admin API: `POST .../sales-buckets/recompute` (manual trigger), `GET .../sales-buckets/stats` (bucket distribution + totals), `GET .../sales-buckets/entities` (paginated with bucket/priority/search filters)
- Admin UI: "Sales Buckets" tab in intelligence panel — distribution cards (color-coded, clickable to filter), recompute button, filterable entity list with priority scores and reason badges
- Operator API: `GET /api/operator/sales-pipeline` — territory-scoped entities by bucket, includes business details + contact signals + outreach method + industry tags + reasons_json, top 25 per bucket
- Operator UI: "Sales Pipeline" sidebar section — bucket tabs with counts, entity cards showing name/address/phone/website/priority/reasons/industry tags/outreach method, "Mark Contacted" and "Claim Link" actions
- DEMAND_PRESENT_NOT_VERIFIED and HIGH_ACTIVITY require engagement data in intelligence_event_log — will show 0 results until real engagement flows in

**Env Controls**: `ENABLE_WEBSITE_CRAWL` (default true), `CRAWL_CONCURRENCY` (default 3), `CRAWL_MAX_PAGES` (default 3), `PIPELINE_SCHEDULE_HOUR` (default 2, hour in ET for daily pipeline run), `ECON_TAG_MIN_CONFIDENCE` (default 50, minimum confidence for industry tag persistence)

**Directory/Collector Discovery Engine** (`server/intelligence/directoryProspects/`):
- Identifies directory-like sites and local list/collection operators from existing entities for micro license prospecting
- Tables: `directory_prospects` (root_domain unique, directory_score 0-100, bucket enum, territory/niche/monetization/contact/evidence jsonb, notes, contacted_at, follow_up_at); `directory_site_pages` (url, page_type enum, title, text_excerpt)
- Candidate generation (`generateDirectoryCandidates.ts`): queries businesses with matching categories (Marketing & Advertising, Community Organizations, Events & Weddings, Networking Groups, Guided Tours), name patterns (media, magazine, news, guide, directory, community, tourism, events, blog), CONTENT_SOURCE_ONLY bucket entities with websites, and entities with detected RSS feeds
- Directory crawler (`directoryCrawler.ts`): fetches homepage + up to 4 auto-discovered priority pages (links matching directory/listings/submit/advertise/events/neighborhoods/about/contact patterns). Extracts:
  - Directory signals: keywords ("get listed", "add your business", "directory"), URL patterns, category navigation
  - Niche tags: 11 categories (PETS, FOOD, SENIOR, HOME_SERVICES, MULTIFAMILY, EVENTS, NEIGHBORHOODS, NIGHTLIFE, ARTS_CULTURE, WELLNESS, FAMILY_KIDS) with confidence scores, top 3 stored
  - Territory inference: Charlotte-area cities, neighborhoods, counties, zip codes (28xxx pattern)
  - Monetization signals: sponsor, advertise, media kit, membership, pricing, get listed
  - Contact methods: emails, phones, contact form URLs, social links
- Scoring: +25 get-listed/add-listing/claim, +20 directory/listings pages, +15 monetize signals, +15 territory, +10 niche clarity. Cap 100.
- Buckets: MICRO_LICENSE_TARGET ≥60, PARTNER_TARGET 40-59, IGNORE <40
- Safety: max 5 pages/site, 3s domain delay, concurrency 2, robots.txt respected (7-day cache), 60-day re-crawl interval
- Admin API: `POST .../directory-prospects/generate` (candidate generation), `POST .../directory-prospects/crawl` (batch crawler), `GET .../directory-prospects/stats` (distribution), `GET .../directory-prospects` (paginated list with bucket/status/search/niche filters), `PATCH .../directory-prospects/:id` (update notes/contacted/follow-up/bucket), `POST .../directory-prospects/:id/recrawl` (single re-crawl)
- Admin UI: "Micro Prospects" tab in intelligence panel + sidebar item in Metro Intelligence group. Stats cards, filters (bucket/status/niche/search), prospect cards with domain link, score, niche/monetization/territory badges, contact info, evidence expandable, actions (Mark Contacted, Notes, Follow-up date, Re-crawl, Change Bucket)

**Content Feed Ingestion** (`server/intelligence/connectors/`, `server/feed-scheduler.ts`):
- Automated "invisible collection" — ingests public RSS/Atom + iCal feeds, auto-approves, and surfaces content for front-end rotation
- **Charlotte feeds** seeded in `metro_sources`:
  - RSS content (HOURLY): Scoop Charlotte, Queen City Nerve, Spectrum Local News, WCNC Charlotte, WFAE Charlotte, WSOC-TV, Charlotte Ledger, La Noticia, Hickory Record, Independent Tribune, CLT Today, Queen City News (FOX 46), Charlotte Magazine, Salisbury Post, Lincoln Herald, Shelby Star, Gaston Gazette, Axios Charlotte, Mooresville Tribune, Statesville R&L, McDowell News, Lenoir News-Topic, Anson Record, Taylorsville Times, The Link (Chesterfield SC), Stanly News & Press
  - **Disabled**: Charlotte On The Cheap (deal/coupon content — blocked by DEAL_SOURCE_BLOCKLIST)
  - **Feed content filters** (`server/intelligence/jobRunner.ts`): NEGATIVE_BLOCKLIST (crime/violence), POLITICAL_BLOCKLIST, DEAL_COUPON_BLOCKLIST (Amazon deals, coupon codes, affiliate content), DEAL_SOURCE_BLOCKLIST (Charlotte On The Cheap, Groupon, etc.), LOCAL_KEYWORDS requirement, EVENT_IRRELEVANT_BLOCKLIST
  - RSS podcasts (DAILY): WFAE Charlotte Talks, FAQ City, SouthBound, Work It, Studios, Amplifier, Still Here, Inside Politics
  - iCal events (DAILY): QC Community Connect, Sustain Charlotte, Network Charlotte
- **Auto-approve**: feeds with `params_json.auto_approve = true` bypass manual review — items inserted as `APPROVED` directly
- **Content type tagging**: `params_json.content_type` on metro_sources (news, things-to-do, culture, podcast, event) — used for filtering
- **ICalConnector** (`icalConnector.ts`): parses VEVENT blocks (SUMMARY, DTSTART, DTEND, LOCATION, UID, URL), unfolds lines, computes SHA256 external IDs. Events upsert into `events` table via `handleEventSeedRows` (dedup on seed_source_type + seed_source_external_id)
- **Feed scheduler** (`feed-scheduler.ts`): runs `runAllDue()` every 6 hours, registered at server startup
- **Public endpoints** (no auth):
  - `GET /api/metro/:citySlug/pulses?limit=20&contentType=podcast` — randomized APPROVED rss_items (content rotation), optional content type filter
  - `GET /api/metro/:citySlug/events?limit=20&start=ISO&end=ISO` — upcoming events ordered by start date
- **Admin**: `POST /api/admin/intelligence/run-pulls` (existing) triggers all feeds; `POST /api/admin/intelligence/run-feed-ingestion` triggers `runAllDue()`
- RSS items stored in `rss_items` table, events in `events` table — both existing tables, no new schema needed

**Data Export Protection**: No CSV/download endpoints for operators. All operator list endpoints paginated (max 100). Scoring/verification data is display-only.

## Domain Routing & Email Domains
The app serves multiple custom domains from a single deployment:
- **`citymetrohub.com`** → Platform marketing site (`/citymetrohub` page). Platform-level emails use `@citymetrohub.com`.
- **`cltcityhub.com`** (primary/canonical) → Charlotte Metro Hub. All Charlotte emails send from `hello@cltcityhub.com`. Verified Resend domain.
- **`cltmetrohub.com`** (legacy alias) → Also routes to Charlotte Metro Hub.
- **`charlottemetrohub.com`** (alias) → Also routes to Charlotte Metro Hub.

**How it works**: Express middleware in `server/routes.ts` inspects `x-forwarded-host` / `req.hostname` on every request and sets `res.locals.isMarketingSite`, `res.locals.resolvedCitySlug`, and `res.locals.resolvedDomain`. The domain map is built from the `cities` table (`site_url`, `email_domain` columns) on startup, plus hardcoded aliases. Frontend `App.tsx` checks `window.location.hostname` to redirect `/` to the correct landing page. API: `GET /api/domain-config` returns `{ isMarketingSite, citySlug, domain, hostname }`.

**SEO**: `robots.txt`, `sitemap.xml`, and SEO snapshots all resolve base URLs dynamically per-request hostname. Charlotte content canonical URLs use `https://cltcityhub.com`. Marketing pages use `https://citymetrohub.com`.

**Email rules**: Charlotte operations → `hello@cltcityhub.com`. Platform admin/support → `@citymetrohub.com`. `territory-email.ts` resolves domain from territory → city → platform fallback. The custom domains must be configured in Replit's deployment settings by the project owner.

## Ad Management System
Eight ad slot types: `LEADERBOARD`, `SIDEBAR`, `INLINE`, `CLASSIFIEDS_SPONSOR`, `DIRECTORY_TILE`, `PULSE_NATIVE`, `EVENT_SPONSOR`, `MARKETPLACE_TILE`. All managed via Admin Ad Manager (`client/src/pages/admin/ad-manager.tsx`) with inventory overview, image upload (drag-and-drop or URL), size guidance per slot, content/context area, vertical tag targeting, and page targeting. Components in `client/src/components/ad-banner.tsx`. All slots self-render nothing when no active ads exist.

**Placements**:
- **Leaderboard**: City home, Neighborhood hub
- **Sidebar**: Directory, Articles list, Business detail, Event detail
- **Inline**: Category hub, Article detail, Attractions, Jobs
- **Directory Tile**: Injected every 6th card in directory grid
- **Pulse Native**: Injected every 8th item in Pulse feed
- **Event Sponsor**: Events list, Event detail
- **Marketplace Tile**: Injected every 6th listing in marketplace grid
- **Classifieds Sponsor**: Classifieds listings

**Schema fields**: `description`, `ctaLabel`, `position`, `contentBody` (ad copy), `tags` (text[], vertical targeting: food/music/commerce/senior/pets/family), `targetPages` (text[], page targeting). API supports `?tags=` and `?page=` query param filtering — ads with no targeting show everywhere.

**Recommended sizes**: Leaderboard 728×90, Sidebar 300×250, Inline 728×90, Directory Tile 400×300, Pulse Native 600×450 (4:3), Event Sponsor 600×200, Marketplace Tile 400×300, Classifieds Sponsor 300×250.

Impression/click tracking via `POST /api/cities/:slug/ads/:id/impression|click`.

## Ad Management & Revenue Programs (Programmatic Module)
Comprehensive programmatic ad management alongside the basic Banner Ads system above.

**Schema**: 10 new enums + 5 new tables:
- `revenue_programs` — Program definitions (AD, SPONSORSHIP, PROMOTION, AUTHORITY, GUIDE, WELCOME, MARKETPLACE, JOBS, SOCIAL_SELLING). Billing cycles (ONE_TIME/MONTHLY/QUARTERLY/ANNUAL), price modes (FIXED_PRICE/RANGE_PRICE/CUSTOM_QUOTE).
- `ad_inventory_slots` — Scoped slots (HUB_ONLY/METRO_ONLY/HUB_OR_METRO) with placement types (BANNER/CARD/LIST_ITEM/BADGE/FEATURED_BLOCK/CTA). Max placements and rotation strategies (NONE/ROUND_ROBIN/WEIGHTED/RANDOM).
- `ad_placements` — Business placements linking programs to slots with creative data, date ranges, status lifecycle (DRAFT→PENDING_PAYMENT→ACTIVE→PAUSED→EXPIRED→CANCELED).
- `ad_creatives` — Creative variants per placement.
- `ad_inquiries` — Lead tracking for ad inquiries (NEW→CONTACTED→PROPOSAL_SENT→WON→LOST).

**Enforcement Gate**: On placement activation, if program.requiresExpandedListing is true, verifies business has ACTIVE entitlement with productType=LISTING_TIER and tier=ENHANCED.

**Runtime Query**: `GET /api/placements/active?slotName=X&hubId=Y&categoryId=Z` returns active placements with 4-tier scope priority: hub+category → hub-only → metro+category → metro-only. Respects max placements per slot and rotation strategy.

**Admin Panel**: `client/src/pages/admin/ad-management-panel.tsx` — 4 tabs (Programs, Inventory, Placements, Reporting). Placement wizard: business → program & slot → dates → creative. Sidebar: "Ad Management" with BarChart3 icon under Hub Operations (id="ad-management").

**Seeded Defaults**: 7 programs (Pulse Advertising, Category Sponsorship, Event Promotion, Authority Position, Seasonal Guide, Welcome Program, Social Selling) + 6 inventory slots.

**Backend**: `server/ad-management-routes.ts` — full CRUD with Zod validation on all insert routes. `server/seed-ad-programs.ts` — idempotent startup seed.

## Territory Sales Management
Super admin panel for managing the sale and activation of 74 micro hub territories across 19 counties.

**Schema**: `territories` table extended with sales fields: `pricingTier` (1–7), `territoryPrice` (cents), `population`, `businessCount`, `participationTarget`, `projectedRevenue`, `saleStatus` (AVAILABLE/RESERVED/SOLD/ACTIVE/DELINQUENT), `soldAt`, `soldToOperatorId`, `activationStripeInvoiceId`, `activationPaidAt`, `quarterlyBillingStartDate`, `quarterlyStripeSubscriptionId`, `revenueMinimum`.

**Tier pricing**: T1=$1K, T2=$1.75K, T3=$2.5K, T4=$3.5K, T5=$5K, T6=$7.5K, T7=$10K. Total pipeline: $185,750.

**Billing lifecycle**: One-time activation fee → mark sold → send Stripe invoice or payment link → payment received → 90-day grace period → quarterly subscription begins.

**Admin panel**: `territory-sales-panel.tsx` — three tabs (Territories table grouped by county, Pipeline funnel, Revenue Alerts). Actions: Mark as Sold, Send Invoice, Payment Link (copies to clipboard), Confirm Activation, Set Revenue Minimum.

**API routes** (in `server/licensing-routes.ts`):
- `GET /api/admin/territory-sales` — list with pricing data
- `GET /api/admin/territory-sales/summary` — pipeline stats
- `PATCH /api/admin/territory-sales/:id/mark-sold` — assign operator
- `POST /api/admin/territory-sales/:id/send-invoice` — Stripe invoice
- `POST /api/admin/territory-sales/:id/create-checkout` — Stripe checkout link
- `PATCH /api/admin/territory-sales/:id/confirm-activation` — manual activation
- `PATCH /api/admin/territory-sales/:id/revenue-minimum` — set threshold
- `GET /api/admin/territory-sales/alerts` — underperforming territories

**Webhook**: `server/stripe/webhook.ts` handles `checkout.session.completed` and `invoice.paid` with `type=TERRITORY_ACTIVATION` metadata — auto-activates territory, sets 90-day quarterly billing start, logs revenue transaction.

**Seed**: `server/seed-territory-pricing.ts` — idempotent, populates all 74 territories with pricing from user's spreadsheet. Called from `server/seed.ts` after hub seed.

## Micro Hub Back Office (Operator Dashboard)
Three-level hierarchy: Super Admin → City Hub (Metro) → Micro Hub. The operator dashboard at `/operator/dashboard` is the micro hub operator's back office.

**Hub Switcher**: Multi-hub operators see a dropdown to switch between "All My Hubs" and individual hubs. Single-hub operators see their hub name. Hub selection scopes data in new sections (analytics, business stats, events, articles, ads).

**Sidebar Groups**: Dashboard (Overview, Hub Analytics), Businesses (My Businesses, Business Stats, Prospect Targeting, Sales Pipeline), Content (Events, Pulse Articles), Ads & Revenue (Ad Overview, My Revenue), Field Tools (Communications), Settings (Territory Overview). Metro operators additionally see: My Micro Operators, Places Import.

**New API Endpoints** (`server/operator-auth-routes.ts`):
- `GET /api/operator/hubs` — operator's territories resolved to hub regions with business counts
- `GET /api/operator/hub-business-stats` — tier breakdown, health metrics (unclaimed, no photo, recent), scoped by `?territoryId=`
- `GET /api/operator/events` — upcoming events in operator's hub ZIPs
- `POST /api/operator/events` — create event auto-tagged to operator's hub
- `GET /api/operator/articles` — articles tagged to operator's hub
- `POST /api/operator/articles` — submit article as draft, auto-bound to operator's hub zoneId
- `GET /api/operator/ads` — ad inventory slots and placements for operator's hubs
- `GET /api/operator/analytics` — comprehensive hub stats (businesses, revenue, pipeline, events)

**New UI Sections**: `BusinessStatsSection` (tier cards + health), `HubEventsSection` (list + create), `HubArticlesSection` (list + submit), `HubAdsSection` (slots + placements), `HubAnalyticsSection` (dashboard cards + pipeline progress).

## Platform Slug Naming Rules
All slugs across the platform use meaningful, human-readable names. No hex suffixes, no timestamps, no numeric-only identifiers (unless the number is part of the real name like "510 Expert Tattoo" or a ZIP code).

**Business slugs** (`server/lib/slug-utils.ts` → `generateBusinessSlug()`): Cascade: `{name}` → `{name}-{zoneName}` → `{name}-{zoneName}-{streetName}` → `{name}-{cityName}` → `{name}-{zoneName}-{4-alpha}`. All callers pass `cityName`. No hex, no timestamps.

**Event slugs** (`server/lib/slug-utils.ts` → `generateEventSlug()`): Cascade: `{title}` → `{title}-{month}-{year}` → `{title}-{venueName}` → `{title}-{zoneName}` → `{title}-{4-alpha}` with collision check loop.

**Spotlight article slugs** (`server/charlotte-flows.ts`): Format `meet-{contact}-{business}-{zone}-{town}-spotlight-{4-alpha}`. Alpha-only suffix.

**Hub slugs** (`server/hub-slug-audit.ts`): Cascade: `{name}` → `{name}-{county}` → `{name}-{zip}` → `{name}-{counter}`.

## Hub Slug Audit
Territories now have a `slug` column. Script at `server/hub-slug-audit.ts` audits all MICRO territories and MICRO_HUB zones for valid, unique slugs. Run with `npx tsx server/hub-slug-audit.ts`. Admin endpoint at `GET /api/admin/tools/hubs/ensure-slugs` (supports `?dryRun=true`). Idempotent — safe to run repeatedly.

## Geo-Based Micro Hub Pages
Each of the 74 micro hubs has a public-facing page at `/:citySlug/hub/:hubSlug` (e.g., `/charlotte/hub/uptown-charlotte`). Hub slug resolves territory → region → ZIP coverage → content feed.

**Public API Endpoints**:
- `GET /api/hub/:slug` — hub metadata (region, territory, parent, ZIPs, business count, nearby hubs with slugs)
- `GET /api/hub/:slug/feed` — hub content feed (businesses, events, articles, popular categories) scoped to hub's ZIP codes + add-on coverage

**Geo-Resolve Enhancement**: `/api/zones/geo-resolve` now returns `hubSlug` alongside `hubCode`/`hubName`. Resolved from `territories.slug` where `code` matches the detected hub region.

**Local Hub Banner**: `PublicLayout` shows a dismissible "You're near [Hub Name] — View local hub →" banner when geo-location detects a nearby hub. Suppressed on hub pages, homepage, and after dismiss.

**Operator Content → Feed Pipeline**: Events and articles created via operator back office (`POST /api/operator/events`, `POST /api/operator/articles`) now auto-create content tags via `autoTagContent()`, ensuring operator content appears in the public feed for their hub's geo area.

**Universal Geo-Tagging & Classification Pipeline** (`server/services/geo-tagger.ts`): Every piece of content flows through `geoTagAndClassify()` before publishing. 7-step geo-resolution chain: (1) address/ZIP lookup, (2) text scan for zone names in title/description, (3) SOURCE_NAME_ZONE_MAP (hardcoded RSS source→zone), (4) URL path parsing, (5) LANDMARK_ZONE_MAP (30+ Charlotte landmarks), (6) business entity match (inherit zone from linked business), (7) AI fallback via OpenAI. Also runs topic classification and writes `content_tags`. Wired into ALL content entry points: `jobRunner.ts` (RSS, business, event, job ingestion), `moderation-routes.ts` (user + admin posts), `operator-auth-routes.ts` (operator events/articles), `venue-channel-pulse.ts` (auto-generated posts), `charlotte-public-routes.ts` (Charlotte activation + Crown onboarding), `activate-routes.ts` (business activation form), `routes.ts` (marketplace listings), `shop-routes.ts` (shop items). All calls use fire-and-forget `.catch()` to avoid blocking the request.

**Route**: `/:citySlug/hub/:hubSlug` → `MicroHubPage` component with tabbed view (Businesses, Events, Articles) + nearby hubs.

## Standalone Vertical Landing Pages & Map PWA (Task #95)
City-level vertical landing pages rendered outside PublicLayout (no sidebar/navigation chrome) using `LandingPageShell` component. Each vertical has a marketing-focused landing page at the primary URL and a full-browse experience at a `/browse` sub-path inside PublicLayout.

**Architecture**:
- `LandingPageShell` (`client/src/components/landing-page-shell.tsx`): Lightweight layout with minimal branded header (logo + city name + nav links) and city-aware footer with ecosystem cross-links. Provides cosmic dark background. Used instead of PublicLayout for landing pages.
- Existing `VerticalLanding` component (`client/src/pages/vertical-landing.tsx`) supports `bare` prop to skip its internal `DarkPageShell` wrapper when nested inside `LandingPageShell`.

**Route Pattern** (primary → landing, browse → listings):
- `/:citySlug/events` → `EventsLanding` (standalone landing page)
- `/:citySlug/events/browse` → `EventsList` (full listing in PublicLayout)
- `/:citySlug/jobs` → `JobsLanding` (standalone)
- `/:citySlug/jobs/browse` → `JobsList` (PublicLayout)
- `/:citySlug/marketplace` → `MarketplaceLanding` (standalone)
- `/:citySlug/marketplace/browse` → `Marketplace` (PublicLayout)
- `/:citySlug/map` → `UnifiedMap` (PublicLayout, full-viewport with neighborhood overlays)
- `/:citySlug/map/landing` → `MapLanding` (LandingPageShell)
- `/:citySlug/food|family|arts-entertainment|senior|pets|commerce` → `VerticalLanding` in `LandingPageShell` (bare mode)
- `/:citySlug/moving-to-charlotte` → `MovingToCharlotte` in `LandingPageShell` (standalone)

**Neighborhood × Vertical Pages** (`client/src/pages/neighborhood-vertical.tsx`):
- Routes: `/:citySlug/neighborhoods/:code/events|jobs|food|family|marketplace`
- Each filters content by hub/zone code for hyper-local SEO
- Includes breadcrumbs, JSON-LD BreadcrumbList, cross-links to other verticals in same neighborhood
- Rendered inside PublicLayout (not standalone)

**Map PWA Optimization**:
- `client/public/manifest-map.json`: Separate PWA manifest for map experience (emerald theme, standalone display)
- `MapLanding` swaps manifest link tag on mount for map-specific install experience
- `AddToHomescreenBanner` (`client/src/components/add-to-homescreen.tsx`): Mobile-only "Add to Home Screen" prompt for repeat map visitors

**SEO/AEO**: All landing pages include unique title/description/keywords, Open Graph tags, canonical URLs, and JSON-LD (`CollectionPage` or `WebApplication` for map). Neighborhood vertical pages include `BreadcrumbList` JSON-LD.

**Landing Page Components**: `client/src/pages/events-landing.tsx`, `jobs-landing.tsx`, `marketplace-landing.tsx`, `map-landing.tsx`

## Listing Add-Ons System
Multi-location, multi-hub visibility, service-area coverage, and metro-wide coverage add-ons. Extends the existing listing subscription system.

**Tables**: `business_locations` (multi-location support, max 5 self-serve), `listing_addon_subscriptions` (tracks paid add-on subscriptions), `enterprise_inquiries` (for franchise/enterprise requests when >5 locations).

**Coverage via `presence_coverage`**: HUB type = hub visibility add-on; ZONE type = service area hub; REGION type = metro-wide. `isAddon=true` flag distinguishes paid coverage from organic.

**Pricing**: PHYSICAL_LOCATION=$99/yr, EXTRA_HUB_VISIBILITY=$50/yr, SERVICE_AREA_HUB=$50/yr, METRO_WIDE=$2500/yr. Max 5 self-serve locations → auto-creates enterprise inquiry.

**Hub visibility query**: Hub neighborhood + category hub endpoints include businesses from: (1) ZIP match, (2) `business_locations` with matching hubId, (3) `presence_coverage` HUB/ZONE type with targetId=hub.id, (4) REGION type for metro-wide. `allCityBiz` for popular/related categories uses only ZIP-matched businesses (not addon-extended set).

**API routes** (`server/listing-addon-routes.ts`): Admin CRUD for locations, coverage, subscriptions, enterprise inquiries. Owner-facing: coverage-summary, request-addon. Reporting endpoint for dashboard stats.

**Admin panel** (`client/src/pages/admin/listing-addons-panel.tsx`): Business search, manage locations/coverage/subscriptions, enterprise inquiries with status workflow, reporting tab. Sidebar item "Listing Add-Ons" under Tools & Settings.

**Owner dashboard** (`client/src/pages/owner-dashboard.tsx`): `LocationsAndAddonsSection` — locations list (X/5), add location form, hub visibility badges, metro-wide status, active subscription list, upgrade CTAs.

## Admin Fixes & Enhancements (Session 2026-03-07)

### Coming Soon Guard — Admin Bypass
`ComingSoonGuard` now only wraps Marketplace and Live Video routes. All other public pages use `OpenCityRoute` (no guard). Anonymous users see content with ScrollWall limits. Admins bypass ComingSoonGuard on remaining gated routes because `/api/auth/me` detects admin-only sessions and returns `{ isAdmin: true, ... }`.

### Admin Search (Cmd+K) — RSS Items
The admin search endpoint (`GET /api/admin/search?q=term`) now queries `rss_items` alongside businesses, contacts, events, and articles. Results include title, source name, and review status. Frontend renders RSS results with Rss icon, clicking navigates to the Moderation panel.

### Media Library Seed
`scripts/seed-media-library.ts` registers ~109 existing image files into the `cms_assets` table: CLT brand logos (from attached_assets/), vertical category icons, stock category images (from client/public/assets/stock_images/), and county images (from client/public/images/counties/). Files are copied to `uploads/cms-assets/`. Idempotent — skips if any assets already exist.

### Data Counts (Approximate — may be stale)
- RSS Items: ~900+ from 48+ sources (counts grow as RSS feeds sync)
- Events: ~1,100+ from 3 event sources + seed data
- Businesses: ~130+ from hub seed scripts
- Media Library: ~109 registered assets
- These are approximate dev environment snapshots. Production counts vary based on which seed scripts and sync jobs have run.

## Ordering / Delivery Platform Support
Businesses can now have ordering platform links and a menu URL. These display as clickable action buttons on both the business detail page and microsite (Hub Presence) pages.

**Schema Fields** (on `businesses` table):
- `orderingLinks` — JSON (`Record<string, string>`) storing platform → URL pairs. Keys: `doordash`, `ubereats`, `postmates`, `grubhub`
- `menuUrl` — text field for a direct menu link

**Admin Edit**: Business edit dialog has a new "Ordering / Delivery Links" section with individual inputs for DoorDash, Uber Eats, Postmates, Grubhub URLs, plus a Menu URL field.

**Click Tracking**: Every action button on business pages is tracked:
- `CLICK_CALL` / `CALL_CLICK` — phone tap (uses `tel:` link, opens native dialer)
- `CLICK_WEBSITE` / `WEBSITE_CLICK` — website link
- `CLICK_DIRECTIONS` / `DIRECTIONS_CLICK` — Google Maps
- `CLICK_BOOKING` / `BOOKING_CLICK` — reservation link
- `CLICK_ORDER` / `ORDER_CLICK` — delivery platform (metadata includes `platform` name)
- `CLICK_MENU` / `MENU_CLICK` — menu link
- `CLICK_RIDE` / `RIDE_CLICK` — ride-hailing platform (metadata includes `platform`: uber/lyft)
- Events fire to both `lead_events` table (via `trackLeadEvent`) and `intelligence_event_log` table (via `trackIntelligenceEvent`)

**Review Source Types**: `reviewSourceTypeEnum` now includes `doordash`, `ubereats`, `grubhub` alongside `google`, `yelp`, `facebook`, `other` — enabling review aggregation from delivery platforms.

## Platform Affiliates & Ride-Hailing Integration

**Schema**: `platform_affiliates` table (platform PK, affiliateId text, enabled boolean, updatedAt). Pre-seeded with: uber, lyft, doordash, ubereats, grubhub, postmates.

**Admin Panel**: "Platform Affiliates" section under Tools & Settings in admin sidebar (`client/src/pages/admin/platform-affiliates-panel.tsx`). Cards for each platform grouped by type (Ride-Hailing vs Food Delivery). Each card has: affiliate ID input, enable/disable toggle, save button, signup link to affiliate program. API routes: `GET/PATCH /api/admin/platform-affiliates/:platform`, public `GET /api/platform-affiliates`.

**Affiliate Link Builder** (`client/src/lib/affiliate-links.ts`):
- `buildUberRideLink(lat, lng, name, affiliateId?)` → Uber deep link with `client_id` param
- `buildLyftRideLink(lat, lng, affiliateId?)` → Lyft deep link with `partner` param
- `wrapAffiliateLink(platform, rawUrl, affiliateId?)` → Appends `utm_source`/`utm_medium`/`utm_campaign` to delivery platform URLs
- `getAffiliateId(configs, platform)` → Helper to extract ID from config array
- Hook: `usePlatformAffiliates()` (`client/src/hooks/use-platform-affiliates.ts`) — cached react-query hook for public config

**Ride Buttons on Event Pages**: Every event with an address shows Uber/Lyft ride buttons in the Event Details sidebar card. Uses event lat/lng coordinates for deep link destination. Click tracking: RIDE_CLICK with platform metadata.

**Ride Buttons on Business Pages**: Business detail pages show "Get a Ride" section with Uber/Lyft buttons only for ride-worthy categories: restaurant-dining, fine-dining, casual-dining, fast-casual, bars-breweries, coffee-tea, music-nightlife, entertainment-recreation, arts-culture, sports-athletics, family-fun, parks-outdoors, retail-shopping-cat, clothing-apparel, grocery-market, furniture-home-decor — or any business with a reservationUrl. Uses business lat/lng for destination.

**Ride Buttons on Microsites**: Contact block shows Uber/Lyft buttons when business has latitude/longitude. Block renderer passes coordinates through context.

**Affiliate Wrapping on Ordering Links**: DoorDash/Uber Eats/Grubhub ordering links are automatically wrapped with affiliate tracking params when admin has configured an affiliate ID for that platform.

**Files**: `shared/schema.ts` (schema), `client/src/pages/business-detail.tsx` (public page), `client/src/components/microsite/contact-block.tsx` (microsite), `client/src/components/microsite/block-renderer.tsx` (context), `client/src/pages/event-detail.tsx` (events), `client/src/pages/admin/platform-affiliates-panel.tsx` (admin), `client/src/pages/admin/dashboard.tsx` (admin routing), `client/src/pages/admin/admin-sidebar.tsx` (sidebar nav), `client/src/lib/affiliate-links.ts` (utility), `client/src/hooks/use-platform-affiliates.ts` (hook), `client/src/lib/lead-tracking.ts` (tracking types), `client/src/pages/microsite.tsx` (coordinates passthrough).

## Logo Assets
- **Primary logo** (transparent, for app use): `attached_assets/CLT_Charlotte_Skyline_Transparent_1772937096782.png` — imported in `client/src/lib/logos.ts` as `mainLogo`
- **Banner logo** (full background, for emails/banners): `attached_assets/CLT_Skyline_Logo_1772937096781.png` — imported as `skylineBanner`
- **Public email logo**: Copied to `client/public/icons/clt-logo.png` for use in HTML emails
- **Old logo** (`Charlotte_CLT_Logo_wiih_Skyline_1771792717615.png`) was the wrong "catch app" logo — replaced everywhere

## Tell Your Story Page (`/:citySlug/tell-your-story`)
- **Single entry point for all community contributions**: Share your story (default), submit an event (`?intent=event`), give a shout-out (`?intent=shout-out`), nominate someone's story (`?intent=nominate`). Charlotte detects intent from query params or asks naturally.
- **Two modes**: Standard (default) and Recognition First (`?mode=recognition`). Recognition mode is for outreach where we've already noticed the business.
- **Editorial framing**: Charlotte is the "Neighborhood Story Editor" — no AI/chatbot language anywhere. Positioned as editorial outreach, not technology.
- **Basics first**: Collects first AND last name, business name, business type, email, website/social, phone, location, and role/title before moving into story questions. `business_contact_details` module tracks when contact details are collected.
- **Intent-specific modules**: `event_submission`, `shout_out`, `story_nomination` modules have `priority: "intent_only"` — excluded from default story flow, only used when matching intent is active. System prompt includes intent-specific question sequences.
- **Dynamic story questions**: Uses 28 `CONVERSATION_MODULES` system (24 story + 4 intent/contact) that rotates questions based on persona/context. No two interviews are the same. Captures buying/qualification signals naturally.
- **Progress**: Shows "Getting Started" during basics, "Story Interview" during story, "Almost There" when depth score >= 70.
- **Stalling fix**: maxRounds=5 in chat loop. Empty-response fallback rebuilds fresh system prompt with "MUST continue" instruction. max_tokens=1000 for flow-mode completions (prevents tool-call argument truncation). JSON.parse of tool args wrapped in try/catch with graceful recovery.
- **Article generation threshold**: `flowComplete` triggers at depth score >= 60 (was 80). `getConversationCompleteness` returns `ready: true` at score >= 60 with minimum 3 core modules. System prompt mandates `save_conversation_data` after EVERY user message (not just "meaningful" ones).
- **Generate My Story button**: Appears in chat UI when `completeness.ready` OR 5+ user messages sent. Sends `[GENERATE_MY_STORY]` special message. Backend force-generates via `generateSpotlightArticle` bypassing AI loop. Graceful error recovery — no dead-end spinner state.
- **SEO-friendly article slugs**: Format is `meet-{contactName}-{businessName}-{zoneName}-{townName}-spotlight-{4char}` — all lowercase words, no timestamps. Zone name (neighborhood) and town/city name both pulled from business record. Deduplicates if zone and town are the same (e.g. Concord zone = Concord city → only appears once). Falls back gracefully if fields are missing. Slug capped at 120 chars + suffix.
- **Inbox notification on article generation**: Creates `spotlight_article_generated` inbox item (type in `inboxItemTypeEnum`). Priority `high` if flagged for review, `low` if auto-published. Includes "View Article" and "Admin Articles" action links. Summary includes contact name, business, zone, word count, and publish status.
- **Repeated questions fix**: Explicit "DO NOT REVISIT THESE TOPICS" block in system prompt listing completed modules.
- **Fallback form**: "Switch to form" shows `StoryFormFallback`. "Back to conversation with Charlotte" button returns to AI chat without losing messages.
- **Photo upload**: ImagePlus button next to chat input lets users upload photos (logo, space, team) anytime during interview. Uses public `/api/upload` endpoint. Photos saved to flow session via `POST /api/charlotte-public/flow/photos` (stored in `responses.photo_uploads`). Charlotte naturally asks about photos once 3+ modules are completed. Uploaded photo thumbnails shown above input using thumb variant for fast loading.
- **Image processing**: All uploaded images are automatically processed by Sharp (`server/lib/image-processing.ts`) into 4 responsive WebP variants: hero (1600x900), card (800x450), square (600x600), thumb (300x300). Original preserved. Upload limit is 25MB across all endpoints. Variants stored in `uploads/processed/`. Upload response includes `{ url, variants: { original, hero, card, square, thumb } }`.
- **Production resilience**: SSE streaming uses proper buffer-based line splitting. All catch blocks log errors (no silent swallowing). Content-type detection handles both SSE and JSON responses. Input/send button NOT gated on flowSessionId — conversation works with fallback greeting even if session init fails.
- **Story invite email**: Sent from "Charlotte at City Metro Hub <hello@cltcityhub.com>". Subject: "We'd Love to Feature Your Story". Warm editorial copy, no AI language. Bilingual (English + Spanish). Charlotte signs as "Neighborhood Story Editor, City Metro Hub".

### Media Library Enhancements
- **`cms_assets` table** extended with: `creditName`, `creditUrl`, `licenseType` (owned/licensed/creative_commons/stock/user_submitted), `linkedBusinessId` (FK→businesses), `linkedCreatorId`, `categoryIds` (text[]), `zoneId`, `hubSlug`, `tags` (text[]), `status` (approved default).
- **Upload flow**: File picker opens metadata dialog with credit/attribution, license type, business search picker, creator ID, hub/zone selectors, category toggles, freeform tag chips — all sent as multipart form data.
- **Edit flow**: Same fields editable in edit dialog. Business search uses `/api/admin/businesses?search=&limit=8`.
- **Filtering**: Filter bar supports file type, license type, hub. API supports additional filters: linkedBusinessId, linkedCreatorId, tag, categoryId, status.
- **Asset cards**: Show credit name ("by ..."), license badge, tag chips (max 3 + overflow count).

### Charlotte Relocation SEO Cluster
- **Pillar page**: `/:citySlug/moving-to-charlotte` — comprehensive relocation guide with FAQ JSON-LD, dynamic Pulse/events sections, neighborhood links, SEO keywords. File: `client/src/pages/moving-to-charlotte.tsx`.
- **5 supporting articles** (all in `client/src/pages/relocation-articles.tsx`):
  - `/:citySlug/relocating-to-charlotte`
  - `/:citySlug/cost-of-living-in-charlotte`
  - `/:citySlug/best-neighborhoods-in-charlotte`
  - `/:citySlug/living-in-charlotte-nc`
  - `/:citySlug/charlotte-nc-neighborhood-guide`
- **8 neighborhood "living in" pages** (all in `client/src/pages/relocation-neighborhoods.tsx`):
  - `/:citySlug/living-in-south-end-charlotte` (hub: southend)
  - `/:citySlug/living-in-noda-charlotte` (hub: noda)
  - `/:citySlug/living-in-plaza-midwood` (hub: plazamidwood)
  - `/:citySlug/living-in-dilworth-charlotte` (hub: dilworth)
  - `/:citySlug/living-in-ballantyne` (hub: ballantyne)
  - `/:citySlug/living-in-matthews-nc` (hub: matthews)
  - `/:citySlug/living-in-huntersville-nc` (hub: huntersville)
  - `/:citySlug/living-in-cornelius-nc` (hub: cornelius)
- **Shared components**: `relocation-article-layout.tsx` (article wrapper with FAQ JSON-LD, breadcrumb, neighborhood nav), `living-in-neighborhood.tsx` (neighborhood page template with dynamic businesses/events from hub APIs).
- **Routing**: `/:citySlug/relocation` redirects to `/:citySlug/moving-to-charlotte` via `RelocationRedirect` component.
- **Domain**: `charlottemovingguide.com` added to `CHARLOTTE_DOMAIN_ALIASES` and `RELOCATION_DOMAINS` in `server/routes.ts`. Root path redirects to `/charlotte/moving-to-charlotte`. Domain config API returns `redirectPath` for client-side routing.
- **SEO**: Every page has Article + FAQPage JSON-LD, unique meta title/description/keywords, canonical URL, Open Graph tags. Internal cross-linking between all pages and back to pillar.

## Neighborhood Discovery Map (Phase 1)
- **Interactive Leaflet map** on relocation page (`/:citySlug/relocation`) with CartoDB dark tiles, plotting all hub-type regions with coordinates.
- **Reusable component**: `client/src/components/neighborhood-map.tsx` (`<NeighborhoodMap />`) accepts `hubs`, `citySlug` props. Can be embedded on other pages later.
- **Lifestyle tags**: `regions.lifestyle_tags` text[] column stores tags per hub (urban-living, family-friendly, walkable, nightlife, suburban, waterfront, arts-creative). Seeded for Charlotte hubs.
- **Filter buttons**: 7 lifestyle filters above map highlight/filter matching pins. Click pin → popup with name, description, lifestyle tag badges, "Explore This Neighborhood" link.
- **Compare Neighborhoods**: Section below map with side-by-side cards (housing type, lifestyle, popular with) for 8 key neighborhoods.
- **Dark theme redesign**: Entire relocation page wrapped in `DarkPageShell`. All sections (hero stats, Why Charlotte, Area Guide by County, Essential Resources) restyled to dark theme matching community hub/city overview.
- **Leaflet CSS overrides**: Custom dark theme for zoom controls, attribution, popups in `client/src/index.css`.
- **Packages**: `leaflet`, `react-leaflet`, `@types/leaflet`.

## Crown Program (Community Awards System)
- **Backend**: `server/crown-routes.ts` — admin CRUD for categories/participants/votes/winners + public voting + invitation acceptance + Stripe checkout + candidate discovery engine
- **Admin UI**: `client/src/pages/admin/crown-admin.tsx` — tabs for Overview, Categories, Participants, Votes, Winners. Sidebar nav under Hub Operations with sub-items.
- **Public Pages**: `client/src/pages/crown-program.tsx` — 6 pages: Overview (`/:citySlug/crown`), Voting, Winners, Rules, Invitation (`:token`), Onboarding (payment)
- **Schema**: `shared/schema.ts` — tables: `crown_categories`, `crown_participants`, `crown_votes`, `crown_winners`, `crown_vote_flags`, `crown_hub_category_assignments`, `crown_invitations`, `crown_events`, `crown_parent_profiles`, `crown_child_locations`, `crown_hub_activations`, `crown_hub_config`. Enums: `crown_participant_type`, `crown_participant_status`, `crown_competition_level`, `crown_hub_status`.
- **Participant Types**: business, creator, networking_group, community_org
- **Status Flow**: candidate → invited → accepted → verified_participant → nominee → qualified_nominee → crown_winner
- **Vote Thresholds**: high=75, mid=40, community=25 (per `competition_level` on category)
- **Fraud Detection**: IP-based (max 3 votes/IP/category/24h), fingerprint-based, user cooldown (24h per category). `crown_vote_flags` table for flagged vote moderation with resolution workflow.
- **Payment**: Crown checkout reuses existing Stripe LISTING_TIER ENHANCED pricing. Marks participant as verified upon payment.
- **12 Launch Categories**: Best Coffee, Best Restaurant, Best Brewery, Best Food Truck, Best Realtor, Best Insurance Advisor, Best Mortgage Broker, Best Date Night Spot, Best Local Creator, Best Podcast, Best Networking Group, Best Community Connector
- **Multi-Location Support**: `crown_parent_profiles` (org name/type/total locations/franchise flag) + `crown_child_locations` (per-location with activity score, event attendance, hub assignment)
- **Hub Category Assignments**: `crown_hub_category_assignments` links categories to geographic hubs per season
- **Crown Events**: `crown_events` table for meetups/events tied to categories/participants/hubs with recurring support
- **Invitation System**: `crown_invitations` with invite tokens, expiry, accept/decline tracking
- **Tables init**: Raw SQL via `ensureCrownTables()` in crown-routes.ts (same pattern as community-engagement-routes.ts)
- **Candidate Discovery Engine**: `GET /api/admin/crown/discover?hubId=X&cityId=Y[&categorySlug=Z&radiusMiles=N]` — scores businesses using Crown Candidate Score = (Reputation×0.40 + Audience×0.25 + Activity×0.15 + PlatformReadiness×0.20). 16 category keyword maps, per-category viability minimums, hub relevance via lat/lng + region assignment + zone match + service area. Hard filters (rating>=4.0, reviews>=15, plus audience/review/community thresholds). Three tiers: ANCHOR(>=70)/STRONG(45-69)/EMERGING(<45). Marketing flags: ready_for_claim_invite, ready_for_voting_campaign, ready_for_venue_tv, ready_for_creator_feature, ready_for_winner_spotlight. Hub readiness check: >=3 categories READY + >=15 qualified businesses. `GET /api/admin/crown/discover/hubs?cityId=Y` scans all hubs.
- **Hub Readiness & Activation Engine**:
  - `crown_hub_activations` table: tracks per-hub per-season lifecycle state, scan results, activated categories, timestamps
  - `crown_hub_config` table: configurable thresholds per city/season (minCategoriesForLaunch, minQualifiedBusinesses, defaultCategoryMinimum, scanRadiusMiles, per-category overrides)
  - **Lifecycle**: INACTIVE → SCANNING → READY_FOR_ACTIVATION → NOMINATIONS_OPEN → VOTING_OPEN → WINNERS_DECLARED → ARCHIVED
  - **Routes**: `GET /api/admin/crown/hubs?cityId=X` (list hubs with status), `POST /api/admin/crown/hubs/:hubId/scan` (evaluate readiness), `POST /api/admin/crown/hubs/:hubId/activate` (create categories + register candidates + move to NOMINATIONS_OPEN), `PATCH /api/admin/crown/hubs/:hubId/status` (transition lifecycle), `GET /api/admin/crown/hubs/:hubId/readiness` (detailed readiness data), `GET/PATCH /api/admin/crown/config` (threshold config)
  - **Opportunity Radar**: Scan creates `CROWN_HUB_READY` signal in `pulse_signals` when hub meets activation conditions. Appears in Opportunity Radar with "Activate Crown Program for this hub" action.
  - **Admin UI**: Hub Readiness tab in Crown Admin — hub cards with status badges, scan button, activate button, lifecycle progression buttons, scan results panel with category breakdown, configurable thresholds panel

## Profile Types & Participation Roles (Task #64)
- **Column**: `public_users.profile_types text[] DEFAULT '{resident}'` — stores which participation roles a user has selected.
- **Valid types**: `resident`, `business`, `creator`, `expert`, `employer`, `organization`. Users can have multiple.
- **Module visibility**: `PROFILE_TYPE_MODULES` in `server/access-config.ts` maps each profile type to its relevant dashboard modules. `getVisibleModulesForProfileTypes()` computes the union across all active types.
- **AccessContext**: Extended with `profileTypes: ProfileType[]`. `buildAccessContext()` in `server/entitlements.ts` accepts and validates profileTypes.
- **API endpoints**: `PUT /api/auth/profile-types` (update), `GET /api/auth/visible-modules` (returns visible modules for current user).
- **Frontend**: `ProfileTypeSelector` component in `subscriber-profile.tsx` Settings tab. Multi-select toggle grid with icons, descriptions, and save button.
- **Defaults**: All existing users default to `["resident"]`. Business owners (users who claimed businesses) are backfilled with `["resident", "business"]`.
- **Admin users**: Get all profile types automatically.

## Admin Roles & Separation
- **user_role enum**: `PLATFORM_ADMIN`, `SUPER_ADMIN`, `CITY_ADMIN`, `ZONE_ADMIN`
- **PLATFORM_ADMIN / SUPER_ADMIN**: Platform-level access. Can manage all cities, territories, operators, licensing, revenue/payouts, audit log. `isPlatformAdminRole()` helper checks for both.
- **CITY_ADMIN**: Metro-level access scoped to their assigned `cityId`. Can manage content, events, CRM, listings, etc. for their city only.
- **ZONE_ADMIN**: Zone-level access.
- **requirePlatformAdmin** middleware in `server/routes.ts`: async middleware that checks user role before allowing access to platform-level routes.
- **Platform-guarded routes**: Hub management, city CRUD (`POST/PATCH /api/admin/cities`), territories, operators, licensing, revenue/payouts, audit log.
- **Metro-guarded routes**: Content management, events, CRM, listings, media — use `requireAdmin` middleware.
- **Admin sidebar scope tags**: Each sidebar group has `scope: "platform" | "metro" | "both"`. Platform-scoped groups only show for PLATFORM_ADMIN/SUPER_ADMIN.
- **Launch New City workflow**: `POST /api/admin/cities` supports: city basics, initial ZIP zones, content feeds (RSS/ICAL), CITY_ADMIN user creation/assignment. Returns `launchLog` array with provisioning steps.
- **Dynamic city context**: Admin panels use `useAdminCitySelection()` hook instead of hardcoded Charlotte slug. Fallback to first available city when selection not initialized.

## Unified Message Center (Task #72)
- **Backend**: `server/message-center-routes.ts` — raw SQL tables `platform_messages` and `platform_message_templates` with pg enums (`platform_msg_engine`, `platform_msg_channel`, `platform_msg_status`, `platform_tpl_status`).
- **recordPlatformMessage()**: Exported helper to log any message from any engine. Called from email campaign send (email-routes.ts) and SMS send (routes.ts).
- **Routes**: `GET /api/admin/message-center/messages` (filterable by engine/channel/status/search, paginated), `GET /api/admin/message-center/stats`, template CRUD (`GET/POST/PATCH/DELETE /api/admin/message-center/templates`).
- **City Authorization**: All routes use `getAuthorizedCityId()` pattern — CITY_ADMIN users only see their city's data, PLATFORM_ADMIN/SUPER_ADMIN see all.
- **Enum Validation**: Zod enums for engineTag and channel on template create/update (rejects invalid values with 400).
- **Admin UI**: `client/src/pages/admin/message-center-panel.tsx` — 7 tabs: All Messages (filtered table with stats cards), Templates (CRUD cards), Email Templates, Campaigns, SMS, Digest, Suppression. Existing panels embedded as sub-tabs.
- **Sidebar**: "Message Center" entry under CRM group (replaced "Communications"). Dashboard case: `message-center` renders `<MessageCenterPanel cityId={selectedCityId} />`.
- **Engines**: crown, outreach, events, digest, crm, general, sms, venue_tv, pulse.
- **Channels**: email, sms, pulse_draft, venue_tv, print, in_app.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Stripe**: Payment processing, billing, webhooks.
- **Resend**: Email communication.
- **Google Places API**: Autocomplete and business details.
- **OpenAI**: All AI features via direct API (`OPENAI_API_KEY` secret, shared client at `server/lib/openai.ts`). Used for: TTS narration, AI Admin Assistant, CMS content composer, SEO generator, email drafter, public AI chat, content moderation, auto-translation, intelligence reports, business activation AI, capture analysis, image generation.
- **Twilio**: SMS integration (activation verification, territory-aware SMS via `server/services/territory-sms.ts`).
- **Leaflet**: Interactive maps for neighborhood discovery (CartoDB dark tiles, no API key needed) and event map view (OpenStreetMap tiles).

## Event Discovery Layer
Public event browsing with rich filtering and time-scoped views. Routes in `server/event-discovery-routes.ts`, registered via `registerEventDiscoveryRoutes()`.
- **Discover endpoint**: `GET /api/cities/:citySlug/events/discover` — paginated, filterable by zone, category, search, date range, cost (free/paid), sort (soonest/trending/recently_added).
- **Tonight/Weekend**: `GET /api/cities/:citySlug/events/tonight` and `/events/weekend` — time-scoped event lists.
- **Calendar**: `GET /api/cities/:citySlug/events/calendar?month=&year=` — events grouped by day for month view.
- **Category**: `GET /api/cities/:citySlug/events/category/:slug` — events filtered by category with category metadata.
- **Map**: `GET /api/cities/:citySlug/events/map` — events with lat/lng for Leaflet map pins.
- **Event Collections**: `GET /api/cities/:citySlug/event-collections` — admin-curated collections (schema: `event_collections`, `event_collection_items`). Admin CRUD at `/api/admin/event-collections`. Admin UI: "Event Collections" panel under Content & Listings in admin sidebar — create/delete collections, toggle active/inactive, add/remove events from collections via search.
- **Frontend pages**: `events-tonight.tsx` (with RSVP quick links per event), `events-weekend.tsx`, `events-category.tsx`, `events-map.tsx` (Leaflet with auto-fit bounds via useMap hook). `events-list.tsx` uses `/events/discover` endpoint with server-side pagination, date range filters, cost/sort/zone/category filters, and collections display.
- **Recurring events**: Calendar endpoint expands `recurring_rule` (weekly/biweekly/daily/monthly) into per-day occurrences within the requested month.
- **Privacy**: Business events endpoint and collections endpoint enforce `visibility='public'` filtering.
- **DB indexes**: `idx_events_city_start` (city_id, start_date_time), `idx_events_zone` (zone_id), `idx_events_category_ids` (GIN on category_ids) on events table.

## Search Foundation
- **Quick Search** (`GET /api/cities/:citySlug/quick-search`): Returns grouped results across 6 types: businesses, events, articles, jobs, attractions, marketplace listings. Location-intent extraction parses zone/neighborhood names from query and applies geographic filters. Category-name matching matches businesses by category name (not just business name). Creator-type businesses show with "Creator" label and route to creator profile.
- **Directory Search** (`GET /api/cities/:citySlug/directory-search`): Multi-type search for directory page — returns events, articles, jobs, attractions, marketplace results when text query present. Shown in collapsible sections below business results.
- **Bilingual Search**: All text search includes Spanish fields (descriptionEs, titleEs, excerptEs, etc.) via ILIKE matching.
- **Location Intent**: `extractLocationIntent()` in routes.ts parses zone names from search queries (e.g., "coffee NoDa" → text:"coffee" + zone:"noda"). Applied to quick-search, directory-search, and businesses endpoint.
- **Category-Name Matching**: Business text search matches against category names using subquery on categories table, including child categories.
- **Relevance Ordering**: Text search results sorted by exact-match-first (name equals → starts with → contains), then by priority/tier score.
- **No Charlotte hardcoding**: Search scoping flows from URL city context. Default city fallback in search-suggestions changed from "Charlotte" to "your city".

## 29. Platform Pricing & Metro Launch System

### Platform Products (Centralized Stripe Pricing)
- **Table**: `platform_products` — source of truth for all Stripe product/price IDs
- **Fields**: `product_key` (unique lookup key), `category` (listing/hub/addon/capability/crown/contributor/promo), `billing_type` (one_time/monthly/annual), `stripe_product_id`, `stripe_price_id`, `price_version`, `active`
- **Resolver**: `server/stripe/platformPricing.ts` — `getPlatformPrice({ productKey })` checks DB first, falls back to env var map (`priceMap.ts`)
- **Test endpoint**: `GET /api/test/platform-price?product=LISTING_ENHANCED`

### Metro Launch System (Cora's Domain)
- **Architecture**: Cora = platform-level AI managing multi-city network. Charlotte = city-level AI for local ops.
- **Tables**: `metro_projects` (lifecycle tracker with nullable `city_id` FK to cities — populated when city is provisioned, `template_id` FK to metro_templates), `metro_launch_projects` (checklist and notes per launch), `metro_templates` (reusable config templates with `includes_config_json`, unique name), `metro_launch_checklist` (per-metro checklist items with pending/complete/blocked status)
- **Status enum**: idea → planned → coming_soon → building → soft_open → active (+ `paused` from any state)
- **Mode helper**: `getMetroMode(status)` returns `"live"` for active/soft_open, else `"coming_soon"`
- **Metro Clone Service**: `server/metro/metroCloneService.ts` — `createMetroFromTemplate()` creates metro project + city + launch project + 9 default checklist items + coming_soon config in transaction. `updateMetroStatus()` enforces `confirmLive` guard for soft_open/active transitions. `updateChecklistItem()` for checklist management.
- **Default Checklist Items**: hub_structure, categories_verified, pricing_assigned, ai_persona_configured, outreach_templates, coming_soon_live, test_listings, content_pipeline, admin_access
- **Coming Soon Generator**: `server/metro/comingSoon.ts` — `createComingSoonPage({ metroName, slug })` generates config stored in `metro_projects.coming_soon_config`
- **API Routes**: `server/metro/routes.ts` — registered via `registerMetroRoutes(app, requireAdmin)` in `server/routes.ts`
  - `GET /api/admin/metro-templates` — list templates
  - `GET /api/admin/metros` — list metros with mode/city/checklist progress
  - `POST /api/admin/metros/create-from-template` — clone metro from template
  - `PATCH /api/admin/metros/:id/status` — update status (confirmLive guard)
  - `GET /api/admin/metros/:id/checklist` — get checklist with progress
  - `PATCH /api/admin/metros/:id/checklist/:itemId` — update checklist item (cross-metro guard)
- **Admin Panel**: `client/src/pages/admin/metro-management-panel.tsx` — Metro Management under Platform Operations in sidebar

### Cora Metro Intent
- **Detection**: METRO_KEYWORDS in `server/cora/service.ts` trigger `"metro"` intent before outreach/content/plan
- **Hat**: Always `operator` for metro intents
- **Checklist queries**: "what's missing", "launch readiness" return audit with progress %
- **Creation requests**: Generate plan-first with `requiresApproval: true`, no auto-clone
- **Metro name resolution**: Resolves metro_projects → cities for correct name lookup

### Cora Voice & Agent Prep Layer
- **Purpose**: Draft-first voice persona and call campaign management. No live calling — preparation layer only.
- **DB Tables**: `ai_voice_profiles` (draft→active→archived), `ai_call_campaigns` (draft→approved→active→paused→completed→archived), `ai_call_tasks` (pending→scheduled→in_progress→completed→failed→cancelled), `ai_answer_flows` (draft→approved→active→archived), `ai_outbound_flows` (draft→approved→active→archived). All enforce strict status transition matrices server-side.
- **Services**: `server/cora/ai_voice_service.ts`, `server/cora/ai_call_campaign_service.ts`, `server/cora/ai_answer_flow_service.ts`, `server/cora/ai_outbound_flow_service.ts`. All have Zod schemas for create/update validation. Updates blocked unless entity is in draft status.
- **Provider Abstraction**: `server/cora/ai_voice_provider.ts` — `VoiceProviderAdapter` interface with TTS/STT/dialer methods. `StubVoiceProvider` active (throws "not configured"). Swap via `setVoiceProvider()`. Status endpoint: `GET /api/cora/voice/provider/status`. TTS preview: `POST /api/cora/voice/preview-tts` (returns estimated duration when unconfigured).
- **Voice Scripts**: Reuses `outreach_assets` table with types `voicemail_script`, `inbound_answer_script`, `follow_up_sms`. Created via `createVoiceScriptDraft()` in `outreachService.ts`.
- **Cora Integration**: `conversation_mode: "voice_prep"` reformats responses for spoken delivery. Voice intent detection via VOICE_KEYWORDS in `service.ts`. Hat routing: editor (scripts), cmo (campaigns), operator (inbound/answering).
- **Frontend**: `client/src/pages/admin/cora-voice-panel.tsx` — 5-tab panel (Profiles, Campaigns, Scripts, Inbound, Outbound). "Talk to Cora" toggle in `cora-panel.tsx`. Registered in admin sidebar under Cora group as "Voice & Agent Prep".
- **API Routes**: All under `/api/cora/voice/` — profiles CRUD, campaigns CRUD + transition + tasks, answer-flows CRUD + approve/reject, outbound-flows CRUD + approve/reject. All behind admin auth.

### Cora Operator Intelligence Layer (Prompt 6)
- **Purpose**: Internal operator dashboard for multi-metro operations management
- **Tables**: `cora_operator_snapshots` (platform/metro state summaries), `cora_opportunities` (tracked with priority/status/estimated value/recommended next steps), `cora_blockers` (severity-based with linked plans/opportunities, resolve/ignore actions), `cora_next_actions` (urgency-based to-do list with hat recommendations)
- **Enums**: `cora_opportunity_status` (identified/reviewed/approved/archived), `cora_opportunity_priority` (low/medium/high/critical), `cora_blocker_severity` (low/medium/high/critical), `cora_blocker_status` (open/resolved/ignored), `cora_next_action_urgency` (today/this_week/later), `cora_next_action_status` (pending/done/skipped)
- **Services**: `server/cora/operatorSnapshotService.ts`, `server/cora/opportunityService.ts`, `server/cora/blockerService.ts`, `server/cora/nextActionService.ts`, `server/cora/metroReadinessService.ts`
- **Metro Readiness**: Per-metro readiness flags (contentReady, pricingReady, outreachReady, operatorReady, comingSoonReady) with readinessPercent, topBlockers, topOpportunities — aggregated from existing tables
- **API Routes**: All under `/api/cora/operator/*` — snapshots (POST generate, GET list/detail), opportunities (CRUD + approve/archive), blockers (CRUD + resolve/ignore), next-actions (CRUD + complete/skip), readiness (GET all/per-metro)
- **Admin UI**: `client/src/pages/admin/operator-hq-panel.tsx` — "Operator HQ" in Cora sidebar group with Dashboard (platform summary + metro readiness grid), Opportunities (filterable list with create/approve/archive), Blockers (severity badges with resolve/ignore), Next Actions (urgency-grouped to-do with complete/skip)
- **No auto-execution**: Reads from existing systems, does not auto-execute outreach/content/pricing changes

- **Vertical Landing Pages**: Marketing landing pages for 6 verticals (`food`, `arts-entertainment`, `commerce`, `senior`, `family`, `pets`). Routes: `/:citySlug/food`, `/:citySlug/arts-entertainment`, `/:citySlug/commerce`, `/:citySlug/senior`, `/:citySlug/family`, `/:citySlug/pets`. Hub-scoped routes: `/:citySlug/:hubSlug/food` etc. Component: `client/src/pages/vertical-landing.tsx`. API: `GET /api/cities/:citySlug/verticals/:verticalKey/landing?hub=:hubSlug`. Hub resolution: `GET /api/hub-resolve/:hubSlug`. SEO snapshot support via `buildVerticalLanding()` in `server/seo-snapshot.ts`. `VERTICAL_KEYWORDS` map at `server/routes.ts:2622` drives category matching. `music` is an alias for `arts-entertainment`. Nav in `public-layout.tsx` points to vertical landing pages.

- **Hub Pulse Issues** (Print-to-Digital Community Publication):
  - **Purpose**: Reusable "Hub Pulse" monthly issue page system — digital twin of printed 11×17 community publications for micro hubs.
  - **Schema**: `pulse_issues` (id, cityId, hubSlug, slug, issueNumber, title, intro, hero fields, featuredStory fields, quickHits JSONB, featuredBusinesses JSONB, advertisers JSONB, giveaway fields, conversion CTA fields, pickupLocations JSONB, status enum draft/review/published/archived, publishedAt, timestamps). `pulse_pickup_locations` (id, hubSlug, cityId, name, address, lat/lng, isActive). Status enum: `pulse_issue_status`. Typed schemas: `pulseBusinessEntrySchema` (discriminated union: `{type:"linked", businessId}` | `{type:"manual", name, description?, imageUrl?, ctaText?, ctaUrl?}`), `pulsePickupLocationEntrySchema`.
  - **Routes**: Public — `GET /api/cities/:citySlug/hub/:hubSlug/pulse` (list published), `GET /api/cities/:citySlug/hub/:hubSlug/pulse/:issueSlug` (single with enriched business data + lat/lng), `GET /api/cities/:citySlug/hub/:hubSlug/pickup-locations`. Admin — full CRUD at `/api/admin/pulse-issues`, `/api/admin/pulse-pickup-locations`, plus `POST /api/admin/pulse-issues/:id/duplicate` and `POST /api/admin/pulse-issues/generate` (Charlotte AI generation).
  - **Storage Layer**: IStorage interface + DatabaseStorage implementations for all pulse CRUD: `getPulseIssuesByHub`, `getPulseIssueBySlug`, `getPulseIssueById`, `createPulseIssue`, `updatePulseIssue`, `deletePulseIssue`, `getAllPulseIssues`, `getPulsePickupLocations`, `getAllPulsePickupLocations`, `createPulsePickupLocation`, `updatePulsePickupLocation`, `deletePulsePickupLocation`.
  - **Charlotte Generation**: `POST /api/admin/pulse-issues/generate` accepts districtName, hubSlug, cityId, issueNumber, storyPrompt, quickHits[], featuredBusinessIds[], advertiserIds[], giveawayInfo, theme. Uses GPT-4o-mini to draft title, intro, story, quick hits, slug. Creates draft issue. Auto-pulls active pickup locations for the hub.
  - **Public Page**: `client/src/pages/pulse-issue-page.tsx` at `/:citySlug/hub/:hubSlug/pulse/:issueSlug`. Sections: hero, intro, featured story, quick hits, featured businesses, advertisers grid, giveaway card, pickup locations + featured businesses on embedded Leaflet mini-map (two marker types: amber pickup pins, purple business pins with legend), conversion CTA. SEO: canonical URL, full OG/Twitter meta (title, description, image, url, type, card), NewsArticle + BreadcrumbList JSON-LD with absolute URLs.
  - **Admin Panel**: `client/src/pages/admin/pulse-issues-panel.tsx` — Issues list with create/edit/duplicate/delete, Charlotte Generate dialog, Pickup Locations management tab. Hybrid business/advertiser editor: supports both linked (business UUID) and manual entries (name, description, imageUrl, ctaText, ctaUrl). BusinessEntryEditor component handles both modes. Registered as "Hub Pulse Issues" under Content & Listings in admin sidebar.
  - **Map Integration**: `pulse_pickup` marker type in unified-map.tsx (amber Newspaper icon) and map-routes.ts (queries pulse_pickup_locations with coordinates).
  - **Backend**: `server/pulse-routes.ts` — all routes registered via `registerPulseRoutes(app, requireAdmin)` in routes.ts. Uses storage interface for all CRUD. Zod validation with typed schemas. No `any` casts.

- **Micro Hub Publications** — Standalone print publication digital twin system, completely separate from Pulse Issues. Each micro hub can have a recurring print publication with its digital version online.
  - **Schema**: 4 tables in `shared/schema.ts` — `micro_publications` (city, hub, slug, name, cover), `micro_pub_issues` (publication ref, issue number, status draft/published/archived, pickup locations JSONB), `micro_pub_sections` (5 per issue — pets/family/senior/events/arts_entertainment, each at a position front1/front2/back1/back2/back3, with nonprofit story content + paired sponsor ad), `micro_pub_community_ads` (3 ad slots per issue). Enums: `micro_pub_section_type`, `micro_pub_position`, `micro_pub_status`. DDL in `server/index.ts`.
  - **Routes**: `server/micro-pub-routes.ts` registered via `registerMicroPubRoutes(app, requireAdmin)`. Admin CRUD for publications, issues, sections, community ads. Clone-with-rotation endpoint (`POST /api/admin/micro-pub-issues/:id/clone`) creates new draft with sections rotated to new positions but sponsor pairings preserved. All PATCH routes use Zod validation schemas. Public endpoint: `GET /api/cities/:citySlug/pub/:pubSlug` returns publication + all published issues with sections and ads.
  - **Admin Panel**: `client/src/pages/admin/micro-pub-panel.tsx` — Three-level navigation: publication list → issue list → issue editor. Create publications with name/hub/description/cover. Issue editor with tabs: Sections (5 expandable cards with nonprofit story + paired sponsor fields), Community Ads (3 slots), Pickup Locations (pipe-delimited text format). Clone previous issue button. Public URL shown for each publication. Registered as "Micro Publications" under Content & Listings in admin sidebar.
  - **Public Landing Page**: `client/src/pages/micro-pub-landing.tsx` at `/:citySlug/pub/:pubSlug`. Stable URL per publication. Latest published issue rendered in full (header, 5 sections in print-mirrored two-column layout — story left, sponsor right on desktop, stacked on mobile, community ads grid, pickup location strip). Older issues listed as expandable archive cards below. Sponsor ads are clickable links with visit tracking.

- **Trust System (Data Model & Service Layer)** — Unified trust layer that combines verification, reviews, badges, Crown, Story Builder, and activity signals into structured trust levels (T0–T5) and operational states (eligible→qualified→active→needs_attention→at_risk→paused→removed). Schema: `trust_profiles` table (businessId FK, trustLevel enum T0-T5, operationalStatus enum, signalSnapshot JSONB, contextLabels text[], storyTrustFields JSONB, decayDetectedAt, lastComputedAt), `trust_status_history` table (profileId FK, previousLevel, newLevel, previousStatus, newStatus, reason, changedBy). Badge types: TRUST_ACTIVE, TRUST_GROWING, TRUST_NEEDS_ATTENTION added to `profileBadgeTypeEnum`. Service: `server/trust-service.ts` — `computeTrustProfile()` gathers all signals (verification, reviews, badges, Crown wins, story completeness, activity recency), computes level/status, syncs trust badges via `syncTrustBadges()` (idempotent upsert/revoke), detects decay (90-day inactivity), supports recovery paths. Network eligibility: T2+ with verification. Story Builder integration: `deriveStoryTrustFields()` called on session completion in `server/charlotte-flows.ts`. Routes: `server/trust-routes.ts` — GET profile, GET eligibility, POST compute, GET history, PATCH status, POST/DELETE labels, POST recover, POST story-fields, POST compute-all, POST decay-scan. All write endpoints use Zod validation. Scheduler: `server/trust-scheduler.ts` — 24h periodic recalculation of all trust profiles. DDL migrations in `server/index.ts`.

- **Enter to Win Engine** — Full giveaway/sweepstakes system. **Schema**: 5 enums (`giveaway_status`, `giveaway_entry_method`, `giveaway_draw_method`, `giveaway_winner_status`, `giveaway_bonus_type`) + 9 tables (`giveaways`, `giveaway_prizes`, `giveaway_sponsors`, `giveaway_entries`, `giveaway_bonus_actions`, `giveaway_bonus_completions`, `giveaway_draws`, `giveaway_winners`, `giveaway_notifications`, `giveaway_analytics`). DDL in `server/index.ts` (startup, `[Giveaway] Tables ready`). **Backend**: `server/giveaway-routes.ts` — Admin CRUD (giveaways, prizes, sponsors, bonus actions), entry management (disqualify/reinstate), draw execution with seeded deterministic shuffle (`seededShuffle()`), winner notification via `sendTerritoryEmail`, claim flow (`POST /api/giveaways/claim/:token`). All child operations scoped by parent giveawayId. Public APIs: entry (`POST /api/giveaways/:slug/enter`), bonus completion, winner list, check-entry. Email normalized via `normalizeEmail()`. Unique constraints: slug, bonus completion (entry+action). **Admin Panel**: `client/src/pages/admin/giveaway-admin.tsx` — Tabbed interface (Settings, Prizes, Sponsors, Bonus Actions, Entries, Draws & Winners). Full CRUD dialogs for prizes/sponsors/bonus actions. Entry disqualify/reinstate. Draw execution dialog with winner count + prize assignment. Winner status management. Registered as "Enter to Win" under Hub Operations in admin sidebar with sub-items.

- **Ingestion Quality Layer** — Unified content quality system at ingestion time. **Dedup Engine** (`server/services/content-dedup.ts`): Three-tier duplicate detection — hard duplicates (exact URL match globally or cross-source externalId match → skip entirely), soft duplicates (Jaccard title similarity ≥0.75 within 24h → `duplicate_candidate` integrityFlag), AI duplicates (`checkAiSlugDuplicate`: exact slug collision or near-match via Jaccard ≥0.8 on slug words → `ai_duplicate_candidate` flag + `dedupMeta` JSON with `originalItemId` and `matchType` linkage). Same-source existing items resolved via update path before dedup runs. Empty URLs skipped in URL dedup. Uses shared `titleWords`/`jaccardSimilarity` from `server/services/text-similarity.ts`. **Source Trust** (`server/services/source-trust.ts`): Computes 0–100 trust score per source based on category mapping rate, geo accuracy, duplication rate (both `duplicate_candidate` and `ai_duplicate_candidate` via JSONB `?` operator), and filter hit rate. Admin override supported via `trustOverride` column on `metro_sources` — when set, overrides computed score. Updated after each `runAllDue()` cycle. Low trust (<30) → items auto-set to `reviewStatus: "PENDING"` with `low_trust_source` integrityFlag; preserved through full AI processing lifecycle including failure catch paths. Columns on `metro_sources`: `trust_score`, `trust_override`, `frequency_weight`, `content_types`, `last_ingested_item_count`. **Source Throttling**: Per-source cap of 25 items per pull run (configurable `DEFAULT_SOURCE_INGESTION_CAP`). Excess items inserted with `queueStatus: "QUEUE_DELAYED"` and `throttled` integrityFlag. **Content Diversity** (`server/services/content-diversity.ts`): Post-batch analysis on 24h ready pool per city. Flags: `OVERREPRESENTED_SOURCE` (>40%), `OVERREPRESENTED_CATEGORY` (>50%), `OVERREPRESENTED_GEO` (>60%). Written to `integrityFlags` JSON array. **Schema**: `rss_items` has `dedup_meta` JSON column for AI duplicate linkage. **Editorial Filters**: `editorial-control-tab.tsx` has integrity flag filter dropdown for: duplicate_candidate, low_trust_source, throttled, OVERREPRESENTED_SOURCE/CATEGORY/GEO. API supports `?integrityFlag=` query parameter.

- **Light Automation Engine** — Rule-based automation layer for follow-ups, status triggers, and lifecycle actions. **Schema**: 2 enums (`automation_trigger_event`: booking_no_response/content_published/story_approved/lead_created/event_rsvp; `automation_action_type`: send_email/update_status/generate_content/create_notification) + 3 tables (`automation_rules`, `automation_queue`, `automation_log`). **Scheduler** (`server/services/automation-scheduler.ts`): 60s polling interval with concurrency lock, processes due queue items, dispatches to action handlers, logs results. Registered at server startup (`[AutomationEngine]` prefix). **Action Handlers** (`server/services/automation-actions.ts`): send_email (via sendTerritoryEmail), update_status (CMS content status update), generate_content (OpenAI-powered), create_notification (admin inbox). **Trigger Hooks** (`server/services/automation-triggers.ts`): `enqueueAutomationTrigger(event, payload)` helper matches active rules and enqueues with configurable delay. Hooks in: cms-routes.ts (content_published, story_approved), routes.ts (lead_created), event-rsvp-routes.ts (event_rsvp). **Admin API** (`server/automation-routes.ts`): CRUD for rules (`/api/admin/automation/rules`), queue read (`/api/admin/automation/queue`), log read (`/api/admin/automation/logs`). All requireAdmin. **Admin UI** (`client/src/pages/admin/automation-panel.tsx`): Rules table with active/inactive toggle, create/edit dialog (trigger, action, delay, JSON config, city scope), execution log tab. Under "Automation" sidebar group.

- **Event Back Office — Sponsor & Vendor Management**: Full CRUD for event sponsors and vendors. Schema: `event_sponsors` (tier enum: title/presenting/gold/silver/bronze/community/in_kind/media; status enum: prospect/contacted/confirmed/declined/withdrawn) and `event_vendors_managed` (status enum: applied/under_review/approved/rejected/waitlisted/confirmed/withdrawn). Both tables have presenceId FK to businesses, displayPublicly flag, contact fields, sortOrder. Routes in `server/event-backoffice-routes.ts`: admin CRUD (`/api/admin/events/:eventId/sponsors`, `/api/admin/event-sponsors/:id`, etc.), owner-gated CRUD (`/api/owner/events/:eventId/sponsors`, etc.), public display (`/api/events/:eventId/sponsors/public`, `/api/events/:eventId/vendors-managed/public` — only confirmed/approved + displayPublicly=true), intake forms (`POST /api/events/:eventId/sponsor-interest`, `POST /api/events/:eventId/vendor-application`), presence search (`/api/admin/businesses/search-presence`, `/api/owner/businesses/search-presence`). UI: Shared component `client/src/components/event-sponsors-vendors-panel.tsx` (EventSponsorsTab, EventVendorsTab) used in admin events-panel.tsx (expandable event cards with Sponsors/Vendors tabs) and owner-dashboard.tsx (OwnerEventsSection). Public event-detail.tsx shows confirmed sponsors/vendors and collapsible intake forms for sponsor interest and vendor applications.

- **Charlotte Orchestrator Core** — Central orchestration layer for Charlotte AI (`server/charlotte-orchestrator.ts`). Receives natural language or structured requests, classifies intent via AI into 5 operating modes (operator/proposal/search/concierge/brainstorm), extracts entity references, resolves them against existing platform data (businesses, CRM contacts, events) with confidence scoring (HIGH/MEDIUM/LOW) and metro/city scoping for tenant isolation, and routes to appropriate engines. HIGH confidence auto-links entities, MEDIUM suggests, LOW creates inbox items for review (`pipeline_needs_review`). Prompt registered in `server/ai/prompts/platform-services.ts` as `platformService.orchestratorIntentClassifier`. Integrated into `server/charlotte-chat-routes.ts` — orchestrator runs on every admin chat message, enriching the system prompt with classified intent, resolved entities, geo context, and target engines. Fallback classification (no AI) uses keyword matching. Engine routing maps 40+ keywords to existing services (CRM, content-pipeline, trust-service, pulse-scanner, etc.). Schema: `orchestrator_decisions` table (metro_id, source, user_id, mode, intent, confidence, entity_count, entities JSONB, target_engines text[], requires_proposal, batch_mode, routing_steps JSONB, input_preview, created_at). DDL in `server/index.ts`. All decisions persisted to `orchestrator_decisions` via raw SQL pool insert. Classifier output fully validated (mode, intent, desiredAction, confidence, booleans, arrays) with safe defaults for malformed AI responses. Admin API: `POST /api/admin/charlotte/orchestrate` for direct testing. Exports: `orchestrate()`, `classifyIntent()`, `resolveEntities()`, `routeCommand()`, `getOrchestratorSummary()`. Types: `OrchestratorRequest`, `OrchestratorCommand`, `ResolvedEntity`, `IntentClassification`, `RoutingPlan`, `OrchestratorResult`.

- **Charlotte Proposal Engine** — Action template system and batch proposal processing (`server/charlotte-proposal-engine.ts`). Evaluates entities (businesses, contacts, events) for eligible actions, builds structured proposals with approval workflow, and executes confirmed items through existing platform services. **10 Action Templates**: CLAIM_LISTING (queue unclaimed for outreach), STORY_DRAFT (AI story from capture), BECKY_OUTREACH (personalized intro email), CROWN_CANDIDATE (flag for Crown competition), FOLLOWUP_EMAIL (queue follow-up via automation triggers), LISTING_UPGRADE (recommend tier upgrade), TV_VENUE_SCREEN (add to venue TV rotation), CONTENT_ARTICLE (editorial content draft), EVENT_PROMOTION (featured placement), SEARCH_RECOMMENDATION (search signal boost). **Opportunity Evaluation**: `evaluateOpportunities()` checks entity state against template eligibility (claim status, outreach status, tier, linked articles). **Proposal Lifecycle**: pending → confirmed → executing → completed/failed. Items: proposed → confirmed/skipped → executing → completed/failed. **Batch Directives**: `buildBatchProposal()` accepts entity type + filters + template keys, resolves up to 200 entities, evaluates each. **Execution Engine**: `executeProposal()` runs confirmed items through real services (capture-story-generator, becky-outreach, automation-triggers, DB updates). **Orchestrator Integration**: `handleProposalMode()` in orchestrator auto-generates proposals when mode=proposal; proposal summary injected into chat system prompt context. **Schema**: `charlotte_proposals` (metro_id, status, directive, batch_mode, item counts, orchestrator_decision_id), `charlotte_proposal_items` (template_key, entity refs, status, params JSONB, result JSONB, error). DDL in `server/index.ts`. **API Routes** (in `server/charlotte-intelligence-routes.ts`): `GET /api/admin/charlotte/proposals` (list), `GET /api/admin/charlotte/proposals/:id` (detail), `POST /api/admin/charlotte/proposals/evaluate` (opportunity check), `POST /api/admin/charlotte/proposals/build` (single entity), `POST /api/admin/charlotte/proposals/batch` (batch directive), `POST /api/admin/charlotte/proposals/:id/confirm` (confirm/skip items), `POST /api/admin/charlotte/proposals/:id/execute` (execute confirmed), `GET /api/admin/charlotte/action-templates` (list templates). Inbox routing: proposals with confirmation-required items create `pipeline_needs_review` inbox items.

- **Charlotte Search & Connection Layer** — Trust-aware search, geo-first query layer, concierge routing, command center queries, and sales lifecycle hooks (`server/charlotte-recommendation-connector.ts`, `server/charlotte-command-center.ts`). **Recommendation Connector**: `queryRecommendations()` wraps existing trust-service.ts and opportunity-scoring.ts — no duplicate scoring logic. Returns ranked results with trust level, verification status, participation signals (Crown, story depth, listing tier), and follow-on actions. Supports geo filtering (near_me with haversine, zone slug, hub code, metro-wide). Sort by trust score, relevance, activity, or rating. Min trust level filter, claimed/verified toggles. **Concierge Domain Routing**: `queryConcierge()` maps 12 concierge domains (dining, services, shopping, housing, jobs, events, marketplace, creators, experts, things-to-do, attractions, general) to entity types and category filters. Each domain has configured follow-on actions and contextual suggestions. `getDomainFromQuery()` infers domain from natural language via keyword matching — extended to catch relocation queries (relocat, move to, where.*live, neighborhood, area.*famil). `resolveLocationFromText()` bridges to location-detection.ts for geo resolution. **Housing Domain**: Expanded to combine real-estate agent businesses AND marketplace housing listings (HOUSING_SUPPLY/HOUSING_DEMAND/HOUSING types). For relocation-style queries, includes zone activity summary via `getZoneActivitySummary()` as `zoneInsights` in response. **Action Route Resolution**: `resolveActionRoute(action, entity, citySlug)` maps follow-on action identifiers to concrete platform routes/URLs. Supports: view_profile, read_story, view_map/view_on_map, connect_to_booking, schedule_with_becky, start_claim, make_reservation, book_appointment, contact, view_details, apply, view_listing, rsvp, schedule_tour. Returns `{ action, route, label }`. **Recommendation Gap Inbox**: `flagRecommendationGap()` in orchestrator creates `recommendation_gap` inbox items when search/concierge returns 0 results, surfacing content coverage holes for admin review. **Command Center**: `getCommandCenterSummary()` provides cross-system operational overview (listing stats with tier breakdown, trust profile distribution with at-risk/needs-attention counts, pipeline bucket breakdown with high-fit/contact-ready counts, Crown participant/winner/category stats, content pipeline metrics, event/job counts). `identifyAdvertiserOpportunities()` surfaces high-prospect-fit businesses with actionable signals and suggested actions. `getCrownReadinessReport()` scores businesses on Crown readiness (verification, trust level, story depth, participation). `getZoneActivitySummary()` aggregates per-zone listing/claimed/verified counts with average trust level. `getRecentOrchestratorActivity()` queries orchestrator decision history. **Sales Lifecycle Hooks**: `inferSalesLifecycleStage()` in orchestrator maps business state to 7-stage lifecycle (verify → story → align → recommend → close → downsell → handoff) with suggested next actions — Phase 3 readiness for lifecycle engine. **Operations Center** (`server/charlotte-ops-center.ts`): Unified daily-operations backend layer. `getCommandCenterOperationsOverview()` returns 5 structured queues: actionQueue (pending proposals + ready onboarding workflow steps), reviewQueue (open admin inbox items + low-confidence orchestrator decisions), followUps (incomplete onboarding flows + pending story approvals + paused workflows + overdue inbox items), opportunities (high-scoring entities + Crown candidates + TV/venue candidates), recentActivity (recent orchestrator decisions + completed batch sessions + proposal executions + onboarding completions). Action control hooks: `approveAction(actionId)` confirms all proposal items, `rejectAction(actionId)` cancels proposals, `runActionNow(actionId)` confirms and executes proposals, `sendToInbox(itemId)` creates admin inbox items. Orchestrator integration: `integrateOrchestratorDecision()` classifies decisions into action/review queues by confidence. Batch processor integration: `integrateBatchResult()` routes batch items to action/review/opportunity queues. API: `GET /api/admin/charlotte/ops-center` (full overview), `POST .../approve`, `POST .../reject`, `POST .../run-now`, `POST .../send-to-inbox`. **Orchestrator Mode Handlers**: `handleSearchMode()` and `handleConciergeMode()` wire search/concierge orchestrator modes to recommendation connector with geo/trust context. **API Routes** (in `server/charlotte-intelligence-routes.ts`): `POST /api/admin/charlotte/search` (trust-ranked search), `POST /api/admin/charlotte/concierge` (domain-routed concierge), `GET /api/admin/charlotte/command-center/:metroId` (full summary), `GET .../advertiser-opportunities` (prospect identification), `GET .../crown-readiness` (Crown readiness report), `GET .../zone-activity` (per-zone stats), `GET .../orchestrator-activity` (decision history), `GET /api/admin/charlotte/sales-lifecycle/:businessId` (lifecycle stage inference).

- **Charlotte Batch Processor (Expo/Field Capture Sessions)** — Input-driven batch processing pipeline for expo captures and field visits (`server/charlotte-batch-processor.ts`). Groups multiple captures into a session, processes each through entity resolution → proposal generation → optional execution. **Capture Sessions**: `capture_sessions` table (metro_id, event_name, event_date, location, operator, status, proposal_id). **Session Items**: `capture_session_items` table (session_id, capture_type, input fields for name/email/phone/company/job_title/website/address/notes, photo_urls, raw_data, processing_status, resolved_entity_id/type, match_type, confidence, eligible_actions, business_id, contact_id, dedup_of_item_id). **Processing Pipeline**: `processCaptureBatch(sessionId)` iterates items: (1) builds EntityReferences from input data, (2) deduplicates within batch by email/company/phone, (3) resolves against existing entities via orchestrator's `resolveEntities()`, (4) for matched entities evaluates opportunities via proposal engine, (5) for unresolved entities auto-creates businesses/contacts via existing `storage.createBusiness()` + claim queue, (6) flags low-confidence items to admin inbox (`field_capture_review`), (7) builds grouped proposal with all eligible actions. **Session Statuses**: open → processing → ready_for_review → partially_executed/completed. **Item Statuses**: pending → extracting → resolved/low_confidence/proposal_ready → executed/failed. **API Routes** (in `server/capture-routes.ts`): `POST /api/admin/capture-sessions` (create), `POST .../items` (add items, max 200), `POST .../process` (run batch), `GET /api/admin/capture-sessions` (list), `GET .../:id` (detail with items), `POST .../:id/execute` (confirm + execute proposal). DDL in `server/index.ts`.
  **Phase 5D Capture Gap-Fill** (`server/capture-session-routes.ts`, `client/src/pages/capture-sessions-page.tsx`): (1) **Voice Note Input** — `POST /api/capture-sessions/:id/items/voice` accepts base64 audio, transcribes via `speechToText`, extracts name/email/phone/company via regex from transcript, stores as capture item. Frontend voice tab with mic record/stop, transcript display, saved count. (2) **Bulk Paste Entry** — `POST /api/capture-sessions/:id/items/bulk-text` parses multi-line text (comma/dash/tab separated, auto-detects email/phone), creates one capture item per line. Frontend bulk paste tab with textarea + Import All. (3) **Fast Capture Loop** — "Save & Next" button clears form but keeps dialog open, auto-focuses first field, shows saved count banner. (4) **Light Text Parsing** — `extractContactFieldsFromText()` in `server/lib/capture-extraction.ts` does regex email/phone/website extraction; integrated into `extractDataFromItem` for rawInput with notes/transcript/rawText fields. (5) **Queue-Ready Hooks** — `prepareCaptureForQueue()` + `CaptureQueueItem` type exported from `capture-session-routes.ts`. Maps processed items to priority/type/recommendedAction based on match confidence and entity status. Processing endpoint returns `queueReadyItems` array alongside items/proposal/summary.

- **Phase 2 Integration Test Suite** — End-to-end validation of all Charlotte flows (`server/tests/charlotte-integration.ts`, run via `npx tsx server/tests/run-charlotte-tests.ts`). 97 tests across 19 sections: (1-16) Same as before. (17) Charlotte Response Doctrine — mode detection for all 6 modes (discovery/concierge/editor/organizer/growth/brainstorm), doctrine context generation, growth+onboarding stage context, onboarding stage progression (verify→story→align→recommend→close→downsell→null); (18) Objection Handling & Fit Filters — "too expensive"→re_anchor, "can't afford"→downsell, "real person"→handoff, neutral→null, objection context string, outside metro→redirect, no budget→disengage, not a business→defer, valid business→null; (19) Doctrine Mode Coverage — all 6 mode doctrines complete, all 6 onboarding stages defined, CORE_TONE_RULES complete, community fund rules defined, editor/brainstorm mode-specific guidance.
- **Charlotte Response Doctrine (Phase 3A)** — Structured behavior layer (`server/services/charlotte/charlotte-response-doctrine.ts`). 6 Charlotte modes: discovery (local friend), concierge (navigator), editor (story reviewer), organizer (ecosystem guide), growth (consultative sales), brainstorm (creative collaborator). Each mode defines tone, opening style, explanation degree, action orientation, closing style, response guidance, sample phrasing. Core tone: consultative, assumptive, warm but not fluffy, locally grounded. 6-stage onboarding flow: verify→story→align→recommend→close→downsell with key messages, questions, and transition cues per stage. 6 objection handling rules (too expensive, can't afford, not ready, not sure, talk to real person, scam concern) with re_anchor/downsell/handoff/disengage actions. 3 fit filters (no budget, outside metro, not a business). Community fund positioning rules (don't lead with percentages, frame as ecosystem participation). Integrated into admin chat via `charlotte-chat-routes.ts` — doctrine context injected into LLM system prompt alongside orchestrator context, with objection/fit filter detection on every message.

- **Charlotte Phase 4A — Retention & Engagement Engine** — Lightweight engagement layer for post-onboarding business retention. **Engagement Triggers** (`server/charlotte-engagement-triggers.ts`): Deterministic trigger system evaluating 4 categories — inactivity (configurable days threshold, checks claimed/verified businesses with stale updatedAt), new capability (recently verified, story approved — ready for next participation step), opportunity detected (high prospect fit scores, Crown candidates with T4/T5 trust but low tier), seasonal moments (New Year, Spring, Summer, Back to School, Holiday — fires on Mondays). Each trigger emits `{ triggerType, entityId, entityName, recommendedNextAction, priority, reason, metadata }`. `evaluateAllTriggers(metroId)` runs all checks in parallel. **Participation Surface Suggestions**: `getParticipationSuggestions(entityId)` returns suggested surfaces (Pulse, Events, Jobs, Marketplace, TV/Venue, Radio, Print) with reasons and action template keys, based on entity type, trust level, listing tier, and business characteristics. **Content Prompt Generator** (`server/charlotte-content-prompter.ts`): `generateContentPrompt({ entity, trigger, context })` returns short, actionable prompts using Charlotte's response doctrine tone. Prompt banks per trigger type (inactivity, new capability, opportunity, seasonal). Returns `{ prompt, suggestedAction, tone, contentType }`. Batch generation via `generateBatchContentPrompts()`. **Upsell Detector** (`server/charlotte-upsell-detector.ts`): Soft opportunity detection — 6 upsell types: high_trust_low_tier (T3+ on FREE/VERIFIED), active_poster_no_upgrade (5+ posts/30d on low tier), high_activity_low_tier (activity + data quality on low tier), strong_story_no_content (story depth 60+ but no ongoing content), event_potential_no_events (venue-type with no events), multi_location (same name claimed multiple times). Returns `{ upsellType, entityId, reason, recommendedAction, confidence }`. Batch detection via `detectBatchUpsellOpportunities(metroId)`. **Automation Hooks** (`server/services/automation-actions.ts`): `enqueueEngagementAction(trigger, options)` wires engagement triggers into existing automation queue — creates/reuses automation rules, enqueues items with configurable delay, fires through existing scheduler. **Orchestrator Integration** (`server/charlotte-orchestrator.ts`): `detectEngagementOpportunities(businessId, metroId)` returns full engagement context (triggers, participation suggestions, content prompt, upsell opportunities). `buildEngagementSuggestionText()` formats context into natural language. `executeWithEngagementCheck()` extends `executeWithConstraints()` with engagement detection for business entities. `fireEngagementTriggers(metroId)` batch-fires triggers through automation queue. Non-aggressive — does not interrupt primary onboarding or operator flows.

- **Phase 6 — System Stabilization & End-to-End Integration** — Wired all Charlotte subsystems end-to-end without adding new features. Key changes: (1) **Failed processing → inbox**: Batch processor item failures now create `pipeline_processing_failed` inbox exception items instead of silently logging (`charlotte-batch-processor.ts`). (2) **Proposal execution failures → inbox**: When proposal items fail execution, an inbox exception item is created with failure details (`charlotte-proposal-engine.ts`). (3) **Orchestrator routing fallback → inbox**: When orchestrator confidence is below 0.4 and routing falls back to `admin_inbox`, an actual inbox item is now created (`charlotte-orchestrator.ts`). (4) **Ops Center capture actions → downstream sync**: Approving/rejecting/running capture queue items now resolves linked inbox items and logs operations (`charlotte-ops-center.ts`). (5) **Review queue includes failed sessions**: Failed capture sessions now appear in the ops center review queue. (6) **Workflow item handling**: Ops center approve/reject/run now handle `workflow:` prefixed items. (7) **Inbox triage map expanded**: Added `field_capture_review` (needs_review) and `pipeline_processing_failed` (exception) item types to the triage map (`admin-inbox.ts`). Status model: Capture sessions (open→processing→ready_for_review→partially_executed→completed|failed), Capture items (pending→extracting→resolved|low_confidence|proposal_ready→executed|failed), Proposals (pending→confirmed→executing→completed|partial|failed|cancelled), Inbox (open→in_progress→waiting→resolved|closed).

- **RSS Article Natural Voice & Image Cleanup (Task #262)** — RSS-sourced articles now use natural, editorial voice instead of raw feed copy. AI rewriting produces human-quality prose with proper attribution. Image handling cleaned up: broken/missing images gracefully handled, fallback category images applied, duplicate image URLs deduplicated, and image alt text auto-generated where missing.

- **Universal Geo Coordinates Across All Content Types (Task #263)** — First-class `latitude`/`longitude` numeric columns added to `events`, `articles`, and `job_listings` tables. Geocoding utility (`server/services/geocoding.ts`) provides `geocodeAddress()`, `geocodeFromParts()`, `getZoneCentroid()`, `getBusinessCoordinates()`, plus `toFiniteCoord()` and `hasValidCoords()` helpers. All content import pipelines (admin event creation, content-intake publish, RSS event detection, workforce job creation) auto-geocode with fallback chain: explicit coordinates → address geocode → business coordinates → zone centroid. Map routes, JSON-LD structured data, and SEO snapshots all consume these coordinates.

- **CLT Hub Visible Brand Sweep (Task #261)** — All 40+ page files now use brand-system-first pattern (`brand?.ogSiteName || "CLT Hub"`) via `getCityBranding()`/`getBrandForContext()` from `shared/city-branding.ts`. Meta titles, OG tags, JSON-LD publisher/isPartOf fields, and description brands all rotate through the 5 brand variants by page context. Server-side SEO suggestion endpoints made brand-aware. Intentional exceptions preserved: CityMetroHub licensing page generic "City Hub" product term, FAQPage alternateName variant references, admin form placeholders.

- **Geo Cross-Vertical Neighborhood Context System (Task #265)** — Registry-based system where every vertical (business, event, article, marketplace, attraction, job) declares itself in `shared/neighborhood-context.ts`. Backend API `GET /api/cities/:citySlug/nearby?lat=&lng=&sourceType=&radius=` returns nearby cross-vertical content grouped by type, sorted by haversine distance, with configurable radius (default 1.5 mi, max 5 mi). Reusable frontend component `client/src/components/neighborhood-context.tsx` with shared `useNearbyData` hook and `buildNearbyJsonLd` utility. Wired into all four detail pages (business-detail, event-detail, article-detail, marketplace-detail). JSON-LD cross-vertical enrichment: each detail page emits a `schema.org/ItemList` structured data block with nearby items typed as LocalBusiness/Event/Article/Product/TouristAttraction/JobPosting. Job listings filtered by `status = 'PUBLISHED'`. New verticals auto-participate by registering in the registry — no special wiring needed. Architectural rule documented in Strategic Moat Features.

- **Personal Link Hub (Linktree-Style Pages)** — Users with handles get a shareable Linktree-style page at `/:citySlug/@handle`. DB tables: `link_hub_settings` (bio, theme color, visibility toggles) and `link_hub_links` (custom links with click tracking). Public API: `GET /api/cities/:citySlug/link-hub/:handle` returns user profile, auto-populated links (businesses, events, marketplace listings), and custom links. Authenticated APIs: settings CRUD (`GET/PUT /api/link-hub/my/settings`), link CRUD (`GET/POST/PUT/DELETE /api/link-hub/my/links`), reorder (`PUT /api/link-hub/my/links/reorder`), analytics (`GET /api/link-hub/my/analytics`). Frontend: `client/src/pages/link-hub.tsx` (public page with avatar, bio, profile badges, link cards, share button, JSON-LD Person schema, SEO meta), `client/src/pages/link-hub-settings.tsx` (management dashboard with links/settings/analytics tabs). Free tier: 5 custom links; premium: unlimited links, theme colors, click analytics. Link to settings added in subscriber-profile settings tab. Route: `/:citySlug/@handle` renders LinkHub, `/:citySlug/link-hub/settings` renders settings page.

- **Events Phase 1 — Self-Service Engine & Admin Command Center** — Full Events Module ($199/yr) implementation. **Schema**: `event_ticket_types` (name, price_display, quantity, external_checkout_url, sort_order), `event_article_mentions` (title, url, source_name), `event_rss_suppressions` (source_name, source_pattern, title_pattern). Events table gains `lifecycle_status` (draft/under_review/published/live/completed/canceled/archived), `view_count`, `rsvp_count`, `outbound_ticket_clicks`. Event series gains `archived_at`. **Admin Command Center** (`events-panel.tsx`): 4-tab layout — Overview (KPIs, action items, status breakdown), Pipeline (filterable table with bulk ops, inline lifecycle select), Calendar (month view with status dots), Capture & Claims (AI capture queue, RSS events, suppression rules). Event Detail Workspace with 6 tabs: Basics, Tickets, Attendees, Sponsors, Vendors, Mentions. **Self-service event creation** (`owner-dashboard.tsx`): OwnerCreateEventForm with two-layer gate (Enhanced tier + EVENTS capability). Events created as draft, CLAIMED status. Owners cannot change lifecycle_status. **Backend** (`server/event-management-routes.ts`): CRUD for ticket types, article mentions, RSS suppressions; owner self-service with tier/module gating; series archive/unarchive; KPI overview; calendar endpoint; bulk lifecycle actions; public business events endpoint. City-scoped auth via `getAuthorizedCityId()` helper. Role-verified `requireAdmin` middleware. **Public changes**: Article mentions section on event-detail page. Events section on business-detail (Hub Presence) pages. Event series year-over-year archive with collapsible year groups. "Featured" label removed from all public event pages (events-landing, events-list); replaced with "Popular Events" section. Migration: `0013_events_phase1.sql`.

- **Events Phase 3 — Community, Syndication & Post-Event Engine** — **Schema** (`shared/schema.ts`): 10+ new tables — `event_comments` (role-badged discussion with attendee/sponsor/community_member tiers), `seen_around_town` (AI-generated post-event recap content with 14-day shelf life), `event_syndications` (cross-platform tracking for Facebook/Eventbrite/Meetup), `event_embed_configs` (embeddable widget configs), `event_surveys` (link surveys to events), `event_nominations` + `event_nomination_votes` (community voting), `event_giveaways` + `event_giveaway_entries` (random draw giveaways), `event_drip_campaigns` + `event_drip_steps` (credit-based email/SMS drip campaigns). Reviews table gains `event_id` column. New enums: `event_comment_role`, `event_comment_status`, `syndication_platform`, `syndication_status`, `event_survey_link_type`, `drip_timing`, `drip_channel`. **Backend** (`server/event-phase3-routes.ts`): Full API — comments CRUD (gated to verified users), event reviews with attendee gating + owner response, Seen Around Town CRUD + AI generation, syndication management, embeddable widget HTML endpoint, .ics calendar export with branding, surveys/nominations/giveaways management, attendee CSV export, follow-up messaging, drip campaign CRUD with steps. **Frontend — Event Detail** (`event-detail.tsx`): EventReviewsSection (star ratings, written reviews, aggregate display, attendee-only post-completion submission), EventCommentsSection (discussion with role badges — attendee/sponsor/community_member, collapsible, photo support), EventEngagementSection (nominations with voting, giveaway entries), .ics calendar download link in sidebar. **Frontend — Admin Panel** (`events-panel.tsx`): 4 new tabs in EventDetailWorkspace — Toolkit (attendee CSV export, follow-up messaging, nominations CRUD, giveaways with random draw), Syndication (cross-platform publishing to Facebook/Eventbrite/Meetup), Drip Campaigns (campaign builder with steps, timing, channel selection, credit gating), Embed (widget code generator with theme/button config). **Frontend — Events Landing** (`events-landing.tsx`): "Seen Around Town" section with AI-generated post-event recap cards. **Frontend — Share Menu** (`share-menu.tsx`): .ics calendar download option for events. All tables created via direct SQL (drizzle-kit push is interactive for new enums).

- **Capacitor Native App Scaffolding** — Capacitor v6 added to wrap the web app for iOS and Android distribution. Config: `capacitor.config.ts` (appId: `com.restexpress.app`, webDir: `dist/public`). Native project shells: `ios/` (Xcode) and `android/` (Android Studio). Plugins installed: `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`, `@capacitor/haptics`. Commands: `npx cap sync` (copy web assets + update plugins), `npx cap copy` (assets only), `npx cap open ios/android`. Docs: `docs/capacitor-setup.md`. Native builds require local Xcode/Android Studio — Replit is web dev only.