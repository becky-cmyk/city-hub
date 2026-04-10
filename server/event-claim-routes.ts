import type { Express, Request, Response } from "express";
import { db } from "./db";
import { events, verificationCodes, publicUsers, businesses, zones, type InsertEvent } from "@shared/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import { sendTerritoryEmail } from "./services/territory-email";
import { sendTerritorySms } from "./services/territory-sms";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { openai } from "./lib/openai";
import multer from "multer";
import { workflowEngine } from "./workflow-engine";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

const claimAttempts = new Map<string, { count: number; resetAt: number }>();

function checkClaimRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = claimAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    claimAttempts.set(ip, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const verifyAttempts = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();

function checkVerifyRateLimit(key: string): { allowed: boolean; locked?: boolean } {
  const now = Date.now();
  const entry = verifyAttempts.get(key);
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, locked: true };
  }
  if (!entry || now > entry.resetAt) {
    verifyAttempts.set(key, { count: 1, resetAt: now + 600000 });
    return { allowed: true };
  }
  if (entry.count >= 5) {
    entry.lockedUntil = now + 900000;
    return { allowed: false, locked: true };
  }
  entry.count++;
  return { allowed: true };
}

const sendCodeAttempts = new Map<string, { count: number; resetAt: number }>();

function checkSendCodeRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = sendCodeAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    sendCodeAttempts.set(key, { count: 1, resetAt: now + 600000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

function buildEventClaimEmailHtml(eventTitle: string, claimUrl: string, viewUrl: string): { subject: string; html: string } {
  const subject = `${eventTitle} — claim your event on CLT Metro Hub`;
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #5B1D8F 0%, #7B2FBF 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">CLT Metro Hub</h1>
      <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">Charlotte's Neighborhood-First Platform</p>
    </div>
    <div style="padding: 32px 32px 24px;">
      <p style="color: #1a1a2e; font-size: 18px; font-weight: 600; line-height: 1.4; margin: 0 0 16px;">Your event <strong>${eventTitle}</strong> is listed on CLT Metro Hub!</p>
      <p style="color: #555; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">Claim your event to manage details, engage attendees, and get featured across Charlotte's neighborhoods.</p>
      <p style="text-align: center; margin: 0 0 16px;">
        <a href="${claimUrl}" style="display: inline-block; padding: 16px 40px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">Claim Your Event</a>
      </p>
      <p style="text-align: center; margin: 0 0 8px;">
        <a href="${viewUrl}" style="display: inline-block; padding: 10px 24px; background: transparent; color: #5B1D8F; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; border: 1px solid #e5e5e5;">View Event Page</a>
      </p>
    </div>
    <div style="background: #f9f7fc; padding: 20px 32px; border-top: 1px solid #f0ecf5;">
      <p style="color: #777; font-size: 12px; margin: 0; text-align: center;">This link expires in 14 days.</p>
    </div>
  </div>`;
  return { subject, html };
}

export function registerEventClaimRoutes(app: Express, requireAdmin: (req: Request, res: Response, next: any) => void) {

  app.post("/api/admin/intake/event-photo-extract", requireAdmin, upload.single("photo"), async (req: Request, res: Response) => {
    try {
      const mReq = req as Request & { file?: Express.Multer.File };
      if (!mReq.file) return res.status(400).json({ error: "photo required" });

      const base64 = mReq.file.buffer.toString("base64");
      const mimeType = mReq.file.mimetype || "image/jpeg";

      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You extract event information from photos of flyers, posters, social media screenshots, or signs. Return a JSON object with these fields and confidence scores. Use empty string for missing fields and 0.0 confidence for fields you couldn't find.
{
  "title": "event name",
  "description": "event description (2-3 sentences)",
  "startDate": "YYYY-MM-DD or best guess",
  "startTime": "HH:MM (24hr) or empty",
  "endDate": "YYYY-MM-DD or empty",
  "endTime": "HH:MM (24hr) or empty",
  "locationName": "venue name",
  "address": "full address",
  "city": "city name",
  "state": "state abbreviation",
  "zip": "zip code",
  "costText": "price or 'Free'",
  "organizerName": "organizer or host name",
  "organizerEmail": "contact email",
  "organizerPhone": "contact phone",
  "websiteUrl": "url if visible",
  "rsvpUrl": "rsvp or ticket url if visible",
  "sponsors": ["list of sponsor names"],
  "tags": ["relevant tags like live-music, family-friendly, etc"],
  "confidenceScores": {
    "title": 0.0-1.0,
    "startDate": 0.0-1.0,
    "startTime": 0.0-1.0,
    "locationName": 0.0-1.0,
    "organizerName": 0.0-1.0,
    "costText": 0.0-1.0,
    "description": 0.0-1.0,
    "address": 0.0-1.0,
    "organizerEmail": 0.0-1.0,
    "organizerPhone": 0.0-1.0,
    "endDate": 0.0-1.0,
    "endTime": 0.0-1.0
  },
  "gapFlags": ["list of missing or uncertain fields like 'no end time', 'address incomplete', 'no contact email']
}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all event information from this image. Return only valid JSON." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let extracted: any;
      try {
        extracted = JSON.parse(content);
      } catch {
        extracted = { title: "Could not parse", rawResponse: content, gapFlags: ["extraction_failed"] };
      }

      res.json({ extracted });
    } catch (err) {
      console.error("[EVENT-CAPTURE] Photo extract error:", err);
      res.status(500).json({ error: "Photo extraction failed" });
    }
  });

  app.post("/api/admin/intake/event-url-extract", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "url required" });

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: "Only HTTP/HTTPS URLs are allowed" });
      }
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedHostPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^0\./,
        /^169\.254\./,
        /^\[::1\]$/,
        /^\[fc/i,
        /^\[fd/i,
        /^\[fe80/i,
        /^metadata\./i,
      ];
      if (blockedHostPatterns.some(p => p.test(hostname))) {
        return res.status(400).json({ error: "URL target not allowed" });
      }

      const dns = await import("dns");
      const { promisify } = await import("util");
      const dnsLookup = promisify(dns.lookup);
      try {
        const resolved = await dnsLookup(hostname, { all: true });
        const resolvedAddrs = Array.isArray(resolved) ? resolved : [resolved];
        const blockedIpPatterns = [
          /^127\./,
          /^10\./,
          /^172\.(1[6-9]|2\d|3[01])\./,
          /^192\.168\./,
          /^0\./,
          /^169\.254\./,
          /^::1$/,
          /^fc/i,
          /^fd/i,
          /^fe80/i,
        ];
        for (const addr of resolvedAddrs) {
          const ip = typeof addr === "object" && "address" in addr ? addr.address : String(addr);
          if (blockedIpPatterns.some(p => p.test(ip))) {
            return res.status(400).json({ error: "URL resolves to a blocked address" });
          }
        }
      } catch {
        return res.status(400).json({ error: "Could not resolve URL hostname" });
      }

      let pageContent = "";
      try {
        const resp = await fetch(url, {
          headers: { "User-Agent": "CityMetroHub/1.0 Content Importer" },
          signal: AbortSignal.timeout(15000),
          redirect: "manual",
        });
        if (resp.status >= 300 && resp.status < 400) {
          return res.status(400).json({ error: "URL redirects are not followed for security" });
        }
        pageContent = await resp.text();
      } catch {
        return res.status(400).json({ error: "Could not fetch the URL" });
      }

      const textContent = pageContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);

      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Extract event information from web page content. Return JSON with the same structure as for photo extraction:
{
  "title": "event name",
  "description": "event description (2-3 sentences rewritten)",
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:MM (24hr)",
  "endDate": "YYYY-MM-DD or empty",
  "endTime": "HH:MM (24hr) or empty",
  "locationName": "venue name",
  "address": "full address",
  "city": "city",
  "state": "state",
  "zip": "zip",
  "costText": "price info",
  "organizerName": "organizer name",
  "organizerEmail": "email",
  "organizerPhone": "phone",
  "websiteUrl": "original url",
  "rsvpUrl": "rsvp/ticket url",
  "sponsors": [],
  "tags": [],
  "confidenceScores": { "title": 0.0-1.0, "startDate": 0.0-1.0, "startTime": 0.0-1.0, "locationName": 0.0-1.0, "organizerName": 0.0-1.0, "costText": 0.0-1.0, "description": 0.0-1.0, "address": 0.0-1.0, "organizerEmail": 0.0-1.0, "organizerPhone": 0.0-1.0 },
  "gapFlags": ["list of missing fields"]
}`
          },
          { role: "user", content: `Extract event information from this page (URL: ${url}):\n\n${textContent}` },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let extracted: any;
      try {
        extracted = JSON.parse(content);
      } catch {
        extracted = { title: "Could not parse", rawResponse: content, gapFlags: ["extraction_failed"] };
      }

      res.json({ extracted });
    } catch (err) {
      console.error("[EVENT-CAPTURE] URL extract error:", err);
      res.status(500).json({ error: "URL extraction failed" });
    }
  });

  app.post("/api/admin/intake/event-capture-publish", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        cityId: z.string().min(1),
        zoneId: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        startDateTime: z.string().min(1),
        endDateTime: z.string().optional(),
        locationName: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        costText: z.string().optional(),
        imageUrl: z.string().optional(),
        organizerName: z.string().optional(),
        organizerEmail: z.string().optional(),
        organizerPhone: z.string().optional(),
        hostBusinessId: z.string().optional(),
        capturePhotoUrl: z.string().optional(),
        aiExtractedData: z.record(z.any()).optional(),
        aiConfidenceScores: z.record(z.number()).optional(),
        aiGapFlags: z.array(z.string()).optional(),
        sourceUrl: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

      const data = parsed.data;
      const slug = slugify(data.title);

      let resolvedZoneId = data.zoneId;
      if (!resolvedZoneId) {
        const [fallbackZone] = await db.select({ id: zones.id })
          .from(zones)
          .where(eq(zones.cityId, data.cityId))
          .limit(1);
        resolvedZoneId = fallbackZone?.id || null;
      }
      if (!resolvedZoneId) {
        return res.status(400).json({ error: "No zone available for this city. Please specify a zoneId." });
      }

      const { storage } = await import("./storage");
      const existing = await storage.getEventBySlug(data.cityId, slug);
      const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

      const eventData: InsertEvent = {
        cityId: data.cityId,
        zoneId: resolvedZoneId,
        title: data.title,
        slug: finalSlug,
        description: data.description || null,
        startDateTime: new Date(data.startDateTime),
        endDateTime: data.endDateTime ? new Date(data.endDateTime) : null,
        locationName: data.locationName || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        costText: data.costText || null,
        imageUrl: data.imageUrl || null,
        hostBusinessId: data.hostBusinessId || null,
        organizerName: data.organizerName || null,
        organizerEmail: data.organizerEmail || null,
        organizerPhone: data.organizerPhone || null,
        captureSource: "field_capture",
        capturePhotoUrl: data.capturePhotoUrl || null,
        aiExtractedData: data.aiExtractedData || null,
        aiConfidenceScores: data.aiConfidenceScores || null,
        aiGapFlags: data.aiGapFlags || [],
        sourceUrl: data.sourceUrl || null,
        eventClaimStatus: "UNCLAIMED",
      };
      const event = await storage.createEvent(eventData);

      createInboxItemIfNotOpen({
        itemType: "new_event_capture",
        relatedTable: "events",
        relatedId: event.id,
        title: `Event Captured: ${data.title}`,
        summary: `Event captured from ${data.capturePhotoUrl ? "photo" : data.sourceUrl ? "URL" : "manual entry"}. ${data.aiGapFlags?.length ? `Gaps: ${data.aiGapFlags.join(", ")}` : "No gaps detected."}`,
        tags: ["Event Capture", ...(data.aiGapFlags?.length ? ["Has Gaps"] : [])],
        links: [{ label: "Review Event", urlOrRoute: "/admin/events" }],
      }).catch(err => console.error("[INBOX] Failed to create event capture inbox item:", err));

      const enrichments: string[] = [];

      if (data.organizerName) {
        try {
          const { ilike } = await import("drizzle-orm");
          const [matchedBiz] = await db.select({ id: businesses.id, name: businesses.name })
            .from(businesses)
            .where(ilike(businesses.name, data.organizerName.trim()))
            .limit(1);
          if (matchedBiz) {
            await storage.updateEvent(event.id, { hostBusinessId: matchedBiz.id });
            enrichments.push(`Matched organizer to business: ${matchedBiz.name}`);
          }
        } catch (e) {
          console.error("[EVENT-CAPTURE] Business matching error:", e);
        }
      }

      if (data.locationName) {
        try {
          const { ilike } = await import("drizzle-orm");
          const [venueBiz] = await db.select({ id: businesses.id, name: businesses.name })
            .from(businesses)
            .where(ilike(businesses.name, data.locationName.trim()))
            .limit(1);
          if (venueBiz && !data.hostBusinessId) {
            await storage.updateEvent(event.id, { venuePresenceId: venueBiz.id });
            enrichments.push(`Matched venue to business: ${venueBiz.name}`);
          }
        } catch (e) {
          console.error("[EVENT-CAPTURE] Venue matching error:", e);
        }
      }

      if (data.address && data.city && data.state) {
        try {
          const fullAddress = `${data.address}, ${data.city}, ${data.state} ${data.zip || ""}`.trim();
          const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`;
          const geoResp = await fetch(geoUrl, { headers: { "User-Agent": "CLTMetroHub/1.0" } });
          if (geoResp.ok) {
            const geoResults = await geoResp.json();
            if (geoResults.length > 0) {
              const { lat, lon } = geoResults[0];
              await storage.updateEvent(event.id, {
                latitude: lat.toString(),
                longitude: lon.toString(),
              });
              enrichments.push(`Geocoded address: ${lat}, ${lon}`);
            }
          }
        } catch (e) {
          console.error("[EVENT-CAPTURE] Geocoding error:", e);
        }
      }

      const { queueTranslation } = await import("./services/auto-translate");
      queueTranslation("event", event.id);

      res.json({ event, enrichments });
    } catch (err: any) {
      console.error("[EVENT-CAPTURE] Publish error:", err);
      res.status(500).json({ error: err.message || "Failed to publish event" });
    }
  });

  app.post("/api/admin/events/:eventId/send-claim-invite", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { email, customMessage } = req.body;

      if (!email) return res.status(400).json({ error: "email required" });

      const [evt] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (!evt) return res.status(404).json({ error: "Event not found" });

      if (evt.eventClaimStatus === "CLAIMED") {
        return res.status(400).json({ error: "Event is already claimed" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await db.update(events).set({
        eventClaimTokenHash: tokenHash,
        eventClaimTokenExpiresAt: expiresAt,
        eventClaimStatus: "CLAIM_SENT",
        organizerEmail: email,
        updatedAt: new Date(),
      }).where(eq(events.id, eventId));

      const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;

      const cities = await import("@shared/schema").then(m => m.cities);
      const [city] = await db.select().from(cities).where(eq(cities.id, evt.cityId)).limit(1);
      const citySlug = city?.slug || "charlotte";

      const claimUrl = `${appUrl}/${citySlug}/claim-event/${token}`;
      const viewUrl = `${appUrl}/${citySlug}/events/${evt.slug}`;

      const { subject, html } = buildEventClaimEmailHtml(evt.title, claimUrl, viewUrl);

      const { sendTemplatedEmail } = await import("./resend-client");
      const sent = await sendTemplatedEmail(email, subject, html);

      if (!sent) {
        return res.status(500).json({ error: "Failed to send claim invite email" });
      }

      res.json({ success: true, message: `Claim invite sent to ${email}` });
    } catch (err: any) {
      console.error("[EVENT-CLAIM] Send invite error:", err);
      res.status(500).json({ error: err.message || "Failed to send invite" });
    }
  });

  app.get("/api/event-claim/verify", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ error: "token required" });

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const [evt] = await db.select().from(events)
        .where(eq(events.eventClaimTokenHash, tokenHash))
        .limit(1);

      if (!evt) return res.status(404).json({ error: "Invalid or expired claim link" });

      if (evt.eventClaimTokenExpiresAt && new Date() > evt.eventClaimTokenExpiresAt) {
        return res.status(410).json({ error: "Claim link has expired" });
      }

      if (evt.eventClaimStatus === "CLAIMED") {
        return res.status(400).json({ error: "Event has already been claimed" });
      }

      const cities = await import("@shared/schema").then(m => m.cities);
      const [city] = await db.select().from(cities).where(eq(cities.id, evt.cityId)).limit(1);

      const availableChannels: string[] = [];
      if (evt.organizerEmail) availableChannels.push("EMAIL");
      if (evt.organizerPhone) availableChannels.push("SMS");

      res.json({
        eventId: evt.id,
        title: evt.title,
        slug: evt.slug,
        startDateTime: evt.startDateTime,
        locationName: evt.locationName,
        imageUrl: evt.imageUrl,
        organizerName: evt.organizerName,
        organizerEmail: evt.organizerEmail,
        maskedOrganizerPhone: evt.organizerPhone ? evt.organizerPhone.replace(/\d(?=\d{4})/g, "*") : null,
        availableChannels,
        citySlug: city?.slug || "charlotte",
      });
    } catch (err: any) {
      console.error("[EVENT-CLAIM] Verify error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/event-claim/send-code", async (req: Request, res: Response) => {
    try {
      const { eventId, type, target, token } = req.body;
      if (!eventId || !type || !target || !token) {
        return res.status(400).json({ error: "eventId, type, target, and token required" });
      }
      if (!["EMAIL", "SMS"].includes(type)) {
        return res.status(400).json({ error: "type must be EMAIL or SMS" });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const [claimEvt] = await db.select().from(events)
        .where(and(eq(events.id, eventId), eq(events.eventClaimTokenHash, tokenHash)))
        .limit(1);
      if (!claimEvt) return res.status(400).json({ error: "Invalid claim token" });

      if (type === "EMAIL") {
        if (!claimEvt.organizerEmail) {
          return res.status(403).json({ error: "Email verification is not available for this event. No organizer email on file." });
        }
        if (target.toLowerCase().trim() !== claimEvt.organizerEmail.toLowerCase().trim()) {
          return res.status(403).json({ error: "Verification target must match the organizer email on file" });
        }
      }
      if (type === "SMS") {
        if (!claimEvt.organizerPhone) {
          return res.status(403).json({ error: "SMS verification is not available for this event. No organizer phone on file." });
        }
        if (target.replace(/\D/g, "") !== claimEvt.organizerPhone.replace(/\D/g, "")) {
          return res.status(403).json({ error: "Verification target must match the organizer phone on file" });
        }
      }

      const ip = req.ip || "unknown";
      if (!checkClaimRateLimit(ip)) {
        return res.status(429).json({ error: "Too many attempts. Please try again later." });
      }

      const sendKey = `${ip}:${eventId}`;
      if (!checkSendCodeRateLimit(sendKey)) {
        return res.status(429).json({ error: "Too many code requests. Please wait before requesting another code." });
      }

      await db.update(verificationCodes)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(verificationCodes.entityId, eventId),
            eq(verificationCodes.type, type),
            isNull(verificationCodes.usedAt),
          )
        );

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(verificationCodes).values({
        entityId: eventId,
        code,
        type,
        target,
        expiresAt,
      });

      const evt = claimEvt;

      if (type === "EMAIL") {
        const result = await sendTerritoryEmail({
          cityId: evt?.cityId,
          to: target,
          subject: "CLT Metro Hub - Event Claim Verification Code",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #5B1D8F; margin-bottom: 16px;">Verify Your Event Claim</h2>
              <p style="color: #333; font-size: 16px;">Your verification code is:</p>
              <div style="background: #f4f0ff; border: 2px solid #5B1D8F; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #5B1D8F;">${code}</span>
              </div>
              <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
            </div>
          `,
          metadata: { type: "event_claim_verification", entityId: eventId },
        });
        if (!result.success) {
          return res.status(500).json({ error: "Failed to send verification email" });
        }
      } else {
        const result = await sendTerritorySms({
          cityId: evt?.cityId,
          to: target,
          body: `CLT Metro Hub event claim verification code: ${code}. Expires in 10 minutes.`,
          metadata: { type: "event_claim_verification", entityId: eventId },
        });
        if (!result.success) {
          return res.status(500).json({ error: "Failed to send SMS" });
        }
      }

      res.json({ success: true, message: `Verification code sent via ${type.toLowerCase()}` });
    } catch (err: any) {
      console.error("[EVENT-CLAIM] Send code error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/event-claim/verify-code", async (req: Request, res: Response) => {
    try {
      const { eventId, code, type, token, target } = req.body;
      if (!eventId || !code || !type || !token || !target) {
        return res.status(400).json({ error: "eventId, code, type, token, and target required" });
      }

      const ip = req.ip || "unknown";
      const verifyKey = `${ip}:${eventId}`;
      const rateCheck = checkVerifyRateLimit(verifyKey);
      if (!rateCheck.allowed) {
        const msg = rateCheck.locked
          ? "Too many failed attempts. Account locked for 15 minutes."
          : "Too many verification attempts. Please try again later.";
        return res.status(429).json({ error: msg });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const [evt] = await db.select().from(events)
        .where(and(eq(events.id, eventId), eq(events.eventClaimTokenHash, tokenHash)))
        .limit(1);
      if (!evt) return res.status(400).json({ error: "Invalid claim token" });

      const [match] = await db.select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.entityId, eventId),
            eq(verificationCodes.code, code),
            eq(verificationCodes.type, type),
            eq(verificationCodes.target, target),
            isNull(verificationCodes.usedAt),
            gt(verificationCodes.expiresAt, new Date()),
          )
        )
        .limit(1);

      if (!match) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }

      await db.update(verificationCodes)
        .set({ usedAt: new Date() })
        .where(eq(verificationCodes.id, match.id));

      const session = req.session as any;
      if (session) {
        session.eventClaimVerified = eventId;
        session.eventClaimVerifiedAt = Date.now();
      }

      res.json({ success: true, verified: type.toLowerCase() });
    } catch (err: any) {
      console.error("[EVENT-CLAIM] Verify code error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/event-claim/complete", async (req: Request, res: Response) => {
    try {
      const { eventId, token, name, email, phone } = req.body;
      if (!eventId || !token || !email) {
        return res.status(400).json({ error: "eventId, token, and email are required" });
      }

      const session = req.session as any;
      const verifiedEventId = session?.eventClaimVerified;
      const verifiedAt = session?.eventClaimVerifiedAt;
      const VERIFICATION_WINDOW_MS = 30 * 60 * 1000;

      if (verifiedEventId !== eventId || !verifiedAt || (Date.now() - verifiedAt) > VERIFICATION_WINDOW_MS) {
        return res.status(403).json({ error: "You must verify your identity before completing the claim. Please go back and enter the verification code." });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const [evt] = await db.select().from(events)
        .where(and(
          eq(events.id, eventId),
          eq(events.eventClaimTokenHash, tokenHash),
        ))
        .limit(1);

      if (!evt) return res.status(404).json({ error: "Invalid claim token" });

      if (evt.eventClaimStatus === "CLAIMED") {
        return res.status(400).json({ error: "Event already claimed" });
      }

      if (evt.eventClaimTokenExpiresAt && new Date() > evt.eventClaimTokenExpiresAt) {
        return res.status(410).json({ error: "Claim link has expired" });
      }

      let publicUserId = session?.publicUserId;

      if (!publicUserId && email) {
        let user = await db.select().from(publicUsers).where(eq(publicUsers.email, email.toLowerCase())).limit(1);
        if (user.length > 0) {
          publicUserId = user[0].id;
        } else {
          const [newUser] = await db.insert(publicUsers).values({
            email: email.toLowerCase(),
            displayName: name || email.split("@")[0],
            accountType: "EVENT_ORGANIZER",
          }).returning();
          publicUserId = newUser.id;
        }
        session.publicUserId = publicUserId;
      }

      await db.update(events).set({
        eventClaimStatus: "CLAIMED",
        eventClaimedAt: new Date(),
        eventClaimedByUserId: publicUserId || null,
        eventClaimTokenHash: null,
        eventClaimTokenExpiresAt: null,
        organizerName: name || evt.organizerName,
        organizerEmail: email || evt.organizerEmail,
        organizerPhone: phone || evt.organizerPhone,
        updatedAt: new Date(),
      }).where(eq(events.id, eventId));

      if (session) {
        delete session.eventClaimVerified;
        delete session.eventClaimVerifiedAt;
      }

      const citiesMod = await import("@shared/schema").then(m => m.cities);
      const [city] = await db.select().from(citiesMod).where(eq(citiesMod.id, evt.cityId)).limit(1);

      createInboxItemIfNotOpen({
        itemType: "event_claimed",
        relatedTable: "events",
        relatedId: eventId,
        title: `Event Claimed: ${evt.title}`,
        summary: `Event claimed by ${name || email || "unknown"} (${email || "no email"}).`,
        tags: ["Event Claim"],
        links: [{ label: "View Event", urlOrRoute: "/admin/events" }],
      }).catch(err => console.error("[INBOX] Event claim inbox item failed:", err));

      workflowEngine.startSession({
        cityId: evt.cityId,
        source: "event",
        contactEmail: email,
        contactPhone: phone,
        contactName: name,
        entityId: eventId,
        entityType: "event",
        sessionData: { eventTitle: evt.title, claimCompleted: true },
        internalResume: true,
      }).then(({ session }) =>
        workflowEngine.advanceThroughSteps(session.id, "complete", { reason: "event claim completed directly" })
      ).catch(err => console.error("[WORKFLOW] event claim session:", err));

      const hostBizSlug = evt.hostBusinessId ? await db.select().from(businesses).where(eq(businesses.id, evt.hostBusinessId)).limit(1).then(r => r[0]?.slug) : null;

      res.json({
        success: true,
        eventId: evt.id,
        slug: evt.slug,
        citySlug: city?.slug || "charlotte",
        venueEventsUrl: hostBizSlug ? `/${city?.slug || "charlotte"}/owner/${hostBizSlug}/events` : null,
      });
    } catch (err: any) {
      console.error("[EVENT-CLAIM] Complete error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/event-claim/initiate", async (req: Request, res: Response) => {
    try {
      const { eventId, name, email, phone } = req.body;
      if (!eventId || !email) {
        return res.status(400).json({ error: "eventId and email required" });
      }

      const ip = req.ip || "unknown";
      if (!checkClaimRateLimit(ip)) {
        return res.status(429).json({ error: "Too many attempts. Please try again later." });
      }

      const [evt] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (!evt) return res.status(404).json({ error: "Event not found" });

      if (evt.eventClaimStatus === "CLAIMED") {
        return res.status(400).json({ error: "Event is already claimed" });
      }

      const emailLower = email.toLowerCase().trim();
      const hasOrganizerContact = evt.organizerEmail || evt.organizerPhone;

      if (!hasOrganizerContact) {
        createInboxItemIfNotOpen({
          itemType: "event_claim_request",
          relatedTable: "events",
          relatedId: eventId,
          title: `Claim Request: ${evt.title}`,
          summary: `${name || email} requested to claim "${evt.title}" but no organizer contact is on file. Admin review required to issue claim invite.`,
          tags: ["Event Claim", "Pending Review", "No Contact Match"],
          links: [{ label: "Review Event", urlOrRoute: "/admin/events" }],
        }).catch(err => console.error("[INBOX] Claim request inbox item failed:", err));

        return res.status(202).json({
          success: false,
          pendingReview: true,
          message: "Your claim request has been submitted for admin review. We'll notify you once it's approved.",
        });
      }

      const emailMatch = evt.organizerEmail && evt.organizerEmail.toLowerCase().trim() === emailLower;
      const phoneMatch = phone && evt.organizerPhone && evt.organizerPhone.replace(/\D/g, "") === phone.replace(/\D/g, "");
      if (!emailMatch && !phoneMatch) {
        return res.status(403).json({ error: "The provided contact information does not match the event organizer on file. If you believe this is an error, please contact support." });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await db.update(events).set({
        eventClaimTokenHash: tokenHash,
        eventClaimTokenExpiresAt: expiresAt,
        eventClaimStatus: "CLAIM_SENT",
        updatedAt: new Date(),
      }).where(eq(events.id, eventId));

      createInboxItemIfNotOpen({
        itemType: "event_claim_self_initiated",
        relatedTable: "events",
        relatedId: eventId,
        title: `Self-Claim Initiated: ${evt.title}`,
        summary: `${name || email} initiated claim for "${evt.title}". Contact matched organizer on file.`,
        tags: ["Event Claim", "Self-Initiated"],
        links: [{ label: "Review Event", urlOrRoute: "/admin/events" }],
      }).catch(err => console.error("[INBOX] Self-claim inbox item failed:", err));

      res.json({ success: true, token });
    } catch (err: any) {
      console.error("[EVENT-CLAIM] Initiate error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/events/captured", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(events)
        .where(eq(events.captureSource, "field_capture"))
        .orderBy(events.createdAt);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
