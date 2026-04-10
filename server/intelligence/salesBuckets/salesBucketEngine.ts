import { db } from "../../db";
import { eq, sql, inArray } from "drizzle-orm";
import {
  businesses,
  entityContactVerification,
  entityLocationProfile,
  entityScores,
  entityOutreachRecommendation,
  entityAssetTags,
  entityEngagement30d,
  entitySalesBuckets,
} from "@shared/schema";

type SalesBucket =
  | "CONTACT_READY_NO_WEBSITE" | "STOREFRONT_WALKIN_READY" | "DIGITAL_GAP_HIGH"
  | "WEBSITE_DEGRADED" | "DATA_INCONSISTENT" | "DEMAND_PRESENT_NOT_VERIFIED"
  | "HIGH_ACTIVITY" | "CONVERSION_GAP";

interface BucketResult {
  bucket: SalesBucket;
  priorityScore: number;
  reasons: Array<{ rule: string; points: number; label: string }>;
}

interface EntityData {
  biz: any;
  verification: any | null;
  locationProfile: any | null;
  scores: any | null;
  outreachRec: any | null;
  industryTags: Array<{ tag: string; confidence: number }>;
  engagement: any | null;
}

function isNotVerified(biz: any): boolean {
  return biz.claimStatus !== "CLAIMED" && biz.presenceStatus !== "ACTIVE";
}

function ruleContactReadyNoWebsite(data: EntityData): BucketResult | null {
  const { biz, verification, locationProfile } = data;
  const hasWebsite = !!biz.websiteUrl;
  const hasPhone = !!(biz.phone || verification?.detectedPhone);

  if (hasWebsite || !hasPhone) return null;

  let score = 0;
  const reasons: BucketResult["reasons"] = [];

  score += 40;
  reasons.push({ rule: "no_website", points: 40, label: "No website — needs digital presence" });

  score += 25;
  reasons.push({ rule: "has_phone", points: 25, label: "Has phone number (contactable)" });

  if (biz.address) {
    score += 15;
    reasons.push({ rule: "has_address", points: 15, label: "Has physical address" });
  }

  const lt = locationProfile?.locationType;
  if (lt === "STOREFRONT" || lt === "OFFICE") {
    score += 10;
    reasons.push({ rule: "storefront_office", points: 10, label: `Physical location (${lt.toLowerCase()})` });
  }

  if (isNotVerified(biz)) {
    score += 10;
    reasons.push({ rule: "not_verified", points: 10, label: "Not verified/claimed" });
  }

  return { bucket: "CONTACT_READY_NO_WEBSITE", priorityScore: Math.min(score, 100), reasons };
}

function ruleStorefrontWalkinReady(data: EntityData): BucketResult | null {
  const { biz, locationProfile, outreachRec, scores } = data;

  if (locationProfile?.locationType !== "STOREFRONT") return null;
  if (outreachRec?.recommendedMethod !== "WALK_IN") return null;

  let score = 0;
  const reasons: BucketResult["reasons"] = [];

  score += 50;
  reasons.push({ rule: "storefront", points: 50, label: "Confirmed storefront location" });

  const aq = locationProfile?.addressQuality;
  if (aq === "HIGH" || aq === "MED") {
    score += 20;
    reasons.push({ rule: "address_quality", points: 20, label: `Address quality: ${aq}` });
  }

  if (isNotVerified(biz)) {
    score += 15;
    reasons.push({ rule: "not_verified", points: 15, label: "Not verified/claimed" });
  }

  if (scores?.contactReadyScore >= 40) {
    score += 15;
    reasons.push({ rule: "contact_ready", points: 15, label: "Contact-ready score >= 40" });
  }

  return { bucket: "STOREFRONT_WALKIN_READY", priorityScore: Math.min(score, 100), reasons };
}

function ruleDigitalGapHigh(data: EntityData): BucketResult | null {
  const { biz, verification, locationProfile } = data;

  const hasWebsite = !!biz.websiteUrl;
  const degraded = verification?.crawlStatus === "FAILED" || verification?.crawlStatus === "BLOCKED";
  if (hasWebsite && !degraded) return null;

  const hasPhone = !!(biz.phone || verification?.detectedPhone);
  const hasAddress = !!biz.address;
  if (!hasPhone && !hasAddress) return null;

  const socialJson = verification?.detectedSocialJson as Record<string, string> | null;
  const bizSocial = biz.socialLinks as Record<string, string> | null;
  const hasSocial = (socialJson && Object.keys(socialJson).length > 0) || (bizSocial && Object.keys(bizSocial).length > 0);
  if (hasSocial) return null;

  let score = 0;
  const reasons: BucketResult["reasons"] = [];

  score += 40;
  reasons.push({ rule: "no_digital", points: 40, label: hasWebsite ? "Website degraded, no social" : "No website, no social" });

  const lt = locationProfile?.locationType;
  if (lt === "STOREFRONT" || lt === "OFFICE") {
    score += 20;
    reasons.push({ rule: "storefront_office", points: 20, label: `Physical location (${lt.toLowerCase()})` });
  }

  if (hasPhone) {
    score += 20;
    reasons.push({ rule: "has_phone", points: 20, label: "Has phone (contactable)" });
  }

  if (isNotVerified(biz)) {
    score += 10;
    reasons.push({ rule: "not_verified", points: 10, label: "Not verified/claimed" });
  }

  if (!hasSocial) {
    score += 10;
    reasons.push({ rule: "no_social", points: 10, label: "No social media presence" });
  }

  return { bucket: "DIGITAL_GAP_HIGH", priorityScore: Math.min(score, 100), reasons };
}

function ruleWebsiteDegraded(data: EntityData): BucketResult | null {
  const { biz, verification } = data;

  if (!verification) return null;
  const httpStatus = verification.httpStatusCode;
  const isDegraded = httpStatus && (httpStatus === 404 || httpStatus === 410 || (httpStatus >= 500 && httpStatus <= 599));
  if (!isDegraded) return null;

  let score = 0;
  const reasons: BucketResult["reasons"] = [];

  score += 50;
  reasons.push({ rule: "degraded", points: 50, label: `Website returns HTTP ${httpStatus}` });

  if (biz.phone || verification.detectedPhone) {
    score += 20;
    reasons.push({ rule: "has_phone", points: 20, label: "Has phone (contactable)" });
  }

  if (biz.address) {
    score += 15;
    reasons.push({ rule: "has_address", points: 15, label: "Has physical address" });
  }

  if (isNotVerified(biz)) {
    score += 15;
    reasons.push({ rule: "not_verified", points: 15, label: "Not verified/claimed" });
  }

  return { bucket: "WEBSITE_DEGRADED", priorityScore: Math.min(score, 100), reasons };
}

function ruleDataInconsistent(data: EntityData): BucketResult | null {
  const { biz, verification, locationProfile } = data;

  if (!verification || verification.crawlStatus !== "SUCCESS") return null;

  let inconsistencies = 0;
  const reasons: BucketResult["reasons"] = [];

  if (verification.detectedPhone && biz.phone) {
    const normalizePhone = (p: string) => p.replace(/\D/g, "").slice(-10);
    if (normalizePhone(verification.detectedPhone) !== normalizePhone(biz.phone)) {
      inconsistencies++;
      reasons.push({ rule: "phone_mismatch", points: 30, label: `Phone mismatch: stored "${biz.phone}" vs crawled "${verification.detectedPhone}"` });
    }
  }

  if (verification.detectedEmail && biz.ownerEmail) {
    if (verification.detectedEmail.toLowerCase() !== biz.ownerEmail.toLowerCase()) {
      inconsistencies++;
      reasons.push({ rule: "email_mismatch", points: 30, label: `Email mismatch: stored "${biz.ownerEmail}" vs crawled "${verification.detectedEmail}"` });
    }
  }

  if (inconsistencies === 0) return null;

  let score = 60;

  const lt = locationProfile?.locationType;
  if (lt === "STOREFRONT" || lt === "OFFICE") {
    score += 20;
    reasons.push({ rule: "storefront_office", points: 20, label: `Physical location (${lt.toLowerCase()})` });
  }

  if (isNotVerified(biz)) {
    score += 20;
    reasons.push({ rule: "not_verified", points: 20, label: "Not verified/claimed" });
  }

  return { bucket: "DATA_INCONSISTENT", priorityScore: Math.min(score, 100), reasons };
}

function ruleDemandPresentNotVerified(data: EntityData): BucketResult | null {
  const { biz, engagement } = data;

  if (!engagement) return null;
  if (!isNotVerified(biz)) return null;

  const totalClicks = (engagement.callClicks30d || 0) + (engagement.websiteClicks30d || 0) + (engagement.directionsClicks30d || 0);
  const views = engagement.views30d || 0;

  if (views < 25 && totalClicks < 10) return null;

  const reasons: BucketResult["reasons"] = [];
  let score = 0;

  const viewPoints = Math.min(60, Math.round(views * 1.2));
  score += viewPoints;
  reasons.push({ rule: "views", points: viewPoints, label: `${views} profile views in 30 days` });

  const clickPoints = Math.min(40, totalClicks * 4);
  score += clickPoints;
  reasons.push({ rule: "clicks", points: clickPoints, label: `${totalClicks} engagement clicks in 30 days` });

  return { bucket: "DEMAND_PRESENT_NOT_VERIFIED", priorityScore: Math.min(score, 100), reasons };
}

function ruleHighActivity(data: EntityData): BucketResult | null {
  const { engagement } = data;

  if (!engagement) return null;

  const leadsStarted = engagement.leadsStarted30d || 0;
  const leadsSubmitted = engagement.leadsSubmitted30d || 0;

  if (leadsStarted < 5 && leadsSubmitted < 2) return null;

  const reasons: BucketResult["reasons"] = [];
  let score = 0;

  if (leadsSubmitted >= 2) {
    const pts = Math.min(50, leadsSubmitted * 15);
    score += pts;
    reasons.push({ rule: "leads_submitted", points: pts, label: `${leadsSubmitted} leads submitted in 30 days` });
  }

  if (leadsStarted >= 5) {
    const pts = Math.min(30, leadsStarted * 5);
    score += pts;
    reasons.push({ rule: "leads_started", points: pts, label: `${leadsStarted} leads started in 30 days` });
  }

  const views = engagement.views30d || 0;
  if (views > 0) {
    const pts = Math.min(20, Math.round(views * 0.5));
    score += pts;
    reasons.push({ rule: "views_boost", points: pts, label: `${views} profile views` });
  }

  return { bucket: "HIGH_ACTIVITY", priorityScore: Math.min(score, 100), reasons };
}

function ruleConversionGap(data: EntityData): BucketResult | null {
  const { biz, verification, engagement } = data;

  if (!biz.websiteUrl) return null;
  if (!verification || verification.crawlStatus !== "SUCCESS") return null;

  const hasForm = !!verification.detectedContactFormUrl;
  const hasEmail = !!(verification.detectedEmail || biz.ownerEmail);
  const hasSitePhone = !!verification.detectedPhone;

  if (hasForm || hasEmail || hasSitePhone) return null;

  const reasons: BucketResult["reasons"] = [];
  let score = 0;

  score += 50;
  reasons.push({ rule: "conversion_gap", points: 50, label: "Website exists but no contact form, email, or phone found" });

  const totalEngagement = engagement ? (engagement.views30d || 0) + (engagement.callClicks30d || 0) + (engagement.websiteClicks30d || 0) : 0;
  if (totalEngagement > 0) {
    const pts = Math.min(20, Math.round(totalEngagement * 0.5));
    score += pts;
    reasons.push({ rule: "engagement", points: pts, label: `${totalEngagement} engagement events — visitors can't convert` });
  }

  if (isNotVerified(biz)) {
    score += 30;
    reasons.push({ rule: "not_verified", points: 30, label: "Not verified/claimed" });
  }

  return { bucket: "CONVERSION_GAP", priorityScore: Math.min(score, 100), reasons };
}

const ALL_RULES = [
  ruleContactReadyNoWebsite,
  ruleStorefrontWalkinReady,
  ruleDigitalGapHigh,
  ruleWebsiteDegraded,
  ruleDataInconsistent,
  ruleDemandPresentNotVerified,
  ruleHighActivity,
  ruleConversionGap,
];

export async function computeSalesBuckets(entityId: string): Promise<BucketResult[]> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
  if (!biz) return [];

  const [verification] = await db.select().from(entityContactVerification).where(eq(entityContactVerification.entityId, entityId)).limit(1);
  const [locationProfile] = await db.select().from(entityLocationProfile).where(eq(entityLocationProfile.entityId, entityId)).limit(1);
  const [scores] = await db.select().from(entityScores).where(eq(entityScores.entityId, entityId)).limit(1);
  const [outreachRec] = await db.select().from(entityOutreachRecommendation).where(eq(entityOutreachRecommendation.entityId, entityId)).limit(1);
  const tags = await db.select({ tag: entityAssetTags.tag, confidence: entityAssetTags.confidence }).from(entityAssetTags).where(eq(entityAssetTags.entityId, entityId));
  const [engagement] = await db.select().from(entityEngagement30d).where(eq(entityEngagement30d.entityId, entityId)).limit(1);

  const entityData: EntityData = {
    biz,
    verification: verification || null,
    locationProfile: locationProfile || null,
    scores: scores || null,
    outreachRec: outreachRec || null,
    industryTags: tags,
    engagement: engagement || null,
  };

  const buckets: BucketResult[] = [];
  for (const rule of ALL_RULES) {
    const result = rule(entityData);
    if (result) buckets.push(result);
  }

  return buckets;
}

export async function computeAllSalesBuckets(metroId?: string): Promise<{ entitiesProcessed: number; bucketsAssigned: number; errors: number }> {
  let bizIds: { id: string; cityId: string }[];
  if (metroId) {
    bizIds = await db.select({ id: businesses.id, cityId: businesses.cityId }).from(businesses).where(eq(businesses.cityId, metroId));
  } else {
    bizIds = await db.select({ id: businesses.id, cityId: businesses.cityId }).from(businesses);
  }

  const metroFilter = metroId ? sql`AND metro_id = ${metroId}` : sql``;
  await db.execute(sql`DELETE FROM entity_sales_buckets WHERE 1=1 ${metroFilter}`);

  let entitiesProcessed = 0;
  let bucketsAssigned = 0;
  let errors = 0;

  for (const { id, cityId } of bizIds) {
    try {
      const buckets = await computeSalesBuckets(id);
      for (const b of buckets) {
        await db.insert(entitySalesBuckets).values({
          metroId: cityId,
          entityId: id,
          bucket: b.bucket as any,
          priorityScore: b.priorityScore,
          reasonsJson: b.reasons,
          computedAt: new Date(),
        }).onConflictDoUpdate({
          target: [entitySalesBuckets.entityId, entitySalesBuckets.bucket],
          set: {
            priorityScore: b.priorityScore,
            reasonsJson: b.reasons,
            computedAt: new Date(),
          },
        });
        bucketsAssigned++;
      }
      entitiesProcessed++;
    } catch (err: any) {
      console.error(`[SalesBucketEngine] Error for entity ${id}:`, err.message);
      errors++;
    }
  }

  console.log(`[SalesBucketEngine] Complete: ${entitiesProcessed} entities, ${bucketsAssigned} buckets, ${errors} errors`);
  return { entitiesProcessed, bucketsAssigned, errors };
}
