import { db } from "../db";
import { sql, eq, and, desc } from "drizzle-orm";
import { openai } from "../lib/openai";
import {
  pulseSignals, aiOutreachDrafts, businesses, cities, zones,
} from "@shared/schema";
import { buildCityBranding } from "@shared/city-branding";
import { buildClaimInviteSystem, buildUpgradePitchSystem } from "../ai/prompts/outreach";

async function draftClaimInvites(metroId: string, cityName: string, brandShort: string, aiName: string): Promise<number> {
  const signals = await db.select({
    id: pulseSignals.id,
    entityId: pulseSignals.entityId,
    dataJson: pulseSignals.dataJson,
  }).from(pulseSignals)
    .where(and(
      eq(pulseSignals.metroId, metroId),
      eq(pulseSignals.signalType, "UNCLAIMED_HIGH_DEMAND"),
      eq(pulseSignals.status, "new"),
    ))
    .orderBy(desc(pulseSignals.score))
    .limit(10);

  let created = 0;
  for (const signal of signals) {
    const existing = await db.select({ id: aiOutreachDrafts.id }).from(aiOutreachDrafts)
      .where(and(
        eq(aiOutreachDrafts.signalId, signal.id),
        eq(aiOutreachDrafts.templateType, "claim_invite"),
      )).limit(1);
    if (existing.length > 0) continue;

    const data = signal.dataJson as any;
    const businessName = data?.businessName || "Your Business";
    const eventCount = data?.eventCount || 0;
    const saveCount = data?.saveCount || 0;

    let subject = `${businessName} is getting noticed on ${brandShort}`;
    let body = `Hi,\n\nYour business ${businessName} received ${eventCount} interactions and ${saveCount} saves on ${brandShort} this month — and you haven't even claimed your listing yet.\n\nClaiming is free and takes 2 minutes. You'll be able to update your info, respond to the community, and start posting directly to the local feed.\n\nView and Claim Your Listing: [CLAIM_LINK]\n\nBest,\n${aiName}\n${brandShort}`;

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: buildClaimInviteSystem(aiName)
            },
            {
              role: "user",
              content: `Draft a claim invite email for "${businessName}" in ${cityName}. Stats: ${eventCount} interactions, ${saveCount} saves this month. The business has not claimed their free listing yet.`
            },
          ],
          max_tokens: 300,
        });
        const aiBody = completion.choices[0]?.message?.content;
        if (aiBody) body = aiBody;
      } catch (err: any) {
        console.error("[OutreachDrafter] OpenAI error:", err.message);
      }
    }

    await db.insert(aiOutreachDrafts).values({
      metroId,
      businessId: signal.entityId,
      signalId: signal.id,
      templateType: "claim_invite",
      subject,
      body,
    });
    created++;
  }
  return created;
}

async function draftUpgradePitches(metroId: string, cityName: string, brandShort: string, aiName: string): Promise<number> {
  const signals = await db.select({
    id: pulseSignals.id,
    entityId: pulseSignals.entityId,
    dataJson: pulseSignals.dataJson,
  }).from(pulseSignals)
    .where(and(
      eq(pulseSignals.metroId, metroId),
      eq(pulseSignals.signalType, "UPGRADE_READY"),
      eq(pulseSignals.status, "new"),
    ))
    .orderBy(desc(pulseSignals.score))
    .limit(10);

  let created = 0;
  for (const signal of signals) {
    const existing = await db.select({ id: aiOutreachDrafts.id }).from(aiOutreachDrafts)
      .where(and(
        eq(aiOutreachDrafts.signalId, signal.id),
        eq(aiOutreachDrafts.templateType, "upgrade_pitch"),
      )).limit(1);
    if (existing.length > 0) continue;

    const data = signal.dataJson as any;
    const businessName = data?.businessName || "Your Business";
    const postCount = data?.postCount || 0;

    let subject = `${businessName}: you're ready for Charter`;
    let body = `Hi,\n\nYou've published ${postCount} posts on ${brandShort} in the last month — that's fantastic engagement. Right now on your Verified plan, each post goes through moderation.\n\nWith Charter, your posts go live immediately. You'll also get topic tagging, microsite blocks, and more visibility in the feed.\n\nReady to upgrade? [UPGRADE_LINK]\n\nBest,\n${aiName}\n${brandShort}`;

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: buildUpgradePitchSystem(aiName)
            },
            {
              role: "user",
              content: `Draft an upgrade pitch email for "${businessName}" in ${cityName}. They're on Verified tier and posted ${postCount} times in 30 days. Pitch Charter tier benefits: auto-approved posts, topic tagging, microsite blocks.`
            },
          ],
          max_tokens: 300,
        });
        const aiBody = completion.choices[0]?.message?.content;
        if (aiBody) body = aiBody;
      } catch (err: any) {
        console.error("[OutreachDrafter] OpenAI error:", err.message);
      }
    }

    await db.insert(aiOutreachDrafts).values({
      metroId,
      businessId: signal.entityId,
      signalId: signal.id,
      templateType: "upgrade_pitch",
      subject,
      body,
    });
    created++;
  }
  return created;
}

async function draftReengagement(metroId: string, cityName: string, brandShort: string, aiName: string): Promise<number> {
  const signals = await db.select({
    id: pulseSignals.id,
    entityId: pulseSignals.entityId,
    dataJson: pulseSignals.dataJson,
  }).from(pulseSignals)
    .where(and(
      eq(pulseSignals.metroId, metroId),
      eq(pulseSignals.signalType, "DORMANT_CLAIMED"),
      eq(pulseSignals.status, "new"),
    ))
    .limit(10);

  let created = 0;
  for (const signal of signals) {
    const existing = await db.select({ id: aiOutreachDrafts.id }).from(aiOutreachDrafts)
      .where(and(
        eq(aiOutreachDrafts.signalId, signal.id),
        eq(aiOutreachDrafts.templateType, "reengagement"),
      )).limit(1);
    if (existing.length > 0) continue;

    const data = signal.dataJson as any;
    const businessName = data?.businessName || "Your Business";

    const subject = `We miss ${businessName} on ${brandShort}`;
    const body = `Hi,\n\nIt's been a while since we've seen activity from ${businessName} on ${brandShort}. The community is still engaging with your listing — don't miss out.\n\nA quick post or photo update keeps your business visible and top of mind for locals.\n\nLog in and post: [LOGIN_LINK]\n\nBest,\n${aiName}\n${brandShort}`;

    await db.insert(aiOutreachDrafts).values({
      metroId,
      businessId: signal.entityId,
      signalId: signal.id,
      templateType: "reengagement",
      subject,
      body,
    });
    created++;
  }
  return created;
}

export async function runOutreachDrafter(): Promise<number> {
  console.log("[OutreachDrafter] Starting outreach drafting...");
  const allCities = await db.select({
    id: cities.id, name: cities.name,
    cityCode: cities.cityCode, brandName: cities.brandName,
    aiGuideName: cities.aiGuideName, siteUrl: cities.siteUrl,
    emailDomain: cities.emailDomain, slug: cities.slug,
  }).from(cities);
  let totalDrafts = 0;

  for (const city of allCities) {
    try {
      const branding = buildCityBranding(city);
      const d1 = await draftClaimInvites(city.id, city.name, branding.brandShort, branding.aiGuideName);
      const d2 = await draftUpgradePitches(city.id, city.name, branding.brandShort, branding.aiGuideName);
      const d3 = await draftReengagement(city.id, city.name, branding.brandShort, branding.aiGuideName);
      const cityTotal = d1 + d2 + d3;
      totalDrafts += cityTotal;
      if (cityTotal > 0) {
        console.log(`[OutreachDrafter] ${city.name}: ${cityTotal} drafts created`);
      }
    } catch (err: any) {
      console.error(`[OutreachDrafter] Error for ${city.name}:`, err.message);
    }
  }

  console.log(`[OutreachDrafter] Complete: ${totalDrafts} outreach drafts created`);
  return totalDrafts;
}

const CAPTURE_ORIGIN_TEMPLATES: Record<string, { templateType: "capture_met_in_person" | "capture_stopped_by" | "capture_found_card"; subjectTemplate: string; bodyTemplate: string }> = {
  met_in_person: {
    templateType: "capture_met_in_person",
    subjectTemplate: "Great meeting you — {businessName} is now on {brandShort}",
    bodyTemplate: "Hi,\n\nGreat meeting you! I added {businessName} to the {brandShort} directory for the {neighborhood} area — please take a look and confirm I set it up correctly.\n\nView Your Listing: {listingLink}\n\nIf anything needs updating, you can claim and edit your listing directly from that page.\n\nBest,\n{aiName}\n{brandShort}",
  },
  stopped_by_location: {
    templateType: "capture_stopped_by",
    subjectTemplate: "I stopped by {businessName} — you're now on {brandShort}",
    bodyTemplate: "Hi,\n\nI stopped by {businessName} today and was impressed. I went ahead and added you to the {brandShort} directory for the {neighborhood} area — please confirm the details look right.\n\nView Your Listing: {listingLink}\n\nYou can claim your listing to update information, add photos, and connect with the local community.\n\nBest,\n{aiName}\n{brandShort}",
  },
  found_business_card: {
    templateType: "capture_found_card",
    subjectTemplate: "{businessName} — listed on {brandShort}",
    bodyTemplate: "Hi,\n\nI came across your business card for {businessName} and thought it'd be a great fit for the {brandShort}. I listed it on the directory for the {neighborhood} area — please confirm the information.\n\nView Your Listing: {listingLink}\n\nClaiming your listing is free and takes just a minute. You'll be able to update your info, respond to the community, and start posting directly.\n\nBest,\n{aiName}\n{brandShort}",
  },
};

async function resolveBusinessContext(businessId: string): Promise<{ businessName: string; neighborhood: string; metroId: string; listingLink: string; brandShort: string; aiName: string } | null> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return null;

  let neighborhood = "";
  if (biz.zoneId) {
    const [zone] = await db.select({ name: zones.name }).from(zones).where(eq(zones.id, biz.zoneId)).limit(1);
    if (zone && !/^\d+$/.test(zone.name.trim())) neighborhood = zone.name.trim();
  }
  if (!neighborhood && biz.city) neighborhood = biz.city;

  let citySlug = "";
  let brandShort = "Metro Hub";
  let aiName = "Metro Guide";
  if (biz.cityId) {
    const [city] = await db.select({
      slug: cities.slug,
      name: cities.name,
      cityCode: cities.cityCode,
      brandName: cities.brandName,
      aiGuideName: cities.aiGuideName,
      siteUrl: cities.siteUrl,
      emailDomain: cities.emailDomain,
    }).from(cities).where(eq(cities.id, biz.cityId)).limit(1);
    if (city) {
      citySlug = city.slug;
      const branding = buildCityBranding(city);
      brandShort = branding.brandShort;
      aiName = branding.aiGuideName;
      if (!neighborhood) neighborhood = city.name;
    }
  }

  const appUrl = process.env.APP_PUBLIC_URL || `https://${citySlug}cityhub.com`;
  const listingLink = `${appUrl}/${citySlug}/directory/${biz.slug}`;

  return {
    businessName: biz.name,
    neighborhood,
    metroId: biz.cityId,
    listingLink,
    brandShort,
    aiName,
  };
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

const STORY_ASK_PARAGRAPH = "\n\nWe'd also love to feature your story on {brandShort}. If you're up for it, reply with a few sentences about how {businessName} got started, what makes it special, or what you want the community to know. We'll turn it into a short feature on the platform.";

const SEEDED_TEMPLATE = {
  subjectTemplate: "Claim {businessName} on {brandShort}",
  bodyTemplate: "Hi,\n\nWe noticed {businessName} is a staple in {neighborhood}. We've added you to the {brandShort} directory — please confirm your details and claim your listing.\n\nView and Claim Your Listing: {listingLink}\n\nClaiming is free and takes just a minute. You'll be able to update your information, add photos, and connect with the local community.\n\nBest,\n{aiName}\n{brandShort}",
};

export async function previewOutreachEmail(
  businessId: string,
  captureOrigin?: string | null,
  includeStoryAsk: boolean = false,
): Promise<{ subject: string; body: string; templateType: string } | null> {
  const ctx = await resolveBusinessContext(businessId);
  if (!ctx) return null;

  const vars = {
    businessName: ctx.businessName,
    neighborhood: ctx.neighborhood,
    listingLink: ctx.listingLink,
    brandShort: ctx.brandShort,
    aiName: ctx.aiName,
  };

  let subjectTemplate: string;
  let bodyTemplate: string;
  let templateType: string;

  const captureConfig = captureOrigin ? CAPTURE_ORIGIN_TEMPLATES[captureOrigin] : null;
  if (captureConfig) {
    subjectTemplate = captureConfig.subjectTemplate;
    bodyTemplate = captureConfig.bodyTemplate;
    templateType = captureConfig.templateType;
  } else {
    subjectTemplate = SEEDED_TEMPLATE.subjectTemplate;
    bodyTemplate = SEEDED_TEMPLATE.bodyTemplate;
    templateType = "seeded_unclaimed";
  }

  if (includeStoryAsk) {
    const signoff = "\n\nBest,\n{aiName}\n{brandShort}";
    bodyTemplate = bodyTemplate.replace(signoff, STORY_ASK_PARAGRAPH + signoff);
  }

  return {
    subject: renderTemplate(subjectTemplate, vars),
    body: renderTemplate(bodyTemplate, vars),
    templateType,
  };
}

export async function generateCaptureOutreachDraft(
  businessId: string,
  captureOrigin: "met_in_person" | "stopped_by_location" | "found_business_card",
  recipientEmail?: string | null,
  recipientName?: string | null,
  includeStoryAsk: boolean = false,
): Promise<string | null> {
  const config = CAPTURE_ORIGIN_TEMPLATES[captureOrigin];
  if (!config) return null;

  const ctx = await resolveBusinessContext(businessId);
  if (!ctx) return null;

  const vars = {
    businessName: ctx.businessName,
    neighborhood: ctx.neighborhood,
    listingLink: ctx.listingLink,
    brandShort: ctx.brandShort,
    aiName: ctx.aiName,
  };

  const subject = renderTemplate(config.subjectTemplate, vars);
  let bodyTemplate = config.bodyTemplate;
  if (includeStoryAsk) {
    const signoff = "\n\nBest,\n{aiName}\n{brandShort}";
    bodyTemplate = bodyTemplate.replace(signoff, STORY_ASK_PARAGRAPH + signoff);
  }
  const body = renderTemplate(bodyTemplate, vars);

  const [draft] = await db.insert(aiOutreachDrafts).values({
    metroId: ctx.metroId,
    businessId,
    templateType: config.templateType,
    recipientEmail: recipientEmail || null,
    recipientName: recipientName || null,
    subject,
    body,
    status: "draft",
  }).returning();

  console.log(`[OutreachDrafter] Capture-origin draft created: ${config.templateType} for ${ctx.businessName} (${draft.id})`);
  return draft.id;
}

export async function generateSeededOutreachDraft(
  businessId: string,
  recipientEmail?: string | null,
  recipientName?: string | null,
  includeStoryAsk: boolean = false,
): Promise<string | null> {
  const ctx = await resolveBusinessContext(businessId);
  if (!ctx) return null;

  const vars = {
    businessName: ctx.businessName,
    neighborhood: ctx.neighborhood,
    listingLink: ctx.listingLink,
    brandShort: ctx.brandShort,
    aiName: ctx.aiName,
  };

  const subject = renderTemplate(SEEDED_TEMPLATE.subjectTemplate, vars);
  let bodyTemplate = SEEDED_TEMPLATE.bodyTemplate;
  if (includeStoryAsk) {
    const signoff = "\n\nBest,\n{aiName}\n{brandShort}";
    bodyTemplate = bodyTemplate.replace(signoff, STORY_ASK_PARAGRAPH + signoff);
  }
  const body = renderTemplate(bodyTemplate, vars);

  const [draft] = await db.insert(aiOutreachDrafts).values({
    metroId: ctx.metroId,
    businessId,
    templateType: "seeded_unclaimed",
    recipientEmail: recipientEmail || null,
    recipientName: recipientName || null,
    subject,
    body,
    status: "draft",
  }).returning();

  console.log(`[OutreachDrafter] Seeded-unclaimed draft created for ${ctx.businessName} (${draft.id})`);
  return draft.id;
}
