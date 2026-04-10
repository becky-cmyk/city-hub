import { db } from "../../db";
import { eq, sql, isNotNull } from "drizzle-orm";
import {
  businesses,
  entityContactVerification,
  entityScores,
  entityLocationProfile,
  entityOutreachRecommendation,
  entityAssetTags,
  trustProfiles,
  type EntityScores,
} from "@shared/schema";

interface ScoreReason {
  field: string;
  points: number;
  label: string;
}

interface ScoringResult {
  dataQualityScore: number;
  contactReadyScore: number;
  prospectFitScore: number;
  bucket: "TARGET" | "VERIFY_LATER" | "CONTENT_SOURCE_ONLY" | "NEEDS_REVIEW";
  reasons: ScoreReason[];
}

function computeDataQualityScore(
  biz: typeof businesses.$inferSelect,
  verification: typeof entityContactVerification.$inferSelect | null
): { score: number; reasons: ScoreReason[] } {
  let score = 0;
  const reasons: ScoreReason[] = [];

  if (biz.address && biz.zip) {
    score += 20;
    reasons.push({ field: "address_zip", points: 20, label: "Valid address + zip" });
  }

  if (biz.phone) {
    score += 15;
    reasons.push({ field: "phone", points: 15, label: "Has phone number" });
  }

  if (biz.websiteUrl) {
    score += 15;
    reasons.push({ field: "website", points: 15, label: "Has website URL" });
  }

  if (verification?.crawlStatus === "SUCCESS") {
    score += 20;
    reasons.push({ field: "crawl_success", points: 20, label: "Website crawl succeeded" });
  }

  if (verification?.schemaOrgJson) {
    score += 15;
    reasons.push({ field: "schema_org", points: 15, label: "Schema.org data present" });
  }

  const socialJson = verification?.detectedSocialJson as Record<string, string> | null;
  const bizSocial = biz.socialLinks as Record<string, string> | null;
  if ((socialJson && Object.keys(socialJson).length > 0) || (bizSocial && Object.keys(bizSocial).length > 0)) {
    score += 5;
    reasons.push({ field: "social", points: 5, label: "Has social media link(s)" });
  }

  const seedSources = new Set<string>();
  if (biz.seedSourceType) seedSources.add(biz.seedSourceType);
  if (biz.googlePlaceId) seedSources.add("google");
  if (verification?.crawlStatus === "SUCCESS") seedSources.add("crawl");
  if (seedSources.size >= 2) {
    score += 10;
    reasons.push({ field: "multi_source", points: 10, label: "Multiple data sources (>= 2)" });
  }

  return { score: Math.min(score, 100), reasons };
}

function computeContactReadyScore(
  biz: typeof businesses.$inferSelect,
  verification: typeof entityContactVerification.$inferSelect | null
): { score: number; reasons: ScoreReason[] } {
  let score = 0;
  const reasons: ScoreReason[] = [];

  if (biz.phone || verification?.detectedPhone) {
    score += 35;
    reasons.push({ field: "phone", points: 35, label: "Has phone number" });
  }

  if (verification?.detectedContactFormUrl) {
    score += 25;
    reasons.push({ field: "contact_form", points: 25, label: "Has contact form" });
  }

  if (biz.ownerEmail || verification?.detectedEmail) {
    score += 25;
    reasons.push({ field: "email", points: 25, label: "Has business email" });
  }

  if (biz.address) {
    score += 15;
    reasons.push({ field: "address", points: 15, label: "Has physical address" });
  }

  return { score: Math.min(score, 100), reasons };
}

const CONTRACTOR_TAGS = new Set([
  "CONSTRUCTION_CONTRACTOR", "ROOFING_CONTRACTOR", "HVAC_CONTRACTOR",
  "PLUMBING_CONTRACTOR", "ELECTRICAL_CONTRACTOR", "GENERAL_CONTRACTOR",
]);
const INDUSTRIAL_TAGS = new Set([
  "WHOLESALE_DISTRIBUTION", "WAREHOUSE_LOGISTICS", "INDUSTRIAL_SUPPLY",
]);
const MANUFACTURING_TAGS = new Set(["MANUFACTURING", "FABRICATION"]);
const CONSUMER_FACING_TAGS = new Set([
  "FOOD_SERVICE", "RETAIL_STOREFRONT", "BEAUTY_PERSONAL_CARE",
]);

interface IndustryTagRow {
  tag: string;
  confidence: number;
}

export function computeProspectFitScore(
  biz: typeof businesses.$inferSelect,
  verification: typeof entityContactVerification.$inferSelect | null,
  locationProfile: typeof entityLocationProfile.$inferSelect | null,
  outreachRec: typeof entityOutreachRecommendation.$inferSelect | null,
  industryTags: IndustryTagRow[] = []
): { score: number; reasons: ScoreReason[] } {
  let score = 0;
  const reasons: ScoreReason[] = [];

  if (!biz.websiteUrl) {
    score += 20;
    reasons.push({ field: "no_website", points: 20, label: "No website (needs digital presence)" });
  }

  if (biz.phone || verification?.detectedPhone) {
    score += 20;
    reasons.push({ field: "phone", points: 20, label: "Has phone (contactable)" });
  }

  if (biz.address) {
    score += 15;
    reasons.push({ field: "address", points: 15, label: "Has physical address" });
  }

  if (biz.claimStatus === "UNCLAIMED" && biz.presenceStatus !== "ACTIVE") {
    score += 15;
    reasons.push({ field: "unclaimed", points: 15, label: "Not verified/claimed" });
  }

  if (biz.categoryIds && biz.categoryIds.length > 0 && biz.zip) {
    score += 20;
    reasons.push({ field: "in_scope", points: 20, label: "In scope category + zip" });
  }

  if (biz.googlePlaceId || biz.googleRating) {
    score += 10;
    reasons.push({ field: "engagement", points: 10, label: "Has engagement signals (Google presence)" });
  }

  if (locationProfile) {
    const lt = locationProfile.locationType;
    if (lt === "STOREFRONT" || lt === "OFFICE") {
      score += 10;
      reasons.push({ field: "location_storefront_office", points: 10, label: `Physical location (${lt.toLowerCase()})` });
    }

    if (lt === "VIRTUAL") {
      const hasPhone = !!(biz.phone || verification?.detectedPhone);
      const hasFormOrEmail = !!(verification?.detectedContactFormUrl || verification?.detectedEmail || biz.ownerEmail);
      if (!hasPhone && !hasFormOrEmail) {
        score -= 20;
        reasons.push({ field: "virtual_no_contact", points: -20, label: "Virtual with no phone/form/email" });
      }
    }
  }

  if (outreachRec) {
    const method = outreachRec.recommendedMethod;
    if (method === "WALK_IN" || method === "PHONE_FIRST" || method === "MAILER") {
      score += 15;
      reasons.push({ field: "outreach_direct", points: 15, label: `Direct outreach available (${method.toLowerCase().replace("_", " ")})` });
    }
  }

  if (industryTags.length > 0) {
    const hasContractor = industryTags.some(t => CONTRACTOR_TAGS.has(t.tag));
    const hasIndustrial = industryTags.some(t => INDUSTRIAL_TAGS.has(t.tag));
    const hasManufacturing = industryTags.some(t => MANUFACTURING_TAGS.has(t.tag));
    const hasConsumerFacing = industryTags.some(t => CONSUMER_FACING_TAGS.has(t.tag));

    if (hasContractor && !biz.websiteUrl) {
      score += 25;
      reasons.push({ field: "contractor_no_website", points: 25, label: "Contractor without website (prime sales target)" });
    } else if (hasContractor) {
      score += 10;
      reasons.push({ field: "contractor_with_website", points: 10, label: "Contractor (upgrade target)" });
    }

    if (hasIndustrial) {
      score -= 15;
      reasons.push({ field: "industrial_wholesale", points: -15, label: "Industrial/wholesale (not consumer-facing)" });
    }

    if (hasManufacturing) {
      score -= 10;
      reasons.push({ field: "manufacturing", points: -10, label: "Manufacturing (less likely directory customer)" });
    }

    if (hasConsumerFacing) {
      score += 5;
      reasons.push({ field: "consumer_facing", points: 5, label: "Consumer-facing business (natural directory fit)" });
    }
  }

  if (biz.seedSourceType === "AD_SPOT") {
    score += 15;
    reasons.push({ field: "advertising_elsewhere", points: 15, label: "Already advertising elsewhere (ad capture)" });
  }

  return { score: Math.max(Math.min(score, 100), 0), reasons };
}

function determineBucket(
  prospectFitScore: number,
  contactReadyScore: number,
  biz: typeof businesses.$inferSelect,
  verification: typeof entityContactVerification.$inferSelect | null,
  locationProfile: typeof entityLocationProfile.$inferSelect | null,
  industryTags: IndustryTagRow[] = []
): "TARGET" | "VERIFY_LATER" | "CONTENT_SOURCE_ONLY" | "NEEDS_REVIEW" {
  if (prospectFitScore >= 70 && contactReadyScore >= 40) {
    return "TARGET";
  }

  const noContact = !biz.phone && !biz.ownerEmail && !verification?.detectedPhone && !verification?.detectedEmail;
  const noAddress = !biz.address;
  const crawlFailed = !verification || verification.crawlStatus === "FAILED" || verification.crawlStatus === "BLOCKED";

  if (noContact && noAddress && crawlFailed) {
    return "CONTENT_SOURCE_ONLY";
  }

  const isIndustrialOnly = industryTags.length > 0 &&
    industryTags.every(t => INDUSTRIAL_TAGS.has(t.tag) || MANUFACTURING_TAGS.has(t.tag) || t.tag === "INDUSTRIAL_CORRIDOR_LOCATION") &&
    !industryTags.some(t => CONTRACTOR_TAGS.has(t.tag) || CONSUMER_FACING_TAGS.has(t.tag));
  if (isIndustrialOnly && noContact) {
    return "CONTENT_SOURCE_ONLY";
  }

  const lowConfidence = locationProfile && locationProfile.confidenceScore < 40;
  const unknownType = !locationProfile || locationProfile.locationType === "UNKNOWN";
  if (lowConfidence || (unknownType && !noContact && prospectFitScore >= 30)) {
    return "NEEDS_REVIEW";
  }

  return "VERIFY_LATER";
}

export async function computeEntityScores(entityId: string): Promise<ScoringResult | null> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
  if (!biz) return null;

  const [verification] = await db
    .select()
    .from(entityContactVerification)
    .where(eq(entityContactVerification.entityId, entityId))
    .limit(1);

  const [locProfile] = await db
    .select()
    .from(entityLocationProfile)
    .where(eq(entityLocationProfile.entityId, entityId))
    .limit(1);

  const [outreachRec] = await db
    .select()
    .from(entityOutreachRecommendation)
    .where(eq(entityOutreachRecommendation.entityId, entityId))
    .limit(1);

  const tags = await db
    .select({ tag: entityAssetTags.tag, confidence: entityAssetTags.confidence })
    .from(entityAssetTags)
    .where(eq(entityAssetTags.entityId, entityId));

  const [trustProfile] = await db
    .select()
    .from(trustProfiles)
    .where(eq(trustProfiles.businessId, entityId))
    .limit(1);

  const dq = computeDataQualityScore(biz, verification || null);
  const cr = computeContactReadyScore(biz, verification || null);
  const pf = computeProspectFitScore(biz, verification || null, locProfile || null, outreachRec || null, tags);

  if (trustProfile) {
    const opStatus = trustProfile.operationalStatus;
    if (opStatus === "paused" || opStatus === "removed") {
      pf.score = 0;
      pf.reasons.push({ field: "trust_suppressed", points: -100, label: `Trust status: ${opStatus} (suppressed from recommendations)` });
    } else if (opStatus === "at_risk") {
      pf.score = Math.max(pf.score - 20, 0);
      pf.reasons.push({ field: "trust_at_risk", points: -20, label: "Trust status: at_risk (reduced recommendation priority)" });
    }
  }

  const bucket = determineBucket(pf.score, cr.score, biz, verification || null, locProfile || null, tags);

  const allReasons = [
    ...dq.reasons.map((r) => ({ ...r, field: `dq_${r.field}` })),
    ...cr.reasons.map((r) => ({ ...r, field: `cr_${r.field}` })),
    ...pf.reasons.map((r) => ({ ...r, field: `pf_${r.field}` })),
  ];

  const now = new Date();

  await db
    .insert(entityScores)
    .values({
      metroId: biz.cityId,
      entityId,
      dataQualityScore: dq.score,
      contactReadyScore: cr.score,
      prospectFitScore: pf.score,
      bucket,
      reasonsJson: allReasons,
      computedAt: now,
    })
    .onConflictDoUpdate({
      target: entityScores.entityId,
      set: {
        dataQualityScore: dq.score,
        contactReadyScore: cr.score,
        prospectFitScore: pf.score,
        bucket,
        reasonsJson: allReasons,
        computedAt: now,
        updatedAt: now,
      },
    });

  return {
    dataQualityScore: dq.score,
    contactReadyScore: cr.score,
    prospectFitScore: pf.score,
    bucket,
    reasons: allReasons,
  };
}

export async function computeAllScores(metroId?: string): Promise<{ processed: number; errors: number }> {
  let query = db.select({ id: businesses.id }).from(businesses);

  let rows: { id: string }[];
  if (metroId) {
    rows = await query.where(eq(businesses.cityId, metroId));
  } else {
    rows = await query;
  }

  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      await computeEntityScores(row.id);
      processed++;
    } catch (err) {
      console.error(`[EntityScoring] Error scoring entity ${row.id}:`, err);
      errors++;
    }
  }

  console.log(`[EntityScoring] Batch complete: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}
