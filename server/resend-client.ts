// Resend email client - uses Replit connector for API key management
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    const fallbackKey = process.env.RESEND_API_KEY;
    if (fallbackKey) {
      return { apiKey: fallbackKey, fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@cltcityhub.com' };
    }
    throw new Error('Resend credentials not available');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    const fallbackKey = process.env.RESEND_API_KEY;
    if (fallbackKey) {
      return { apiKey: fallbackKey, fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@cltcityhub.com' };
    }
    throw new Error('Resend not connected');
  }
  const connectorFrom = connectionSettings.settings.from_email || 'noreply@cltcityhub.com';
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectorFrom };
}

const VERIFIED_FROM_EMAIL = process.env.FROM_EMAIL || 'CLT Metro Hub <hello@cltcityhub.com>';

export async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const { apiKey, fromEmail } = await getCredentials();
  const finalFrom = fromEmail.includes('@cltcityhub.com') ? fromEmail : VERIFIED_FROM_EMAIL;
  return {
    client: new Resend(apiKey),
    fromEmail: finalFrom,
  };
}

export async function sendTemplatedEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey && !process.env.REPLIT_CONNECTORS_HOSTNAME) {
    console.log(`[EMAIL-FALLBACK] To: ${to}, Subject: ${subject}`);
    return true;
  }
  try {
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({ from: fromEmail, to: [to], subject, html });
    return true;
  } catch (err) {
    console.error("[EMAIL] Send error:", err);
    return false;
  }
}
