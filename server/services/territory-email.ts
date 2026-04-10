import { getResendClient } from "../resend-client";
import { db } from "../db";
import { territories, cities, commsLog } from "@shared/schema";
import { eq } from "drizzle-orm";

interface SendTerritoryEmailOptions {
  territoryId?: string;
  cityId?: string;
  operatorId?: string;
  to: string;
  subject: string;
  html: string;
  metadata?: Record<string, any>;
}

async function resolveEmailDomain(territoryId?: string, cityId?: string): Promise<string> {
  if (territoryId) {
    const [territory] = await db.select().from(territories).where(eq(territories.id, territoryId));
    if (territory?.emailDomain) return territory.emailDomain;
    if (territory?.cityId) {
      const [city] = await db.select().from(cities).where(eq(cities.id, territory.cityId));
      if (city?.emailDomain) return city.emailDomain;
    }
  }

  if (cityId) {
    const [city] = await db.select().from(cities).where(eq(cities.id, cityId));
    if (city?.emailDomain) return city.emailDomain;
  }

  return "citymetrohub.com";
}

export async function sendTerritoryEmail(options: SendTerritoryEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { territoryId, cityId, operatorId, to, subject, html, metadata } = options;

  const domain = await resolveEmailDomain(territoryId, cityId);
  const fromAddress = `noreply@${domain}`;
  const bodyPreview = html.replace(/<[^>]*>/g, "").substring(0, 200);

  try {
    const { client } = await getResendClient();

    const result = await client.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });

    const messageId = (result as any)?.data?.id || (result as any)?.id;

    await db.insert(commsLog).values({
      channel: "EMAIL",
      direction: "OUTBOUND",
      territoryId: territoryId || null,
      cityId: cityId || null,
      operatorId: operatorId || null,
      recipientEmail: to,
      senderAddress: fromAddress,
      subject,
      bodyPreview,
      status: "SENT",
      messageId: messageId || null,
      metadata: metadata || null,
    });

    try {
      const { recordPlatformMessage } = await import("../message-center-routes");
      await recordPlatformMessage({
        cityId: cityId || undefined,
        sourceEngine: "crm",
        channel: "email",
        status: "sent",
        recipientAddress: to,
        subject,
        bodyPreview,
        sentAt: new Date(),
      });
    } catch {}

    return { success: true, messageId };
  } catch (err: any) {
    await db.insert(commsLog).values({
      channel: "EMAIL",
      direction: "OUTBOUND",
      territoryId: territoryId || null,
      cityId: cityId || null,
      operatorId: operatorId || null,
      recipientEmail: to,
      senderAddress: fromAddress,
      subject,
      bodyPreview,
      status: "FAILED",
      metadata: { ...metadata, error: err.message },
    });

    return { success: false, error: err.message };
  }
}
