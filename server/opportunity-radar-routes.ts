import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, isNull, isNotNull, gte, or, count } from "drizzle-orm";
import {
  businesses, crmContacts, pulseSignals, listingsToClaimQueue,
  entityScores, entityContactVerification, zones, aiOutreachDrafts,
  categories, users, events, articles, posts, jobListings,
  marketplaceListings, emailTemplates,
} from "@shared/schema";
import { generateCaptureOutreachDraft, generateSeededOutreachDraft, previewOutreachEmail } from "./intelligence/outreach-drafter";
import { storage } from "./storage";
import {
  textSearchPlaces, fetchPlaceDetails, mapGoogleTypesToCategories,
  aiFallbackCategorize, matchZoneForAddress, isVenueScreenLikelyFromGoogleTypes,
  googlePlacePhotoUrl,
} from "./google-places";
import { crawlEntityWebsite } from "./intelligence/crawl/websiteCrawler";
import { generateBusinessSlug } from "./lib/slug-utils";
import { queueTranslation } from "./services/auto-translate";
import { getResendClient } from "./resend-client";

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const session = req.session as any;
  if (!session?.userId) {
    res.status(401).json({ error: "Admin login required" });
    return false;
  }
  return true;
}

function categorizeOpportunity(contactEmail: string | null, contactPhone: string | null, venueScreenLikely: boolean): string {
  if (contactEmail) return "ready_to_reach";
  if (venueScreenLikely && !contactEmail) return "venue_prospect";
  if (contactPhone && !contactEmail) return "phone_outreach";
  return "walk_in_needed";
}

const GOVT_INSTITUTIONAL_PATTERNS = [
  /\bdept\s+of\b/i,
  /\bdepartment\s+of\b/i,
  /\bcity\s+of\b/i,
  /\bstate\s+of\b/i,
  /\bcounty\s+(government|office|services|commission|board)\b/i,
  /\bmecklenburg\s+county\b/i,
  /\bfederal\b/i,
  /\bus\s+government\b/i,
  /\btransit\s+authority\b/i,
  /\binternational\s+airport\b/i,
  /\bmunicipal\s+airport\b/i,
  /\bregional\s+airport\b/i,
  /\bschool\s+district\b/i,
  /\bpublic\s+school/i,
  /\bpolice\b/i,
  /\bfire\s+department\b/i,
  /\bsheriff\b/i,
  /\bpost\s+office\b/i,
  /\bDMV\b/,
  /\bNCD[A-Z]{2,}\b/,
];

function isGovernmentEntity(name: string | null): boolean {
  if (!name) return false;
  return GOVT_INSTITUTIONAL_PATTERNS.some(p => p.test(name));
}

router.get("/api/admin/opportunity-radar", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { entityType, source, hub, status: activationStatus, sortBy, limit: limitStr, cityId, zoneId } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 500, 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cityFilter = cityId ? sql`AND b.city_id = ${String(cityId)}` : sql``;
    const crmCityFilter = cityId ? sql`AND (b.city_id = ${String(cityId)} OR c.linked_business_id IS NULL)` : sql``;

    const opportunities: any[] = [];

    const capturesResult = await db.execute(sql`
      SELECT c.id, c.name, c.company, c.email, c.phone, c.capture_method, c.capture_origin,
        c.linked_business_id, c.created_at, c.website,
        b.name as biz_name, b.slug as biz_slug, b.claim_status, b.seed_source_type, b.zone_id,
        b.venue_screen_likely, b.address, b.city, b.state,
        z.name as zone_name
      FROM crm_contacts c
      LEFT JOIN businesses b ON b.id = c.linked_business_id
      LEFT JOIN zones z ON z.id = b.zone_id
      WHERE c.capture_method IS NOT NULL
        AND c.created_at >= ${thirtyDaysAgo}
        AND c.deleted_at IS NULL
        ${crmCityFilter}
      ORDER BY c.created_at DESC
      LIMIT 200
    `);

    for (const r of capturesResult.rows as any[]) {
      const bizName = r.biz_name || r.company || r.name;
      if (isGovernmentEntity(bizName)) continue;
      const hasContact = !!(r.email || r.phone);
      const activated = r.claim_status === "CLAIM_SENT" || r.claim_status === "CLAIMED";
      const isFieldCapture = !!r.capture_origin;
      const seedType = r.seed_source_type;
      const captureMethod = r.capture_method;
      let source = "capture";
      let whySurfaced = `Field capture via ${captureMethod || "manual"}${r.capture_origin ? ` (${r.capture_origin.replace(/_/g, " ")})` : ""}`;
      if (seedType === "AD_SPOT") {
        source = "ad_spot";
        whySurfaced = "Competitor ad captured in field — advertising elsewhere";
      } else if (!isFieldCapture) {
        if (seedType) {
          source = seedType === "GOOGLE_PLACES" ? "google_places" : seedType === "OSM" ? "osm" : (seedType || "import").toLowerCase();
          whySurfaced = `Seeded from ${seedType} with contact on file`;
        } else if (captureMethod === "google_places" || captureMethod === "GOOGLE_PLACES") {
          source = "google_places";
          whySurfaced = "Imported from Google Places with contact on file";
        } else if (captureMethod === "osm" || captureMethod === "OSM") {
          source = "osm";
          whySurfaced = "Imported from OpenStreetMap with contact on file";
        }
      }
      const contactEmail = r.email || null;
      const contactPhone = r.phone || null;
      const venueScreenLikely = !!r.venue_screen_likely;
      const opportunityCategory = categorizeOpportunity(contactEmail, contactPhone, venueScreenLikely);
      opportunities.push({
        id: r.linked_business_id || `capture-${r.id}`,
        entityType: "business",
        name: r.biz_name || r.company || r.name,
        hub: r.zone_name || "",
        zoneId: r.zone_id || null,
        slug: r.biz_slug || null,
        source,
        sourceDetail: captureMethod,
        contactAvailable: hasContact,
        contactEmail,
        contactPhone,
        activationStatus: activated ? "activation_sent" : "pending",
        whySurfaced,
        recommendedNextStep: activated ? "Follow up on claim" : "Activate and send outreach",
        priorityScore: hasContact ? 85 : 60,
        createdAt: r.created_at,
        captureOrigin: r.capture_origin || null,
        businessId: r.linked_business_id || null,
        venueScreenLikely,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        opportunityCategory,
        tags: [isFieldCapture ? "field_capture" : "manual_capture", source].filter(Boolean),
      });
    }

    const seededResult = await db.execute(sql`
      SELECT b.id, b.name, b.slug, b.seed_source_type, b.seed_source_external_id,
        b.claim_status, b.owner_email, b.phone, b.zone_id, b.created_at,
        b.venue_screen_likely, b.address, b.city, b.state,
        z.name as zone_name,
        ecv.detected_email, ecv.detected_phone
      FROM businesses b
      LEFT JOIN zones z ON z.id = b.zone_id
      LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = b.id
      WHERE b.claimed_by_user_id IS NULL
        AND b.claim_status != 'CLAIMED'
        AND (b.activation_source IS NULL OR b.activation_source = '')
        ${cityFilter}
      ORDER BY b.created_at DESC
      LIMIT 2000
    `);

    for (const r of seededResult.rows as any[]) {
      if (isGovernmentEntity(r.name)) continue;
      const existsAlready = opportunities.some(o => o.id === r.id);
      if (existsAlready) continue;

      const contactEmail = r.owner_email || r.detected_email || null;
      const contactPhone = r.phone || r.detected_phone || null;
      const hasContact = !!(contactEmail || contactPhone);
      const activated = r.claim_status === "CLAIM_SENT";
      const venueScreenLikely = !!r.venue_screen_likely;
      const opportunityCategory = categorizeOpportunity(contactEmail, contactPhone, venueScreenLikely);

      opportunities.push({
        id: r.id,
        entityType: "business",
        name: r.name,
        hub: r.zone_name || "",
        zoneId: r.zone_id || null,
        slug: r.slug || null,
        source: r.seed_source_type === "CAPTURE" ? "capture" : r.seed_source_type === "AD_SPOT" ? "ad_spot" : r.seed_source_type ? (r.seed_source_type).toLowerCase() : "google_places",
        sourceDetail: r.seed_source_type || "google_places",
        contactAvailable: hasContact,
        contactEmail,
        contactPhone,
        activationStatus: activated ? "activation_sent" : "pending",
        whySurfaced: r.seed_source_type === "AD_SPOT" ? "Competitor ad captured in field — advertising elsewhere" : r.seed_source_type ? `Seeded from ${r.seed_source_type} — unclaimed` : "Discovered business — unclaimed with contact info",
        recommendedNextStep: activated ? "Follow up on claim" : "Activate and send outreach",
        priorityScore: hasContact ? 70 : 45,
        createdAt: r.created_at,
        captureOrigin: null,
        businessId: r.id,
        venueScreenLikely,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        opportunityCategory,
        tags: ["seeded", "unclaimed", "activation_ready"],
      });
    }

    const activatedResult = await db.execute(sql`
      SELECT b.id, b.name, b.slug, b.activation_source, b.claim_status, b.owner_email,
        b.phone, b.zone_id, b.created_at, b.venue_screen_likely, b.address, b.city, b.state,
        b.seed_source_type, b.opportunity_scores, b.opportunity_profile,
        z.name as zone_name,
        ecv.detected_email, ecv.detected_phone
      FROM businesses b
      LEFT JOIN zones z ON z.id = b.zone_id
      LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = b.id
      WHERE (
        b.activation_source IS NOT NULL
        OR (b.claim_status = 'CLAIM_SENT' AND b.owner_email IS NOT NULL AND b.seed_source_type IS NULL)
      )
        AND b.claimed_by_user_id IS NULL
        ${cityFilter}
      ORDER BY b.created_at DESC
      LIMIT 500
    `);

    for (const r of activatedResult.rows as any[]) {
      if (isGovernmentEntity(r.name)) continue;
      const existsAlready = opportunities.some(o => o.id === r.id);
      if (existsAlready) continue;

      const contactEmail = r.owner_email || r.detected_email || null;
      const contactPhone = r.phone || r.detected_phone || null;
      const hasContact = !!(contactEmail || contactPhone);
      const venueScreenLikely = !!r.venue_screen_likely;
      const opportunityCategory = categorizeOpportunity(contactEmail, contactPhone, venueScreenLikely);
      const scores = r.opportunity_scores as { hubTv?: number; listingUpgrade?: number; adBuyer?: number; eventPartner?: number; overall?: number } | null;
      const hasScores = scores && typeof scores === "object" && Object.keys(scores).length > 0;

      let recommendedNextStep = "Review activation";
      if (hasScores) {
        if ((scores.hubTv || 0) > 60) recommendedNextStep = "Hub TV candidate";
        else if ((scores.adBuyer || 0) > 60) recommendedNextStep = "Ad buyer prospect";
        else if ((scores.listingUpgrade || 0) > 60) recommendedNextStep = "Listing upgrade candidate";
        else if ((scores.eventPartner || 0) > 60) recommendedNextStep = "Event partner prospect";
      }

      const activationSource = r.activation_source || null;
      const source = activationSource === "charlotte" ? "charlotte" : "form_activated";
      const whySurfaced = activationSource === "charlotte"
        ? "Activated via Charlotte conversation"
        : "Activated via form";

      opportunities.push({
        id: r.id,
        entityType: "business",
        name: r.name,
        hub: r.zone_name || "",
        zoneId: r.zone_id || null,
        slug: r.slug || null,
        source,
        sourceDetail: activationSource || "form",
        contactAvailable: hasContact,
        contactEmail,
        contactPhone,
        activationStatus: r.claim_status === "CLAIMED" ? "claimed" : r.claim_status === "CLAIM_SENT" ? "activation_sent" : "pending",
        whySurfaced,
        recommendedNextStep,
        priorityScore: hasScores ? 80 : 65,
        createdAt: r.created_at,
        captureOrigin: null,
        businessId: r.id,
        venueScreenLikely,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        opportunityCategory,
        tags: hasScores ? ["activated", "profiled"] : ["activated", "needs_review"],
        opportunityScores: hasScores ? scores : null,
      });
    }

    const signalsResult = await db.execute(sql`
      SELECT ps.id as signal_id, ps.signal_type, ps.entity_type, ps.entity_id, ps.title, ps.summary,
        ps.score, ps.data_json, ps.created_at,
        b.name as biz_name, b.slug as biz_slug, b.claim_status, b.owner_email, b.phone as biz_phone,
        b.zone_id, b.seed_source_type, b.venue_screen_likely, b.address, b.city, b.state,
        z.name as zone_name
      FROM pulse_signals ps
      LEFT JOIN businesses b ON b.id = ps.entity_id
      LEFT JOIN zones z ON z.id = b.zone_id
      WHERE ps.status = 'new'
      ORDER BY ps.score DESC
      LIMIT 50
    `);

    for (const r of signalsResult.rows as any[]) {
      if (isGovernmentEntity(r.biz_name)) continue;
      const existsAlready = opportunities.some(o => o.id === r.entity_id);
      if (existsAlready) continue;

      const contactEmail = r.owner_email || null;
      const contactPhone = r.biz_phone || null;
      const hasContact = !!(contactEmail || contactPhone);
      const venueScreenLikely = !!r.venue_screen_likely;
      const opportunityCategory = categorizeOpportunity(contactEmail, contactPhone, venueScreenLikely);

      opportunities.push({
        id: r.entity_id || `signal-${r.signal_id}`,
        entityType: r.entity_type || "business",
        name: r.biz_name || (r.data_json as any)?.businessName || r.title,
        hub: r.zone_name || "",
        zoneId: r.zone_id || null,
        slug: r.biz_slug || null,
        source: "ai_discovery",
        sourceDetail: r.signal_type,
        contactAvailable: hasContact,
        contactEmail,
        contactPhone,
        activationStatus: "pending",
        whySurfaced: r.summary || r.title,
        recommendedNextStep: r.signal_type === "UNCLAIMED_HIGH_DEMAND" ? "Send claim invite" :
          r.signal_type === "UPGRADE_READY" ? "Pitch upgrade" :
          r.signal_type === "DORMANT_CLAIMED" ? "Re-engage" :
          r.signal_type === "CROWN_HUB_READY" ? "Activate Crown Program for this hub" : "Review and act",
        priorityScore: Number(r.score) || 50,
        createdAt: r.created_at,
        captureOrigin: null,
        businessId: r.entity_id || null,
        venueScreenLikely,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        opportunityCategory,
        signalId: r.signal_id,
        tags: [r.signal_type?.toLowerCase(), r.entity_type || "business"].filter(Boolean),
      });
    }

    const claimQueueResult = await db.execute(sql`
      SELECT ltc.id as queue_id, ltc.presence_id, ltc.source as queue_source, ltc.status as queue_status,
        ltc.notes, ltc.created_at,
        b.name as biz_name, b.slug as biz_slug, b.claim_status, b.owner_email, b.phone as biz_phone,
        b.zone_id, b.seed_source_type, b.venue_screen_likely, b.address, b.city, b.state,
        z.name as zone_name
      FROM listings_to_claim_queue ltc
      JOIN businesses b ON b.id = ltc.presence_id
      LEFT JOIN zones z ON z.id = b.zone_id
      WHERE ltc.status = 'ready'
        AND b.claimed_by_user_id IS NULL
      ORDER BY ltc.created_at DESC
      LIMIT 50
    `);

    for (const r of claimQueueResult.rows as any[]) {
      if (isGovernmentEntity(r.biz_name)) continue;
      const existsAlready = opportunities.some(o => o.id === r.presence_id);
      if (existsAlready) continue;

      const contactEmail = r.owner_email || null;
      const contactPhone = r.biz_phone || null;
      const hasContact = !!(contactEmail || contactPhone);
      const venueScreenLikely = !!r.venue_screen_likely;
      const opportunityCategory = categorizeOpportunity(contactEmail, contactPhone, venueScreenLikely);

      opportunities.push({
        id: r.presence_id,
        entityType: "business",
        name: r.biz_name,
        hub: r.zone_name || "",
        zoneId: r.zone_id || null,
        slug: r.biz_slug || null,
        source: r.queue_source || "claim_queue",
        sourceDetail: r.notes,
        contactAvailable: hasContact,
        contactEmail,
        contactPhone,
        activationStatus: "pending",
        whySurfaced: `In claim queue — ${r.notes || "ready for outreach"}`,
        recommendedNextStep: "Send claim invite",
        priorityScore: hasContact ? 75 : 50,
        createdAt: r.created_at,
        captureOrigin: null,
        businessId: r.presence_id,
        venueScreenLikely,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        opportunityCategory,
        tags: ["claim_candidate"],
      });
    }

    const highScoreResult = await db.execute(sql`
      SELECT es.entity_id, es.prospect_fit_score, es.contact_ready_score, es.bucket,
        b.name as biz_name, b.slug as biz_slug, b.claim_status, b.owner_email, b.phone as biz_phone,
        b.zone_id, b.claimed_by_user_id, b.seed_source_type,
        b.venue_screen_likely, b.address, b.city, b.state,
        z.name as zone_name,
        ecv.detected_email, ecv.detected_phone
      FROM entity_scores es
      JOIN businesses b ON b.id = es.entity_id
      LEFT JOIN zones z ON z.id = b.zone_id
      LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = es.entity_id
      WHERE es.prospect_fit_score >= 50
      ORDER BY es.prospect_fit_score DESC
      LIMIT 30
    `);

    for (const r of highScoreResult.rows as any[]) {
      if (isGovernmentEntity(r.biz_name)) continue;
      const existsAlready = opportunities.some(o => o.id === r.entity_id);
      if (existsAlready) continue;

      const contactEmail = r.owner_email || r.detected_email || null;
      const contactPhone = r.biz_phone || r.detected_phone || null;
      const hasContact = !!(contactEmail || contactPhone);
      const isClaimed = !!r.claimed_by_user_id;
      const venueScreenLikely = !!r.venue_screen_likely;
      const opportunityCategory = categorizeOpportunity(contactEmail, contactPhone, venueScreenLikely);

      opportunities.push({
        id: r.entity_id,
        entityType: "business",
        name: r.biz_name,
        hub: r.zone_name || "",
        zoneId: r.zone_id || null,
        slug: r.biz_slug || null,
        source: "scoring",
        sourceDetail: `Bucket: ${r.bucket}`,
        contactAvailable: hasContact,
        contactEmail,
        contactPhone,
        activationStatus: isClaimed ? "claimed" : r.claim_status === "CLAIM_SENT" ? "activation_sent" : "pending",
        whySurfaced: `High prospect fit score (${r.prospect_fit_score}) — ${r.bucket}`,
        recommendedNextStep: isClaimed ? "Pitch upgrade" : "Activate and send outreach",
        priorityScore: Number(r.prospect_fit_score) || 50,
        createdAt: null,
        captureOrigin: null,
        businessId: r.entity_id,
        venueScreenLikely,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        opportunityCategory,
        tags: ["visibility_prospect", r.bucket?.toLowerCase()].filter(Boolean),
      });
    }

    const pipelineReviewResult = await db.execute(sql`
      SELECT es.entity_id, es.prospect_fit_score, es.contact_ready_score, es.bucket,
        b.name as biz_name, b.slug as biz_slug, b.claim_status, b.owner_email, b.phone as biz_phone,
        b.zone_id, b.claimed_by_user_id,
        b.venue_screen_likely, b.address, b.city, b.state,
        z.name as zone_name,
        ecv.detected_email, ecv.detected_phone
      FROM entity_scores es
      JOIN businesses b ON b.id = es.entity_id
      LEFT JOIN zones z ON z.id = b.zone_id
      LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = es.entity_id
      WHERE es.bucket = 'NEEDS_REVIEW'
        AND b.claimed_by_user_id IS NULL
      ORDER BY es.prospect_fit_score DESC
      LIMIT 30
    `);

    for (const r of pipelineReviewResult.rows as any[]) {
      if (isGovernmentEntity(r.biz_name)) continue;
      const existsAlready = opportunities.some(o => o.id === r.entity_id);
      if (existsAlready) continue;

      const contactEmail = r.owner_email || r.detected_email || null;
      const contactPhone = r.biz_phone || r.detected_phone || null;
      const hasContact = !!(contactEmail || contactPhone);
      const venueScreenLikely = !!r.venue_screen_likely;
      const opportunityCategory = categorizeOpportunity(contactEmail, contactPhone, venueScreenLikely);

      opportunities.push({
        id: r.entity_id,
        entityType: "business",
        name: r.biz_name,
        hub: r.zone_name || "",
        zoneId: r.zone_id || null,
        slug: r.biz_slug || null,
        source: "pipeline_review",
        sourceDetail: "NEEDS_REVIEW",
        contactAvailable: hasContact,
        contactEmail,
        contactPhone,
        activationStatus: r.claim_status === "CLAIM_SENT" ? "activation_sent" : "pending",
        whySurfaced: "Pipeline flagged for review — location type or contact signals unclear",
        recommendedNextStep: "Review and classify, then activate if appropriate",
        priorityScore: Number(r.prospect_fit_score) || 40,
        createdAt: null,
        captureOrigin: null,
        businessId: r.entity_id,
        venueScreenLikely,
        address: [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
        opportunityCategory,
        tags: ["pipeline_review", "needs_review"],
      });
    }

    let filtered = opportunities;

    if (entityType && entityType !== "all") {
      filtered = filtered.filter(o => o.entityType === entityType);
    }
    if (source && source !== "all") {
      if (source === "activated") {
        filtered = filtered.filter(o => o.source === "charlotte" || o.source === "form_activated");
      } else {
        filtered = filtered.filter(o => o.source === source);
      }
    }
    if (hub && hub !== "all") {
      filtered = filtered.filter(o => o.hub === hub);
    }
    if (zoneId && zoneId !== "all") {
      filtered = filtered.filter(o => o.zoneId === zoneId);
    }
    if (activationStatus && activationStatus !== "all") {
      filtered = filtered.filter(o => o.activationStatus === activationStatus);
    }

    if (sortBy === "name") {
      filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "date") {
      filtered.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db2 - da;
      });
    } else {
      filtered.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    }

    const sources = Array.from(new Set(opportunities.map(o => o.source)));
    const hubs = Array.from(new Set(opportunities.map(o => o.hub).filter(Boolean)));

    const categoryCounts = {
      ready_to_reach: filtered.filter(o => o.opportunityCategory === "ready_to_reach").length,
      phone_outreach: filtered.filter(o => o.opportunityCategory === "phone_outreach").length,
      venue_prospect: filtered.filter(o => o.opportunityCategory === "venue_prospect").length,
      walk_in_needed: filtered.filter(o => o.opportunityCategory === "walk_in_needed").length,
    };

    return res.json({
      opportunities: filtered,
      total: opportunities.length,
      sources,
      hubs,
      categoryCounts,
    });
  } catch (err: any) {
    console.error("[OpportunityRadar] Error:", err.message);
    return res.status(500).json({ error: "Failed to load opportunity radar" });
  }
});

router.get("/api/admin/opportunity-radar/:id/preview", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const includeStoryAsk = req.query.includeStoryAsk === "true";

  try {
    const [captureContact] = await db.select().from(crmContacts)
      .where(and(
        eq(crmContacts.linkedBusinessId, id),
        isNotNull(crmContacts.captureOrigin),
      ))
      .orderBy(desc(crmContacts.createdAt))
      .limit(1);

    const [anyContact] = !captureContact
      ? await db.select().from(crmContacts)
          .where(and(
            eq(crmContacts.linkedBusinessId, id),
            isNull(crmContacts.deletedAt),
          ))
          .orderBy(desc(crmContacts.createdAt))
          .limit(1)
      : [captureContact];

    const captureOrigin = captureContact?.captureOrigin || null;
    const preview = await previewOutreachEmail(id, captureOrigin, includeStoryAsk);
    if (!preview) {
      return res.status(404).json({ error: "Business not found" });
    }

    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    const [ecv] = await db.select().from(entityContactVerification)
      .where(eq(entityContactVerification.entityId, id)).limit(1);

    const recipientEmail = captureContact?.email || anyContact?.email || biz?.ownerEmail || ecv?.detectedEmail || null;
    const recipientName = captureContact?.name || anyContact?.name || null;

    return res.json({
      ...preview,
      recipientEmail,
      recipientName,
    });
  } catch (err: any) {
    console.error("[OpportunityRadar] Preview error:", err.message);
    return res.status(500).json({ error: "Failed to preview" });
  }
});

router.post("/api/admin/opportunity-radar/:id/activate", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const { includeStoryAsk } = req.body || {};

  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    if (!biz) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (biz.presenceStatus === "INACTIVE" || biz.presenceStatus === "ARCHIVED") {
      await db.update(businesses).set({
        presenceStatus: "ACTIVE",
        updatedAt: new Date(),
      }).where(eq(businesses.id, id));
    }

    let draftId: string | null = null;

    const [captureContact] = await db.select().from(crmContacts)
      .where(and(
        eq(crmContacts.linkedBusinessId, id),
        isNotNull(crmContacts.captureOrigin),
      ))
      .orderBy(desc(crmContacts.createdAt))
      .limit(1);

    const [anyContact] = !captureContact
      ? await db.select().from(crmContacts)
          .where(and(
            eq(crmContacts.linkedBusinessId, id),
            isNull(crmContacts.deletedAt),
          ))
          .orderBy(desc(crmContacts.createdAt))
          .limit(1)
      : [captureContact];

    const [ecv] = await db.select().from(entityContactVerification)
      .where(eq(entityContactVerification.entityId, id)).limit(1);

    const bestEmail = captureContact?.email || anyContact?.email || biz.ownerEmail || ecv?.detectedEmail || null;

    if (captureContact?.captureOrigin) {
      const origin = captureContact.captureOrigin as "met_in_person" | "stopped_by_location" | "found_business_card";
      draftId = await generateCaptureOutreachDraft(
        id,
        origin,
        bestEmail,
        captureContact.name,
        !!includeStoryAsk,
      );
    } else {
      draftId = await generateSeededOutreachDraft(
        id,
        bestEmail,
        anyContact?.name || null,
        !!includeStoryAsk,
      );
    }

    if (biz.claimStatus === "UNCLAIMED") {
      await db.update(businesses).set({
        claimStatus: "CLAIM_SENT",
        updatedAt: new Date(),
      }).where(eq(businesses.id, id));
    }

    await db.update(pulseSignals).set({
      status: "actioned",
      reviewedAt: new Date(),
    }).where(and(
      eq(pulseSignals.entityId, id),
      eq(pulseSignals.status, "new"),
    ));

    await db.update(listingsToClaimQueue).set({
      status: "archived",
      updatedAt: new Date(),
    }).where(and(
      eq(listingsToClaimQueue.presenceId, id),
      eq(listingsToClaimQueue.status, "ready"),
    ));

    let draft = null;
    if (draftId) {
      const [draftRow] = await db.select().from(aiOutreachDrafts)
        .where(eq(aiOutreachDrafts.id, draftId)).limit(1);
      if (draftRow) {
        draft = {
          id: draftRow.id,
          subject: draftRow.subject,
          body: draftRow.body,
          recipientEmail: draftRow.recipientEmail,
          recipientName: draftRow.recipientName,
          templateType: draftRow.templateType,
          status: draftRow.status,
        };
      }
    }

    return res.json({
      ok: true,
      businessId: id,
      draftId,
      draft,
      message: `Listing activated and outreach draft created${draftId ? ` (${draftId})` : ""}`,
    });
  } catch (err: any) {
    console.error("[OpportunityRadar] Activate error:", err.message);
    return res.status(500).json({ error: "Failed to activate" });
  }
});

router.post("/api/admin/opportunity-radar/:id/log-call", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const { notes, type } = req.body || {};

  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    if (!biz) {
      return res.status(404).json({ error: "Business not found" });
    }

    const logType = type === "visit" ? "Visit" : type === "venue_pitch" ? "Venue pitch" : "Call";
    const logEntry = `[${logType} logged ${new Date().toLocaleDateString()}]${notes ? ` ${notes}` : ""}`;

    const [contact] = await db.select().from(crmContacts)
      .where(eq(crmContacts.linkedBusinessId, id))
      .orderBy(desc(crmContacts.createdAt))
      .limit(1);

    if (contact) {
      await db.update(crmContacts).set({
        notes: [contact.notes, logEntry].filter(Boolean).join("\n"),
        updatedAt: new Date(),
      }).where(eq(crmContacts.id, contact.id));
    }

    if (type !== "visit" && biz.claimStatus === "UNCLAIMED") {
      await db.update(businesses).set({
        claimStatus: "CLAIM_SENT",
        updatedAt: new Date(),
      }).where(eq(businesses.id, id));
    }

    return res.json({ ok: true, businessId: id, message: `${logType} logged successfully` });
  } catch (err: any) {
    console.error("[OpportunityRadar] Log call error:", err.message);
    return res.status(500).json({ error: "Failed to log call" });
  }
});

router.post("/api/admin/opportunity-radar/:id/add-email", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const { email } = req.body || {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email address required" });
  }

  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    if (!biz) {
      return res.status(404).json({ error: "Business not found" });
    }

    await db.update(businesses).set({
      ownerEmail: email.trim().toLowerCase(),
      updatedAt: new Date(),
    }).where(eq(businesses.id, id));

    const [contact] = await db.select().from(crmContacts)
      .where(eq(crmContacts.linkedBusinessId, id))
      .orderBy(desc(crmContacts.createdAt))
      .limit(1);

    if (contact && !contact.email) {
      await db.update(crmContacts).set({
        email: email.trim().toLowerCase(),
        updatedAt: new Date(),
      }).where(eq(crmContacts.id, contact.id));
    }

    return res.json({ ok: true, businessId: id, email: email.trim().toLowerCase(), message: "Email added — business is now ready to reach" });
  } catch (err: any) {
    console.error("[OpportunityRadar] Add email error:", err.message);
    return res.status(500).json({ error: "Failed to add email" });
  }
});

router.post("/api/admin/opportunity-radar/pull-listings", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { category, hub, maxResults: maxResultsStr } = req.body || {};

  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "category is required" });
  }

  const maxResults = Math.min(parseInt(maxResultsStr) || 20, 40);
  const searchArea = hub && hub !== "all" ? `${hub}, Charlotte NC` : "Charlotte NC";
  const query = `${category} in ${searchArea}`;

  try {
    const allCities = await storage.getAllCities();
    const city = allCities.find((c: any) => c.slug === "charlotte") || allCities[0];
    if (!city) return res.status(500).json({ error: "No city configured" });

    const cityZones = await storage.getZonesByCityId(city.id);
    const defaultZone = cityZones[0];
    if (!defaultZone) return res.status(500).json({ error: "No zones configured" });

    const allCategories = await db.select().from(categories);

    console.log(`[PullListings] Searching: "${query}" (max ${maxResults})`);
    const searchResults = await textSearchPlaces(query, maxResults, { skipDailyLimit: true });
    console.log(`[PullListings] Found ${searchResults.length} results from Google Places`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let withEmail = 0;
    let withPhone = 0;
    const importedBusinesses: Array<{ id: string; name: string; email: string | null; phone: string | null }> = [];

    for (const sr of searchResults) {
      try {
        const existing = await storage.getPresencePlacesSource(sr.place_id);
        if (existing) {
          skipped++;
          continue;
        }

        const existingByPlaceId = await db.select({ id: businesses.id })
          .from(businesses)
          .where(eq(businesses.googlePlaceId, sr.place_id))
          .limit(1);
        if (existingByPlaceId.length > 0) {
          skipped++;
          continue;
        }

        const details = await fetchPlaceDetails(sr.place_id, { skipDailyLimit: true });

        const matchedZoneId = details.formatted_address
          ? await matchZoneForAddress(details.formatted_address, city.id)
          : null;

        const slug = await generateBusinessSlug(details.name, city.id, {
          zoneId: matchedZoneId || defaultZone.id,
          address: details.formatted_address,
          cityName: city.name || null,
        });

        let photoImageUrl: string | null = null;
        let photoAttr: string | null = null;
        if (details.photos && details.photos.length > 0) {
          photoImageUrl = googlePlacePhotoUrl(details.photos[0].photo_reference, 800);
          if (details.photos[0].html_attributions?.length) {
            photoAttr = details.photos[0].html_attributions.join("; ");
          }
        }

        let resolvedCategoryIds: string[] = [];
        let venueScreenLikely = false;
        if (details.types && details.types.length > 0) {
          let { l2Slugs } = mapGoogleTypesToCategories(details.types);
          if (l2Slugs.length === 0) {
            l2Slugs = await aiFallbackCategorize(details.name, details.types);
          }
          if (l2Slugs.length > 0) {
            resolvedCategoryIds = allCategories
              .filter((c: any) => l2Slugs.includes(c.slug))
              .map((c: any) => c.id);
          }
          venueScreenLikely = isVenueScreenLikelyFromGoogleTypes(details.types);
        }

        const presence = await storage.createBusiness({
          cityId: city.id,
          zoneId: matchedZoneId || defaultZone.id,
          name: details.name,
          slug,
          description: null,
          address: details.formatted_address || null,
          city: "Charlotte",
          state: "NC",
          phone: details.formatted_phone_number || null,
          websiteUrl: details.website || null,
          hoursOfOperation: details.opening_hours?.weekday_text ? { weekday_text: details.opening_hours.weekday_text } : null,
          googlePlaceId: sr.place_id,
          googleRating: details.rating?.toString() || null,
          googleReviewCount: details.user_ratings_total || null,
          latitude: details.geometry?.location.lat?.toString() || null,
          longitude: details.geometry?.location.lng?.toString() || null,
          claimStatus: "UNCLAIMED",
          micrositeTier: "none",
          listingTier: "VERIFIED",
          presenceStatus: "ACTIVE",
          presenceStatus2: "DRAFT",
          categoryIds: resolvedCategoryIds,
          tagIds: [],
          venueScreenLikely,
          ...(photoImageUrl ? { imageUrl: photoImageUrl, photoAttribution: photoAttr } : {}),
        });

        queueTranslation("business", presence.id);

        await storage.createPresencePlacesSource({
          presenceId: presence.id,
          placeId: sr.place_id,
        });

        try {
          const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN")).limit(1);
          if (adminUser) {
            await db.insert(crmContacts).values({
              userId: adminUser.id,
              name: details.name,
              company: details.name,
              phone: details.formatted_phone_number || null,
              website: details.website || null,
              address: details.formatted_address || null,
              linkedBusinessId: presence.id,
              category: "potential_client",
              status: "active",
              captureMethod: "google_places",
              connectionSource: "manual_pull",
              notes: "Manually pulled via Opportunity Radar",
            });
          }
        } catch {}

        if (details.formatted_phone_number) withPhone++;

        if (details.website) {
          try {
            await crawlEntityWebsite(presence.id, details.website, city.id);
          } catch (crawlErr: any) {
            console.warn(`[PullListings] Crawl failed for ${details.name}:`, crawlErr.message);
          }
        }

        const [refreshed] = await db.select({ ownerEmail: businesses.ownerEmail }).from(businesses).where(eq(businesses.id, presence.id)).limit(1);
        if (refreshed?.ownerEmail) withEmail++;

        imported++;
        importedBusinesses.push({
          id: presence.id,
          name: details.name,
          email: refreshed?.ownerEmail || null,
          phone: details.formatted_phone_number || null,
        });
      } catch (err: any) {
        console.warn(`[PullListings] Failed to import ${sr.name}:`, err.message);
        failed++;
      }
    }

    console.log(`[PullListings] Done: ${imported} imported, ${skipped} skipped, ${failed} failed, ${withEmail} with email, ${withPhone} with phone`);

    return res.json({
      imported,
      skipped,
      failed,
      withEmail,
      withPhone,
      total: searchResults.length,
      businesses: importedBusinesses,
    });
  } catch (err: any) {
    console.error("[PullListings] Error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to pull listings" });
  }
});

router.post("/api/admin/opportunity-radar/crawl-for-emails", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const allCities = await storage.getAllCities();
    const city = allCities.find((c: any) => c.slug === "charlotte") || allCities[0];
    if (!city) return res.status(500).json({ error: "No city configured" });

    const uncrawledResult = await db.execute(sql`
      SELECT b.id, b.name, b.website_url
      FROM businesses b
      LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = b.id
      WHERE b.website_url IS NOT NULL
        AND b.website_url != ''
        AND b.owner_email IS NULL
        AND b.claimed_by_user_id IS NULL
        AND (ecv.id IS NULL OR ecv.crawl_status IS NULL OR ecv.crawl_status != 'SUCCESS')
      ORDER BY b.created_at DESC
      LIMIT 50
    `);

    const rows = uncrawledResult.rows as Array<{ id: string; name: string; website_url: string }>;
    console.log(`[CrawlForEmails] Found ${rows.length} businesses to crawl`);

    let crawled = 0;
    let emailsFound = 0;
    const concurrency = 5;

    for (let i = 0; i < rows.length; i += concurrency) {
      const batch = rows.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (row) => {
          try {
            const result = await crawlEntityWebsite(row.id, row.website_url, city.id);
            crawled++;
            if (result.detectedEmail) {
              emailsFound++;
            }
            return result;
          } catch (err: any) {
            console.warn(`[CrawlForEmails] Failed for ${row.name}:`, err.message);
            crawled++;
            return null;
          }
        })
      );
    }

    console.log(`[CrawlForEmails] Done: ${crawled} crawled, ${emailsFound} emails found`);

    return res.json({ crawled, emailsFound, total: rows.length });
  } catch (err: any) {
    console.error("[CrawlForEmails] Error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to crawl for emails" });
  }
});

router.get("/api/admin/opportunity-radar/coverage-gaps", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { zoneType, categoryId, limit: limitStr, cityId } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const zoneFilter = zoneType && zoneType !== "all" ? zoneType as string : null;

    const result = await db.execute(sql`
      WITH zone_category_counts AS (
        SELECT
          z.id as zone_id,
          z.name as zone_name,
          z.slug as zone_slug,
          z.type as zone_type,
          z.parent_zone_id,
          c.id as category_id,
          c.name as category_name,
          c.slug as category_slug,
          COUNT(b.id) as business_count,
          COUNT(CASE WHEN b.claimed_by_user_id IS NOT NULL THEN 1 END) as claimed_count
        FROM zones z
        CROSS JOIN categories c
        LEFT JOIN businesses b ON b.zone_id = z.id
          AND c.id = ANY(b.category_ids)
          AND b.presence_status = 'ACTIVE'
        WHERE z.is_active = true
          AND c.parent_category_id IS NOT NULL
          ${zoneFilter ? sql`AND z.type = ${zoneFilter}` : sql``}
          ${cityId ? sql`AND z.city_id = ${String(cityId)}` : sql``}
        GROUP BY z.id, z.name, z.slug, z.type, z.parent_zone_id, c.id, c.name, c.slug
      ),
      metro_averages AS (
        SELECT
          category_id,
          AVG(business_count) as avg_count,
          MAX(business_count) as max_count
        FROM zone_category_counts
        WHERE business_count > 0
        GROUP BY category_id
      )
      SELECT
        zcc.zone_id, zcc.zone_name, zcc.zone_slug, zcc.zone_type,
        zcc.category_id, zcc.category_name, zcc.category_slug,
        zcc.business_count, zcc.claimed_count,
        COALESCE(ma.avg_count, 0) as metro_avg,
        COALESCE(ma.max_count, 0) as metro_max
      FROM zone_category_counts zcc
      LEFT JOIN metro_averages ma ON ma.category_id = zcc.category_id
      WHERE ma.avg_count IS NOT NULL
        AND zcc.business_count < GREATEST(1, ma.avg_count * 0.5)
        ${categoryId ? sql`AND zcc.category_id = ${categoryId as string}` : sql``}
      ORDER BY (COALESCE(ma.avg_count, 0) - zcc.business_count) DESC
      LIMIT ${limit}
    `);

    const gaps = (result.rows as any[]).map(r => {
      const metroAvg = Number(r.metro_avg) || 0;
      const bizCount = Number(r.business_count) || 0;
      const deficit = Math.round(metroAvg - bizCount);
      const severity = bizCount === 0 ? "critical" : deficit >= 3 ? "high" : "moderate";
      return {
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        zoneSlug: r.zone_slug,
        zoneType: r.zone_type,
        categoryId: r.category_id,
        categoryName: r.category_name,
        categorySlug: r.category_slug,
        businessCount: bizCount,
        claimedCount: Number(r.claimed_count) || 0,
        metroAverage: Math.round(metroAvg * 10) / 10,
        metroMax: Number(r.metro_max) || 0,
        deficit,
        severity,
        whyItMatters: bizCount === 0
          ? `No ${r.category_name} businesses in ${r.zone_name} — this category exists in other areas with avg ${Math.round(metroAvg)} listings`
          : `Only ${bizCount} ${r.category_name} in ${r.zone_name} vs metro avg of ${Math.round(metroAvg)} — underserved area`,
        suggestedAction: bizCount === 0
          ? `Seed or recruit ${r.category_name} businesses for ${r.zone_name}`
          : `Find more ${r.category_name} businesses to fill gap in ${r.zone_name}`,
      };
    });

    const zoneConditions = [eq(zones.isActive, true)];
    if (cityId) zoneConditions.push(eq(zones.cityId, String(cityId)));
    const allZones = await db.select({ id: zones.id, name: zones.name, type: zones.type }).from(zones).where(and(...zoneConditions));
    const allCats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(isNotNull(categories.parentCategoryId));

    return res.json({
      gaps,
      total: gaps.length,
      filters: {
        zones: allZones.map(z => ({ id: z.id, name: z.name, type: z.type })),
        categories: allCats.map(c => ({ id: c.id, name: c.name })),
      },
    });
  } catch (err: any) {
    console.error("[OpportunityRadar] Coverage gaps error:", err.message);
    return res.status(500).json({ error: "Failed to analyze coverage gaps" });
  }
});

router.get("/api/admin/opportunity-radar/category-supply", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { zoneId, limit: limitStr, cityId } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const bizCityFilter = cityId ? sql`AND b.city_id = ${String(cityId)}` : sql``;
    const eventCityFilter = cityId ? sql`AND e.city_id = ${String(cityId)}` : sql``;
    const articleCityFilter = cityId ? sql`AND a.city_id = ${String(cityId)}` : sql``;
    const zoneCityFilter = cityId ? sql`AND z.city_id = ${String(cityId)}` : sql``;

    const result = await db.execute(sql`
      WITH category_metro_presence AS (
        SELECT
          c.id as category_id,
          c.name as category_name,
          c.slug as category_slug,
          COUNT(DISTINCT b.zone_id) as zones_present_in,
          COUNT(b.id) as total_businesses,
          COUNT(DISTINCT e.id) as total_events,
          COUNT(DISTINCT a.id) as total_articles,
          COUNT(DISTINCT p.id) as total_posts,
          COUNT(DISTINCT ml.id) as total_marketplace
        FROM categories c
        LEFT JOIN businesses b ON c.id = ANY(b.category_ids) AND b.presence_status = 'ACTIVE' ${bizCityFilter}
        LEFT JOIN events e ON c.id = ANY(e.category_ids) AND e.start_date_time > NOW() - INTERVAL '90 days' ${eventCityFilter}
        LEFT JOIN articles a ON a.primary_category_id = c.id AND a.published_at > NOW() - INTERVAL '90 days' ${articleCityFilter}
        LEFT JOIN posts p ON p.business_id = b.id AND p.status = 'published' AND p.published_at > NOW() - INTERVAL '90 days'
        LEFT JOIN marketplace_listings ml ON ml.category = c.slug AND ml.status = 'ACTIVE'
        WHERE c.parent_category_id IS NOT NULL
        GROUP BY c.id, c.name, c.slug
        HAVING COUNT(b.id) > 0
      )
      SELECT *,
        (SELECT COUNT(DISTINCT z.id) FROM zones z WHERE z.is_active = true AND z.type IN ('DISTRICT', 'NEIGHBORHOOD') ${zoneCityFilter}) as total_zones
      FROM category_metro_presence
      ORDER BY total_businesses DESC
      LIMIT ${limit}
    `);

    const signals = (result.rows as any[]).map(r => {
      const totalZones = Number(r.total_zones) || 1;
      const zonesPresent = Number(r.zones_present_in) || 0;
      const coveragePercent = Math.round((zonesPresent / totalZones) * 100);
      const hasEvents = Number(r.total_events) > 0;
      const hasArticles = Number(r.total_articles) > 0;
      const hasPosts = Number(r.total_posts) > 0;
      const hasMarketplace = Number(r.total_marketplace) > 0;

      const missingChannels: string[] = [];
      if (!hasEvents) missingChannels.push("events");
      if (!hasArticles) missingChannels.push("articles");
      if (!hasPosts) missingChannels.push("pulse posts");
      if (!hasMarketplace) missingChannels.push("marketplace");

      const severity = coveragePercent < 20 ? "critical"
        : coveragePercent < 50 ? "high"
        : missingChannels.length >= 3 ? "high"
        : missingChannels.length >= 2 ? "moderate"
        : "low";

      return {
        categoryId: r.category_id,
        categoryName: r.category_name,
        categorySlug: r.category_slug,
        totalBusinesses: Number(r.total_businesses),
        zonesPresent,
        totalZones,
        coveragePercent,
        totalEvents: Number(r.total_events),
        totalArticles: Number(r.total_articles),
        totalPosts: Number(r.total_posts),
        totalMarketplace: Number(r.total_marketplace),
        missingChannels,
        severity,
        whyItMatters: missingChannels.length > 0
          ? `${r.category_name} has ${r.total_businesses} businesses but no ${missingChannels.join(", ")} — content gap limits engagement`
          : `${r.category_name} covers ${coveragePercent}% of zones (${zonesPresent}/${totalZones})`,
        suggestedAction: missingChannels.length > 0
          ? `Create ${missingChannels[0]} content for ${r.category_name} businesses`
          : coveragePercent < 50
            ? `Expand ${r.category_name} coverage to more neighborhoods`
            : `Monitor — good coverage for ${r.category_name}`,
      };
    });

    signals.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
      return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    });

    return res.json({ signals, total: signals.length });
  } catch (err: any) {
    console.error("[OpportunityRadar] Category supply error:", err.message);
    return res.status(500).json({ error: "Failed to analyze category supply" });
  }
});

router.get("/api/admin/opportunity-radar/content-opportunities", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { zoneType, limit: limitStr, cityId } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const zoneFilter = zoneType && zoneType !== "all" ? zoneType as string : null;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT
        z.id as zone_id,
        z.name as zone_name,
        z.slug as zone_slug,
        z.type as zone_type,
        COUNT(DISTINCT b.id) as business_count,
        COUNT(DISTINCT e.id) as event_count,
        COUNT(DISTINCT a.id) as article_count,
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT CASE WHEN b.claimed_by_user_id IS NOT NULL THEN b.id END) as claimed_biz_count
      FROM zones z
      LEFT JOIN businesses b ON b.zone_id = z.id AND b.presence_status = 'ACTIVE'
      LEFT JOIN events e ON e.zone_id = z.id AND e.start_date_time > ${ninetyDaysAgo}
      LEFT JOIN articles a ON a.zone_id = z.id AND a.published_at > ${ninetyDaysAgo}
      LEFT JOIN posts p ON p.business_id IN (SELECT id FROM businesses WHERE zone_id = z.id)
        AND p.status = 'published' AND p.published_at > ${ninetyDaysAgo}
      WHERE z.is_active = true
        ${zoneFilter ? sql`AND z.type = ${zoneFilter}` : sql``}
        ${cityId ? sql`AND z.city_id = ${String(cityId)}` : sql``}
      GROUP BY z.id, z.name, z.slug, z.type
      HAVING COUNT(DISTINCT b.id) >= 3
      ORDER BY COUNT(DISTINCT b.id) DESC
      LIMIT ${limit}
    `);

    const opportunities = (result.rows as any[]).map(r => {
      const bizCount = Number(r.business_count) || 0;
      const eventCount = Number(r.event_count) || 0;
      const articleCount = Number(r.article_count) || 0;
      const postCount = Number(r.post_count) || 0;
      const claimedCount = Number(r.claimed_biz_count) || 0;

      const contentGaps: string[] = [];
      if (articleCount === 0 && bizCount >= 5) contentGaps.push("no articles");
      if (postCount === 0 && bizCount >= 3) contentGaps.push("no pulse posts");
      if (eventCount === 0 && bizCount >= 5) contentGaps.push("no events");

      const hasEventRichArea = eventCount >= 3 && postCount === 0;
      const hasBusinessCluster = bizCount >= 5 && articleCount === 0;
      const hasActiveButNoContent = claimedCount >= 2 && articleCount === 0 && postCount === 0;

      let signalType = "content_gap";
      if (hasEventRichArea) signalType = "event_rich_no_pulse";
      if (hasBusinessCluster) signalType = "business_cluster_no_story";
      if (hasActiveButNoContent) signalType = "active_businesses_no_content";

      const severity = contentGaps.length >= 3 ? "critical"
        : contentGaps.length >= 2 ? "high"
        : contentGaps.length >= 1 ? "moderate"
        : "low";

      let whyItMatters = "";
      if (hasBusinessCluster) {
        whyItMatters = `${r.zone_name} has ${bizCount} businesses but no articles — strong roundup/feature opportunity`;
      } else if (hasEventRichArea) {
        whyItMatters = `${r.zone_name} has ${eventCount} events but no Pulse posts — event coverage gap`;
      } else if (hasActiveButNoContent) {
        whyItMatters = `${r.zone_name} has ${claimedCount} active/claimed businesses but zero content coverage`;
      } else if (contentGaps.length > 0) {
        whyItMatters = `${r.zone_name} has ${bizCount} businesses but ${contentGaps.join(" and ")}`;
      } else {
        whyItMatters = `${r.zone_name} has good content coverage — ${articleCount} articles, ${postCount} posts, ${eventCount} events`;
      }

      return {
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        zoneSlug: r.zone_slug,
        zoneType: r.zone_type,
        businessCount: bizCount,
        claimedCount,
        eventCount,
        articleCount,
        postCount,
        contentGaps,
        signalType,
        severity,
        whyItMatters,
        suggestedAction: hasBusinessCluster
          ? `Write a "${r.zone_name} Business Roundup" article`
          : hasEventRichArea
            ? `Create Pulse posts covering events in ${r.zone_name}`
            : hasActiveButNoContent
              ? `Reach out to claimed businesses in ${r.zone_name} for stories`
              : contentGaps.length > 0
                ? `Address ${contentGaps[0]} in ${r.zone_name}`
                : `Continue monitoring ${r.zone_name}`,
      };
    });

    const filtered = opportunities.filter(o => o.severity !== "low");
    filtered.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
      return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    });

    return res.json({ opportunities: filtered, total: filtered.length });
  } catch (err: any) {
    console.error("[OpportunityRadar] Content opportunities error:", err.message);
    return res.status(500).json({ error: "Failed to analyze content opportunities" });
  }
});

router.get("/api/admin/opportunity-radar/workforce-gaps", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { zoneType, limit: limitStr, cityId } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const zoneFilter = zoneType && zoneType !== "all" ? zoneType as string : null;

    const result = await db.execute(sql`
      WITH zone_biz AS (
        SELECT z.id as zone_id, z.name as zone_name, z.slug as zone_slug, z.type as zone_type,
          COUNT(DISTINCT b.id) as business_count
        FROM zones z
        JOIN businesses b ON b.zone_id = z.id AND b.presence_status = 'ACTIVE'
        WHERE z.is_active = true
          ${zoneFilter ? sql`AND z.type = ${zoneFilter}` : sql``}
          ${cityId ? sql`AND z.city_id = ${String(cityId)}` : sql``}
        GROUP BY z.id, z.name, z.slug, z.type
      ),
      zone_jobs AS (
        SELECT
          COALESCE(jl.zone_id, b.zone_id) as zone_id,
          COUNT(DISTINCT jl.id) as job_count,
          COUNT(DISTINCT CASE WHEN jl.status = 'ACTIVE' THEN jl.id END) as active_jobs,
          COALESCE(SUM(jl.applicants_count), 0) as total_applicants
        FROM job_listings jl
        LEFT JOIN businesses b ON jl.business_id = b.id
        GROUP BY COALESCE(jl.zone_id, b.zone_id)
      )
      SELECT zb.zone_id, zb.zone_name, zb.zone_slug, zb.zone_type, zb.business_count,
        COALESCE(zj.job_count, 0) as job_count,
        COALESCE(zj.active_jobs, 0) as active_jobs,
        COALESCE(zj.total_applicants, 0) as total_applicants
      FROM zone_biz zb
      LEFT JOIN zone_jobs zj ON zj.zone_id = zb.zone_id
      ORDER BY zb.business_count DESC
      LIMIT ${limit}
    `);

    const catResult = await db.execute(sql`
      SELECT
        c.id as category_id,
        c.name as category_name,
        COUNT(DISTINCT b.id) as business_count,
        COUNT(DISTINCT jl.id) as job_count
      FROM categories c
      JOIN businesses b ON c.id = ANY(b.category_ids) AND b.presence_status = 'ACTIVE'
      LEFT JOIN job_listings jl ON jl.business_id = b.id
      WHERE c.parent_category_id IS NOT NULL
      GROUP BY c.id, c.name
      HAVING COUNT(DISTINCT b.id) >= 3 AND COUNT(DISTINCT jl.id) = 0
      ORDER BY COUNT(DISTINCT b.id) DESC
      LIMIT 20
    `);

    const zoneSignals = (result.rows as any[]).map(r => {
      const bizCount = Number(r.business_count) || 0;
      const jobCount = Number(r.job_count) || 0;
      const activeJobs = Number(r.active_jobs) || 0;
      const totalApplicants = Number(r.total_applicants) || 0;

      const hasJobsNoBusinesses = activeJobs > 0 && bizCount < 3;
      const hasBusinessesNoJobs = bizCount >= 5 && jobCount === 0;
      const lowApplicantRatio = activeJobs > 0 && totalApplicants === 0;

      let signalType = "workforce_balanced";
      if (hasJobsNoBusinesses) signalType = "jobs_low_employer_density";
      if (hasBusinessesNoJobs) signalType = "businesses_no_hiring";
      if (lowApplicantRatio) signalType = "low_applicant_visibility";

      const severity = hasJobsNoBusinesses || hasBusinessesNoJobs ? "high"
        : lowApplicantRatio ? "moderate"
        : "low";

      return {
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        zoneSlug: r.zone_slug,
        zoneType: r.zone_type,
        businessCount: bizCount,
        jobCount,
        activeJobs,
        totalApplicants,
        signalType,
        severity,
        whyItMatters: hasBusinessesNoJobs
          ? `${r.zone_name} has ${bizCount} businesses but zero job listings — hiring gap`
          : hasJobsNoBusinesses
            ? `${r.zone_name} has ${activeJobs} active jobs but only ${bizCount} businesses — low employer density`
            : lowApplicantRatio
              ? `${r.zone_name} has ${activeJobs} active jobs with no applicants — visibility issue`
              : `${r.zone_name}: ${bizCount} businesses, ${jobCount} jobs`,
        suggestedAction: hasBusinessesNoJobs
          ? `Encourage businesses in ${r.zone_name} to post job listings`
          : hasJobsNoBusinesses
            ? `Recruit more businesses in ${r.zone_name} to increase employer density`
            : lowApplicantRatio
              ? `Promote job listings in ${r.zone_name} to increase applicant visibility`
              : `Monitor workforce activity in ${r.zone_name}`,
      };
    });

    const categorySignals = (catResult.rows as any[]).map(r => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      businessCount: Number(r.business_count),
      jobCount: 0,
      signalType: "category_no_hiring",
      severity: "moderate" as const,
      whyItMatters: `${r.category_name} has ${r.business_count} businesses but zero job listings`,
      suggestedAction: `Reach out to ${r.category_name} businesses about posting jobs`,
    }));

    const filtered = zoneSignals.filter(s => s.severity !== "low");
    filtered.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
      return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    });

    return res.json({
      zoneSignals: filtered,
      categorySignals,
      total: filtered.length + categorySignals.length,
    });
  } catch (err: any) {
    console.error("[OpportunityRadar] Workforce gaps error:", err.message);
    return res.status(500).json({ error: "Failed to analyze workforce gaps" });
  }
});

router.get("/api/admin/opportunity-radar/claim-signals", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { zoneId, limit: limitStr, cityId } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);

    const result = await db.execute(sql`
      SELECT
        b.id,
        b.name,
        b.slug,
        b.zone_id,
        b.image_url,
        b.is_verified,
        b.gallery_images,
        b.owner_email,
        b.phone,
        b.website_url,
        b.description,
        b.claim_status,
        b.category_ids,
        z.name as zone_name,
        z.type as zone_type,
        (SELECT COUNT(*) FROM events WHERE host_business_id = b.id OR venue_presence_id = b.id) as event_count,
        (SELECT COUNT(*) FROM job_listings WHERE business_id = b.id) as job_count,
        (SELECT COUNT(*) FROM marketplace_listings WHERE posted_by_business_id = b.id OR creator_business_id = b.id) as marketplace_count,
        (SELECT COUNT(*) FROM posts WHERE business_id = b.id AND status = 'published') as post_count
      FROM businesses b
      LEFT JOIN zones z ON z.id = b.zone_id
      WHERE b.presence_status = 'ACTIVE'
        AND b.claimed_by_user_id IS NULL
        AND b.claim_status != 'CLAIMED'
        ${zoneId ? sql`AND b.zone_id = ${zoneId as string}` : sql``}
        ${cityId ? sql`AND b.city_id = ${String(cityId)}` : sql``}
      ORDER BY b.created_at DESC
      LIMIT ${limit * 2}
    `);

    const signals = (result.rows as any[]).map(r => {
      const issues: string[] = [];
      if (!r.image_url) issues.push("no photo");
      if (!r.gallery_images || (Array.isArray(r.gallery_images) && r.gallery_images.length === 0)) issues.push("no gallery");
      if (!r.is_verified) issues.push("not verified");
      if (!r.description) issues.push("no description");
      if (!r.website_url) issues.push("no website");
      if (!r.owner_email && !r.phone) issues.push("no contact info");

      const categoryIds = r.category_ids || [];
      const eventCount = Number(r.event_count) || 0;
      const jobCount = Number(r.job_count) || 0;
      const marketplaceCount = Number(r.marketplace_count) || 0;
      const postCount = Number(r.post_count) || 0;

      if (categoryIds.length > 0 && eventCount === 0) issues.push("no events despite category fit");
      if (categoryIds.length > 0 && jobCount === 0) issues.push("no job listings");

      const completenessScore = Math.max(0, 100 - (issues.length * 15));
      const severity = completenessScore <= 30 ? "critical"
        : completenessScore <= 55 ? "high"
        : completenessScore <= 70 ? "moderate"
        : "low";

      return {
        businessId: r.id,
        businessName: r.name,
        businessSlug: r.slug,
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        zoneType: r.zone_type,
        claimStatus: r.claim_status,
        completenessScore,
        issues,
        eventCount,
        jobCount,
        marketplaceCount,
        postCount,
        hasEmail: !!r.owner_email,
        hasPhone: !!r.phone,
        hasWebsite: !!r.website_url,
        severity,
        whyItMatters: `${r.name} is unclaimed with ${issues.length} profile gaps (${issues.slice(0, 3).join(", ")}${issues.length > 3 ? "..." : ""}) — completeness ${completenessScore}%`,
        suggestedAction: !r.owner_email && !r.phone
          ? `Find contact info for ${r.name} to begin outreach`
          : !r.is_verified
            ? `Send verification invite to ${r.name}`
            : `Improve profile completeness for ${r.name}`,
      };
    });

    const filtered = signals.filter(s => s.severity !== "low").slice(0, limit);
    filtered.sort((a, b) => a.completenessScore - b.completenessScore);

    return res.json({ signals: filtered, total: filtered.length });
  } catch (err: any) {
    console.error("[OpportunityRadar] Claim signals error:", err.message);
    return res.status(500).json({ error: "Failed to analyze claim signals" });
  }
});

router.get("/api/admin/opportunity-radar/zones", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { cityId } = req.query;
    const conditions = [eq(zones.isActive, true)];
    if (cityId) conditions.push(eq(zones.cityId, String(cityId)));

    const allZones = await db.select({
      id: zones.id,
      name: zones.name,
      slug: zones.slug,
      type: zones.type,
      county: zones.county,
      parentZoneId: zones.parentZoneId,
      zipCodes: zones.zipCodes,
    }).from(zones).where(and(...conditions));

    const districts = allZones.filter(z => z.type === "DISTRICT" || z.type === "COUNTY");
    const neighborhoods = allZones.filter(z => z.type === "NEIGHBORHOOD" || z.type === "MICRO_HUB");
    const zips = allZones.filter(z => z.type === "ZIP");

    const grouped = districts.map(d => ({
      district: d.name,
      districtId: d.id,
      neighborhoods: neighborhoods
        .filter(n => n.parentZoneId === d.id || n.county === d.name)
        .map(n => ({ id: n.id, name: n.name, slug: n.slug, type: n.type }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(g => g.neighborhoods.length > 0)
      .sort((a, b) => a.district.localeCompare(b.district));

    const ungrouped = neighborhoods.filter(n =>
      !districts.some(d => n.parentZoneId === d.id || n.county === d.name)
    );

    return res.json({
      grouped,
      ungrouped: ungrouped.map(n => ({ id: n.id, name: n.name, slug: n.slug, type: n.type })),
      districts: districts.map(d => ({ id: d.id, name: d.name, type: d.type })),
      zips: zips.map(z => ({ id: z.id, name: z.name, slug: z.slug, zipCodes: z.zipCodes })),
      all: allZones.map(z => ({ id: z.id, name: z.name, slug: z.slug, type: z.type })),
    });
  } catch (err: any) {
    console.error("[OpportunityRadar] Zones error:", err.message);
    return res.status(500).json({ error: "Failed to load zones" });
  }
});

router.get("/api/admin/opportunity-radar/email-templates", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const templates = await db.select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      htmlBody: emailTemplates.htmlBody,
      templateKey: emailTemplates.templateKey,
      status: emailTemplates.status,
    }).from(emailTemplates)
      .where(eq(emailTemplates.status, "active"));

    return res.json(templates);
  } catch (err: any) {
    console.error("[OpportunityRadar] Email templates error:", err.message);
    return res.status(500).json({ error: "Failed to load email templates" });
  }
});

router.post("/api/admin/opportunity-radar/:id/send-email", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const { to, subject, body, templateId } = req.body || {};

  if (!to || typeof to !== "string" || !to.includes("@")) {
    return res.status(400).json({ error: "Valid recipient email required" });
  }
  if (!subject || !body) {
    return res.status(400).json({ error: "Subject and body are required" });
  }

  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    if (!biz) {
      return res.status(404).json({ error: "Business not found" });
    }

    const { client, fromEmail } = await getResendClient();
    const htmlBody = body.replace(/\n/g, "<br/>");

    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html: htmlBody,
    });

    const messageId = (result as any)?.data?.id;

    if (biz.claimStatus === "UNCLAIMED") {
      await db.update(businesses).set({
        claimStatus: "CLAIM_SENT",
        updatedAt: new Date(),
      }).where(eq(businesses.id, id));
    }

    const [contact] = await db.select().from(crmContacts)
      .where(eq(crmContacts.linkedBusinessId, id))
      .orderBy(desc(crmContacts.createdAt))
      .limit(1);

    if (contact) {
      await db.update(crmContacts).set({
        notes: [contact.notes, `[Email sent ${new Date().toLocaleDateString()}] Subject: ${subject}`].filter(Boolean).join("\n"),
        updatedAt: new Date(),
      }).where(eq(crmContacts.id, contact.id));
    }

    return res.json({
      ok: true,
      businessId: id,
      messageId,
      message: `Email sent to ${to}`,
    });
  } catch (err: any) {
    console.error("[OpportunityRadar] Send email error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to send email" });
  }
});

router.post("/api/admin/opportunity-radar/:id/mark-contacted", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;

  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    if (!biz) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (biz.claimStatus === "UNCLAIMED") {
      await db.update(businesses).set({
        claimStatus: "CLAIM_SENT",
        updatedAt: new Date(),
      }).where(eq(businesses.id, id));
    }

    return res.json({ ok: true, businessId: id, message: "Marked as contacted" });
  } catch (err: any) {
    console.error("[OpportunityRadar] Mark contacted error:", err.message);
    return res.status(500).json({ error: "Failed to mark as contacted" });
  }
});

router.get("/api/admin/opportunity-radar/gap-businesses", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { zoneId, categoryId, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 20, 100);

    if (!zoneId && !categoryId) {
      return res.status(400).json({ error: "zoneId or categoryId required" });
    }

    const conditions = [eq(businesses.presenceStatus, "ACTIVE")];
    if (zoneId) conditions.push(eq(businesses.zoneId, String(zoneId)));

    const result = await db.execute(sql`
      SELECT b.id, b.name, b.slug, b.owner_email, b.phone, b.claim_status,
        b.venue_screen_likely, b.address, b.city, b.state, b.zone_id,
        z.name as zone_name
      FROM businesses b
      LEFT JOIN zones z ON z.id = b.zone_id
      WHERE b.presence_status = 'ACTIVE'
        ${zoneId ? sql`AND b.zone_id = ${String(zoneId)}` : sql``}
        ${categoryId ? sql`AND ${String(categoryId)} = ANY(b.category_ids)` : sql``}
      ORDER BY b.name
      LIMIT ${limit}
    `);

    const bizList = (result.rows as any[]).map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      email: r.owner_email,
      phone: r.phone,
      claimStatus: r.claim_status,
      zoneName: r.zone_name,
      address: [r.address, r.city, r.state].filter(Boolean).join(", "),
    }));

    return res.json({ businesses: bizList, total: bizList.length });
  } catch (err: any) {
    console.error("[OpportunityRadar] Gap businesses error:", err.message);
    return res.status(500).json({ error: "Failed to load gap businesses" });
  }
});

export default router;
