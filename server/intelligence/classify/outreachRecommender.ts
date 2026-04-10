import { db } from "../../db";
import { eq } from "drizzle-orm";
import {
  businesses,
  entityContactVerification,
  entityLocationProfile,
  entityOutreachRecommendation,
} from "@shared/schema";

interface MethodScore {
  method: string;
  score: number;
  reason: string;
}

interface OutreachResult {
  recommendedMethod: string;
  methodRankJson: MethodScore[];
  reasonsJson: string[];
}

export async function recommendOutreach(entityId: string): Promise<OutreachResult | null> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
  if (!biz) return null;

  const [verification] = await db
    .select()
    .from(entityContactVerification)
    .where(eq(entityContactVerification.entityId, entityId))
    .limit(1);

  const [locationProfile] = await db
    .select()
    .from(entityLocationProfile)
    .where(eq(entityLocationProfile.entityId, entityId))
    .limit(1);

  const locationType = locationProfile?.locationType || "UNKNOWN";
  const hasPhysicalAddress = locationProfile?.hasPhysicalAddress ?? !!biz.address;
  const rawFlags = locationProfile?.addressTypeFlagsJson;
  const addressFlagsObj: Record<string, boolean> = (rawFlags && typeof rawFlags === "object" && !Array.isArray(rawFlags))
    ? (rawFlags as Record<string, boolean>)
    : {};
  const addressQuality = locationProfile?.addressQuality || "UNKNOWN";

  const hasPhone = !!(biz.phone || verification?.detectedPhone);
  const hasEmail = !!(biz.ownerEmail || verification?.detectedEmail);
  const hasContactForm = !!verification?.detectedContactFormUrl;
  const hasWebsite = !!biz.websiteUrl;
  const socialJson = verification?.detectedSocialJson as Record<string, string> | null;
  const bizSocial = biz.socialLinks as Record<string, string> | null;
  const hasSocial = (socialJson && Object.keys(socialJson).length > 0) ||
    (bizSocial && Object.keys(bizSocial).length > 0);
  const isPOBox = !!addressFlagsObj["PO_BOX"];

  const methods: MethodScore[] = [];
  const reasons: string[] = [];

  if (hasPhysicalAddress && locationType === "STOREFRONT") {
    methods.push({ method: "WALK_IN", score: 90, reason: "Storefront with physical address" });
    reasons.push("WALK_IN: Storefront location with verified address");
  } else if (hasPhysicalAddress && locationType === "OFFICE") {
    methods.push({ method: "WALK_IN", score: 60, reason: "Office with physical address" });
    reasons.push("WALK_IN: Office location — walk-in possible but less ideal");
  }

  if (hasPhysicalAddress && addressQuality !== "LOW" && !isPOBox) {
    let mailerScore = 50;
    if (locationType === "STOREFRONT") mailerScore = 70;
    else if (locationType === "OFFICE") mailerScore = 75;
    else if (locationType === "HOME_BASED") mailerScore = 40;
    methods.push({ method: "MAILER", score: mailerScore, reason: `Mailable address (${locationType})` });
    reasons.push(`MAILER: Valid address, quality=${addressQuality}, type=${locationType}`);
  }

  if (hasPhone) {
    let phoneScore = 80;
    if (locationType === "STOREFRONT" || locationType === "OFFICE") phoneScore = 85;
    else if (locationType === "HOME_BASED") phoneScore = 80;
    else if (locationType === "VIRTUAL") phoneScore = 85;
    methods.push({ method: "PHONE_FIRST", score: phoneScore, reason: `Phone available (${locationType})` });
    reasons.push(`PHONE_FIRST: Phone detected, type=${locationType}`);
  }

  if (hasContactForm || hasWebsite) {
    let formScore = 60;
    if (hasContactForm) {
      formScore = 85;
      reasons.push("WEBSITE_FORM: Contact form URL detected");
    } else {
      if (locationType === "VIRTUAL") formScore = 80;
      else if (locationType === "HOME_BASED") formScore = 75;
      else formScore = 60;
      reasons.push(`WEBSITE_FORM: Website available, type=${locationType}`);
    }
    methods.push({ method: "WEBSITE_FORM", score: formScore, reason: hasContactForm ? "Contact form detected" : "Website available" });
  }

  if (hasEmail) {
    let emailScore = 70;
    if (locationType === "VIRTUAL" || locationType === "HOME_BASED") emailScore = 80;
    else if (locationType === "OFFICE") emailScore = 75;
    methods.push({ method: "EMAIL", score: emailScore, reason: `Email detected (${locationType})` });
    reasons.push(`EMAIL: Business email available, type=${locationType}`);
  }

  if (hasSocial) {
    let socialScore = 50;
    if (locationType === "VIRTUAL") socialScore = 70;
    else if (locationType === "HOME_BASED") socialScore = 65;
    else socialScore = 50;
    methods.push({ method: "SOCIAL_DM", score: socialScore, reason: `Social links available (${locationType})` });
    reasons.push(`SOCIAL_DM: Social media links found, type=${locationType}`);
  }

  methods.sort((a, b) => b.score - a.score);

  const recommendedMethod = methods.length > 0 ? methods[0].method : "UNKNOWN";

  const now = new Date();

  await db
    .insert(entityOutreachRecommendation)
    .values({
      metroId: biz.cityId,
      entityId,
      recommendedMethod: recommendedMethod as any,
      methodRankJson: methods,
      reasonsJson: reasons,
      computedAt: now,
    })
    .onConflictDoUpdate({
      target: entityOutreachRecommendation.entityId,
      set: {
        recommendedMethod: recommendedMethod as any,
        methodRankJson: methods,
        reasonsJson: reasons,
        computedAt: now,
        updatedAt: now,
      },
    });

  return {
    recommendedMethod,
    methodRankJson: methods,
    reasonsJson: reasons,
  };
}

export async function recommendAllOutreach(metroId?: string): Promise<{ processed: number; errors: number }> {
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
      await recommendOutreach(row.id);
      processed++;
    } catch (err) {
      console.error(`[OutreachRecommender] Error for entity ${row.id}:`, err);
      errors++;
    }
  }

  console.log(`[OutreachRecommender] Batch complete: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}
