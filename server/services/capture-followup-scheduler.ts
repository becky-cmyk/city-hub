import { db } from "../db";
import { crmContacts, cities } from "@shared/schema";
import { eq, and, isNotNull, isNull, lt } from "drizzle-orm";
import { openai } from "../lib/openai";
import { sendTerritoryEmail } from "./territory-email";
import { buildCityBranding } from "@shared/city-branding";
import { storage } from "../storage";
import { buildCaptureFollowupSystem } from "../ai/prompts/outreach";

const FOLLOWUP_THRESHOLD_HOURS = parseInt(process.env.OUTREACH_FOLLOWUP_HOURS || "48", 10);
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function buildCharlotteFollowupHtml(params: {
  recipientName: string;
  companyName: string;
  bodyText: string;
  bookingUrl: string;
  brandShort: string;
  aiGuideName: string;
  baseUrl: string;
}): string {
  const { recipientName, bodyText, bookingUrl, brandShort, aiGuideName, baseUrl } = params;

  const bodyParagraphs = bodyText.split("\n").filter(Boolean).map(p =>
    `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 12px;">${p}</p>`
  ).join("");

  const bookingSection = bookingUrl
    ? `<tr><td style="padding:12px 24px;">
        <a href="${bookingUrl}" style="display:inline-block;padding:10px 24px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Schedule a Quick Chat</a>
       </td></tr>`
    : "";

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
  ${bookingSection}
  <tr><td style="padding:24px 24px 16px;">
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0;">Best,</p>
    <p style="color:#334155;font-size:15px;font-weight:600;margin:8px 0 0;">${aiGuideName}</p>
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

async function processFollowups(): Promise<number> {
  const threshold = new Date(Date.now() - FOLLOWUP_THRESHOLD_HOURS * 60 * 60 * 1000);

  const pendingCaptures = await db.select().from(crmContacts).where(
    and(
      eq(crmContacts.outreachStatus, "INVITE_SENT"),
      isNotNull(crmContacts.outreachEmailSentAt),
      lt(crmContacts.outreachEmailSentAt, threshold),
      isNull(crmContacts.calendarBookedAt),
      isNull(crmContacts.followupEmailSentAt),
      isNotNull(crmContacts.email),
      isNull(crmContacts.deletedAt),
    )
  ).limit(20);

  if (pendingCaptures.length === 0) return 0;

  for (const capture of pendingCaptures) {
    try {
      const { enqueueAutomationTrigger } = await import("./automation-triggers");
      await enqueueAutomationTrigger({
        triggerEvent: "booking_no_response",
        entityType: "lead",
        entityId: capture.id,
        cityId: capture.capturedWithHubId || undefined,
        payload: {
          email: capture.email || undefined,
          name: capture.name,
          company: capture.company || undefined,
        },
      });
    } catch {}
  }

  let sent = 0;
  const baseUrl = process.env.APP_PUBLIC_URL || "https://cltcityhub.com";

  for (const capture of pendingCaptures) {
    if (!capture.email) continue;

    try {
      const cityList = await storage.getAllCities();
      let city = cityList[0];
      if (capture.capturedWithHubId) {
        const hubCity = cityList.find(c => c.id === capture.capturedWithHubId);
        if (hubCity) city = hubCity;
      }
      if (!city) continue;

      const [cityRecord] = await db.select().from(cities).where(eq(cities.id, city.id)).limit(1);
      const branding = cityRecord ? buildCityBranding(cityRecord) : { brandShort: "Metro Hub", aiGuideName: "Charlotte" };

      const recipientName = capture.name.split(" ")[0] || capture.name;
      const companyName = capture.company || capture.name;
      const bookingUrl = capture.bookingUrl || process.env.DEFAULT_BOOKING_URL || "";

      let subject = `Quick follow-up -- ${branding.brandShort}`;
      let bodyText = `Just wanted to circle back -- Becky mentioned connecting with you recently about ${companyName} and ${branding.brandShort}.\n\nWe think your business would be a great fit for our community platform. If you have a few minutes, we'd love to set up a quick chat to learn more about what you do.\n\nNo pressure at all -- just reply to this email or grab a time that works for you.`;

      if (openai) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: buildCaptureFollowupSystem(branding.aiGuideName, branding.brandShort),
              },
              {
                role: "user",
                content: `Follow up with ${recipientName} about ${companyName}. They met Becky recently but haven't booked a time yet.`,
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 400,
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
          console.error("[CharlotteFollowup] OpenAI error:", msg);
        }
      }

      const html = buildCharlotteFollowupHtml({
        recipientName,
        companyName,
        bodyText,
        bookingUrl,
        brandShort: branding.brandShort,
        aiGuideName: branding.aiGuideName,
        baseUrl,
      });

      const result = await sendTerritoryEmail({
        cityId: city.id,
        to: capture.email,
        subject,
        html,
        metadata: { type: "charlotte_followup", captureId: capture.id },
      });

      if (result.success) {
        await db.update(crmContacts).set({
          outreachStatus: "FOLLOWUP_SENT",
          followupEmailSentAt: new Date(),
          lastContactedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(crmContacts.id, capture.id));
        sent++;
        console.log(`[CharlotteFollowup] Follow-up sent to ${capture.email} for capture ${capture.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[CharlotteFollowup] Error processing capture ${capture.id}:`, msg);
    }
  }

  return sent;
}

let followupIntervalId: ReturnType<typeof setInterval> | null = null;

export function startFollowupScheduler() {
  console.log(`[CharlotteFollowup] Starting follow-up scheduler (checks hourly, ${FOLLOWUP_THRESHOLD_HOURS}h threshold)`);

  async function check() {
    try {
      const sent = await processFollowups();
      if (sent > 0) {
        console.log(`[CharlotteFollowup] Sent ${sent} follow-up emails`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[CharlotteFollowup] Scheduler error:", msg);
    }
  }

  setTimeout(check, 30000);
  followupIntervalId = setInterval(check, CHECK_INTERVAL_MS);
}

export function stopFollowupScheduler() {
  if (followupIntervalId) {
    clearInterval(followupIntervalId);
    followupIntervalId = null;
  }
}
