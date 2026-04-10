import { getTwilioClient, getTwilioFromPhoneNumber } from "../twilio-client";
import { db } from "../db";
import { commsLog } from "@shared/schema";

interface SendTerritorySmsOptions {
  territoryId?: string;
  cityId?: string;
  operatorId?: string;
  to: string;
  body: string;
  metadata?: Record<string, any>;
}

export async function sendTerritorySms(options: SendTerritorySmsOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { territoryId, cityId, operatorId, to, body, metadata } = options;

  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();

    const message = await client.messages.create({
      body,
      from: fromNumber,
      to,
    });

    await db.insert(commsLog).values({
      channel: "SMS",
      direction: "OUTBOUND",
      territoryId: territoryId || null,
      cityId: cityId || null,
      operatorId: operatorId || null,
      recipientPhone: to,
      senderAddress: fromNumber,
      bodyPreview: body.substring(0, 200),
      status: "SENT",
      messageId: message.sid || null,
      metadata: metadata || null,
    });

    try {
      const { recordPlatformMessage } = await import("../message-center-routes");
      await recordPlatformMessage({
        cityId: cityId || undefined,
        sourceEngine: "sms",
        channel: "sms",
        status: "sent",
        recipientAddress: to,
        subject: `SMS to ${to}`,
        bodyPreview: body.substring(0, 300),
        sentAt: new Date(),
      });
    } catch {}

    return { success: true, messageId: message.sid };
  } catch (err: any) {
    await db.insert(commsLog).values({
      channel: "SMS",
      direction: "OUTBOUND",
      territoryId: territoryId || null,
      cityId: cityId || null,
      operatorId: operatorId || null,
      recipientPhone: to,
      senderAddress: "twilio",
      bodyPreview: body.substring(0, 200),
      status: "FAILED",
      metadata: { ...metadata, error: err.message },
    });

    try {
      const { recordPlatformMessage } = await import("../message-center-routes");
      await recordPlatformMessage({
        cityId: cityId || undefined,
        sourceEngine: "sms",
        channel: "sms",
        status: "failed",
        recipientAddress: to,
        subject: `SMS to ${to}`,
        bodyPreview: body.substring(0, 300),
        sentAt: new Date(),
      });
    } catch {}

    return { success: false, error: err.message };
  }
}
