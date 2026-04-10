# CLT Metro Hub — Full Operational Audit
**Date:** March 7, 2026
**Platform:** CityMetroHub "Business in a Box" — Charlotte Pilot

---

## 1. AUTOMATED SYSTEMS

### 1A. Feed Scheduler (RSS / iCal Ingestion)
- **What it does:** Pulls all enabled content sources (RSS feeds, iCal calendars, OSM Overpass, Google Places, USAJOBS, IRS nonprofits) based on each source's configured frequency
- **Trigger:** Automatic on server startup (30-second delay), then recurring
- **Frequency:** Every 2 hours
- **How it works:** Reads `metro_sources` table for all enabled sources, checks if enough time has elapsed since `lastPulledAt` based on each source's `pullFrequency` (HOURLY / DAILY / WEEKLY / MONTHLY), then runs the appropriate connector
- **Content filtering:** Applies blocklists for negative content (crime, violence), political content (elections, partisan topics), and irrelevant academic events (grades due, exam periods). Also applies local keyword matching for Charlotte metro relevance
- **Tables affected:** `metro_sources`, `source_pull_runs`, `source_raw_rows`, `rss_items`, `businesses`, `events`, `jobs`
- **Outputs:** New RSS articles (require moderator approval before feed), new events (filtered by blocklist), new business listings, job postings

### 1B. CMS Scheduler (Scheduled Publishing / Unpublishing)
- **What it does:** Auto-publishes CMS content items when their `publishAt` timestamp is reached; auto-unpublishes when `unpublishAt` is reached
- **Trigger:** Automatic on server startup
- **Frequency:** Every 60 seconds
- **Tables affected:** `cms_content_items`, `cms_revisions`, `cms_workflow_events`, `articles` (via legacy bridge)
- **Outputs:** Published articles/pages appearing live on the site; archived content removed from public view

### 1C. Charlotte Intelligence Scheduler (AI Brain)
- **What it does:** Runs four AI subsystems in sequence:
  1. **Pulse Scanner** — detects business signals
  2. **Content Generator** — creates article drafts
  3. **Outreach Drafter** — writes sales email drafts
  4. **Social Content Generator** — creates social media post drafts
- **Trigger:** 5 minutes after server startup (initial run), then recurring
- **Frequency:** Every 6 hours
- **Tables affected:** `pulse_signals`, `admin_inbox_items`, `ai_content_drafts`, `outreach_drafts`, `social_posts`
- **Outputs:** Intelligence signals, content drafts, email drafts, social post drafts (all created as drafts requiring review)

### 1D. Prospect Pipeline Scheduler
- **What it does:** Runs the full prospect discovery and qualification pipeline — crawls websites, classifies locations, recommends outreach methods, applies industry tags, scores entities, and auto-promotes high-scoring prospects to the CRM
- **Trigger:** Automatic on server startup, checks every 5 minutes
- **Frequency:** Daily at 2:00 AM ET (configurable via `PIPELINE_SCHEDULE_HOUR` env var)
- **Deduplication:** Skips if a SCHEDULER-triggered run occurred within the last 20 hours
- **Tables affected:** `prospect_pipeline_runs`, `businesses`, `crm_presence`, `crm_activity`, `crm_events`, `entity_scores`, `entity_contact_verification`, `admin_inbox_items`
- **Outputs:** Scored and classified business prospects, auto-promoted sales leads, admin inbox alerts

### 1E. Weekly Digest Scheduler
- **What it does:** Compiles and sends a weekly email digest to subscribers with top content from the platform
- **Trigger:** Checks every hour
- **Frequency:** Sends on Mondays between 8-9 AM ET (UTC 13:00-14:00)
- **Guard:** Won't send if the last digest was sent less than 6 days ago
- **Tables affected:** `digests` (status updated to "sent")
- **Outputs:** Email digest sent via Resend to all subscribers

### 1F. Share Payload Cleanup
- **What it does:** Cleans up temporary file uploads from the mobile share/capture system
- **Frequency:** Every 60 seconds
- **What it cleans:** Share payloads older than 5 minutes (deletes temp files from disk)
- **Tables affected:** None (in-memory Map + filesystem)
- **Outputs:** Freed disk space

### 1G. Feed Session Cleanup
- **What it does:** Removes stale user feed sessions from memory
- **Frequency:** Periodic interval (activates when sessions exist)
- **Tables affected:** None (in-memory Map)
- **Outputs:** Memory cleanup

---

## 2. AI FUNCTIONS (Charlotte Intelligence)

### 2A. Pulse Scanner
Runs every 6 hours. Performs 5 scans per city:

| Scan | What It Detects | Data Source | Output |
|------|----------------|-------------|--------|
| **Unclaimed High-Demand** | Businesses with 20+ interactions in 30 days that have no claimed owner | `intelligence_event_log` + `businesses` | `pulse_signals` (type: UNCLAIMED_HIGH_DEMAND) + `admin_inbox_items` (priority: high) |
| **Upgrade Ready** | Claimed businesses with high engagement that could benefit from a paid tier upgrade | `intelligence_event_log` + `businesses` | `pulse_signals` (type: UPGRADE_READY) |
| **Contributor Candidates** | Active community users who post/comment frequently and could become contributors | `posts` + `public_users` | `pulse_signals` (type: CONTRIBUTOR_CANDIDATE) |
| **Dormant Claimed** | Businesses that were claimed but have gone inactive | `businesses` | `pulse_signals` (type: DORMANT_CLAIMED) |
| **Trending Topics** | Tags/topics with more posts this week vs. last week | `posts` | `pulse_signals` (type: TRENDING_TOPIC) |

### 2B. Content Generator
Runs every 6 hours. Uses GPT-4o-mini to create 3 types of drafts per city:

| Draft Type | What It Creates | Data Source |
|------------|----------------|-------------|
| **Most-Saved Roundup** | "Most Saved This Week" article highlighting top-saved businesses | `intelligence_event_log` (SAVE events) |
| **New in Zone** | Article about newly added businesses in a neighborhood | `businesses` (recent additions) |
| **Trending Post** | Short post about a trending topic | `pulse_signals` (TRENDING_TOPIC signals) |

All drafts are saved to `ai_content_drafts` with status "draft" — they require manual review and publishing.

### 2C. Outreach Drafter
Runs every 6 hours. Uses GPT-4o to write 3 types of personalized email drafts:

| Template Type | Who It Targets | Purpose |
|--------------|----------------|---------|
| **Claim Invites** | Unclaimed high-demand businesses | "Your business is getting attention — claim your listing" |
| **Upgrade Pitches** | Claimed businesses showing upgrade-ready signals | "Upgrade to Enhanced/Charter for more visibility" |
| **Re-engagement** | Dormant claimed businesses | "We noticed your listing hasn't been updated — here's what's new" |

All drafts are saved to `outreach_drafts` — they require manual review before sending.

### 2D. Social Content Generator
Runs every 6 hours. Creates social media post drafts from 4 content pools:

| Source | What It Generates |
|--------|------------------|
| **Top Pulse Posts** | Social captions for popular community posts |
| **Recently Claimed Businesses** | "Welcome to the platform" social posts |
| **Upcoming Popular Events** | Event promotion posts |
| **Recent Articles** | Article promotion posts |

Uses GPT-4o-mini for caption generation. Adds local hashtags (#CLT, #CharlotteNC, etc.) and category-specific hashtags. All posts saved to `social_posts` with status "draft".

### 2E. Charlotte Conversational AI (Story Interviews)
- **What:** Interactive chat-based story creation system
- **How:** Charlotte conducts interviews with users via chat, gathering story material, then generates full articles using the `generate_story` tool
- **Auto-publish safety:** Uses OpenAI Moderation API (`checkAutoPublishSafe`). Safe content auto-publishes; flagged content stays as draft
- **Data source:** User conversation + business context
- **Output:** Published or draft `articles`

### 2F. Prospect Pipeline AI
- **Website Crawling:** Visits discovered websites to extract contact info, social links, industry signals
- **Location Classification:** Determines if business is storefront, home-based, or service-area
- **Outreach Recommendation:** Decides best contact method (visit in person, email owner, etc.)
- **Industry Tagging:** Uses AI to apply fine-grained industry tags
- **Entity Scoring:** Computes Prospect Fit Score and Contact Ready Score, bucketing as TARGET, PROSPECT, or LOW

### 2G. URL Enrichment
- **What:** Scrapes business websites to extract schema.org data, social media handles (Facebook, Instagram, LinkedIn, Twitter/X), contact details
- **Trigger:** On business capture or discovery
- **Output:** Enriched business records with social links, emails, phone numbers

---

## 3. CONTENT STREAMS

### 3A. RSS News Feeds
- **Source:** Configured RSS feeds in `metro_sources` table
- **Filtering:** Negative content blocklist (crime/violence), political blocklist, local keyword matching
- **Categorization:** Auto-tagged by source category; admin can re-categorize
- **Approval:** Goes to `rss_items` table. Requires `reviewStatus === 'APPROVED'` before appearing in Pulse feed
- **Publishes to:** Pulse feed (after approval)

### 3B. iCal Event Feeds
- **Source:** Configured iCal feeds in `metro_sources` table
- **Filtering:** Academic/irrelevant event blocklist; local keyword matching
- **Categorization:** By source category assignment
- **Approval:** Created as `importDrafts`, requires admin publish action
- **Publishes to:** Events section + Pulse feed

### 3C. Seeded Businesses (Google Places / OSM / IRS)
- **Google Places:** Admin-triggered searches by keyword + ZIP code, or automated via jobRunner
- **OSM Overpass:** Automated pulls of amenity/shop/office nodes for Charlotte area
- **IRS Nonprofits:** Automated pulls of nonprofit organizations
- **Filtering:** Duplicate detection via place ID matching; category mapping via `GOOGLE_TYPES_TO_L2_SLUGS`
- **Approval:** Businesses appear in directory immediately; prospect pipeline scores them for CRM promotion
- **Publishes to:** Business directory, Pulse feed (as business cards)

### 3D. Community Submissions (Posts / Reels)
- **Source:** User-submitted posts via feed submission form
- **Filtering:** Moderation queue
- **Approval:** Status must be `published` (may go through moderation)
- **Publishes to:** Pulse feed

### 3E. AI-Generated Stories
- **Source:** Charlotte Intelligence content generator + story interviews
- **Filtering:** OpenAI Moderation API for auto-publish safety check
- **Approval:** Auto-published if safe; otherwise held as draft for manual review
- **Publishes to:** Stories section (`/articles`) + Pulse feed

### 3F. Marketplace Items
- **Source:** Business owners post products/services
- **Filtering:** Status must be `ACTIVE`
- **Approval:** Direct publish by business owner
- **Publishes to:** Marketplace section + Pulse feed

### 3G. Shop Drops & Deals
- **Source:** Business owners create time-sensitive deals
- **Filtering:** Active status + time window
- **Approval:** Direct publish by business owner
- **Publishes to:** Shop section + Pulse feed

### 3H. Live Feeds / Venue Content
- **Source:** Venue channels with live or scheduled sessions
- **Filtering:** Active session status
- **Approval:** Automatic when session starts
- **Publishes to:** Pulse feed (injected as live items)

### 3I. Enhanced/Charter Business Listings (Sponsored Injection)
- **Source:** Businesses on paid tiers (Enhanced, Charter)
- **Filtering:** Active paid tier status
- **Approval:** Automatic based on tier
- **Publishes to:** Pulse feed at fixed intervals (every 5-12 items in feed)

---

## 4. PROSPECT / BUSINESS DISCOVERY

### 4A. How New Businesses Enter the System

| Channel | Trigger | Storage |
|---------|---------|---------|
| **Google Places** | Admin search or automated jobRunner pull | `businesses` table (seedSourceType: GOOGLE_PLACES) |
| **OSM Overpass** | Automated jobRunner pull | `businesses` table (seedSourceType: OSM_OVERPASS) |
| **IRS Nonprofit Data** | Automated jobRunner pull | `businesses` table |
| **User Submissions** | Public "Submit a Business" form | `submissions` table -> reviewed -> `businesses` |
| **Business Card Capture** | Mobile field capture by operator | `crm_contacts` -> auto-creates `businesses` listing |
| **Directory Crawling** | Pipeline finds directory/news sites, crawls for business listings | `businesses` + `crm_contacts` |
| **Press Release Detection** | RSS feeds flagged as press/PR sources | `rss_items` -> manual review -> can create business entries |

### 4B. How Contacts Are Detected

| Source | What's Extracted |
|--------|-----------------|
| **Website Crawling** | Email, phone, social links, schema.org data |
| **Google Places** | Phone, website, hours, photos, rating, review count |
| **Business Card OCR** | Name, email, phone, company, job title (via GPT-4o vision) |
| **Voice Memo Capture** | Transcribed contact details (via Whisper/GPT) |
| **Handwriting Capture** | OCR'd notes about contacts |
| **Form Submissions** | Self-reported contact data |

### 4C. Where Records Appear in Admin

- **Intelligence Engine panel:** Shows pipeline status, entity scores, prospect buckets
- **Inbox:** High-priority alerts for unclaimed high-demand businesses, pipeline completion summaries
- **CRM Contacts:** All captured contacts with filtering by category (inbox, want_to_meet, potential_client, current_client)
- **CRM Organizations:** Business entities with presence tracking (intake -> assigned -> contacted -> won/lost)
- **Listings to Claim:** Pipeline of verified businesses awaiting owner claims
- **Submissions:** Queue of user-submitted businesses/events pending review

---

## 5. CRM / CONTACT DATA

### 5A. What's Captured and Where

| Data Type | Table | Fields |
|-----------|-------|--------|
| **Email** | `crm_contacts` | `email` |
| **Phone** | `crm_contacts` | `phone` |
| **Website** | `businesses` | `website` |
| **Press Contacts** | `crm_contacts` linked to submissions | `email`, `phone`, `company` |
| **Marketing Contacts** | `crm_contacts` | `email`, `category` (potential_client, etc.) |
| **Social Links** | `businesses` | `socialLinks` (JSON: Facebook, Instagram, LinkedIn, Twitter/X, TikTok, YouTube) |
| **vCard Data** | `crm_contacts` | `vcardData` (JSONB — parsed from business cards) |
| **AI-Extracted Data** | `crm_contacts` | `aiExtracted` (JSONB — GPT-4o analysis of business cards/voice memos) |
| **Verified Contacts** | `entity_contact_verification` | Emails and phones found via web crawling |

### 5B. How Contacts Are Used for Outreach

1. **Outreach Drafts:** Charlotte generates personalized email drafts (claim invites, upgrade pitches, re-engagement) targeting contacts based on pulse signals
2. **Territory Email Service:** Delivers outreach via Resend, tracks every outbound message in `comms_log`
3. **Nudge Windows:** Each contact has `nudgeWindowDays` (default 30) and `nudgeSnoozeUntil` to track follow-up timing
4. **CRM Presence Tracking:** Businesses move through stages: intake -> assigned -> contacted -> won/lost
5. **Weekly Digest:** Subscribers receive automated weekly email digests
6. **Referral Triangles:** System tracks introductions between contacts, monitoring delivery status

### 5C. Capture Methods

- **Field Capture (Mobile):** Business cards (OCR), handwriting notes, voice memos
- **URL Drop:** Paste a URL, system crawls and extracts contact data
- **Google Places Match:** Auto-enriches with Google business data
- **Manual Entry:** Admin creates contacts directly
- **Form Submissions:** Public-facing business/event submission forms
- **Auto-Promotion:** Pipeline auto-promotes high-scoring prospects to CRM

---

## 6. ADMIN SURFACES

### 6A. Command Center
| Surface | Purpose |
|---------|---------|
| **Command Center Dashboard** | High-level stats: business count, events, articles, leads, system activity |
| **Inbox** | Unified task queue: billing past due, email bounces, presence verification requests, pipeline alerts |
| **Submissions** | Review queue for user-submitted businesses, events, and edits |
| **Catch (Mobile)** | Mobile-optimized quick data capture interface |

### 6B. CRM
| Surface | Purpose |
|---------|---------|
| **Contacts** | People database with role filters (want to meet, current clients, potential clients) |
| **Organizations** | Business/org database with presence stage tracking |
| **Referrals** | Referral triangle tracking |
| **Communications** | Outreach management hub |
| **Comms Log** | History of all sent communications |

### 6C. Content & Listings
| Surface | Purpose |
|---------|---------|
| **Businesses** | Directory management — all business listings |
| **Events** | Calendar and event management |
| **Categories** | Taxonomy management (L1/L2/L3 categories) |
| **CMS Overview** | Content management dashboard |
| **Content Library** | All CMS articles and pages |
| **Media Library** | Uploaded images and assets |
| **Pulse** | Article/editorial management |
| **Pulse Posts** | Short-form social content management |
| **Shop & Deals** | Marketplace listing management |
| **Curated Lists** | "Top 10" and "Best of" list creation |
| **Content Pages** | Static page management (Legal, Terms, About) |

### 6D. Hub Operations
| Surface | Purpose |
|---------|---------|
| **Live Feeds** | Real-time content stream management |
| **Web TV / Venue Channels** | Digital signage and TV display programming |
| **Social Publishing** | Push content to social media platforms |
| **AI Site Builder** | Generate microsites and landing pages |
| **Banner Ads / Ad Management** | Display advertising and campaign management |
| **Tags** | Global tag management |
| **Feed Debug** | Technical feed troubleshooting |
| **Moderation Hub** | Content moderation queue (reviews, submissions, posts) |
| **Content Sources / Intake** | RSS/iCal/scraper source management |
| **Places Import** | Google Places bulk import tool |
| **Listings to Claim** | Verified businesses awaiting owner claims |
| **Authors** | Content creator profile management |
| **Editorial Calendar** | Content publication scheduling |

### 6E. Metro Intelligence (AI)
| Surface | Purpose |
|---------|---------|
| **Intelligence Engine** | AI dashboard: industry tagging, entity scoring, pipeline status |
| **Pulse Intelligence** | AI-driven local news and signal scanning |
| **Outreach Queue** | AI-drafted outreach emails awaiting review/send |
| **Content Drafts** | AI-generated article and post drafts |
| **Micro Prospects** | Niche lead generation targeting |
| **Report Requests** | Custom intelligence report management |
| **Flow Sessions** | AI chat interaction and lead qualification monitoring |

### 6F. Tools & Settings
| Surface | Purpose |
|---------|---------|
| **Mileage Log** | Business travel tracking |
| **Digital Cards** | Digital business card / NFC profile management |
| **Listing Tiers / Add-Ons** | Pricing level and featured placement configuration |
| **Tiers & Inquiries** | Upgrade inquiry management |
| **Coverage / Feature Audit** | Geographic data completeness diagnostics |
| **SEO Diagnostic** | Search engine optimization health analysis |
| **Content Journal** | Internal editorial change log |
| **Platform Affiliates** | Referral partner and affiliate link management |

### 6G. Platform Master (Super Admin)
| Surface | Purpose |
|---------|---------|
| **Hub Management** | Global city hub management (Metro + Micro hubs) |
| **Territory Sales** | Geographic sales reporting |
| **License CRM** | Hub operator/licensee management |
| **Revenue & Payouts** | Financial dashboard and vendor payout management |
| **ITEX Barter Trades** | Non-cash transaction tracking |
| **Audit Log** | Full system action history |
| **Teach AI** | Charlotte AI training/fine-tuning interface |
| **Messaging Library** | Canned response and template management |

---

## 7. WHAT STILL REQUIRES MANUAL WORK

### Content Operations
1. **RSS Article Approval** — Ingested RSS items must be manually reviewed and approved before appearing in the Pulse feed
2. **Import Draft Publishing** — iCal events and URL-extracted content arrive as drafts; admin must publish individually or bulk-publish
3. **AI Content Draft Review** — Charlotte generates article drafts, but they sit in `ai_content_drafts` until an admin reviews and publishes
4. **Flagged AI Stories** — Stories that fail the OpenAI Moderation check require manual review before publishing
5. **Community Post Moderation** — User-submitted posts may need moderation approval

### Sales & Outreach
6. **Outreach Draft Review & Send** — Charlotte writes personalized email drafts, but an admin must review and trigger the actual send
7. **Social Post Review & Publish** — AI-generated social media posts are saved as drafts; admin must review, edit, and push to social platforms
8. **CRM Stage Progression** — While the pipeline auto-promotes high-scoring prospects, moving contacts through later stages (contacted -> won/lost) is manual
9. **Nudge Follow-ups** — The system tracks nudge windows, but the actual follow-up action is manual

### Business Operations
10. **Google Places Import Triggering** — Searching for and importing new businesses from Google Places requires admin to initiate the search
11. **Business Claim Verification** — When a business owner claims a listing, admin reviews and approves
12. **Submission Review** — All user submissions (new businesses, events, business edits) require manual admin review
13. **Category/Zone Assignment** — New businesses may need manual category or zone assignment refinement

### Platform Management
14. **Banner Ad Creation & Scheduling** — Ad campaigns must be manually created and scheduled
15. **Editorial Calendar Management** — Content scheduling is manual
16. **Curated List Curation** — "Top 10" and "Best of" lists must be manually assembled
17. **TV/Venue Channel Programming** — Schedule creation and loop assignment is manual
18. **Hub Licensing** — New city hub setup and licensee onboarding is manual
19. **Revenue/Payout Processing** — Financial operations require manual oversight

---

## 8. AUTOMATION OPPORTUNITIES

### High Impact — Could Be Automated Now
1. **Auto-Approve Clean RSS Items** — RSS articles that pass all blocklists AND match strong local keywords could be auto-approved without manual review. Add a confidence score threshold; anything above it auto-publishes, below it goes to queue.

2. **Auto-Send Outreach Drafts** — Outreach emails rated "high confidence" by Charlotte could be auto-sent after a configurable delay (e.g., 24-hour hold then auto-send unless admin intervenes). The drafts already exist.

3. **Auto-Publish AI Content Drafts** — The same moderation check used for story interviews could be applied to Charlotte's content generator output. Safe drafts auto-publish; flagged ones queue for review.

4. **Auto-Publish Social Posts** — Social posts generated from already-published content (articles, events) could auto-publish to connected platforms since the source content was already approved.

5. **Scheduled Google Places Sweeps** — Instead of admin-triggered searches, configure automatic monthly sweeps of key ZIP codes and business categories to discover new businesses without manual initiation.

6. **Auto-Send Nudge Reminders** — When a contact's nudge window expires, auto-send a pre-drafted follow-up email instead of just flagging it for admin attention.

### Medium Impact — Would Reduce Operator Load
7. **Smart Digest Content Selection** — Currently the digest compiles content. Charlotte could write a custom intro/summary for each digest, personalizing it by subscriber interests/location.

8. **Auto-Curated Lists** — "Top 10" lists could be auto-generated weekly based on save counts, review scores, and engagement data, then queued for quick admin review rather than built from scratch.

9. **Automated Coverage Gap Alerts** — The system could automatically identify ZIP codes or categories with thin coverage and suggest targeted Google Places imports.

10. **Auto-Claim Outreach Escalation** — If a claim invite email gets no response after 14 days, auto-send a follow-up. After 30 days with no response, auto-generate a different approach (SMS if phone available, or mark for in-person visit).

11. **Editorial Calendar Auto-Population** — Charlotte could auto-suggest a weekly content calendar based on upcoming events, trending topics, and seasonal patterns, pre-scheduling AI-generated drafts.

12. **Automated Ad Inventory Suggestions** — Based on business engagement data, automatically identify businesses that would benefit from banner ad placement and generate pitch drafts.

### Lower Priority — Future Enhancements
13. **Multi-Platform Social Auto-Posting** — Direct API integration with Facebook, Instagram, X, LinkedIn to auto-post approved social content instead of relying on operator to copy/paste.

14. **AI-Powered Review Moderation** — Use AI to auto-approve user reviews that are clearly positive/neutral and flag only potentially problematic ones.

15. **Automated Revenue Reporting** — Generate and email monthly revenue summaries to hub operators without manual dashboard review.

16. **Smart Business Category Refinement** — Use the industry tagger on existing businesses periodically to improve category accuracy as the taxonomy evolves.

---

## Summary: What's Running Right Now Without You

| System | Frequency | Fully Automated? |
|--------|-----------|-----------------|
| RSS/iCal/OSM feed ingestion | Every 2 hours | Yes (ingestion). No (approval required for publishing) |
| CMS scheduled publish/unpublish | Every 60 seconds | Yes |
| Charlotte Pulse Scanner | Every 6 hours | Yes (creates signals + inbox alerts) |
| Charlotte Content Generator | Every 6 hours | Yes (creates drafts). No (publishing is manual) |
| Charlotte Outreach Drafter | Every 6 hours | Yes (creates drafts). No (sending is manual) |
| Charlotte Social Generator | Every 6 hours | Yes (creates drafts). No (publishing is manual) |
| Prospect Pipeline | Daily at 2 AM ET | Yes (scores + auto-promotes targets to CRM) |
| Weekly Digest Email | Mondays 8-9 AM ET | Yes (fully automated send) |
| Share payload cleanup | Every 60 seconds | Yes |
| Feed session cleanup | Periodic | Yes |

**Bottom line:** The platform is pulling data, analyzing it, scoring prospects, generating content drafts, writing outreach emails, and creating social posts — all automatically. The main bottleneck is the "last mile" of human review. The single biggest efficiency gain would be adding confidence-based auto-approval for RSS items, outreach emails, and social posts, turning Charlotte from a drafting assistant into a publishing engine.
