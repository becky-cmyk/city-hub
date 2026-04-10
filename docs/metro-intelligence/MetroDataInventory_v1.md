# Metro Data Inventory v1 — Silent Aggregation Mode

## Overview

The Metro Intelligence Engine is the community data layer for City Core Hub. It aggregates public signals (business filings, multifamily developments, permits, zoning) and internal platform behavior (search queries, language usage, engagement) into actionable intelligence.

**Philosophy**: Silent Aggregation Mode — collect, normalize, and store first; monetize later. We never sell raw personal data. Only anonymized, aggregated patterns.

**Multi-Tenant Scoping**: Everything is scoped by `cityId` (metro) and `zoneId` (ZIP area) using existing tables. Timestamps and source attribution on every record.

---

## Data Streams

### A) Demand / Intent (Resident Behavior)

#### A1: Search / Ask Queries
- **Fields**: queryText, zipCode, language, categoryInferred, timestamp
- **Sources**: internal_log (site search)
- **Cadence**: Realtime
- **Normalization**: Lowercase, trim, remove special chars, infer category from keywords
- **Storage**: `language_usage_log` (eventType = "search_submit")
- **Monetization**: Zip Demand Heat Index, Category Momentum Report

#### A2: Filter Usage
- **Fields**: filterType (open_now, pet_friendly, family_friendly, etc.), zipCode, language, timestamp
- **Sources**: internal_log
- **Cadence**: Realtime
- **Storage**: `language_usage_log` (eventType = "filter_apply")
- **Monetization**: Retail Opportunity Gaps

#### A3: Neighborhood Exploration
- **Fields**: fromZip, toZip, pageType (live/work/play), sessionId, timestamp
- **Sources**: internal_log
- **Cadence**: Realtime
- **Storage**: `language_usage_log` (eventType = "page_view")
- **Monetization**: Emerging Neighborhood Index

#### A4: Saves/Follows
- **Fields**: itemType, itemId, zipCode, language, timestamp
- **Sources**: internal_log (device_saved_items table)
- **Cadence**: Realtime
- **Storage**: Existing `device_saved_items` table
- **Monetization**: Zip Demand Heat Index

#### A5: No Result Found Events
- **Fields**: queryText, zipCode, language, categoryAttempted, timestamp
- **Sources**: internal_log
- **Cadence**: Realtime
- **Storage**: `language_usage_log` with empty result flag
- **Monetization**: Retail Opportunity Gaps

#### A6: Repeat Query Patterns
- **Fields**: queryText, frequency, zipCode, language, timeWindow
- **Sources**: Derived from language_usage_log
- **Cadence**: Weekly aggregation
- **Storage**: Derived/computed
- **Monetization**: Category Momentum Report

#### A7: English vs Spanish Usage
- **Fields**: language, pageType, zipCode, eventType, timestamp
- **Sources**: internal_log
- **Cadence**: Realtime
- **Storage**: `language_usage_log`
- **Monetization**: Hispanic Market Demand Map

---

### B) Supply / Business Ecosystem Behavior

#### B8: Listing Engagement
- **Fields**: businessId, eventType (view, click_to_call, click_to_site, directions), zipCode, timestamp
- **Sources**: internal_log (engagement_events table)
- **Cadence**: Realtime
- **Storage**: Existing `engagement_events` table
- **Monetization**: Lead Quality Index

#### B9: Listing Updates Frequency
- **Fields**: businessId, fieldChanged, timestamp
- **Sources**: internal_log
- **Cadence**: On update
- **Storage**: Existing `businesses.updatedAt`
- **Monetization**: Supply freshness scoring

#### B10: Event Creation & Engagement
- **Fields**: eventId, creatorBusinessId, attendeeCount, zipCode, timestamp
- **Sources**: internal_log
- **Cadence**: Realtime
- **Storage**: Existing `events` table
- **Monetization**: Category Momentum Report

#### B11: Drop/Offer Participation
- **Fields**: offerId, businessId, participationType, timestamp
- **Sources**: internal_log
- **Cadence**: On event
- **Storage**: Future `drops_log` table
- **Monetization**: B2B Vendor Demand Index

#### B12: Referral Network Activity
- **Fields**: referrerId, referredId, status, timestamp
- **Sources**: internal_log (referme system)
- **Cadence**: On event
- **Storage**: Existing referral tables
- **Monetization**: B2B Vendor Demand Index

#### B13: Cross-Promotion Partnerships
- **Fields**: businessIdA, businessIdB, promoType, startDate, endDate
- **Sources**: internal_log
- **Cadence**: Manual
- **Storage**: Future `cross_promo_log` table
- **Monetization**: B2B Vendor Demand Index

---

### C) Lead Gateway Intelligence

#### C14: Lead Form Submissions
- **Fields**: category, zipCode, timeline, budgetRange, languagePreference, timestamp
- **Sources**: internal_log (lead_submissions table)
- **Cadence**: Realtime
- **Storage**: Existing `lead_submissions` table
- **Monetization**: Lead Quality Index

#### C15: Lead Funnel Metrics
- **Fields**: funnelStep (start/complete/abandon), category, zipCode, timestamp
- **Sources**: Derived from lead_submissions
- **Cadence**: Daily aggregation
- **Storage**: Derived/computed
- **Monetization**: Lead Quality Index

#### C16: Response Time Tracking
- **Fields**: leadId, businessId, responseTimeMinutes, timestamp
- **Sources**: internal_log
- **Cadence**: On response
- **Storage**: Existing `leads` table
- **Monetization**: Lead Quality Index

#### C17: Outcome Tracking
- **Fields**: leadId, outcome (converted/not_converted), revenue, timestamp
- **Sources**: CRM integration / manual
- **Cadence**: Manual
- **Storage**: Existing `leads` table (status field)
- **Monetization**: Lead Quality Index

#### C18: Demand-to-Supply Gap Metrics
- **Fields**: category, zipCode, demandScore, supplyCount, gapScore
- **Sources**: Derived from search logs + listing counts
- **Cadence**: Weekly
- **Storage**: Derived/computed
- **Monetization**: Retail Opportunity Gaps

---

### D) Real Estate + Development + Zoning (Public Signals)

#### D19: Building Permits
- **Fields**: permitNumber, permitType, value, address, zipCode, contractor, issueDate, source, sourceUrl
- **Sources**: public_record (county/city permit portals)
- **Cadence**: Weekly
- **Storage**: Future `permits_log` table
- **Monetization**: Development Pressure Score

#### D20: Zoning / Rezoning Petitions
- **Fields**: petitionId, petitionType, address, hearingDate, outcome, source, sourceUrl
- **Sources**: public_record (city planning commission)
- **Cadence**: Weekly
- **Storage**: Future `zoning_log` table
- **Monetization**: Development Pressure Score

#### D21: Development Approvals
- **Fields**: projectName, unitCount, commercialSqFt, address, approvalDate, source
- **Sources**: public_record
- **Cadence**: Monthly
- **Storage**: Future `dev_approvals_log` table
- **Monetization**: Development Pressure Score, Emerging Neighborhood Index

#### D22: Infrastructure Projects
- **Fields**: projectName, type (roads/transit/greenways), location, startDate, completionDate, budget
- **Sources**: public_record (NCDOT, city capital projects)
- **Cadence**: Monthly
- **Storage**: Future `infra_log` table
- **Monetization**: Emerging Neighborhood Index

#### D23: School Boundary Changes
- **Fields**: district, changeType, affectedZips, effectiveDate
- **Sources**: public_record (CMS school board)
- **Cadence**: Manual / as announced
- **Storage**: Future `schools_log` table
- **Monetization**: Emerging Neighborhood Index

#### D24: Crime Trend Aggregates
- **Fields**: zipCode, crimeCategory, count, period, trendDirection
- **Sources**: public_record (CMPD data portal)
- **Cadence**: Monthly
- **Storage**: Future `crime_trends` table (aggregates only, no incident-level data)
- **Monetization**: Emerging Neighborhood Index

#### D25: Retail/Commercial Vacancy
- **Fields**: propertyType, address, sqft, askingRent, timeOnMarket, source
- **Sources**: licensed_feed (CoStar), public_record (commercial listings)
- **Cadence**: Weekly
- **Storage**: Future `vacancy_snapshot` table
- **Monetization**: Retail Opportunity Gaps, Business Launch Radar

#### D26: Multifamily/Apartment Inventory
- **Fields**: propertyName, address, unitCount, developer, managementCompany, completionDate, leaseUpStatus, rentLow, rentHigh, website, phone, source
- **Sources**: manual, csv_import, licensed_feed
- **Cadence**: Weekly
- **Storage**: `multifamily_log` table (implemented)
- **Monetization**: Apartment Lease-Up & Population Inflow Signals

#### D27: Residential Moving Signals
- **Fields**: fromZip, toZip, moveType, timestamp
- **Sources**: Derived from apartment interest flows (future)
- **Cadence**: Monthly
- **Storage**: Future `moving_signals` table
- **Monetization**: Apartment Lease-Up & Population Inflow Signals

---

### E) Business Formation / Economic Activity

#### E28: New Business Filings
- **Fields**: filingExternalId, businessName, filingDate, status, industryCode, organizerName, registeredAgent, registeredAddress, mailingAddress, stateCode, source
- **Sources**: state_registry (NC SOS), manual, csv_import
- **Cadence**: Daily/Weekly
- **Storage**: `business_filings_log` table (implemented)
- **Monetization**: Business Launch Radar

#### E29: Business Closures/Dissolutions
- **Fields**: filingExternalId, businessName, dissolutionDate, reason, source
- **Sources**: state_registry
- **Cadence**: Weekly
- **Storage**: `business_filings_log` (status = "dissolved")
- **Monetization**: Business Launch Radar, Retail Opportunity Gaps

#### E30: Liquor License Filings (Optional)
- **Fields**: licenseNumber, businessName, address, licenseType, issueDate, source
- **Sources**: public_record (NC ABC Commission)
- **Cadence**: Monthly
- **Storage**: Future `liquor_licenses_log` table
- **Monetization**: Business Launch Radar (hospitality signal)

#### E31: Health Inspection Scores (Optional)
- **Fields**: businessName, address, inspectionDate, score, violations, source
- **Sources**: public_record (county health dept)
- **Cadence**: Monthly
- **Storage**: Future `inspections_log` table
- **Monetization**: Supply quality scoring

---

### F) Opportunity Board (B2B Signal Layer)

#### F32: Vendor Requests / Service Needs
- **Fields**: requestorBusinessId, serviceCategory, description, budget, zipCode, timestamp
- **Sources**: internal_log (future opportunity board feature)
- **Cadence**: On submission
- **Storage**: Future `vendor_requests` table
- **Monetization**: B2B Vendor Demand Index

#### F33: Space Available / Retail Vacancy Leads
- **Fields**: address, sqft, askingRent, propertyType, contactInfo, postedBy, timestamp
- **Sources**: internal_log (user-posted)
- **Cadence**: On submission
- **Storage**: Future `space_listings` table
- **Monetization**: Retail Opportunity Gaps

#### F34: Community Partnership Requests
- **Fields**: organizationId, partnershipType, description, targetAudience, timestamp
- **Sources**: internal_log
- **Cadence**: On submission
- **Storage**: Future `partnership_requests` table
- **Monetization**: B2B Vendor Demand Index

#### F35: Event Vendor Calls
- **Fields**: eventId, vendorCategory, description, deadline, timestamp
- **Sources**: internal_log
- **Cadence**: On submission
- **Storage**: Future `event_vendor_calls` table
- **Monetization**: B2B Vendor Demand Index

---

### G) Physical-to-Digital Network

#### G36: QR Scan Logs
- **Fields**: locationNodeId, scannedAt, deviceType, resultUrl, timestamp
- **Sources**: internal_log (QR system)
- **Cadence**: Realtime
- **Storage**: Future `qr_scan_log` table
- **Monetization**: Host Performance Index

#### G37: On-Prem Conversion Path
- **Fields**: scanId, viewedPage, leadGenerated, savedItem, conversionStep, timestamp
- **Sources**: Derived from QR scan + engagement events
- **Cadence**: Realtime
- **Storage**: Derived/computed
- **Monetization**: Host Performance Index

#### G38: Host Location Performance Index
- **Fields**: locationNodeId, totalScans, conversions, revenueAttributed, period
- **Sources**: Derived aggregation
- **Cadence**: Weekly
- **Storage**: Derived/computed
- **Monetization**: Host Performance Index

---

## Schema Plan (Recommended Tables / Logs)

### Implemented (Phase 1)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `business_filings_log` | NC business filings | cityId, zoneId, filingExternalId, businessName, filingDate, outreachStatus |
| `multifamily_log` | Apartment/multifamily properties | cityId, zoneId, propertyName, address, unitCount, leaseUpStatus, partnerStatus |
| `language_usage_log` | Language/demand event log | cityId, zoneId, pageType, language, eventType, queryText |
| `signals_feed` | Unified signal stream | cityId, zoneId, signalType, title, summary, score |

### Future (Phase 2+)
| Table | Purpose | Phase |
|-------|---------|-------|
| `permits_log` | Building permits | 2 |
| `zoning_log` | Zoning petitions/decisions | 2 |
| `vacancy_snapshot` | Retail/commercial vacancy | 2 |
| `dev_approvals_log` | Development approvals | 2 |
| `infra_log` | Infrastructure projects | 2 |
| `schools_log` | School boundary changes | 2 |
| `crime_trends` | Crime aggregates by ZIP | 2 |
| `qr_scan_log` | QR scan events | 3 |
| `vendor_requests` | B2B vendor needs | 3 |
| `space_listings` | Available commercial space | 3 |
| `partnership_requests` | Community partnerships | 3 |
| `event_vendor_calls` | Event vendor solicitations | 3 |
| `liquor_licenses_log` | Liquor license filings | 3 (optional) |
| `inspections_log` | Health inspection scores | 3 (optional) |

All tables include: `id`, `cityId` (FK cities), `zoneId` (FK zones, nullable), `source`, `sourceUrl` (nullable), `createdAt`, `updatedAt`.

---

## Future Products (Aggregated Only)

### 1. Zip Demand Heat Index
- **Streams**: A1, A2, A4, A7
- **Output**: Per-ZIP demand score by category and language
- **Audience**: Developers, retailers, brokers, franchises
- **Cadence**: Weekly snapshot

### 2. Category Momentum Report
- **Streams**: A1, A6, B10, B8
- **Output**: Trending and declining categories by ZIP over time
- **Audience**: Chambers of commerce, economic development orgs
- **Cadence**: Monthly

### 3. Development Pressure Score
- **Streams**: D19, D20, D21, D22
- **Output**: Composite score indicating development activity intensity per ZIP
- **Audience**: Real estate investors, developers
- **Cadence**: Monthly

### 4. Emerging Neighborhood Index
- **Streams**: D19-D24, A3, B8
- **Output**: Multi-factor index scoring neighborhood trajectory
- **Audience**: Real estate investors, retailers expanding footprint
- **Cadence**: Quarterly

### 5. Retail Opportunity Gaps
- **Streams**: A1, A5, C18, D25, E29
- **Output**: Categories with high demand but low supply per ZIP
- **Audience**: Franchises, retail chains, entrepreneurs
- **Cadence**: Monthly

### 6. Apartment Lease-Up & Population Inflow Signals
- **Streams**: D26, D27
- **Output**: New multifamily completions correlated with demand signals
- **Audience**: Property managers, retailers, service providers
- **Cadence**: Monthly

### 7. Hispanic Market Demand Map
- **Streams**: A7, A1 (Spanish queries), C14 (language preference)
- **Output**: Spanish-language demand density by ZIP and category
- **Audience**: Bilingual businesses, franchises targeting Hispanic market
- **Cadence**: Monthly

### 8. Business Launch Radar
- **Streams**: E28, E29, E30, D25
- **Output**: New business formations + vacancy data = launch signals
- **Audience**: B2B service providers, commercial landlords
- **Cadence**: Weekly

### 9. B2B Vendor Demand Index
- **Streams**: F32, F34, F35, B11, B12
- **Output**: Aggregated vendor/service demand by category
- **Audience**: B2B service providers
- **Cadence**: Monthly

### 10. Lead Quality Index
- **Streams**: C14, C15, C16, C17, B8
- **Output**: Aggregated lead performance metrics by category and ZIP
- **Audience**: Business owners evaluating platform ROI
- **Cadence**: Monthly

---

## Build Order (Silent Aggregation Mode)

### Phase 1 (Implemented)
- Business filings log + CSV/JSON ingestion
- Multifamily log + CSV/JSON ingestion
- Language/search event logging (page views, language toggles, searches)
- Signals feed (auto-populated from ingestion)
- Admin Intelligence Panel (4 tabs: Filings, Multifamily, Signals, Language & Demand)
- CSV export endpoints
- Background job stubs (disabled)

### Phase 2 (Next)
- Building permits log + ingestion
- Zoning petitions log + ingestion
- Commercial vacancy snapshots
- Development approvals tracking
- Infrastructure project tracking
- Derived: Development Pressure Score

### Phase 3
- QR scan logging integration
- Opportunity board (vendor requests, space listings)
- Event vendor calls
- Optional: Liquor licenses, health inspections
- Derived: Host Performance Index

### Phase 4
- Derived indexes: Zip Demand Heat, Category Momentum, Emerging Neighborhood
- Gap detection algorithms (demand vs supply)
- Hispanic Market Demand Map computation
- Business Launch Radar aggregation
- Internal reporting dashboards for derived products
