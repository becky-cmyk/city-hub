import { db } from "../db";
import { crmContacts, cities, articles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../lib/openai";
import { sendTerritoryEmail } from "./territory-email";
import { buildCityBranding } from "@shared/city-branding";
import { storage } from "../storage";
import { buildBeckyIntroSystem } from "../ai/prompts/outreach";

const DEFAULT_BOOKING_URL = process.env.DEFAULT_BOOKING_URL || "";

function buildBeckyEmailHtml(params: {
  recipientName: string;
  companyName: string;
  contextNote: string;
  bodyText: string;
  bookingUrl: string;
  storyPreviewUrl: string | null;
  brandShort: string;
  citySlug: string;
  baseUrl: string;
}): string {
  const { recipientName, bodyText, bookingUrl, storyPreviewUrl, brandShort, baseUrl } = params;

  const storySection = storyPreviewUrl
    ? `<tr><td style="padding:12px 24px;">
        <a href="${storyPreviewUrl}" style="display:inline-block;padding:10px 24px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Preview Your Story</a>
       </td></tr>`
    : "";

  const bookingSection = bookingUrl
    ? `<tr><td style="padding:12px 24px;">
        <a href="${bookingUrl}" style="display:inline-block;padding:10px 24px;background:#059669;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Schedule Your Time</a>
       </td></tr>`
    : "";

  const bodyParagraphs = bodyText.split("\n").filter(Boolean).map(p =>
    `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 12px;">${p}</p>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="padding:32px 24px 16px;">
    <p style="color:#334155;font-size:16px;margin:0 0 16px;">Hi ${recipientName},</p>
    ${bodyParagraphs}
  </td></tr>
  ${storySection}
  ${bookingSection}
  <tr><td style="padding:24px 24px 16px;">
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0;">Looking forward to connecting,</p>
    <p style="color:#334155;font-size:15px;font-weight:600;margin:8px 0 0;">Becky</p>
    <p style="color:#64748b;font-size:13px;margin:4px 0 0;">${brandShort}</p>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">${brandShort}</p>
    <p style="margin:4px 0 0;"><a href="${baseUrl}/unsubscribe?email={{email}}" style="color:#94a3b8;font-size:11px;text-decoration:underline;">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendBeckyIntroEmail(captureId: string): Promise<{ success: boolean; error?: string }> {
  const [capture] = await db.select().from(crmContacts).where(eq(crmContacts.id, captureId)).limit(1);
  if (!capture) return { success: false, error: "Capture not found" };
  if (!capture.email) return { success: false, error: "No email address on capture" };

  const recipientName = capture.name.split(" ")[0] || capture.name;
  const companyName = capture.company || capture.name;
  const connectionSource = capture.connectionSource || "";
  const notes = capture.notes || "";

  const cityList = await storage.getAllCities();
  let city = cityList[0];
  if (capture.capturedWithHubId) {
    const hubCity = cityList.find(c => c.id === capture.capturedWithHubId);
    if (hubCity) city = hubCity;
  }
  if (!city) return { success: false, error: "No city found" };

  const [cityRecord] = await db.select().from(cities).where(eq(cities.id, city.id)).limit(1);
  const branding = cityRecord ? buildCityBranding(cityRecord) : { brandShort: "Metro Hub", aiGuideName: "Charlotte" };
  const baseUrl = process.env.APP_PUBLIC_URL || "https://cltcityhub.com";
  const citySlug = cityRecord?.slug || "charlotte";

  let contextClue = "at a recent event";
  if (connectionSource === "networking_event") contextClue = "at the networking event";
  else if (connectionSource === "chamber_event") contextClue = "at the chamber event";
  else if (connectionSource === "conference") contextClue = "at the conference";
  else if (connectionSource === "referral") contextClue = "through a referral";
  else if (connectionSource === "walk_in") contextClue = "when I stopped by";

  let subject = `Great meeting you, ${recipientName} -- ${branding.brandShort}`;
  let bodyText = `It was great meeting you ${contextClue}. I wanted to reach out personally because I think ${companyName} would be a fantastic addition to our local community platform, ${branding.brandShort}.\n\nWe feature local businesses and help them connect with the community through stories, events, and local visibility. I'd love to learn more about what you do and see how we can spotlight ${companyName}.\n\nIf you have a few minutes, I'd love to set up a quick chat.`;

  if (openai) {
    try {
      const prompt = [
        `Recipient: ${recipientName}`,
        `Business: ${companyName}`,
        `Context: Met ${contextClue}`,
        notes ? `Notes from meeting: ${notes}` : "",
        `Platform: ${branding.brandShort}`,
      ].filter(Boolean).join("\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildBeckyIntroSystem(branding.brandShort),
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) bodyText = parsed.body;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[BeckyOutreach] OpenAI error:", msg);
    }
  }

  const bookingUrl = capture.bookingUrl || DEFAULT_BOOKING_URL;

  let storyPreviewUrl: string | null = null;
  if (capture.linkedArticleId) {
    const [article] = await db.select({ slug: articles.slug }).from(articles).where(eq(articles.id, capture.linkedArticleId)).limit(1);
    if (article) {
      storyPreviewUrl = `${baseUrl}/${citySlug}/articles/${article.slug}`;
    }
  }

  const html = buildBeckyEmailHtml({
    recipientName,
    companyName,
    contextNote: contextClue,
    bodyText,
    bookingUrl,
    storyPreviewUrl,
    brandShort: branding.brandShort,
    citySlug,
    baseUrl,
  });

  const result = await sendTerritoryEmail({
    cityId: city.id,
    to: capture.email,
    subject,
    html,
    metadata: { type: "becky_intro", captureId },
  });

  if (result.success) {
    await db.update(crmContacts).set({
      outreachStatus: "INVITE_SENT",
      outreachEmailSentAt: new Date(),
      lastContactedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(crmContacts.id, captureId));
    console.log(`[BeckyOutreach] Intro email sent to ${capture.email} for capture ${captureId}`);
  }

  return result;
}
