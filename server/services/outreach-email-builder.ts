interface OutreachEmailParams {
  recipientFirstName: string;
  businessName: string;
  yesUrl: string;
  noUrl: string;
  brandShort: string;
}

function wrapEmailLayout(bodyHtml: string, brandShort: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
${bodyHtml}
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;">
  <p style="color:#94a3b8;font-size:11px;margin:0;">${brandShort}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildCtaSection(yesUrl: string, noUrl: string): string {
  return `<tr><td style="padding:8px 24px 4px;" align="center">
  <a href="${yesUrl}" style="display:inline-block;padding:14px 48px;background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">Yes</a>
</td></tr>
<tr><td style="padding:8px 24px 24px;" align="center">
  <a href="${noUrl}" style="color:#94a3b8;font-size:13px;text-decoration:underline;">No thanks</a>
</td></tr>`;
}

export function buildVersionAHtml(params: OutreachEmailParams): string {
  const { recipientFirstName, businessName, yesUrl, noUrl, brandShort } = params;
  const body = `
<tr><td style="padding:32px 24px 0;">
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">Hi ${recipientFirstName},</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">We came across ${businessName} and would love to write a short local story with you as part of our community spotlight (no cost).</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">This is a chance to share your story \u2014 what you\u2019ve built, what you\u2019re working on, and what people should know about you.</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">As part of that, we\u2019ve already created your profile in CLT Hub \u2014 this is what we use to support your story, make sure your information is accurate, and help people find you locally.</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 20px;">Can you take 2\u20135 minutes to let us know you\u2019re interested and confirm your details for activation?</p>
</td></tr>
${buildCtaSection(yesUrl, noUrl)}
<tr><td style="padding:0 24px 16px;">
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">This step lets us move forward with your story and gives you access to manage your presence.</p>
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">CLT Hub is a local search and discovery platform, and we also produce weekly newsletters, print features, and community spotlights.</p>
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 16px;">We\u2019d love to include you.</p>
</td></tr>
<tr><td style="padding:0 24px 24px;">
  <p style="color:#334155;font-size:15px;margin:0;">\u2014 Becky</p>
  <p style="color:#64748b;font-size:13px;margin:4px 0 0;">${brandShort}</p>
</td></tr>`;
  return wrapEmailLayout(body, brandShort);
}

export function buildVersionBHtml(params: OutreachEmailParams): string {
  const { recipientFirstName, businessName, yesUrl, noUrl, brandShort } = params;
  const body = `
<tr><td style="padding:32px 24px 0;">
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">Hi ${recipientFirstName},</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">We came across ${businessName} and would love to write a short local story with you as part of our community spotlight (no cost).</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">The story can be about something that matters to you \u2014 your organization, a cause you support, a group you\u2019re involved with, or something happening in your community that deserves more visibility.</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">As part of that, we\u2019ve already created your profile in CLT Hub \u2014 this helps us support your story, keep your information accurate, and connect people locally.</p>
  <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 20px;">Can you take 2\u20135 minutes to let us know you\u2019re interested and confirm your details for activation?</p>
</td></tr>
${buildCtaSection(yesUrl, noUrl)}
<tr><td style="padding:0 24px 16px;">
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">This step lets us move forward and gives you access to your presence in the hub.</p>
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">CLT Hub is a local search and discovery platform, and we also produce weekly newsletters, print features, and community spotlights.</p>
  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 16px;">We\u2019d love to include what matters to you.</p>
</td></tr>
<tr><td style="padding:0 24px 24px;">
  <p style="color:#334155;font-size:15px;margin:0;">\u2014 Becky</p>
  <p style="color:#64748b;font-size:13px;margin:4px 0 0;">${brandShort}</p>
</td></tr>`;
  return wrapEmailLayout(body, brandShort);
}

export function buildVersionAText(recipientFirstName: string, businessName: string, yesUrl: string, noUrl: string, brandShort: string): string {
  return `Hi ${recipientFirstName},

We came across ${businessName} and would love to write a short local story with you as part of our community spotlight (no cost).

This is a chance to share your story — what you've built, what you're working on, and what people should know about you.

As part of that, we've already created your profile in CLT Hub — this is what we use to support your story, make sure your information is accurate, and help people find you locally.

Can you take 2–5 minutes to let us know you're interested and confirm your details for activation?

Yes: ${yesUrl}
No thanks: ${noUrl}

This step lets us move forward with your story and gives you access to manage your presence.

CLT Hub is a local search and discovery platform, and we also produce weekly newsletters, print features, and community spotlights.

We'd love to include you.

— Becky
${brandShort}`;
}

export function buildVersionBText(recipientFirstName: string, businessName: string, yesUrl: string, noUrl: string, brandShort: string): string {
  return `Hi ${recipientFirstName},

We came across ${businessName} and would love to write a short local story with you as part of our community spotlight (no cost).

The story can be about something that matters to you — your organization, a cause you support, a group you're involved with, or something happening in your community that deserves more visibility.

As part of that, we've already created your profile in CLT Hub — this helps us support your story, keep your information accurate, and connect people locally.

Can you take 2–5 minutes to let us know you're interested and confirm your details for activation?

Yes: ${yesUrl}
No thanks: ${noUrl}

This step lets us move forward and gives you access to your presence in the hub.

CLT Hub is a local search and discovery platform, and we also produce weekly newsletters, print features, and community spotlights.

We'd love to include what matters to you.

— Becky
${brandShort}`;
}

export const SUBJECT_A = "\uD83D\uDCF0 Write a story with you \u2014 no cost";
export const SUBJECT_B = "\uD83D\uDCF0 Share something meaningful locally";
