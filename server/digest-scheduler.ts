import { storage } from "./storage";
import { getResendClient } from "./resend-client";
import { db } from "./db";
import { subscribers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDateEs(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-US", { weekday: "short", month: "short", day: "numeric" });
}

export async function buildDigestContent(cityId: string) {
  const recentBusinesses = await storage.getBusinessesByCityId(cityId, {});
  const topBusinesses = recentBusinesses.slice(0, 5).map(b => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    imageUrl: b.imageUrl,
    categoryName: "",
  }));

  const upcomingEvents = await storage.getEventsByCityId(cityId, {});
  const now = new Date();
  const futureEvents = upcomingEvents
    .filter(e => new Date(e.startDateTime) >= now)
    .slice(0, 5)
    .map(e => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      imageUrl: e.imageUrl,
      startDateTime: e.startDateTime?.toISOString(),
    }));

  const recentArticles = await storage.getArticlesByCityId(cityId, {});
  const latestArticle = recentArticles.slice(0, 1).map(a => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    imageUrl: a.imageUrl,
    excerpt: a.excerpt,
  }));

  return {
    businesses: topBusinesses,
    events: futureEvents,
    articles: latestArticle,
  };
}

export function buildDigestHtml(
  content: { businesses: any[]; events: any[]; articles: any[]; neighborhoodName?: string },
  baseUrl: string,
  citySlug: string,
  locale: "en" | "es" = "en"
): string {
  const isEs = locale === "es";
  const title = isEs ? "Charlotte Esta Semana" : "Charlotte This Week";
  const subtitle = isEs ? "Tu resumen semanal de la comunidad" : "Your weekly community roundup";
  const newBizLabel = isEs ? "Nuevos en el Hub" : "New in the Hub";
  const eventsLabel = isEs ? "Pr\u00f3ximos Eventos" : "Upcoming Events";
  const pulseLabel = isEs ? "Del Pulso" : "From the Pulse";
  const viewLabel = isEs ? "Ver" : "View";
  const readMoreLabel = isEs ? "Leer M\u00e1s" : "Read More";
  const unsubLabel = isEs ? "Cancelar suscripci\u00f3n" : "Unsubscribe";
  const neighborhoodSection = content.neighborhoodName
    ? `<tr><td style="padding:16px 24px 0;"><h3 style="color:#6b21a8;margin:0;font-size:16px;">${isEs ? "Nuevo en" : "New in"} ${content.neighborhoodName}</h3></td></tr>`
    : "";

  const businessRows = content.businesses.map(b => `
    <tr>
      <td style="padding:8px 24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          ${b.imageUrl ? `<td width="60" style="vertical-align:top;"><img src="${baseUrl}${b.imageUrl}" alt="${b.name}" width="56" height="56" style="border-radius:6px;object-fit:cover;" /></td>` : ""}
          <td style="vertical-align:top;padding-left:${b.imageUrl ? "12" : "0"}px;">
            <a href="${baseUrl}/${citySlug}/directory/${b.slug}" style="color:#1e293b;font-weight:600;text-decoration:none;font-size:14px;">${b.name}</a>
            ${b.categoryName ? `<br/><span style="color:#64748b;font-size:12px;">${b.categoryName}</span>` : ""}
          </td>
        </tr></table>
      </td>
    </tr>
  `).join("");

  const eventRows = content.events.map(e => `
    <tr>
      <td style="padding:8px 24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td>
            <a href="${baseUrl}/${citySlug}/events/${e.slug}" style="color:#1e293b;font-weight:600;text-decoration:none;font-size:14px;">${e.title}</a>
            ${e.startDateTime ? `<br/><span style="color:#64748b;font-size:12px;">${isEs ? formatDateEs(e.startDateTime) : formatDate(e.startDateTime)}</span>` : ""}
          </td>
          <td width="60" style="text-align:right;vertical-align:top;">
            <a href="${baseUrl}/${citySlug}/events/${e.slug}" style="color:#6b21a8;font-size:12px;text-decoration:none;">${viewLabel} &rarr;</a>
          </td>
        </tr></table>
      </td>
    </tr>
  `).join("");

  const articleSection = content.articles.length > 0
    ? content.articles.map(a => `
      <tr>
        <td style="padding:8px 24px;">
          ${a.imageUrl ? `<img src="${baseUrl}${a.imageUrl}" alt="${a.title}" width="100%" style="border-radius:8px;max-height:180px;object-fit:cover;margin-bottom:8px;" />` : ""}
          <a href="${baseUrl}/${citySlug}/articles/${a.slug}" style="color:#1e293b;font-weight:600;text-decoration:none;font-size:15px;">${a.title}</a>
          ${a.excerpt ? `<p style="color:#64748b;font-size:13px;margin:4px 0 8px;">${a.excerpt}</p>` : ""}
          <a href="${baseUrl}/${citySlug}/articles/${a.slug}" style="color:#6b21a8;font-size:13px;text-decoration:none;font-weight:500;">${readMoreLabel} &rarr;</a>
        </td>
      </tr>
    `).join("")
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#6b21a8,#7c3aed);padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${title}</h1>
    <p style="color:#e9d5ff;margin:8px 0 0;font-size:14px;">${subtitle}</p>
  </td></tr>
  ${neighborhoodSection}
  ${content.businesses.length > 0 ? `
  <tr><td style="padding:24px 24px 8px;">
    <h2 style="color:#6b21a8;margin:0;font-size:18px;border-bottom:2px solid #f3e8ff;padding-bottom:8px;">${newBizLabel}</h2>
  </td></tr>
  ${businessRows}
  ` : ""}
  ${content.events.length > 0 ? `
  <tr><td style="padding:24px 24px 8px;">
    <h2 style="color:#d97706;margin:0;font-size:18px;border-bottom:2px solid #fef3c7;padding-bottom:8px;">${eventsLabel}</h2>
  </td></tr>
  ${eventRows}
  ` : ""}
  ${content.articles.length > 0 ? `
  <tr><td style="padding:24px 24px 8px;">
    <h2 style="color:#6b21a8;margin:0;font-size:18px;border-bottom:2px solid #f3e8ff;padding-bottom:8px;">${pulseLabel}</h2>
  </td></tr>
  ${articleSection}
  ` : ""}
  <tr><td style="padding:32px 24px;text-align:center;">
    <a href="${baseUrl}/${citySlug}" style="display:inline-block;padding:12px 32px;background:#6b21a8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${isEs ? "Explorar el Hub" : "Explore the Hub"}</a>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">CLT Metro Hub &mdash; ${isEs ? "Tu centro comunitario local" : "Your local community hub"}</p>
    <p style="margin:8px 0 0;"><a href="${baseUrl}/unsubscribe?email={{email}}" style="color:#94a3b8;font-size:11px;text-decoration:underline;">${unsubLabel}</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function generateDigestPreview(cityId: string, citySlug: string, baseUrl: string) {
  const content = await buildDigestContent(cityId);
  const now = new Date();
  const weekStr = `${now.getFullYear()}-W${String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, "0")}`;
  const slug = `charlotte-this-week-${weekStr}`;

  const htmlEn = buildDigestHtml(content, baseUrl, citySlug, "en");
  const htmlEs = buildDigestHtml(content, baseUrl, citySlug, "es");

  return {
    title: `Charlotte This Week - ${formatDate(now)}`,
    titleEs: `Charlotte Esta Semana - ${formatDateEs(now)}`,
    slug,
    contentJson: content,
    htmlContent: htmlEn,
    htmlContentEs: htmlEs,
  };
}

export async function sendWeeklyDigest(cityId: string, citySlug: string, baseUrl: string): Promise<{ digestId: string; sent: number; failed: number }> {
  const preview = await generateDigestPreview(cityId, citySlug, baseUrl);

  const digest = await storage.createDigest({
    cityId,
    title: preview.title,
    titleEs: preview.titleEs,
    slug: preview.slug + "-" + Date.now(),
    htmlContent: preview.htmlContent,
    htmlContentEs: preview.htmlContentEs,
    contentJson: preview.contentJson,
    digestStatus: "sending",
    content: preview.title,
  });

  const allSubs = await db.select().from(subscribers).where(and(
    eq(subscribers.cityId, cityId),
    eq(subscribers.status, "ACTIVE")
  ));

  const suppressions = await storage.getEmailSuppressions();
  const unsubs = await storage.getEmailUnsubscribes();
  const suppressedSet = new Set<string>();
  suppressions.forEach(s => suppressedSet.add(s.email.toLowerCase()));
  unsubs.forEach(u => suppressedSet.add(u.email.toLowerCase()));

  const eligibleSubs = allSubs.filter(s => s.email && !suppressedSet.has(s.email.toLowerCase()));

  let sentCount = 0;
  let failCount = 0;

  if (eligibleSubs.length > 0) {
    try {
      const { client, fromEmail } = await getResendClient();

      for (const sub of eligibleSubs) {
        if (!sub.email) continue;
        try {
          const html = preview.htmlContent.replaceAll("{{email}}", encodeURIComponent(sub.email));
          await client.emails.send({
            from: fromEmail,
            to: [sub.email],
            subject: preview.title,
            html,
          });
          sentCount++;
        } catch (err) {
          console.error(`[Digest] Failed to send to ${sub.email}:`, err);
          failCount++;
        }
      }
    } catch (err) {
      console.error("[Digest] Could not initialize Resend client:", err);
      failCount = eligibleSubs.length;
    }
  }

  await storage.updateDigest(digest.id, {
    digestStatus: "sent",
    sentAt: new Date(),
    publishedAt: new Date(),
    recipientCount: sentCount,
  } as any);

  return { digestId: digest.id, sent: sentCount, failed: failCount };
}

let digestIntervalId: ReturnType<typeof setInterval> | null = null;

export function startDigestScheduler() {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000;

  async function checkAndSend() {
    try {
      const now = new Date();
      if (now.getUTCDay() !== 1) return;
      if (now.getUTCHours() < 13 || now.getUTCHours() > 14) return;

      const city = await storage.getCityBySlug("charlotte");
      if (!city) return;

      const latest = await storage.getLatestDigest(city.id);
      if (latest?.sentAt) {
        const daysSince = (now.getTime() - new Date(latest.sentAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 6) return;
      }

      const baseUrl = process.env.APP_PUBLIC_URL || "https://cltcityhub.com";
      console.log("[Digest Scheduler] Sending weekly digest...");
      const result = await sendWeeklyDigest(city.id, "charlotte", baseUrl);
      console.log(`[Digest Scheduler] Sent: ${result.sent}, Failed: ${result.failed}`);
    } catch (err) {
      console.error("[Digest Scheduler] Error:", err);
    }
  }

  console.log("[Digest Scheduler] Starting weekly digest scheduler (checks hourly)");
  checkAndSend();
  digestIntervalId = setInterval(checkAndSend, CHECK_INTERVAL_MS);
}

export function stopDigestScheduler() {
  if (digestIntervalId) {
    clearInterval(digestIntervalId);
    digestIntervalId = null;
  }
}
