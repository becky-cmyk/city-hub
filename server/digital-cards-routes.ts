import type { Express, Request, Response } from "express";
import { db } from "./db";
import { digitalCards, insertDigitalCardSchema, cardContactExchanges, insertCardContactExchangeSchema, crmContacts, commsLog } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getResendClient } from "./resend-client";

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getPublicBaseUrl(): string {
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  return "https://cltcityhub.com";
}

function buildIntroEmailHtml(opts: { visitorName: string; ownerName: string; ownerTitle?: string | null; ownerCompany?: string | null; cardUrl: string }) {
  const vName = escHtml(opts.visitorName);
  const oName = escHtml(opts.ownerName);
  const titleLine = [opts.ownerTitle, opts.ownerCompany].filter(Boolean).map(s => escHtml(s!)).join(" at ");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:40px 32px;" cellpadding="0" cellspacing="0">
<tr><td style="font-size:16px;line-height:1.6;color:#1f2937;">
<p style="margin:0 0 16px;">Hi ${vName},</p>
<p style="margin:0 0 16px;">You just connected with <strong>${oName}</strong>${titleLine ? ` (${titleLine})` : ""} and this is an automatic email intro.</p>
<p style="margin:0 0 16px;"><strong><em>Reply to this email to continue the conversation.</em></strong></p>
<p style="margin:0 0 24px;">${vName}, here is <a href="${opts.cardUrl}" style="color:#6B21A8;text-decoration:underline;">${oName}'s digital business card</a>.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function registerDigitalCardsRoutes(app: Express, requireAdmin: any) {
  app.get("/api/digital-cards", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const cards = await db.select().from(digitalCards).where(eq(digitalCards.userId, userId));
      res.json({ data: cards });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/digital-cards", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const slug = req.body.slug || req.body.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `card-${Date.now()}`;

      const [existingSlug] = await db.select().from(digitalCards).where(eq(digitalCards.slug, slug));
      if (existingSlug) {
        return res.status(400).json({ message: "A card with this slug already exists. Choose a different name." });
      }

      const parsed = insertDigitalCardSchema.parse({ ...req.body, userId, slug });
      const [card] = await db.insert(digitalCards).values(parsed).returning();
      res.status(201).json(card);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/digital-cards/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [existing] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.id, req.params.id), eq(digitalCards.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Card not found" });

      const { name, title, company, email, phone, websiteUrl, photoUrl, cardImageUrl, personPhotoUrl, companyLogoUrl, themeColor, isActive, slug, calendarUrl, bookingEnabled, bookingSlotMinutes, bookingAvailability, bookingTimezone, bookingBufferMinutes, bookingMaxDaysAhead } = req.body;
      const updateFields: any = {};
      if (name !== undefined) updateFields.name = name;
      if (title !== undefined) updateFields.title = title;
      if (company !== undefined) updateFields.company = company;
      if (email !== undefined) updateFields.email = email;
      if (phone !== undefined) updateFields.phone = phone;
      if (websiteUrl !== undefined) updateFields.websiteUrl = websiteUrl;
      if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;
      if (cardImageUrl !== undefined) updateFields.cardImageUrl = cardImageUrl;
      if (personPhotoUrl !== undefined) updateFields.personPhotoUrl = personPhotoUrl;
      if (companyLogoUrl !== undefined) updateFields.companyLogoUrl = companyLogoUrl;
      if (themeColor !== undefined) updateFields.themeColor = themeColor;
      if (isActive !== undefined) updateFields.isActive = isActive;
      if (calendarUrl !== undefined) updateFields.calendarUrl = calendarUrl;
      if (bookingEnabled !== undefined) updateFields.bookingEnabled = bookingEnabled;
      if (bookingSlotMinutes !== undefined) updateFields.bookingSlotMinutes = bookingSlotMinutes;
      if (bookingAvailability !== undefined) updateFields.bookingAvailability = bookingAvailability;
      if (bookingTimezone !== undefined) updateFields.bookingTimezone = bookingTimezone;
      if (bookingBufferMinutes !== undefined) updateFields.bookingBufferMinutes = bookingBufferMinutes;
      if (bookingMaxDaysAhead !== undefined) updateFields.bookingMaxDaysAhead = bookingMaxDaysAhead;
      if (slug !== undefined && slug !== existing.slug) {
        const [slugTaken] = await db.select().from(digitalCards).where(eq(digitalCards.slug, slug));
        if (slugTaken) return res.status(400).json({ message: "Slug already taken" });
        updateFields.slug = slug;
      }
      updateFields.updatedAt = new Date();

      const [updated] = await db.update(digitalCards)
        .set(updateFields)
        .where(and(eq(digitalCards.id, req.params.id), eq(digitalCards.userId, userId)))
        .returning();
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/digital-cards/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [existing] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.id, req.params.id), eq(digitalCards.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Card not found" });

      await db.delete(digitalCards).where(eq(digitalCards.id, req.params.id));
      res.json({ message: "Card deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/card/:slug", async (req: Request, res: Response) => {
    try {
      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.slug, req.params.slug), eq(digitalCards.isActive, true)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      await db.update(digitalCards)
        .set({ viewCount: sql`${digitalCards.viewCount} + 1` })
        .where(eq(digitalCards.id, card.id));

      res.json({ ...card, viewCount: (card.viewCount || 0) + 1 });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/card/:slug/exchange", async (req: Request, res: Response) => {
    try {
      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.slug, req.params.slug), eq(digitalCards.isActive, true)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      const parsed = insertCardContactExchangeSchema.parse({
        cardId: card.id,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone || null,
        businessName: req.body.businessName || null,
      });

      const [exchange] = await db.insert(cardContactExchanges).values(parsed).returning();
      res.status(201).json({ success: true, id: exchange.id });

      const visitorName = parsed.name;
      const visitorEmail = parsed.email;
      const visitorPhone = parsed.phone || null;
      const visitorBusiness = parsed.businessName || null;

      (async () => {
        try {
          await db.insert(crmContacts).values({
            userId: card.userId,
            name: visitorName,
            email: visitorEmail,
            phone: visitorPhone,
            company: visitorBusiness,
            status: "inbox",
            captureMethod: "digital_exchange",
            connectionSource: card.slug,
            captureOrigin: "qr_card_exchange",
          });
        } catch (err) {
          console.error("[EXCHANGE] CRM contact insert error:", err);
        }

        const subject = `👋 ${visitorName} <> ${card.name}`;
        const bodyPreview = `Auto intro email: ${visitorName} connected with ${card.name}`;
        const logMeta = { type: "card_exchange_intro", cardSlug: card.slug, cardOwnerId: card.userId };

        try {
          if (!card.email) {
            console.log("[EXCHANGE] Card owner has no email, skipping intro email");
            await db.insert(commsLog).values({
              channel: "EMAIL",
              direction: "OUTBOUND",
              recipientEmail: visitorEmail,
              senderAddress: "hello@cltcityhub.com",
              subject,
              bodyPreview,
              status: "FAILED",
              metadata: { ...logMeta, reason: "owner_no_email" },
            }).catch(() => {});
            return;
          }

          const cardUrl = `${getPublicBaseUrl()}/card/${card.slug}`;

          const html = buildIntroEmailHtml({
            visitorName,
            ownerName: card.name,
            ownerTitle: card.title,
            ownerCompany: card.company,
            cardUrl,
          });

          const { client, fromEmail } = await getResendClient();
          await client.emails.send({
            from: fromEmail,
            to: [visitorEmail],
            replyTo: card.email,
            subject,
            html,
          });

          await db.insert(commsLog).values({
            channel: "EMAIL",
            direction: "OUTBOUND",
            recipientEmail: visitorEmail,
            senderAddress: fromEmail,
            subject,
            bodyPreview,
            status: "SENT",
            metadata: logMeta,
          });
        } catch (err: any) {
          console.error("[EXCHANGE] Intro email error:", err);
          await db.insert(commsLog).values({
            channel: "EMAIL",
            direction: "OUTBOUND",
            recipientEmail: visitorEmail,
            senderAddress: "hello@cltcityhub.com",
            subject,
            bodyPreview,
            status: "FAILED",
            metadata: { ...logMeta, error: err?.message || "unknown" },
          }).catch(() => {});
        }
      })();
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Please provide your name and email" });
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/digital-cards/:id/exchanges", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.id, req.params.id), eq(digitalCards.userId, userId)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      const exchanges = await db.select().from(cardContactExchanges)
        .where(eq(cardContactExchanges.cardId, card.id))
        .orderBy(desc(cardContactExchanges.createdAt));
      res.json({ data: exchanges });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
