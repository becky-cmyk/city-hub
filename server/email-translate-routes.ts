import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { db } from "./db";
import { businesses, emailTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

const HMAC_SECRET = process.env.SESSION_SECRET || process.env.EMAIL_TRANSLATE_SECRET || "cch-email-translate-key";

const translationCache = new Map<string, { html: string; translatedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function signToken(payload: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex").slice(0, 32);
}

export function generateSpanishEmailToken(templateKey: string, businessId: string): string {
  const payload = `${templateKey}:${businessId}`;
  const sig = signToken(payload);
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sig}`;
}

export function buildSpanishUrl(templateKey: string, businessId: string, baseUrl: string): string {
  const token = generateSpanishEmailToken(templateKey, businessId);
  return `${baseUrl}/email/es/${token}`;
}

function parseToken(token: string): { templateKey: string; businessId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  try {
    const payload = Buffer.from(encoded, "base64url").toString("utf-8");
    const expectedSig = signToken(payload);
    if (sig !== expectedSig) return null;
    const [templateKey, businessId] = payload.split(":");
    if (!templateKey || !businessId) return null;
    return { templateKey, businessId };
  } catch {
    return null;
  }
}

async function translateEmailHtml(html: string): Promise<string> {
  try {
    const { translateText } = await import("./services/auto-translate-email");
    return await translateText(html);
  } catch (err) {
    console.error("[EmailTranslate] Translation failed:", err);
    return html;
  }
}

export function clearTranslationCache(templateKey?: string) {
  if (templateKey) {
    for (const key of translationCache.keys()) {
      if (key.startsWith(`${templateKey}:`)) {
        translationCache.delete(key);
      }
    }
  } else {
    translationCache.clear();
  }
}

export function registerEmailTranslateRoutes(app: Express) {
  app.get("/email/es/:token", async (req: Request, res: Response) => {
    try {
      const parsed = parseToken(req.params.token);
      if (!parsed) {
        return res.status(400).send(renderErrorPage("Enlace no válido", "Este enlace de traducción no es válido o ha expirado."));
      }

      const { templateKey, businessId } = parsed;

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
      if (!biz) {
        return res.status(404).send(renderErrorPage("No encontrado", "No se pudo encontrar la información asociada."));
      }

      if (!biz.preferredLanguage || biz.preferredLanguage !== "es") {
        await db.update(businesses)
          .set({ preferredLanguage: "es", updatedAt: new Date() })
          .where(eq(businesses.id, businessId));
        console.log(`[EmailTranslate] Set preferredLanguage=es for business ${businessId} (${biz.name})`);
      }

      const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, templateKey));

      let emailHtml: string;
      if (template?.htmlBody) {
        emailHtml = renderMergeTags(template.htmlBody, biz, req);
      } else {
        emailHtml = buildFallbackClaimHtml(biz, req);
      }

      const cacheKey = `${templateKey}:${businessId}:${template?.updatedAt?.getTime() || 0}`;
      const cached = translationCache.get(cacheKey);
      let translatedHtml: string;

      if (cached && (Date.now() - cached.translatedAt < CACHE_TTL_MS)) {
        translatedHtml = cached.html;
      } else {
        translatedHtml = await translateEmailHtml(emailHtml);
        if (translatedHtml && translatedHtml !== emailHtml) {
          translationCache.set(cacheKey, { html: translatedHtml, translatedAt: Date.now() });
        }
      }

      res.send(renderTranslatedPage(translatedHtml, biz.name));
    } catch (err) {
      console.error("[EmailTranslate] Error:", err);
      res.status(500).send(renderErrorPage("Error", "Ocurrió un error al cargar la traducción."));
    }
  });
}

function renderMergeTags(html: string, biz: any, req: Request): string {
  const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
  const citySlug = (biz as any).citySlug || "charlotte";
  return html
    .replace(/\{\{name\}\}/g, biz.name || "")
    .replace(/\{\{businessName\}\}/g, biz.name || "")
    .replace(/\{\{email\}\}/g, biz.ownerEmail || biz.email || "")
    .replace(/\{\{phone\}\}/g, biz.phone || "")
    .replace(/\{\{city\}\}/g, biz.city || "Charlotte")
    .replace(/\{\{viewUrl\}\}/g, `${appUrl}/${citySlug}/directory/${biz.slug}`)
    .replace(/\{\{claimUrl\}\}/g, `${appUrl}/${citySlug}/claim/${biz.claimToken || ""}?lang=es`)
    .replace(/\{\{siteUrl\}\}/g, appUrl)
    .replace(/\{\{spanishUrl\}\}/g, "");
}

function buildFallbackClaimHtml(biz: any, req: Request): string {
  const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
  const viewUrl = `${appUrl}/charlotte/directory/${biz.slug}`;
  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #5B1D8F; padding: 24px 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">CLT Metro Hub</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 20px;">Your listing "${biz.name}" is live!</h2>
      <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">Great news — your business has been added to CLT Metro Hub. Claim your listing to manage your details, add photos, respond to reviews, and boost your visibility to the Charlotte community.</p>
      <p style="margin: 0 0 12px;"><a href="${viewUrl}" style="color: #5B1D8F; font-weight: 600;">View your listing &rarr;</a></p>
      <p style="color: #888; font-size: 13px; margin: 24px 0 0;">This link expires in 14 days.</p>
    </div>
  </div>`;
}

function renderTranslatedPage(emailHtml: string, businessName: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${businessName} — Versión en Español</title>
  <style>
    body { margin: 0; padding: 20px; background: #f5f5f5; font-family: sans-serif; }
    .wrapper { max-width: 640px; margin: 0 auto; }
    .lang-banner { background: #5B1D8F; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .lang-banner span { opacity: 0.8; }
    .email-content { background: white; border-radius: 0 0 8px 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .footer-note { text-align: center; color: #999; font-size: 11px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="lang-banner">
      <span>ES</span> <span>Version en Espanol</span>
    </div>
    <div class="email-content">
      ${emailHtml}
    </div>
    <p class="footer-note">CLT Metro Hub &bull; Charlotte, NC</p>
  </div>
</body>
</html>`;
}

function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 40px 20px; background: #f5f5f5; font-family: sans-serif; text-align: center; }
    .card { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { color: #5B1D8F; font-size: 24px; margin: 0 0 12px; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
