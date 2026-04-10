import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { registerMigrationRoute } from "./migration-route";
import { createServer } from "http";
import { stripeWebhookHandler } from "./stripe/webhook";

const app = express();
const httpServer = createServer(app);

process.on("SIGHUP", () => {});
process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED-REJECTION]", reason);
});

let appReady = false;

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json({ limit: "20mb" }));

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  if (!appReady) {
    if (path.startsWith("/api")) {
      res.status(503).json({ message: "Server is starting up, please retry shortly" });
      return;
    }
    res.status(200).set({ "Content-Type": "text/html" }).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Loading...</title>
<meta http-equiv="refresh" content="5">
<style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui;background:#0a0a0a;color:#fff}
.loader{text-align:center}.spinner{width:40px;height:40px;border:3px solid #333;border-top:3px solid #3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}p{opacity:.6;font-size:14px}</style></head>
<body><div class="loader"><div class="spinner"></div><p>Starting up...</p></div></body></html>`);
    return;
  }

  next();
});

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`serving on port ${port}`);
  },
);

(async () => {
  try {
    const { pool: earlyPool } = await import("./db");
    await earlyPool.query(`ALTER TABLE cities ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false`);
  } catch (_) {}

  await registerRoutes(httpServer, app);
  registerMigrationRoute(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    const { registerSeoSnapshotRoutes } = await import("./seo-snapshot");
    registerSeoSnapshotRoutes(app);
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  try {
    const { pool } = await import("./db");
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reservation_platform TEXT`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reservation_embed_code TEXT`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reservation_widget_url TEXT`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS needs_zone_review BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS is_event_source BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS website_last_crawled_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS website_crawl_status TEXT`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS microsite_generation_status TEXT`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS microsite_last_generated_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS microsite_source_type TEXT`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS microsite_draft_blocks JSONB`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS microsite_draft_meta JSONB`);
    await pool.query(`ALTER TABLE businesses ALTER COLUMN microsite_draft_blocks TYPE JSONB USING microsite_draft_blocks::JSONB`);
    await pool.query(`ALTER TABLE businesses ALTER COLUMN microsite_draft_meta TYPE JSONB USING microsite_draft_meta::JSONB`);
    await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS microsite_published_at TIMESTAMPTZ`);
    console.log("[Microsite] Draft generation columns ready");
  } catch (err) {
    console.error("Business column migrations (non-fatal):", err);
  }

  try {
    const { pool: outreachPool } = await import("./db");
    await outreachPool.query(`CREATE TABLE IF NOT EXISTS outreach_tokens (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      token VARCHAR(64) NOT NULL UNIQUE,
      business_id VARCHAR NOT NULL REFERENCES businesses(id),
      contact_id VARCHAR REFERENCES crm_contacts(id),
      variant VARCHAR(2) NOT NULL,
      campaign VARCHAR(100) NOT NULL DEFAULT 'story_outreach',
      batch_id VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      city_id VARCHAR,
      clicked_yes BOOLEAN DEFAULT false,
      clicked_no BOOLEAN DEFAULT false,
      responded_at TIMESTAMPTZ,
      declined_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await outreachPool.query(`CREATE INDEX IF NOT EXISTS outreach_tokens_token_idx ON outreach_tokens(token)`);
    await outreachPool.query(`CREATE INDEX IF NOT EXISTS outreach_tokens_business_idx ON outreach_tokens(business_id)`);
    await outreachPool.query(`CREATE INDEX IF NOT EXISTS outreach_tokens_contact_idx ON outreach_tokens(contact_id)`);
    await outreachPool.query(`CREATE TABLE IF NOT EXISTS outreach_responses (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      token_id VARCHAR NOT NULL REFERENCES outreach_tokens(id),
      business_id VARCHAR NOT NULL REFERENCES businesses(id),
      contact_id VARCHAR REFERENCES crm_contacts(id),
      name TEXT NOT NULL,
      business_phone TEXT,
      personal_phone TEXT,
      email TEXT,
      zip TEXT,
      best_contact_method VARCHAR(20),
      role VARCHAR(30),
      submitter_is_contact BOOLEAN DEFAULT true,
      contact_person_name TEXT,
      contact_person_email TEXT,
      contact_person_phone TEXT,
      story_interest TEXT,
      consent_terms BOOLEAN NOT NULL DEFAULT false,
      consent_contact BOOLEAN NOT NULL DEFAULT false,
      consent_publish BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await outreachPool.query(`CREATE INDEX IF NOT EXISTS outreach_responses_token_idx ON outreach_responses(token_id)`);
    await outreachPool.query(`CREATE INDEX IF NOT EXISTS outreach_responses_business_idx ON outreach_responses(business_id)`);
    try { await outreachPool.query(`ALTER TYPE email_template_key ADD VALUE IF NOT EXISTS 'story_outreach_a'`); } catch (_) {}
    try { await outreachPool.query(`ALTER TYPE email_template_key ADD VALUE IF NOT EXISTS 'story_outreach_b'`); } catch (_) {}
    await outreachPool.query(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'NEW'`);
    await outreachPool.query(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS linked_article_id VARCHAR(36)`);
    await outreachPool.query(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS outreach_email_sent_at TIMESTAMPTZ`);
    await outreachPool.query(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS followup_email_sent_at TIMESTAMPTZ`);
    await outreachPool.query(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS booking_url TEXT`);
    await outreachPool.query(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS calendar_booked_at TIMESTAMPTZ`);
    await outreachPool.query(`ALTER TABLE outreach_responses ADD COLUMN IF NOT EXISTS zip TEXT`).catch(() => { console.log("[Outreach] zip column already exists"); });
    const ctaBlock = `<tr><td style="padding:8px 24px 4px;" align="center"><a href="{{yesUrl}}" style="display:inline-block;padding:14px 48px;background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">Yes</a></td></tr><tr><td style="padding:8px 24px 24px;" align="center"><a href="{{noUrl}}" style="color:#94a3b8;font-size:13px;text-decoration:underline;">No thanks</a></td></tr>`;
    const wrapLayout = (bodyHtml: string) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:24px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">${bodyHtml}<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;"><p style="color:#94a3b8;font-size:11px;margin:0;">{{brandShort}}</p></td></tr></table></td></tr></table></body></html>`;
    const outreachTemplates = [
      {
        key: "story_outreach_a",
        name: "Story Outreach - Version A (Ego/Spotlight)",
        subject: "\uD83D\uDCF0 Write a story with you \u2014 no cost",
        html: wrapLayout(`<tr><td style="padding:32px 24px 0;"><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">Hi {{recipientFirstName}},</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">We came across {{businessName}} and would love to write a short local story with you as part of our community spotlight (no cost).</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">This is a chance to share your story \u2014 what you\u2019ve built, what you\u2019re working on, and what people should know about you.</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">As part of that, we\u2019ve already created your profile in CLT Hub \u2014 this is what we use to support your story, make sure your information is accurate, and help people find you locally.</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 20px;">Can you take 2\u20135 minutes to let us know you\u2019re interested and confirm your details for activation?</p></td></tr>${ctaBlock}<tr><td style="padding:0 24px 16px;"><p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">This step lets us move forward with your story and gives you access to manage your presence.</p><p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">CLT Hub is a local search and discovery platform, and we also produce weekly newsletters, print features, and community spotlights.</p><p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 16px;">We\u2019d love to include you.</p></td></tr><tr><td style="padding:0 24px 24px;"><p style="color:#334155;font-size:15px;margin:0;">\u2014 Becky</p><p style="color:#64748b;font-size:13px;margin:4px 0 0;">{{brandShort}}</p></td></tr>`),
      },
      {
        key: "story_outreach_b",
        name: "Story Outreach - Version B (Community/Impact)",
        subject: "\uD83D\uDCF0 Share something meaningful locally",
        html: wrapLayout(`<tr><td style="padding:32px 24px 0;"><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">Hi {{recipientFirstName}},</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">We came across {{businessName}} and would love to write a short local story with you as part of our community spotlight (no cost).</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">The story can be about something that matters to you \u2014 your organization, a cause you support, a group you\u2019re involved with, or something happening in your community that deserves more visibility.</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">As part of that, we\u2019ve already created your profile in CLT Hub \u2014 this helps us support your story, keep your information accurate, and connect people locally.</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 20px;">Can you take 2\u20135 minutes to let us know you\u2019re interested and confirm your details for activation?</p></td></tr>${ctaBlock}<tr><td style="padding:0 24px 16px;"><p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">This step lets us move forward and gives you access to your presence in the hub.</p><p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">CLT Hub is a local search and discovery platform, and we also produce weekly newsletters, print features, and community spotlights.</p><p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 16px;">We\u2019d love to include what matters to you.</p></td></tr><tr><td style="padding:0 24px 24px;"><p style="color:#334155;font-size:15px;margin:0;">\u2014 Becky</p><p style="color:#64748b;font-size:13px;margin:4px 0 0;">{{brandShort}}</p></td></tr>`),
      },
    ];
    for (const t of outreachTemplates) {
      const exists = await outreachPool.query(`SELECT id FROM email_templates WHERE template_key = $1 LIMIT 1`, [t.key]);
      if (exists.rows.length === 0) {
        await outreachPool.query(
          `INSERT INTO email_templates (id, template_key, classification, name, subject, html_body, status, created_at, updated_at) VALUES (gen_random_uuid()::text, $1, 'marketing', $2, $3, $4, 'active', NOW(), NOW())`,
          [t.key, t.name, t.subject, t.html]
        );
        console.log(`[Outreach] Seeded template: ${t.key}`);
      } else {
        await outreachPool.query(
          `UPDATE email_templates SET html_body = $1, subject = $2, name = $3, updated_at = NOW() WHERE template_key = $4`,
          [t.html, t.subject, t.name, t.key]
        );
        console.log(`[Outreach] Updated template: ${t.key}`);
      }
    }
    console.log("[Outreach] CRM contact outreach columns ready");
  } catch (err) {
    console.error("CRM outreach column migrations (non-fatal):", err);
  }

  try {
    const { pool: trustPool } = await import("./db");
    await trustPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trust_level') THEN CREATE TYPE trust_level AS ENUM ('T0','T1','T2','T3','T4','T5'); END IF; END $$`);
    await trustPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trust_operational_status') THEN CREATE TYPE trust_operational_status AS ENUM ('eligible','qualified','active','needs_attention','at_risk','paused','removed'); END IF; END $$`);
    await trustPool.query(`CREATE TABLE IF NOT EXISTS trust_profiles (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      trust_level trust_level NOT NULL DEFAULT 'T0',
      operational_status trust_operational_status NOT NULL DEFAULT 'eligible',
      signal_snapshot JSONB,
      context_labels TEXT[] DEFAULT '{}',
      is_eligible_for_network BOOLEAN NOT NULL DEFAULT false,
      is_qualified BOOLEAN NOT NULL DEFAULT false,
      story_trust_fields JSONB,
      decay_detected_at TIMESTAMPTZ,
      last_computed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await trustPool.query(`ALTER TABLE trust_profiles ADD COLUMN IF NOT EXISTS story_trust_fields JSONB`).catch(() => {});
    await trustPool.query(`ALTER TABLE trust_profiles ADD COLUMN IF NOT EXISTS decay_detected_at TIMESTAMPTZ`).catch(() => {});
    await trustPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS trust_profiles_business_idx ON trust_profiles(business_id)`);
    await trustPool.query(`CREATE INDEX IF NOT EXISTS trust_profiles_level_idx ON trust_profiles(trust_level)`);
    await trustPool.query(`CREATE INDEX IF NOT EXISTS trust_profiles_status_idx ON trust_profiles(operational_status)`);
    await trustPool.query(`CREATE TABLE IF NOT EXISTS trust_status_history (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id VARCHAR NOT NULL REFERENCES trust_profiles(id) ON DELETE CASCADE,
      previous_level trust_level,
      new_level trust_level NOT NULL,
      previous_status trust_operational_status,
      new_status trust_operational_status NOT NULL,
      reason TEXT NOT NULL,
      changed_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await trustPool.query(`CREATE INDEX IF NOT EXISTS trust_history_profile_idx ON trust_status_history(profile_id)`);
    await trustPool.query(`CREATE INDEX IF NOT EXISTS trust_history_created_idx ON trust_status_history(created_at)`);
    await trustPool.query(`ALTER TYPE profile_badge_type ADD VALUE IF NOT EXISTS 'TRUST_ACTIVE'`).catch(() => {});
    await trustPool.query(`ALTER TYPE profile_badge_type ADD VALUE IF NOT EXISTS 'TRUST_GROWING'`).catch(() => {});
    await trustPool.query(`ALTER TYPE profile_badge_type ADD VALUE IF NOT EXISTS 'TRUST_NEEDS_ATTENTION'`).catch(() => {});
    console.log("[Trust] Tables ready");
  } catch (err) {
    console.error("Trust system setup (non-fatal):", err);
  }

  try {
    const { pool: enumPool } = await import("./db");
    await enumPool.query(`ALTER TYPE import_draft_source ADD VALUE IF NOT EXISTS 'CSV_UPLOAD'`);
  } catch (_) {}

  try {
    const { pool: memPool } = await import("./db");
    await memPool.query(`ALTER TYPE charlotte_memory_type ADD VALUE IF NOT EXISTS 'system_observation'`);
  } catch (_) {}

  try {
    const { pool: inboxPool } = await import("./db");
    await inboxPool.query(`ALTER TABLE admin_inbox_items ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`);
  } catch (_) {}

  try {
    const { pool: gwPool } = await import("./db");
    await gwPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giveaway_status') THEN CREATE TYPE giveaway_status AS ENUM ('draft','scheduled','active','paused','drawing','completed','cancelled'); END IF; END $$`);
    await gwPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giveaway_entry_method') THEN CREATE TYPE giveaway_entry_method AS ENUM ('form','qr_scan','referral','bonus_action','event_checkin','purchase'); END IF; END $$`);
    await gwPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giveaway_draw_method') THEN CREATE TYPE giveaway_draw_method AS ENUM ('random','weighted','manual'); END IF; END $$`);
    await gwPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giveaway_winner_status') THEN CREATE TYPE giveaway_winner_status AS ENUM ('pending','notified','claimed','expired','disqualified','alternate'); END IF; END $$`);
    await gwPool.query(`ALTER TYPE giveaway_winner_status ADD VALUE IF NOT EXISTS 'alternate'`).catch(() => {});
    await gwPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giveaway_bonus_type') THEN CREATE TYPE giveaway_bonus_type AS ENUM ('share_social','refer_friend','visit_sponsor','complete_profile','attend_event','newsletter_signup','custom'); END IF; END $$`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaways (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      zone_id VARCHAR REFERENCES zones(id),
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT,
      hero_image_url TEXT,
      rules_text TEXT,
      status giveaway_status NOT NULL DEFAULT 'draft',
      draw_method giveaway_draw_method NOT NULL DEFAULT 'random',
      max_entries INTEGER,
      max_entries_per_user INTEGER NOT NULL DEFAULT 1,
      requires_verified_email BOOLEAN NOT NULL DEFAULT false,
      requires_zipcode BOOLEAN NOT NULL DEFAULT false,
      allowed_zipcodes TEXT[],
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      draw_at TIMESTAMPTZ,
      is_public BOOLEAN NOT NULL DEFAULT true,
      is_featured BOOLEAN NOT NULL DEFAULT false,
      created_by VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS giveaway_city_idx ON giveaways(city_id)`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS giveaway_status_idx ON giveaways(status)`);
    await gwPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS giveaway_slug_uniq ON giveaways(slug)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_prizes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      image_url TEXT,
      value NUMERIC,
      quantity INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      sponsor_id VARCHAR
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS prize_giveaway_idx ON giveaway_prizes(giveaway_id)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_sponsors (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      business_id VARCHAR REFERENCES businesses(id),
      name VARCHAR(255) NOT NULL,
      logo_url TEXT,
      website_url TEXT,
      tier VARCHAR(50) NOT NULL DEFAULT 'standard',
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS sponsor_giveaway_idx ON giveaway_sponsors(giveaway_id)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_entries (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      user_id VARCHAR,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      zipcode VARCHAR(20),
      entry_method giveaway_entry_method NOT NULL DEFAULT 'form',
      referral_code VARCHAR(100),
      referred_by VARCHAR,
      bonus_entries INTEGER NOT NULL DEFAULT 0,
      total_entries INTEGER NOT NULL DEFAULT 1,
      ip_address VARCHAR(50),
      user_agent TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT false,
      is_disqualified BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS entry_giveaway_idx ON giveaway_entries(giveaway_id)`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS entry_email_idx ON giveaway_entries(email)`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS entry_referral_idx ON giveaway_entries(referral_code)`);
    await gwPool.query(`ALTER TABLE giveaway_entries ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_bonus_actions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      bonus_type giveaway_bonus_type NOT NULL,
      label VARCHAR(255) NOT NULL,
      description TEXT,
      bonus_amount INTEGER NOT NULL DEFAULT 1,
      action_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS bonus_action_giveaway_idx ON giveaway_bonus_actions(giveaway_id)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_bonus_completions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id VARCHAR NOT NULL REFERENCES giveaway_entries(id) ON DELETE CASCADE,
      bonus_action_id VARCHAR NOT NULL REFERENCES giveaway_bonus_actions(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS bonus_completion_entry_idx ON giveaway_bonus_completions(entry_id)`);
    await gwPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS bonus_completion_uniq ON giveaway_bonus_completions(entry_id, bonus_action_id)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_draws (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      draw_method giveaway_draw_method NOT NULL,
      draw_number INTEGER NOT NULL DEFAULT 1,
      total_eligible INTEGER NOT NULL DEFAULT 0,
      winners_selected INTEGER NOT NULL DEFAULT 0,
      executed_by VARCHAR,
      seed VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS draw_giveaway_idx ON giveaway_draws(giveaway_id)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_winners (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      draw_id VARCHAR NOT NULL REFERENCES giveaway_draws(id) ON DELETE CASCADE,
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      entry_id VARCHAR NOT NULL REFERENCES giveaway_entries(id),
      prize_id VARCHAR REFERENCES giveaway_prizes(id),
      status giveaway_winner_status NOT NULL DEFAULT 'pending',
      notified_at TIMESTAMPTZ,
      claimed_at TIMESTAMPTZ,
      claim_deadline TIMESTAMPTZ,
      claim_token VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS winner_draw_idx ON giveaway_winners(draw_id)`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS winner_giveaway_idx ON giveaway_winners(giveaway_id)`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS winner_entry_idx ON giveaway_winners(entry_id)`);
    await gwPool.query(`ALTER TABLE giveaway_winners ADD COLUMN IF NOT EXISTS quote TEXT`);
    await gwPool.query(`ALTER TABLE giveaway_winners ADD COLUMN IF NOT EXISTS review_text TEXT`);
    await gwPool.query(`ALTER TABLE giveaway_winners ADD COLUMN IF NOT EXISTS business_mention VARCHAR(500)`);
    await gwPool.query(`ALTER TABLE giveaway_winners ADD COLUMN IF NOT EXISTS photo_url VARCHAR(1000)`);
    await gwPool.query(`ALTER TABLE giveaway_winners ADD COLUMN IF NOT EXISTS claim_permissions JSONB`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_notifications (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      winner_id VARCHAR REFERENCES giveaway_winners(id),
      channel VARCHAR(20) NOT NULL DEFAULT 'email',
      recipient_email VARCHAR(255),
      recipient_phone VARCHAR(50),
      subject VARCHAR(500),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS notification_giveaway_idx ON giveaway_notifications(giveaway_id)`);

    await gwPool.query(`CREATE TABLE IF NOT EXISTS giveaway_analytics (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      giveaway_id VARCHAR NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      date TIMESTAMPTZ NOT NULL,
      page_views INTEGER NOT NULL DEFAULT 0,
      unique_visitors INTEGER NOT NULL DEFAULT 0,
      entries_count INTEGER NOT NULL DEFAULT 0,
      shares_count INTEGER NOT NULL DEFAULT 0,
      referrals_count INTEGER NOT NULL DEFAULT 0,
      qr_scans_count INTEGER NOT NULL DEFAULT 0
    )`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS analytics_giveaway_idx ON giveaway_analytics(giveaway_id)`);
    await gwPool.query(`CREATE INDEX IF NOT EXISTS analytics_date_idx ON giveaway_analytics(date)`);

    console.log("[Giveaway] Tables ready");
  } catch (err) {
    console.error("Giveaway system setup (non-fatal):", err);
  }

  try {
    const { pool: revPool } = await import("./db");
    await revPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsorship_type') THEN CREATE TYPE sponsorship_type AS ENUM ('NATIVE','BRANDED','AFFILIATE','PROMOTED'); END IF; END $$`);
    await revPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_boost_status') THEN CREATE TYPE content_boost_status AS ENUM ('ACTIVE','EXPIRED','CANCELLED'); END IF; END $$`);
    await revPool.query(`ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN NOT NULL DEFAULT false`);
    await revPool.query(`ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS sponsor_id VARCHAR`);
    await revPool.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cms_content_items' AND column_name='sponsorship_type' AND data_type='text') THEN
        ALTER TABLE cms_content_items ALTER COLUMN sponsorship_type TYPE sponsorship_type USING sponsorship_type::sponsorship_type;
      END IF;
    EXCEPTION WHEN others THEN NULL; END $$`);
    await revPool.query(`ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS sponsorship_type sponsorship_type`);
    await revPool.query(`CREATE TABLE IF NOT EXISTS content_boosts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      content_item_id VARCHAR NOT NULL REFERENCES cms_content_items(id),
      boost_level INTEGER NOT NULL DEFAULT 1,
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ends_at TIMESTAMPTZ NOT NULL,
      status content_boost_status NOT NULL DEFAULT 'ACTIVE',
      created_by_user_id VARCHAR,
      stripe_checkout_session_id VARCHAR,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await revPool.query(`CREATE INDEX IF NOT EXISTS content_boosts_content_idx ON content_boosts(content_item_id)`);
    await revPool.query(`CREATE INDEX IF NOT EXISTS content_boosts_city_idx ON content_boosts(city_id)`);
    await revPool.query(`CREATE INDEX IF NOT EXISTS content_boosts_status_idx ON content_boosts(status)`);
    await revPool.query(`DO $$ BEGIN ALTER TABLE content_boosts ADD CONSTRAINT content_boosts_content_item_fk FOREIGN KEY (content_item_id) REFERENCES cms_content_items(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await revPool.query(`ALTER TABLE ad_inventory_slots ADD COLUMN IF NOT EXISTS slot_size TEXT DEFAULT 'MEDIUM'`);
    await revPool.query(`ALTER TABLE ad_inventory_slots ADD COLUMN IF NOT EXISTS price_per_unit INTEGER DEFAULT 0`);
    console.log("[Revenue] Sponsorship + boost tables ready");
  } catch (err) {
    console.error("Revenue layer setup (non-fatal):", err);
  }

  try {
    const { pool: commPool } = await import("./db");
    try { await commPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VOICE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'comms_channel')) THEN ALTER TYPE comms_channel ADD VALUE 'VOICE'; END IF; END $$`); } catch (_) {}
    try { await commPool.query(`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'EMAIL'`); } catch (_) {}
    try { await commPool.query(`DO $$ BEGIN CREATE TYPE sms_template_category AS ENUM ('INTRO','FOLLOW_UP','BOOKING_REMINDER','CLAIM_PROMPT','WELCOME','CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`); } catch (_) {}
    await commPool.query(`CREATE TABLE IF NOT EXISTS sms_templates (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      category sms_template_category NOT NULL DEFAULT 'CUSTOM',
      char_count INTEGER NOT NULL DEFAULT 0,
      city_id VARCHAR,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await commPool.query(`CREATE INDEX IF NOT EXISTS sms_templates_category_idx ON sms_templates(category)`);
    await commPool.query(`CREATE INDEX IF NOT EXISTS sms_templates_active_idx ON sms_templates(is_active)`);
    try { await commPool.query(`DO $$ BEGIN CREATE TYPE voice_prompt_type AS ENUM ('GREETING','VOICEMAIL','IVR_MENU','ESCALATION','FOLLOW_UP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`); } catch (_) {}
    try { await commPool.query(`DO $$ BEGIN CREATE TYPE voice_call_trigger AS ENUM ('INBOUND_CALL','OUTBOUND_CAMPAIGN','MISSED_CALL_CALLBACK','SCHEDULED_FOLLOWUP','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`); } catch (_) {}
    await commPool.query(`CREATE TABLE IF NOT EXISTS voice_prompts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      prompt_type voice_prompt_type NOT NULL,
      script_text TEXT NOT NULL,
      ssml_markup TEXT,
      voice_profile_id VARCHAR,
      call_trigger voice_call_trigger NOT NULL DEFAULT 'MANUAL',
      city_id VARCHAR,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await commPool.query(`CREATE INDEX IF NOT EXISTS voice_prompts_type_idx ON voice_prompts(prompt_type)`);
    await commPool.query(`CREATE INDEX IF NOT EXISTS voice_prompts_active_idx ON voice_prompts(is_active)`);
    try { await commPool.query(`DO $$ BEGIN CREATE TYPE comm_sequence_status AS ENUM ('DRAFT','ACTIVE','PAUSED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`); } catch (_) {}
    await commPool.query(`CREATE TABLE IF NOT EXISTS communication_sequences (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      status comm_sequence_status NOT NULL DEFAULT 'DRAFT',
      city_id VARCHAR,
      trigger_event TEXT DEFAULT 'CONTACT_CREATED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await commPool.query(`CREATE INDEX IF NOT EXISTS comm_sequences_status_idx ON communication_sequences(status)`);
    await commPool.query(`CREATE TABLE IF NOT EXISTS sequence_steps (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id VARCHAR NOT NULL,
      step_order INTEGER NOT NULL,
      channel TEXT NOT NULL DEFAULT 'EMAIL',
      template_id VARCHAR,
      voice_prompt_id VARCHAR,
      delay_minutes INTEGER NOT NULL DEFAULT 0,
      fallback_channel TEXT,
      condition_type TEXT DEFAULT 'ALWAYS',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await commPool.query(`CREATE INDEX IF NOT EXISTS seq_steps_sequence_idx ON sequence_steps(sequence_id)`);
    const seedTemplates = [
      { name: "Welcome Message", body: "Hi {{name}}, welcome to CityMetroHub! We're excited to have you connected to your local community. Reply STOP to opt out.", category: "WELCOME" },
      { name: "Introduction Outreach", body: "Hi {{name}}, this is {{agent}} from CityMetroHub. I'd love to connect about your business presence in the Charlotte metro. When's a good time to chat?", category: "INTRO" },
      { name: "Follow-Up Check-In", body: "Hi {{name}}, just following up on our previous conversation. Have you had a chance to explore your CityMetroHub listing? Let me know if you have questions!", category: "FOLLOW_UP" },
      { name: "Booking Reminder", body: "Hi {{name}}, friendly reminder about your upcoming appointment tomorrow. Reply YES to confirm or call us to reschedule.", category: "BOOKING_REMINDER" },
      { name: "Listing Claim Prompt", body: "Hi {{name}}, your business has been spotted on CityMetroHub! Claim your free listing to manage your presence and connect with the community. Visit {{link}}", category: "CLAIM_PROMPT" },
    ];
    for (const tpl of seedTemplates) {
      try {
        await commPool.query(
          `INSERT INTO sms_templates (name, body, category, char_count, is_active) SELECT $1, $2, $3::sms_template_category, $4, true WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE name = $1)`,
          [tpl.name, tpl.body, tpl.category, tpl.body.length]
        );
      } catch (_) {}
    }
    console.log("[CommLayer] SMS templates, voice prompts, sequences tables ready");
  } catch (err) {
    console.error("Communication layer setup (non-fatal):", err);
  }

  try {
    const { pool: iqPool } = await import("./db");
    await iqPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 50`);
    await iqPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS trust_override INTEGER`);
    await iqPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS frequency_weight INTEGER NOT NULL DEFAULT 1`);
    await iqPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS content_types TEXT[]`);
    await iqPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS last_ingested_item_count INTEGER NOT NULL DEFAULT 0`);
    await iqPool.query(`ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS dedup_meta JSON`);
    console.log("[IngestionQuality] Columns ready");
  } catch (err) {
    console.error("Ingestion quality columns setup (non-fatal):", err);
  }

  appReady = true;
  log("App fully initialized");

  if (process.env.CONTENT_INTEGRITY_STARTUP === "true") {
    try {
      const { runContentIntegrityPass } = await import("./services/content-normalizer");
      runContentIntegrityPass().then(result => {
        console.log(`[IntegrityPass] Startup pass complete: ${result.totalScanned} scanned, ${result.fixedCategories} categories fixed, ${result.fixedGeo} geo fixed, ${result.routingIssues} routing issues`);
      }).catch(err => {
        console.error("[IntegrityPass] Startup pass failed (non-fatal):", err instanceof Error ? err.message : err);
      });
    } catch {
      console.error("[IntegrityPass] Import failed (non-fatal)");
    }
  }

  try {
    const { seedDatabase } = await import("./seed");
    await seedDatabase();
  } catch (err) {
    console.error("Seed error (non-fatal):", err);
  }

  try {
    const { backfillVenueScreenLikely } = await import("./google-places");
    await backfillVenueScreenLikely();
  } catch (err) {
    console.error("Venue screen backfill (non-fatal):", err);
  }

  try {
    const { backfillShoppingCenters } = await import("./google-places");
    const scResult = await backfillShoppingCenters();
    console.log(`[ShoppingCenter] Startup backfill: ${scResult.linked} linked, ${scResult.skipped} skipped`);
  } catch (err) {
    console.error("Shopping center backfill (non-fatal):", err);
  }

  try {
    const { pool } = await import("./db");
    const approveResult = await pool.query(
      `UPDATE rss_items SET review_status = 'APPROVED', publish_status = 'PUBLISHED', policy_status = 'ALLOW', updated_at = NOW() WHERE review_status = 'PENDING' OR (review_status = 'APPROVED' AND (publish_status IS NULL OR publish_status = 'DRAFT'))`
    );
    if (approveResult.rowCount && approveResult.rowCount > 0) {
      console.log(`[RSSAutoApprove] Bulk-approved ${approveResult.rowCount} pending RSS items`);
    }
  } catch (err) {
    console.error("[RSSAutoApprove] Bulk approve failed (non-fatal):", err);
  }

  try {
    const { backfillAllContent } = await import("./services/content-tagger");
    backfillAllContent().then(stats => {
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      if (total > 0) console.log(`[ContentTagger] Startup backfill: ${total} tag links created`);
    }).catch(err => {
      console.error("[ContentTagger] Startup backfill failed (non-fatal):", err instanceof Error ? err.message : err);
    });
  } catch {
    console.error("[ContentTagger] Import failed (non-fatal)");
  }

  try {
    const { pool } = await import("./db");
    const charterResult = await pool.query(
      `UPDATE businesses SET listing_tier = 'VERIFIED' WHERE listing_tier = 'CHARTER'`
    );
    if (charterResult.rowCount && charterResult.rowCount > 0) {
      console.log(`[TierBackfill] Migrated ${charterResult.rowCount} CHARTER businesses to VERIFIED`);
    }
  } catch (err) {
    console.error("Charter→Verified backfill (non-fatal):", err);
  }

  try {
    const { pool } = await import("./db");
    const chamberResult = await pool.query(
      `UPDATE businesses SET listing_tier = 'VERIFIED' WHERE listing_tier = 'CHAMBER'`
    );
    if (chamberResult.rowCount && chamberResult.rowCount > 0) {
      console.log(`[TierBackfill] Migrated ${chamberResult.rowCount} CHAMBER businesses to VERIFIED`);
    }
  } catch (err) {
    // CHAMBER may not exist as a DB enum value — this is expected and non-fatal
  }

  try {
    const { pool } = await import("./db");
    const CONTENT_TYPE_VALUES = [
      'job','local_podcast','podcast_episode','music_artist','radio_station',
      'tv_item','video_content','attraction','area_fact','shopping_center',
      'transit_stop','pulse_video','giveaway','poll','voting_nominee',
      'crown_campaign','crown_winner','organization','review',
      'curated_list','community_campaign','neighborhood_review','voting_campaign',
      'expert_show_slot','live_broadcast','event_collection','event_series',
      'transit_line','digital_card','crown_event','crown_participant',
    ];
    for (const val of CONTENT_TYPE_VALUES) {
      await pool.query(`ALTER TYPE feed_content_type ADD VALUE IF NOT EXISTS '${val}'`).catch(() => {});
    }
  } catch (err) {
    console.warn("[Startup] feed_content_type enum expansion (non-fatal):", err);
  }

  try {
    const { pool } = await import("./db");
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'suite_location_type') THEN CREATE TYPE suite_location_type AS ENUM ('SALON_SUITE','MEDICAL_OFFICE','COWORKING','WELLNESS_CENTER','SHARED_STUDIO','OTHER'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_category') THEN CREATE TYPE provider_category AS ENUM ('HAIR','BARBER','NAILS','LASHES','BROWS','MAKEUP','ESTHETICS','MASSAGE','WELLNESS','FITNESS','TATTOO','OTHER'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_module_type') THEN CREATE TYPE booking_module_type AS ENUM ('embed_widget','popup_widget','deep_link','call_text_fallback','manual_live_opening','api_connected'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opening_status') THEN CREATE TYPE opening_status AS ENUM ('active','claimed','expired','hidden'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_label') THEN CREATE TYPE urgency_label AS ENUM ('available_today','available_tomorrow','last_minute','this_afternoon','this_evening'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_action_type') THEN CREATE TYPE contact_action_type AS ENUM ('profile_view','booking_click','opening_click','call_click','text_click','instagram_click','directions_click','website_click'); END IF; END $$`);

    await pool.query(`CREATE TABLE IF NOT EXISTS tier_change_log (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id VARCHAR NOT NULL,
      old_tier TEXT NOT NULL,
      new_tier TEXT NOT NULL,
      changed_by TEXT NOT NULL DEFAULT 'system',
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS suite_locations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      address TEXT,
      suite_type suite_location_type NOT NULL DEFAULT 'SALON_SUITE',
      phone TEXT,
      website_url TEXT,
      image_url TEXT,
      description TEXT,
      city_id VARCHAR REFERENCES cities(id),
      zone_id VARCHAR REFERENCES zones(id),
      latitude NUMERIC,
      longitude NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS providers (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id VARCHAR REFERENCES businesses(id),
      display_name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category provider_category NOT NULL DEFAULT 'OTHER',
      subcategory TEXT,
      bio TEXT,
      specialties TEXT[] DEFAULT '{}',
      phone TEXT,
      sms_number TEXT,
      email TEXT,
      instagram_url TEXT,
      website_url TEXT,
      booking_url TEXT,
      booking_platform TEXT,
      booking_module_type booking_module_type DEFAULT 'deep_link',
      booking_embed_code TEXT,
      booking_widget_url TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      accepts_walk_ins BOOLEAN NOT NULL DEFAULT FALSE,
      supports_live_openings BOOLEAN NOT NULL DEFAULT FALSE,
      suite_location_id VARCHAR REFERENCES suite_locations(id),
      suite_number TEXT,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      zone_id VARCHAR REFERENCES zones(id),
      hero_image_url TEXT,
      profile_image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS provider_city_slug_idx ON providers(city_id, slug)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS provider_services (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER,
      price_display TEXT,
      price_min INTEGER,
      price_max INTEGER,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS provider_openings (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      service_id VARCHAR REFERENCES provider_services(id),
      title TEXT NOT NULL,
      opening_date TEXT NOT NULL,
      opening_time_label TEXT,
      start_at TIMESTAMPTZ,
      end_at TIMESTAMPTZ,
      notes TEXT,
      status opening_status NOT NULL DEFAULT 'active',
      urgency_label urgency_label NOT NULL DEFAULT 'available_today',
      expires_at TIMESTAMPTZ,
      created_by VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS provider_contact_actions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      action_type contact_action_type NOT NULL,
      source_context TEXT,
      referrer_page TEXT,
      city_id VARCHAR,
      zone_id VARCHAR,
      user_id VARCHAR,
      session_id VARCHAR,
      metadata JSON,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS pca_provider_idx ON provider_contact_actions(provider_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS pca_created_idx ON provider_contact_actions(created_at)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS booking_platform_configs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      platform_key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'service',
      supports_embed BOOLEAN NOT NULL DEFAULT FALSE,
      supports_popup BOOLEAN NOT NULL DEFAULT FALSE,
      supports_deep_link BOOLEAN NOT NULL DEFAULT TRUE,
      supports_api BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    const platformSeed = [
      { key: "square", name: "Square Appointments", cat: "service", embed: true, popup: true, deep: true, api: false },
      { key: "vagaro", name: "Vagaro", cat: "service", embed: true, popup: true, deep: true, api: false },
      { key: "booksy", name: "Booksy", cat: "service", embed: false, popup: false, deep: true, api: false },
      { key: "glossgenius", name: "GlossGenius", cat: "service", embed: false, popup: false, deep: true, api: false },
      { key: "schedulicity", name: "Schedulicity", cat: "service", embed: false, popup: true, deep: true, api: false },
      { key: "acuity", name: "Acuity Scheduling", cat: "service", embed: true, popup: true, deep: true, api: false },
      { key: "calendly", name: "Calendly", cat: "service", embed: true, popup: true, deep: true, api: false },
      { key: "fresha", name: "Fresha", cat: "service", embed: false, popup: false, deep: true, api: false },
      { key: "styleseat", name: "StyleSeat", cat: "service", embed: false, popup: false, deep: true, api: false },
      { key: "opentable", name: "OpenTable", cat: "restaurant", embed: true, popup: true, deep: true, api: false },
      { key: "resy", name: "Resy", cat: "restaurant", embed: false, popup: false, deep: true, api: false },
      { key: "yelp_reservations", name: "Yelp Reservations", cat: "restaurant", embed: false, popup: false, deep: true, api: false },
      { key: "google_reserve", name: "Google Reserve", cat: "restaurant", embed: false, popup: false, deep: true, api: false },
      { key: "tock", name: "Tock", cat: "restaurant", embed: false, popup: false, deep: true, api: false },
      { key: "sevenrooms", name: "SevenRooms", cat: "restaurant", embed: true, popup: true, deep: true, api: false },
      { key: "toast", name: "Toast", cat: "restaurant", embed: false, popup: false, deep: true, api: false },
      { key: "other", name: "Other", cat: "both", embed: false, popup: false, deep: true, api: false },
      { key: "none", name: "None (Manual)", cat: "both", embed: false, popup: false, deep: false, api: false },
    ];
    for (const p of platformSeed) {
      await pool.query(
        `INSERT INTO booking_platform_configs (platform_key, display_name, category, supports_embed, supports_popup, supports_deep_link, supports_api)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (platform_key) DO NOTHING`,
        [p.key, p.name, p.cat, p.embed, p.popup, p.deep, p.api]
      );
    }
    console.log("[Provider] Tables + platform configs ready");
  } catch (err) {
    console.error("Provider system setup (non-fatal):", err);
  }

  try {
    const { pool: denomPool } = await import("./db");
    const denomTags = [
      "DENOMINATION_BAPTIST", "DENOMINATION_CATHOLIC", "DENOMINATION_METHODIST",
      "DENOMINATION_PRESBYTERIAN", "DENOMINATION_NON_DENOMINATIONAL", "DENOMINATION_PENTECOSTAL",
      "DENOMINATION_LUTHERAN", "DENOMINATION_EPISCOPAL", "DENOMINATION_AME",
      "DENOMINATION_CHURCH_OF_GOD", "DENOMINATION_ADVENTIST",
      "DENOMINATION_ISLAMIC", "DENOMINATION_HINDU", "DENOMINATION_JEWISH",
      "DENOMINATION_BUDDHIST", "DENOMINATION_SIKH",
    ];
    for (const tag of denomTags) {
      await denomPool.query(`ALTER TYPE industry_tag ADD VALUE IF NOT EXISTS '${tag}'`).catch(() => {});
    }
    await denomPool.query(`UPDATE categories SET name = 'Churches & Places of Worship', slug = 'churches-places-of-worship' WHERE slug = 'faith-based'`).catch(() => {});
  } catch (err) {
    console.error("Denomination tag enum sync (non-fatal):", err);
  }

  try {
    const { pool } = await import("./db");
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'neighborhood_review_status') THEN CREATE TYPE neighborhood_review_status AS ENUM ('PENDING','APPROVED','REJECTED'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_choice_mode') THEN CREATE TYPE poll_choice_mode AS ENUM ('single','multi'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voting_campaign_status') THEN CREATE TYPE voting_campaign_status AS ENUM ('draft','active','closed','archived'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'survey_question_type') THEN CREATE TYPE survey_question_type AS ENUM ('text','rating','single_choice','multi_choice'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type') THEN CREATE TYPE reaction_type AS ENUM ('like','love','insightful','funny','helpful'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_reaction_entity_type') THEN CREATE TYPE content_reaction_entity_type AS ENUM ('article','event','pulse_post','business'); END IF; END $$`);

    await pool.query(`CREATE TABLE IF NOT EXISTS neighborhood_reviews (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      zone_id VARCHAR NOT NULL REFERENCES zones(id),
      user_id VARCHAR NOT NULL REFERENCES public_users(id),
      rating INTEGER NOT NULL,
      comment TEXT,
      pros TEXT,
      cons TEXT,
      status neighborhood_review_status NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS nhr_city_idx ON neighborhood_reviews(city_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS nhr_zone_idx ON neighborhood_reviews(zone_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS nhr_status_idx ON neighborhood_reviews(status)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS polls (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      zone_id VARCHAR REFERENCES zones(id),
      question TEXT NOT NULL,
      image_url TEXT,
      choice_mode poll_choice_mode NOT NULL DEFAULT 'single',
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMPTZ,
      created_by VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS polls_city_idx ON polls(city_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS poll_options (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      poll_id VARCHAR NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      image_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS poll_opt_poll_idx ON poll_options(poll_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS poll_votes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      poll_id VARCHAR NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      user_id VARCHAR NOT NULL REFERENCES public_users(id),
      selected_option_ids TEXT[] NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const pvCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'poll_votes' AND column_name = 'option_id'`);
    if (pvCols.rows.length > 0) {
      await pool.query(`ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS selected_option_ids TEXT[] DEFAULT '{}'`);
      await pool.query(`UPDATE poll_votes SET selected_option_ids = ARRAY[option_id] WHERE selected_option_ids = '{}' AND option_id IS NOT NULL`);
      await pool.query(`ALTER TABLE poll_votes ALTER COLUMN selected_option_ids SET NOT NULL`);
      await pool.query(`ALTER TABLE poll_votes DROP COLUMN IF EXISTS option_id`);
      await pool.query(`ALTER TABLE poll_votes ALTER COLUMN user_id SET NOT NULL`);
      await pool.query(`DROP INDEX IF EXISTS pv_unique_vote_idx`);
    }
    await pool.query(`CREATE INDEX IF NOT EXISTS pv_poll_idx ON poll_votes(poll_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS pv_user_idx ON poll_votes(user_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS pv_unique_user_poll_idx ON poll_votes(poll_id, user_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS voting_campaigns (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      title TEXT NOT NULL,
      slug VARCHAR,
      description TEXT,
      image_url TEXT,
      status voting_campaign_status NOT NULL DEFAULT 'draft',
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      created_by VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS vc_city_idx ON voting_campaigns(city_id)`);
    await pool.query(`ALTER TABLE voting_campaigns ADD COLUMN IF NOT EXISTS slug VARCHAR`).catch(() => {});

    await pool.query(`CREATE TABLE IF NOT EXISTS voting_categories (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id VARCHAR NOT NULL REFERENCES voting_campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS vcat_campaign_idx ON voting_categories(campaign_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS voting_nominees (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id VARCHAR NOT NULL REFERENCES voting_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      business_id VARCHAR REFERENCES businesses(id),
      provider_id VARCHAR,
      image_url TEXT,
      description TEXT
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS vnom_cat_idx ON voting_nominees(category_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS voting_ballots (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id VARCHAR NOT NULL REFERENCES voting_campaigns(id) ON DELETE CASCADE,
      category_id VARCHAR NOT NULL REFERENCES voting_categories(id) ON DELETE CASCADE,
      nominee_id VARCHAR NOT NULL REFERENCES voting_nominees(id) ON DELETE CASCADE,
      user_id VARCHAR NOT NULL REFERENCES public_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS vb_campaign_idx ON voting_ballots(campaign_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS vb_user_idx ON voting_ballots(user_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS vb_unique_ballot_idx ON voting_ballots(campaign_id, category_id, user_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS quizzes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS quiz_city_idx ON quizzes(city_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS quiz_questions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_id VARCHAR NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_index INTEGER NOT NULL,
      explanation TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS qq_quiz_idx ON quiz_questions(quiz_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS quiz_attempts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_id VARCHAR NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      user_id VARCHAR NOT NULL REFERENCES public_users(id),
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      answers JSONB,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS qa_quiz_idx ON quiz_attempts(quiz_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS qa_user_idx ON quiz_attempts(user_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS qa_unique_user_quiz_idx ON quiz_attempts(quiz_id, user_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS surveys (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      title TEXT NOT NULL,
      description TEXT,
      is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMPTZ,
      created_by VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS survey_city_idx ON surveys(city_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS survey_questions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      survey_id VARCHAR NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      question_type survey_question_type NOT NULL DEFAULT 'text',
      options JSONB,
      is_required BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS sq_survey_idx ON survey_questions(survey_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS survey_responses (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      survey_id VARCHAR NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      user_id VARCHAR NOT NULL REFERENCES public_users(id),
      answers JSONB NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS sr_survey_idx ON survey_responses(survey_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS sr_user_idx ON survey_responses(user_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS sr_unique_user_survey_idx ON survey_responses(survey_id, user_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS content_reactions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type content_reaction_entity_type NOT NULL,
      entity_id VARCHAR NOT NULL,
      user_id VARCHAR NOT NULL REFERENCES public_users(id),
      reaction_type reaction_type NOT NULL,
      city_id VARCHAR REFERENCES cities(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`ALTER TABLE content_reactions ADD COLUMN IF NOT EXISTS city_id VARCHAR REFERENCES cities(id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cr_entity_idx ON content_reactions(entity_type, entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cr_user_idx ON content_reactions(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cr_city_idx ON content_reactions(city_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS cr_unique_user_entity_idx ON content_reactions(entity_type, entity_id, user_id)`);

    console.log("[CommunityEngagement] Tables ready");
  } catch (err) {
    console.error("Community engagement tables setup (non-fatal):", err);
  }

  try {
    const { pool: evPool } = await import("./db");
    await evPool.query(`CREATE TABLE IF NOT EXISTS event_collections (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await evPool.query(`CREATE TABLE IF NOT EXISTS event_collection_items (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      collection_id VARCHAR NOT NULL REFERENCES event_collections(id) ON DELETE CASCADE,
      event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (collection_id, event_id)
    )`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS idx_events_city_start ON events (city_id, start_date_time)`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS idx_events_zone ON events (zone_id)`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS idx_events_category_ids ON events USING GIN (category_ids)`);
    console.log("[EventDiscovery] Tables and indexes ready");
  } catch (err) {
    console.error("Event discovery tables setup (non-fatal):", err);
  }

  async function ensureEntitlementEngineTables() {
    const { pool } = await import("./db");

    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capability_type') THEN CREATE TYPE capability_type AS ENUM ('JOBS','MARKETPLACE','CREATOR','EXPERT','EVENTS','PROVIDER','COMMUNITY'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_interval') THEN CREATE TYPE billing_interval AS ENUM ('monthly','annual'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_tx_type') THEN CREATE TYPE credit_tx_type AS ENUM ('MONTHLY_GRANT','PURCHASED','SPEND','EXPIRATION','ADMIN_GRANT','REFUND'); END IF; END $$`);

    await pool.query(`ALTER TYPE entitlement_product_type ADD VALUE IF NOT EXISTS 'HUB_PRESENCE'`);
    await pool.query(`ALTER TYPE entitlement_product_type ADD VALUE IF NOT EXISTS 'CATEGORY_ADDON'`);
    await pool.query(`ALTER TYPE entitlement_product_type ADD VALUE IF NOT EXISTS 'MICRO_ADDON'`);
    await pool.query(`ALTER TYPE entitlement_product_type ADD VALUE IF NOT EXISTS 'CAPABILITY'`);

    await pool.query(`CREATE TABLE IF NOT EXISTS hub_entitlements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      presence_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      hub_id VARCHAR NOT NULL,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      is_base_hub BOOLEAN NOT NULL DEFAULT FALSE,
      status entitlement_status NOT NULL DEFAULT 'ACTIVE',
      billing_interval billing_interval NOT NULL DEFAULT 'monthly',
      stripe_subscription_id TEXT,
      plan_version_id VARCHAR REFERENCES plan_versions(id),
      founder_locked BOOLEAN NOT NULL DEFAULT FALSE,
      amount_cents INTEGER,
      start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_at TIMESTAMPTZ,
      grace_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS hub_ent_presence_idx ON hub_entitlements(presence_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS hub_ent_hub_idx ON hub_entitlements(hub_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS hub_ent_status_idx ON hub_entitlements(status)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS category_entitlements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      presence_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      hub_entitlement_id VARCHAR NOT NULL REFERENCES hub_entitlements(id) ON DELETE CASCADE,
      category_id VARCHAR NOT NULL,
      is_base_category BOOLEAN NOT NULL DEFAULT FALSE,
      status entitlement_status NOT NULL DEFAULT 'ACTIVE',
      billing_interval billing_interval NOT NULL DEFAULT 'monthly',
      stripe_subscription_id TEXT,
      amount_cents INTEGER,
      start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_at TIMESTAMPTZ,
      grace_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cat_ent_presence_idx ON category_entitlements(presence_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cat_ent_hub_idx ON category_entitlements(hub_entitlement_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cat_ent_category_idx ON category_entitlements(category_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cat_ent_status_idx ON category_entitlements(status)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS micro_entitlements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      presence_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      category_entitlement_id VARCHAR NOT NULL REFERENCES category_entitlements(id) ON DELETE CASCADE,
      micro_id VARCHAR NOT NULL,
      is_base_micro BOOLEAN NOT NULL DEFAULT FALSE,
      status entitlement_status NOT NULL DEFAULT 'ACTIVE',
      billing_interval billing_interval NOT NULL DEFAULT 'monthly',
      stripe_subscription_id TEXT,
      amount_cents INTEGER,
      start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_at TIMESTAMPTZ,
      grace_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS micro_ent_presence_idx ON micro_entitlements(presence_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS micro_ent_cat_idx ON micro_entitlements(category_entitlement_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS micro_ent_micro_idx ON micro_entitlements(micro_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS micro_ent_status_idx ON micro_entitlements(status)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS capability_entitlements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      presence_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      hub_entitlement_id VARCHAR NOT NULL REFERENCES hub_entitlements(id) ON DELETE CASCADE,
      capability_type capability_type NOT NULL,
      status entitlement_status NOT NULL DEFAULT 'ACTIVE',
      billing_interval billing_interval NOT NULL DEFAULT 'monthly',
      stripe_subscription_id TEXT,
      amount_cents INTEGER,
      start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_at TIMESTAMPTZ,
      grace_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cap_ent_presence_idx ON capability_entitlements(presence_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cap_ent_hub_idx ON capability_entitlements(hub_entitlement_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cap_ent_type_idx ON capability_entitlements(capability_type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cap_ent_status_idx ON capability_entitlements(status)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS credit_wallets (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      presence_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      monthly_balance INTEGER NOT NULL DEFAULT 0,
      banked_balance INTEGER NOT NULL DEFAULT 0,
      monthly_reset_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS cw_presence_uniq ON credit_wallets(presence_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS credit_transactions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_id VARCHAR NOT NULL REFERENCES credit_wallets(id) ON DELETE CASCADE,
      tx_type credit_tx_type NOT NULL,
      amount INTEGER NOT NULL,
      balance_after_monthly INTEGER NOT NULL,
      balance_after_banked INTEGER NOT NULL,
      action_type TEXT,
      reference_id TEXT,
      note TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS ctx_wallet_idx ON credit_transactions(wallet_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS ctx_type_idx ON credit_transactions(tx_type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS ctx_created_idx ON credit_transactions(created_at)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS credit_action_costs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      action_type TEXT NOT NULL,
      label TEXT NOT NULL,
      cost_credits INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS cac_action_uniq ON credit_action_costs(action_type)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS plan_versions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      version_key TEXT NOT NULL,
      label TEXT NOT NULL,
      presence_monthly INTEGER NOT NULL,
      presence_annual INTEGER NOT NULL,
      hub_addon_monthly INTEGER NOT NULL,
      hub_addon_annual INTEGER NOT NULL,
      category_addon_monthly INTEGER NOT NULL,
      category_addon_annual INTEGER NOT NULL,
      micro_addon_monthly INTEGER NOT NULL,
      micro_addon_annual INTEGER NOT NULL,
      stripe_price_presence_monthly TEXT,
      stripe_price_presence_annual TEXT,
      stripe_price_hub_addon_monthly TEXT,
      stripe_price_hub_addon_annual TEXT,
      stripe_price_category_addon_monthly TEXT,
      stripe_price_category_addon_annual TEXT,
      stripe_price_micro_addon_monthly TEXT,
      stripe_price_micro_addon_annual TEXT,
      monthly_credits_included INTEGER NOT NULL DEFAULT 10,
      is_current_offering BOOLEAN NOT NULL DEFAULT FALSE,
      is_founder_plan BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS pv_version_key_uniq ON plan_versions(version_key)`);

    await pool.query(`INSERT INTO plan_versions (version_key, label, presence_monthly, presence_annual, hub_addon_monthly, hub_addon_annual, category_addon_monthly, category_addon_annual, micro_addon_monthly, micro_addon_annual, monthly_credits_included, is_current_offering, is_founder_plan) VALUES ('founder_v1', 'Founder Plan', 1900, 19900, 1900, 19900, 900, 8900, 300, 2900, 10, FALSE, TRUE) ON CONFLICT (version_key) DO NOTHING`);
    await pool.query(`INSERT INTO plan_versions (version_key, label, presence_monthly, presence_annual, hub_addon_monthly, hub_addon_annual, category_addon_monthly, category_addon_annual, micro_addon_monthly, micro_addon_annual, monthly_credits_included, is_current_offering, is_founder_plan) VALUES ('standard_v1', 'Standard Plan', 2900, 29900, 1900, 19900, 900, 8900, 300, 2900, 10, TRUE, FALSE) ON CONFLICT (version_key) DO NOTHING`);

    await pool.query(`ALTER TABLE credit_action_costs ADD COLUMN IF NOT EXISTS can_substitute_addon TEXT`);

    const defaultActions = [
      { type: "JOB_POST", label: "Job Posting", cost: 3, addon: "JOB_BOARD" },
      { type: "EVENT_PROMOTION", label: "Event Promotion", cost: 2, addon: "EVENT_HOST" },
      { type: "EVENT_INVITE_SEND", label: "Event Invitation Batch (25)", cost: 2, addon: "EVENT_HOST" },
      { type: "LISTING_BOOST", label: "Listing Priority Boost", cost: 5, addon: null },
      { type: "SMALL_BOOST", label: "Small Visibility Boost", cost: 1, addon: null },
      { type: "FEATURED_ROTATION", label: "Featured Rotation Slot", cost: 10, addon: "FEATURED_DISTRIBUTION" },
      { type: "CROWN_PROMOTION", label: "Crown Amplification", cost: 8, addon: "PREMIUM_PLACEMENT" },
      { type: "MARKETPLACE_LISTING", label: "Marketplace Listing", cost: 2, addon: "MARKETPLACE_STOREFRONT" },
      { type: "FEATURE_TO_PULSE", label: "Feature to Pulse Feed", cost: 3, addon: null },
      { type: "STORY_BOOST", label: "Story Boost", cost: 4, addon: null },
      { type: "SPOTLIGHT_ARTICLE", label: "AI Spotlight Article", cost: 5, addon: null },
    ];
    for (const a of defaultActions) {
      await pool.query(
        `INSERT INTO credit_action_costs (action_type, label, cost_credits, can_substitute_addon)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (action_type) DO UPDATE SET label = $2, cost_credits = $3, can_substitute_addon = $4`,
        [a.type, a.label, a.cost, a.addon]
      );
    }

    const columnMigrations = [
      { tbl: "hub_entitlements", col: "plan_version_id", def: "VARCHAR REFERENCES plan_versions(id)" },
      { tbl: "hub_entitlements", col: "founder_locked", def: "BOOLEAN NOT NULL DEFAULT FALSE" },
      { tbl: "plan_versions", col: "stripe_price_presence_monthly", def: "TEXT" },
      { tbl: "plan_versions", col: "stripe_price_presence_annual", def: "TEXT" },
      { tbl: "plan_versions", col: "stripe_price_hub_addon_monthly", def: "TEXT" },
      { tbl: "plan_versions", col: "stripe_price_hub_addon_annual", def: "TEXT" },
      { tbl: "plan_versions", col: "stripe_price_category_addon_monthly", def: "TEXT" },
      { tbl: "plan_versions", col: "stripe_price_category_addon_annual", def: "TEXT" },
      { tbl: "plan_versions", col: "stripe_price_micro_addon_monthly", def: "TEXT" },
      { tbl: "plan_versions", col: "stripe_price_micro_addon_annual", def: "TEXT" },
      { tbl: "businesses", col: "farm_product_types", def: "TEXT[] DEFAULT '{}'" },
      { tbl: "businesses", col: "seasonal_availability", def: "TEXT" },
      { tbl: "businesses", col: "primary_photo_url", def: "TEXT" },
      { tbl: "businesses", col: "farm_hub_id", def: "TEXT" },
      { tbl: "businesses", col: "farm_growing_methods", def: "TEXT[] DEFAULT '{}'" },
      { tbl: "businesses", col: "farm_certifications", def: "TEXT[] DEFAULT '{}'" },
      { tbl: "businesses", col: "farm_distribution_radius", def: "TEXT" },
      { tbl: "businesses", col: "farm_location_type", def: "TEXT" },
      { tbl: "businesses", col: "csa_subscription_type", def: "TEXT" },
      { tbl: "businesses", col: "csa_details", def: "JSONB" },
      { tbl: "businesses", col: "farm_stand_schedule", def: "JSONB" },
      { tbl: "businesses", col: "wholesale_available", def: "BOOLEAN DEFAULT FALSE" },
      { tbl: "businesses", col: "direct_to_consumer", def: "BOOLEAN DEFAULT TRUE" },
      { tbl: "businesses", col: "featured_product", def: "TEXT" },
      { tbl: "businesses", col: "harvest_season_start", def: "TEXT" },
      { tbl: "businesses", col: "harvest_season_end", def: "TEXT" },
      { tbl: "businesses", col: "pickup_schedule", def: "JSONB" },
      { tbl: "businesses", col: "market_days", def: "TEXT[] DEFAULT '{}'" },
      { tbl: "businesses", col: "ordering_method", def: "TEXT" },
      { tbl: "businesses", col: "accepts_preorders", def: "BOOLEAN DEFAULT FALSE" },
      { tbl: "public_users", col: "profile_types", def: "TEXT[] DEFAULT '{resident}'" },
      { tbl: "public_users", col: "active_profile_type", def: "TEXT NOT NULL DEFAULT 'resident'" },
    ];
    for (const m of columnMigrations) {
      try {
        await pool.query(`ALTER TABLE ${m.tbl} ADD COLUMN ${m.col} ${m.def}`);
      } catch (e: unknown) {
        const code = e instanceof Error && "code" in e ? (e as Record<string, unknown>).code : "";
        if (code !== "42701") throw e;
      }
    }

    await pool.query(`
      UPDATE public_users
      SET profile_types = CASE
        WHEN NOT ('business' = ANY(profile_types)) THEN profile_types || '{business}'
        ELSE profile_types
      END
      WHERE profile_types IS NOT NULL
        AND id IN (SELECT DISTINCT claimed_by_user_id FROM businesses WHERE claimed_by_user_id IS NOT NULL)
        AND NOT ('business' = ANY(profile_types))
    `);

    const fkMigrations = [
      { tbl: "category_entitlements", col: "hub_entitlement_id", ref: "hub_entitlements(id)", name: "cat_ent_hub_fk" },
      { tbl: "micro_entitlements", col: "category_entitlement_id", ref: "category_entitlements(id)", name: "micro_ent_cat_fk" },
      { tbl: "capability_entitlements", col: "hub_entitlement_id", ref: "hub_entitlements(id)", name: "cap_ent_hub_fk" },
      { tbl: "credit_transactions", col: "wallet_id", ref: "credit_wallets(id)", name: "ctx_wallet_fk" },
    ];
    for (const fk of fkMigrations) {
      try {
        await pool.query(`ALTER TABLE ${fk.tbl} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${fk.col}) REFERENCES ${fk.ref} ON DELETE CASCADE`);
      } catch (e: unknown) {
        const code = e instanceof Error && "code" in e ? (e as Record<string, unknown>).code : "";
        if (code !== "42710") throw e;
      }
    }

    await pool.query(`UPDATE businesses SET image_url = NULL WHERE image_url ILIKE 'data:%'`).catch(() => {});

    console.log("[EntitlementEngine] Hub/Category/Micro/Capability + Credit tables ready");
  }

  try {
    await ensureEntitlementEngineTables();
  } catch (err) {
    console.error("Entitlement engine tables setup (non-fatal):", err);
  }

  try {
    const { pool: csPool } = await import("./db");
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='content_package_status') THEN CREATE TYPE content_package_status AS ENUM ('draft','review','approved','published','archived'); END IF; END $$`);
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='content_deliverable_type') THEN CREATE TYPE content_deliverable_type AS ENUM ('social_post','caption_variant','pulse_update','ad_copy','email_blurb'); END IF; END $$`);
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='content_deliverable_status') THEN CREATE TYPE content_deliverable_status AS ENUM ('draft','approved','rejected','published'); END IF; END $$`);
    await csPool.query(`CREATE TABLE IF NOT EXISTS content_packages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      metro_id VARCHAR NOT NULL REFERENCES cities(id),
      source_type TEXT NOT NULL,
      source_id VARCHAR NOT NULL,
      source_title TEXT NOT NULL,
      source_excerpt TEXT,
      source_image_url TEXT,
      status content_package_status NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL DEFAULT 'charlotte',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`CREATE TABLE IF NOT EXISTS content_deliverables (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id VARCHAR NOT NULL REFERENCES content_packages(id),
      type content_deliverable_type NOT NULL,
      platform TEXT,
      content TEXT NOT NULL,
      hashtags TEXT[] DEFAULT '{}',
      image_url TEXT,
      status content_deliverable_status NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS content_packages_metro_idx ON content_packages(metro_id)`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS content_packages_status_idx ON content_packages(status)`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS content_deliverables_package_idx ON content_deliverables(package_id)`);
    const coraCols = [
      { tbl: "content_deliverables", col: "scope", def: "TEXT DEFAULT 'metro'" },
      { tbl: "content_deliverables", col: "persona_name", def: "TEXT DEFAULT 'charlotte'" },
      { tbl: "ai_content_drafts", col: "scope", def: "TEXT DEFAULT 'metro'" },
      { tbl: "ai_content_drafts", col: "persona_name", def: "TEXT DEFAULT 'charlotte'" },
      { tbl: "social_posts", col: "scope", def: "TEXT DEFAULT 'metro'" },
      { tbl: "social_posts", col: "persona_name", def: "TEXT DEFAULT 'charlotte'" },
    ];
    for (const m of coraCols) {
      try {
        await csPool.query(`ALTER TABLE ${m.tbl} ADD COLUMN ${m.col} ${m.def}`);
      } catch (e: unknown) {
        const code = e instanceof Error && "code" in e ? (e as Record<string, unknown>).code : "";
        if (code !== "42701") throw e;
      }
    }

    await csPool.query(`CREATE TABLE IF NOT EXISTS cora_knowledge (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence_level TEXT NOT NULL DEFAULT 'medium',
      source TEXT NOT NULL DEFAULT 'system',
      needs_review BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS cora_knowledge_category_idx ON cora_knowledge(category)`);

    await csPool.query(`CREATE TABLE IF NOT EXISTS cora_questions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      question TEXT NOT NULL,
      context TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS cora_questions_status_idx ON cora_questions(status)`);

    await csPool.query(`CREATE TABLE IF NOT EXISTS cora_suggestions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      suggestion TEXT NOT NULL,
      context TEXT,
      impact_level TEXT NOT NULL DEFAULT 'medium',
      approved BOOLEAN NOT NULL DEFAULT FALSE,
      executed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS cora_suggestions_approved_idx ON cora_suggestions(approved)`);

    console.log("[ContentStudio] Tables ready");
  } catch (err) {
    console.error("Content Studio tables setup (non-fatal):", err);
  }

  try {
    const { pool: evPool } = await import("./db");
    await evPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='event_visibility') THEN CREATE TYPE event_visibility AS ENUM ('public','unlisted','private'); END IF; END $$`);
    await evPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='event_rsvp_response') THEN CREATE TYPE event_rsvp_response AS ENUM ('attending','maybe','declined'); END IF; END $$`);
    await evPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='event_invitation_status') THEN CREATE TYPE event_invitation_status AS ENUM ('invited','accepted','declined','maybe'); END IF; END $$`);

    const evCols = [
      { tbl: "events", col: "visibility", def: "event_visibility NOT NULL DEFAULT 'public'" },
      { tbl: "events", col: "recurring_rule", def: "TEXT" },
      { tbl: "events", col: "max_capacity", def: "INTEGER" },
      { tbl: "events", col: "rsvp_enabled", def: "BOOLEAN NOT NULL DEFAULT FALSE" },
    ];
    for (const m of evCols) {
      try {
        await evPool.query(`ALTER TABLE ${m.tbl} ADD COLUMN ${m.col} ${m.def}`);
      } catch (e: unknown) {
        const code = e instanceof Error && "code" in e ? (e as Record<string, unknown>).code : "";
        if (code !== "42701") throw e;
      }
    }

    await evPool.query(`CREATE TABLE IF NOT EXISTS event_rsvps (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id VARCHAR,
      public_user_id VARCHAR,
      name TEXT,
      email TEXT,
      response event_rsvp_response NOT NULL DEFAULT 'attending',
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS er_event_idx ON event_rsvps(event_id)`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS er_user_idx ON event_rsvps(user_id)`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS er_pubuser_idx ON event_rsvps(public_user_id)`);
    try {
      await evPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS er_event_pubuser_uniq ON event_rsvps(event_id, public_user_id) WHERE public_user_id IS NOT NULL`);
      await evPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS er_event_email_uniq ON event_rsvps(event_id, email) WHERE email IS NOT NULL AND public_user_id IS NULL`);
    } catch (e) { /* index may already exist */ }

    await evPool.query(`CREATE TABLE IF NOT EXISTS event_invitations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT,
      invite_token VARCHAR NOT NULL DEFAULT gen_random_uuid(),
      status event_invitation_status NOT NULL DEFAULT 'invited',
      sent_at TIMESTAMPTZ,
      responded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await evPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ei_event_email_uniq ON event_invitations(event_id, email)`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS ei_token_idx ON event_invitations(invite_token)`);
    await evPool.query(`CREATE INDEX IF NOT EXISTS ei_event_idx ON event_invitations(event_id)`);

    console.log("[EventsEngine] RSVP/Invitation/Visibility tables ready");
  } catch (err) {
    console.error("Events engine tables setup (non-fatal):", err);
  }

  try {
    const { pool } = await import("./db");
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_type') THEN CREATE TYPE availability_type AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','SEASONAL','FLEXIBLE'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_verification_status') THEN CREATE TYPE credential_verification_status AS ENUM ('PENDING','VERIFIED','EXPIRED','REJECTED'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hiring_status') THEN CREATE TYPE hiring_status AS ENUM ('ACTIVELY_HIRING','OPEN_TO_CANDIDATES','NOT_HIRING'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_type') THEN CREATE TYPE employment_type AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERNSHIP','SEASONAL'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compensation_type') THEN CREATE TYPE compensation_type AS ENUM ('HOURLY','SALARY','COMMISSION','TIPS','STIPEND'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN CREATE TYPE job_status AS ENUM ('DRAFT','ACTIVE','PAUSED','CLOSED','FILLED'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skill_level') THEN CREATE TYPE skill_level AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','EXPERT'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_level') THEN CREATE TYPE visibility_level AS ENUM ('PUBLIC','VISIBLE_WHEN_APPLYING','PRIVATE'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'remote_preference') THEN CREATE TYPE remote_preference AS ENUM ('ONSITE','REMOTE','HYBRID','NO_PREFERENCE'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'desired_pay_unit') THEN CREATE TYPE desired_pay_unit AS ENUM ('HOURLY','WEEKLY','MONTHLY','ANNUALLY'); END IF; END $$`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hiring_contact_method') THEN CREATE TYPE hiring_contact_method AS ENUM ('EMAIL','PHONE','WEBSITE','IN_PERSON','PLATFORM'); END IF; END $$`);

    await pool.query(`CREATE TABLE IF NOT EXISTS skill_categories (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS skill_subcategories (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id VARCHAR NOT NULL REFERENCES skill_categories(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS skills (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      subcategory_id VARCHAR NOT NULL REFERENCES skill_subcategories(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS credential_directory (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      issuing_body TEXT,
      category TEXT,
      typical_expiration_years INTEGER,
      requires_jurisdiction BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS applicant_profiles (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES public_users(id),
      zone_id VARCHAR REFERENCES zones(id),
      headline TEXT,
      summary TEXT,
      availability_type availability_type NOT NULL DEFAULT 'FULL_TIME',
      desired_roles TEXT[] DEFAULT '{}',
      desired_industries TEXT[] DEFAULT '{}',
      willing_to_relocate BOOLEAN NOT NULL DEFAULT FALSE,
      preferred_radius INTEGER,
      years_experience INTEGER,
      highest_education TEXT,
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      hired_through_hub BOOLEAN NOT NULL DEFAULT FALSE,
      shift_preferences TEXT[] DEFAULT '{}',
      days_available TEXT[] DEFAULT '{}',
      remote_preference remote_preference DEFAULT 'NO_PREFERENCE',
      desired_pay_min INTEGER,
      desired_pay_max INTEGER,
      desired_pay_unit desired_pay_unit DEFAULT 'HOURLY',
      visibility_level visibility_level NOT NULL DEFAULT 'PUBLIC',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS applicant_skills (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
      skill_id VARCHAR NOT NULL REFERENCES skills(id),
      level skill_level NOT NULL DEFAULT 'INTERMEDIATE',
      years_used INTEGER,
      is_top_skill BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(applicant_id, skill_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS applicant_credentials (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
      credential_id VARCHAR REFERENCES credential_directory(id),
      verification_status credential_verification_status NOT NULL DEFAULT 'PENDING',
      issued_date TIMESTAMPTZ,
      expiration_date TIMESTAMPTZ,
      jurisdiction TEXT,
      credential_number TEXT,
      document_url TEXT,
      is_custom BOOLEAN NOT NULL DEFAULT FALSE,
      custom_name TEXT,
      custom_issuing_body TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS applicant_credential_jurisdictions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      credential_record_id VARCHAR NOT NULL REFERENCES applicant_credentials(id) ON DELETE CASCADE,
      state TEXT NOT NULL,
      license_number TEXT,
      issued_date TIMESTAMPTZ,
      expiration_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS applicant_resumes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS business_hiring_profiles (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id VARCHAR NOT NULL REFERENCES businesses(id),
      hiring_status hiring_status NOT NULL DEFAULT 'NOT_HIRING',
      company_description TEXT,
      typical_roles TEXT[] DEFAULT '{}',
      industries TEXT[] DEFAULT '{}',
      benefits_offered TEXT[] DEFAULT '{}',
      application_url TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      workplace_summary TEXT,
      culture_description TEXT,
      hiring_contact_method hiring_contact_method DEFAULT 'EMAIL',
      verification_badges TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(business_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS job_listings (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id VARCHAR NOT NULL REFERENCES businesses(id),
      zone_id VARCHAR REFERENCES zones(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      employment_type employment_type NOT NULL DEFAULT 'FULL_TIME',
      compensation_type compensation_type NOT NULL DEFAULT 'HOURLY',
      compensation_min INTEGER,
      compensation_max INTEGER,
      status job_status NOT NULL DEFAULT 'DRAFT',
      location TEXT,
      is_remote BOOLEAN NOT NULL DEFAULT FALSE,
      required_skills TEXT[] DEFAULT '{}',
      required_credentials TEXT[] DEFAULT '{}',
      applicants_count INTEGER NOT NULL DEFAULT 0,
      interviews_count INTEGER NOT NULL DEFAULT 0,
      hires_count INTEGER NOT NULL DEFAULT 0,
      job_closed_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS job_applications (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      job_listing_id VARCHAR NOT NULL REFERENCES job_listings(id),
      applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id),
      resume_id VARCHAR REFERENCES applicant_resumes(id),
      cover_letter TEXT,
      status TEXT NOT NULL DEFAULT 'submitted',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(job_listing_id, applicant_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS employer_hiring_metrics (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id VARCHAR NOT NULL REFERENCES businesses(id),
      month TEXT NOT NULL,
      jobs_posted INTEGER NOT NULL DEFAULT 0,
      applications_received INTEGER NOT NULL DEFAULT 0,
      interviews_conducted INTEGER NOT NULL DEFAULT 0,
      hires_made INTEGER NOT NULL DEFAULT 0,
      avg_time_to_fill_days INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(business_id, month)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS job_categories (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await pool.query(`ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS city_id VARCHAR REFERENCES cities(id)`);
    await pool.query(`
      UPDATE job_listings jl SET city_id = b.city_id
      FROM businesses b WHERE jl.business_id = b.id AND jl.city_id IS NULL
    `);

    console.log("[Workforce] Tables ready");
    const { seedWorkforceData } = await import("./workforce-seed");
    await seedWorkforceData();
  } catch (err) {
    console.error("Workforce tables setup (non-fatal):", err);
  }

  try {
    const { pool: mapPool } = await import("./db");
    await mapPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'map_placement_type') THEN CREATE TYPE map_placement_type AS ENUM ('promoted_pin','zone_overlay','business_card_ad'); END IF; END $$`);
    await mapPool.query(`CREATE TABLE IF NOT EXISTS map_placements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      type map_placement_type NOT NULL,
      business_id VARCHAR REFERENCES businesses(id),
      zone_id VARCHAR,
      title TEXT,
      tagline TEXT,
      logo_url TEXT,
      cta_url TEXT,
      cta_text TEXT,
      start_date TIMESTAMPTZ,
      end_date TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await mapPool.query(`CREATE INDEX IF NOT EXISTS mp_city_idx ON map_placements(city_id)`);
    await mapPool.query(`CREATE INDEX IF NOT EXISTS mp_business_idx ON map_placements(business_id)`);
    await mapPool.query(`CREATE INDEX IF NOT EXISTS mp_type_idx ON map_placements(type)`);
    console.log("[MapPlacements] Table ready");
  } catch (err) {
    console.error("Map placements setup (non-fatal):", err);
  }

  try {
    const { pool: crownPool } = await import("./db");
    await crownPool.query(`ALTER TYPE crown_participant_status ADD VALUE IF NOT EXISTS 'confirmed'`).catch(() => {});
    await crownPool.query(`ALTER TYPE crown_participant_status ADD VALUE IF NOT EXISTS 'winner'`).catch(() => {});
    await crownPool.query(`ALTER TYPE crown_participant_status ADD VALUE IF NOT EXISTS 'finalist'`).catch(() => {});
    console.log("[Crown] Enum values synced");
  } catch (err) {
    console.error("Crown enum sync (non-fatal):", err);
  }

  try {
    const { pool: inboxPool } = await import("./db");
    await inboxPool.query(`ALTER TYPE inbox_item_type ADD VALUE IF NOT EXISTS 'recommendation_gap'`).catch(() => {});
    await inboxPool.query(`ALTER TYPE inbox_item_type ADD VALUE IF NOT EXISTS 'stock_photo_capture'`).catch(() => {});
    await inboxPool.query(`ALTER TYPE inbox_item_type ADD VALUE IF NOT EXISTS 'visitor_feedback'`).catch(() => {});
    await inboxPool.query(`ALTER TYPE field_capture_type ADD VALUE IF NOT EXISTS 'stock_photo'`).catch(() => {});
    await inboxPool.query(`ALTER TYPE field_capture_type ADD VALUE IF NOT EXISTS 'ad_spot'`).catch(() => {});
    const mktVals = ["SERVICE", "FOR_SALE", "HOUSING", "COMMUNITY", "WANTED", "HOUSING_SUPPLY", "HOUSING_DEMAND", "COMMERCIAL_PROPERTY"];
    for (const v of mktVals) {
      await inboxPool.query(`ALTER TYPE marketplace_listing_type ADD VALUE IF NOT EXISTS '${v}'`).catch(() => {});
    }
    await inboxPool.query(`ALTER TABLE admin_inbox_items ADD COLUMN IF NOT EXISTS triage_category TEXT`);
    await inboxPool.query(`ALTER TABLE admin_inbox_items ADD COLUMN IF NOT EXISTS confidence NUMERIC`);
    await inboxPool.query(`ALTER TABLE admin_inbox_items ADD COLUMN IF NOT EXISTS triage_reason TEXT`);
    await inboxPool.query(`ALTER TABLE admin_inbox_items ADD COLUMN IF NOT EXISTS suggested_action TEXT`);
    await inboxPool.query(`ALTER TABLE admin_inbox_items ADD COLUMN IF NOT EXISTS triage_metadata JSONB`);
    const backfillResult = await inboxPool.query(`
      UPDATE admin_inbox_items SET triage_category = CASE item_type
        WHEN 'submission_business' THEN 'needs_review'
        WHEN 'submission_organization' THEN 'needs_review'
        WHEN 'submission_event' THEN 'needs_review'
        WHEN 'submission_article_pitch' THEN 'needs_review'
        WHEN 'submission_press_release' THEN 'needs_review'
        WHEN 'submission_shoutout' THEN 'needs_review'
        WHEN 'submission_media_mention' THEN 'needs_review'
        WHEN 'presence_claim_confirm' THEN 'needs_review'
        WHEN 'presence_transfer_request' THEN 'needs_review'
        WHEN 'presence_review_charlotte_verification' THEN 'needs_review'
        WHEN 'cms_content_review' THEN 'needs_review'
        WHEN 'vendor_review' THEN 'needs_review'
        WHEN 'event_review' THEN 'needs_review'
        WHEN 'capture_listing_review' THEN 'needs_review'
        WHEN 'pipeline_needs_review' THEN 'needs_review'
        WHEN 'marketplace_inquiry' THEN 'needs_review'
        WHEN 'listing_imported_needs_publish' THEN 'unprocessed'
        WHEN 'recommendation_gap' THEN 'unprocessed'
        WHEN 'spotlight_article_generated' THEN 'unprocessed'
        WHEN 'billing_past_due' THEN 'exception'
        WHEN 'billing_founder_grace_expiring' THEN 'exception'
        WHEN 'org_supporter_grace_started' THEN 'exception'
        WHEN 'org_supporter_grace_expiring' THEN 'exception'
        WHEN 'email_bounce_attention' THEN 'exception'
        WHEN 'email_complaint_attention' THEN 'exception'
        WHEN 'places_import_failed' THEN 'exception'
        WHEN 'site_error_report' THEN 'exception'
        ELSE 'notification'
      END WHERE triage_category IS NULL
    `);
    if (backfillResult.rowCount && backfillResult.rowCount > 0) {
      console.log(`[Inbox] Backfilled triage_category on ${backfillResult.rowCount} existing items`);
    }
    console.log("[Inbox] Enum values synced, triage columns ready");
  } catch (err) {
    console.error("Inbox enum sync (non-fatal):", err);
  }

  try {
    const { pool: attrPool } = await import("./db");
    await attrPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attraction_type') THEN CREATE TYPE attraction_type AS ENUM ('HISTORICAL','PARK','LANDMARK','HIDDEN_GEM','MUSEUM','TOUR'); END IF; END $$`);
    await attrPool.query(`CREATE TABLE IF NOT EXISTS attractions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      zone_id VARCHAR REFERENCES zones(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      attraction_type attraction_type NOT NULL DEFAULT 'LANDMARK',
      address TEXT,
      image_url TEXT,
      fun_fact TEXT,
      latitude NUMERIC,
      longitude NUMERIC,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await attrPool.query(`ALTER TABLE attractions ADD COLUMN IF NOT EXISTS attraction_type attraction_type NOT NULL DEFAULT 'LANDMARK'`).catch(() => {});
    console.log("[Attractions] Table ready");
  } catch (err) {
    console.error("Attractions setup (non-fatal):", err);
  }

  try {
    const { pool: ppPool } = await import("./db");
    await ppPool.query(`CREATE TABLE IF NOT EXISTS pulse_pickup_locations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      hub_slug TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      latitude NUMERIC,
      longitude NUMERIC,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    console.log("[PulsePickup] Table ready");
  } catch (err) {
    console.error("Pulse pickup setup (non-fatal):", err);
  }

  const { pool: feedPool } = await import("./db");

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_tag_type') THEN CREATE TYPE feed_tag_type AS ENUM ('location','topic','entity','status'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS tags (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      type feed_tag_type NOT NULL DEFAULT 'topic',
      parent_tag_id VARCHAR,
      synonyms TEXT[],
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS idx_tags_slug_lower ON tags(LOWER(slug))`).catch(() => {});
    console.log("[FeedSchema] tags table ready");
  } catch (err) { console.error("[FeedSchema] tags (non-fatal):", err); }

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_content_type') THEN CREATE TYPE feed_content_type AS ENUM ('business','event','article','rss_item','marketplace_listing','post','reel','shop_item','shop_drop','job','local_podcast','podcast_episode','music_artist','radio_station','tv_item','video_content','attraction','area_fact','shopping_center','transit_stop','pulse_video','giveaway','poll','voting_nominee','crown_campaign','crown_winner','organization','review','curated_list','community_campaign','neighborhood_review','voting_campaign','expert_show_slot','live_broadcast','event_collection','event_series','transit_line','digital_card','crown_event','crown_participant'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS content_tags (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type feed_content_type NOT NULL,
      content_id VARCHAR NOT NULL,
      tag_id VARCHAR NOT NULL
    )`);
    await feedPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS content_tags_unique_idx ON content_tags(content_type, content_id, tag_id)`).catch(() => {});
    await feedPool.query(`CREATE INDEX IF NOT EXISTS content_tags_tag_idx ON content_tags(tag_id)`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS content_tags_content_idx ON content_tags(content_type, content_id)`);
    console.log("[FeedSchema] content_tags table ready");
  } catch (err) { console.error("[FeedSchema] content_tags (non-fatal):", err); }

  try {
    const TOPIC_TAXONOMY: Array<{ slug: string; name: string; icon?: string; sort: number; children?: Array<{ slug: string; name: string; icon?: string; sort: number }> }> = [
      { slug: "news", name: "News", icon: "Newspaper", sort: 1, children: [
        { slug: "breaking-news", name: "Breaking News", sort: 1 },
        { slug: "local-news", name: "Local News", sort: 2 },
      ]},
      { slug: "business", name: "Business & Economy", icon: "Briefcase", sort: 2, children: [
        { slug: "small-business", name: "Small Business", sort: 1 },
        { slug: "entrepreneurship", name: "Entrepreneurship", sort: 2 },
        { slug: "banking", name: "Banking & Finance", sort: 3 },
      ]},
      { slug: "food-dining", name: "Food & Dining", icon: "UtensilsCrossed", sort: 3, children: [
        { slug: "restaurants", name: "Restaurants", sort: 1 },
        { slug: "breweries", name: "Breweries & Taprooms", sort: 2 },
        { slug: "food-trucks", name: "Food Trucks", sort: 3 },
        { slug: "coffee-cafes", name: "Coffee & Cafes", sort: 4 },
      ]},
      { slug: "entertainment", name: "Entertainment", icon: "Clapperboard", sort: 4, children: [
        { slug: "live-music", name: "Live Music", sort: 1 },
        { slug: "comedy", name: "Comedy", sort: 2 },
        { slug: "movies", name: "Movies & Film", sort: 3 },
      ]},
      { slug: "arts-culture", name: "Arts & Culture", icon: "Palette", sort: 5, children: [
        { slug: "galleries", name: "Galleries & Exhibits", sort: 1 },
        { slug: "museums", name: "Museums", sort: 2 },
        { slug: "theater", name: "Theater & Performing Arts", sort: 3 },
      ]},
      { slug: "sports", name: "Sports", icon: "Trophy", sort: 6, children: [
        { slug: "pro-sports", name: "Pro Sports", sort: 1 },
        { slug: "college-sports", name: "College Sports", sort: 2 },
        { slug: "recreation", name: "Recreation & Leagues", sort: 3 },
      ]},
      { slug: "community", name: "Community", icon: "Users", sort: 7, children: [
        { slug: "volunteer", name: "Volunteer & Giving", sort: 1 },
        { slug: "nonprofit", name: "Nonprofit", sort: 2 },
        { slug: "neighborhoods", name: "Neighborhoods", sort: 3 },
      ]},
      { slug: "education", name: "Education", icon: "GraduationCap", sort: 8, children: [
        { slug: "k12", name: "K-12 Schools", sort: 1 },
        { slug: "higher-ed", name: "Higher Education", sort: 2 },
      ]},
      { slug: "health-wellness", name: "Health & Wellness", icon: "Heart", sort: 9, children: [
        { slug: "fitness", name: "Fitness & Gyms", sort: 1 },
        { slug: "mental-health", name: "Mental Health", sort: 2 },
        { slug: "medical", name: "Medical & Healthcare", sort: 3 },
      ]},
      { slug: "real-estate", name: "Real Estate", icon: "Home", sort: 10, children: [
        { slug: "housing", name: "Housing Market", sort: 1 },
        { slug: "commercial-re", name: "Commercial Real Estate", sort: 2 },
      ]},
      { slug: "government", name: "Government & Policy", icon: "Landmark", sort: 11 },
      { slug: "weather", name: "Weather", icon: "Cloud", sort: 12 },
      { slug: "technology", name: "Technology & Innovation", icon: "Cpu", sort: 13, children: [
        { slug: "startups", name: "Startups", sort: 1 },
        { slug: "fintech", name: "Fintech", sort: 2 },
      ]},
      { slug: "faith", name: "Faith & Religion", icon: "Church", sort: 14 },
      { slug: "development", name: "Development & Growth", icon: "Building2", sort: 15, children: [
        { slug: "construction", name: "Construction", sort: 1 },
        { slug: "infrastructure", name: "Infrastructure", sort: 2 },
      ]},
      { slug: "lifestyle", name: "Lifestyle", icon: "Sparkles", sort: 16, children: [
        { slug: "beauty-wellness", name: "Beauty & Personal Care", sort: 1 },
        { slug: "fashion", name: "Fashion", sort: 2 },
        { slug: "home-garden", name: "Home & Garden", sort: 3 },
      ]},
      { slug: "nightlife", name: "Nightlife", icon: "Moon", sort: 17 },
      { slug: "family", name: "Family & Kids", icon: "Baby", sort: 18 },
      { slug: "outdoors", name: "Outdoors & Nature", icon: "TreePine", sort: 19, children: [
        { slug: "parks", name: "Parks & Greenways", sort: 1 },
        { slug: "hiking", name: "Hiking & Trails", sort: 2 },
      ]},
      { slug: "pets-animals", name: "Pets & Animals", icon: "PawPrint", sort: 20 },
      { slug: "shopping-retail", name: "Shopping & Retail", icon: "ShoppingBag", sort: 21 },
      { slug: "automotive", name: "Automotive & Transit", icon: "Car", sort: 22, children: [
        { slug: "traffic", name: "Traffic & Roads", sort: 1 },
        { slug: "transit", name: "Public Transit", sort: 2 },
      ]},
      { slug: "seniors", name: "Seniors & Aging", icon: "Armchair", sort: 23 },
      { slug: "opinion", name: "Opinion & Editorial", icon: "MessageSquare", sort: 24 },
      { slug: "events", name: "Events & Things To Do", icon: "Calendar", sort: 25 },
      { slug: "travel", name: "Travel & Tourism", icon: "Plane", sort: 26 },
      { slug: "public-safety", name: "Public Safety", icon: "Shield", sort: 27 },
      { slug: "shopping", name: "Shopping", icon: "ShoppingCart", sort: 28 },
    ];

    for (const core of TOPIC_TAXONOMY) {
      await feedPool.query(
        `INSERT INTO tags (name, slug, type, icon, sort_order) VALUES ($1, $2, 'topic', $3, $4) ON CONFLICT (slug) DO UPDATE SET name = $1, icon = COALESCE($3, tags.icon), sort_order = $4`,
        [core.name, core.slug, core.icon || null, core.sort]
      );
      if (core.children) {
        const parentRes = await feedPool.query(`SELECT id FROM tags WHERE slug = $1`, [core.slug]);
        const parentId = parentRes.rows[0]?.id;
        if (parentId) {
          for (const sub of core.children) {
            await feedPool.query(
              `INSERT INTO tags (name, slug, type, parent_tag_id, icon, sort_order) VALUES ($1, $2, 'topic', $3, $4, $5) ON CONFLICT (slug) DO UPDATE SET name = $1, parent_tag_id = $3, sort_order = $5`,
              [sub.name, sub.slug, parentId, sub.icon || null, sub.sort]
            );
          }
        }
      }
    }
    console.log("[FeedSchema] topic taxonomy seeded");

    const zoneRows = await feedPool.query(`SELECT id, slug, name FROM zones WHERE is_active = true`);
    for (const z of zoneRows.rows) {
      await feedPool.query(
        `INSERT INTO tags (name, slug, type, sort_order) VALUES ($1, $2, 'location', 0) ON CONFLICT (slug) DO UPDATE SET type = 'location'`,
        [z.name, z.slug]
      );
    }
    console.log(`[FeedSchema] ${zoneRows.rows.length} location tags seeded`);
  } catch (err) { console.error("[FeedSchema] taxonomy seed (non-fatal):", err); }

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rss_review_status') THEN CREATE TYPE rss_review_status AS ENUM ('PENDING','APPROVED','SKIPPED','FLAGGED'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS rss_items (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      metro_source_id VARCHAR NOT NULL REFERENCES metro_sources(id),
      external_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      published_at TIMESTAMP,
      summary TEXT,
      rewritten_summary TEXT,
      title_es TEXT,
      rewritten_summary_es TEXT,
      author TEXT,
      image_url TEXT,
      categories_json JSON,
      raw_json JSON DEFAULT '{}',
      review_status rss_review_status NOT NULL DEFAULT 'PENDING',
      reviewed_at TIMESTAMP,
      reviewed_by VARCHAR,
      view_count INTEGER NOT NULL DEFAULT 0,
      zone_slug VARCHAR,
      local_article_slug TEXT,
      local_article_body TEXT,
      local_article_body_es TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rss_items_source_external ON rss_items(metro_source_id, external_id)`).catch(() => {});
    const rssAlters = [
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS title_es TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS rewritten_summary_es TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS zone_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS local_article_slug TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS local_article_body TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS local_article_body_es TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS content_type VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS category_core_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS category_sub_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS geo_primary_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS geo_secondary_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS hub_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS county_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS venue_name TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS venue_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS venue_address TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS publish_status VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS processing_stage VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS policy_status VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS last_edited_by VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_suggested_category_core_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_suggested_category_sub_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_suggested_geo_primary_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_suggested_geo_secondary_slug VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_suggested_content_type VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_suggested_policy_status VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_confidence JSON`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_classified_at TIMESTAMP`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS pulse_eligible BOOLEAN NOT NULL DEFAULT TRUE`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS edit_history JSON`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS original_title TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS original_summary TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS original_image_url TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_generated_title TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS ai_generated_summary TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS suppression_reason TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS suppressed_by VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMP`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS image_credit TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS source_attribution TEXT`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS active_until TIMESTAMP`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS is_evergreen BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS queue_status VARCHAR`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS integrity_flags JSONB`,
      `ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS last_integrity_pass_at TIMESTAMP`,
    ];
    for (const q of rssAlters) { await feedPool.query(q).catch(() => {}); }
    await feedPool.query(`UPDATE rss_items SET publish_status = 'PUBLISHED' WHERE publish_status IS NULL AND review_status = 'APPROVED'`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET publish_status = 'SUPPRESSED' WHERE publish_status IS NULL AND review_status = 'SKIPPED'`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET policy_status = 'ALLOW' WHERE policy_status IS NULL AND review_status = 'APPROVED'`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET policy_status = 'SUPPRESS' WHERE policy_status IS NULL AND review_status = 'SKIPPED'`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET processing_stage = 'ROUTED' WHERE processing_stage IS NULL AND rewritten_summary IS NOT NULL AND zone_slug IS NOT NULL`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET processing_stage = 'REWRITTEN' WHERE processing_stage IS NULL AND rewritten_summary IS NOT NULL`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET processing_stage = 'INGESTED' WHERE processing_stage IS NULL`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET content_type = 'story' WHERE content_type IS NULL`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET geo_primary_slug = zone_slug WHERE geo_primary_slug IS NULL AND zone_slug IS NOT NULL`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET original_title = title WHERE original_title IS NULL AND title IS NOT NULL`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET original_summary = COALESCE(summary, rewritten_summary) WHERE original_summary IS NULL AND (summary IS NOT NULL OR rewritten_summary IS NOT NULL)`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET original_image_url = image_url WHERE original_image_url IS NULL AND image_url IS NOT NULL`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET queue_status = 'SUPPRESSED' WHERE queue_status IS NULL AND (publish_status = 'SUPPRESSED' OR policy_status = 'SUPPRESS')`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET queue_status = 'ARCHIVED' WHERE queue_status IS NULL AND publish_status = 'ARCHIVED'`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET queue_status = 'PULSE_SUPPRESSED' WHERE queue_status IS NULL AND publish_status = 'PUBLISHED' AND policy_status = 'ALLOW' AND pulse_eligible = FALSE`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET queue_status = 'PUBLISHED' WHERE queue_status IS NULL AND publish_status = 'PUBLISHED' AND policy_status = 'ALLOW'`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET queue_status = 'REVIEW_REQUIRED' WHERE queue_status IS NULL AND (publish_status = 'REVIEW_NEEDED' OR policy_status = 'REVIEW_NEEDED')`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET queue_status = 'UNPUBLISHED' WHERE queue_status IS NULL AND publish_status = 'DRAFT'`).catch(() => {});
    await feedPool.query(`UPDATE rss_items SET queue_status = 'REVIEW_REQUIRED' WHERE queue_status IS NULL`).catch(() => {});
    const rssIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_rss_items_geo_primary ON rss_items(geo_primary_slug)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_geo_secondary ON rss_items(geo_secondary_slug)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_hub ON rss_items(hub_slug)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_county ON rss_items(county_slug)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_category_core ON rss_items(category_core_slug)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_publish_status ON rss_items(publish_status)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_policy_status ON rss_items(policy_status)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_pulse_eligible ON rss_items(pulse_eligible)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_city_review ON rss_items(city_id, review_status)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_published_at ON rss_items(published_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_queue_status ON rss_items(queue_status)`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_geo_primary_lower ON rss_items(LOWER(geo_primary_slug))`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_geo_secondary_lower ON rss_items(LOWER(geo_secondary_slug))`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_hub_slug_lower ON rss_items(LOWER(hub_slug))`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_zone_slug_lower ON rss_items(LOWER(zone_slug))`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_cat_core_lower ON rss_items(LOWER(category_core_slug))`,
      `CREATE INDEX IF NOT EXISTS idx_rss_items_cat_sub_lower ON rss_items(LOWER(category_sub_slug))`,
    ];
    for (const q of rssIndexes) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] rss_items table ready");
  } catch (err) { console.error("[FeedSchema] rss_items (non-fatal):", err); }

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pulse_video_status') THEN CREATE TYPE pulse_video_status AS ENUM ('draft','review','approved','rejected','archived'); END IF; END $$`);
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pulse_video_tier') THEN CREATE TYPE pulse_video_tier AS ENUM ('free','featured','promoted','ad'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS pulse_videos (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR(36) NOT NULL,
      business_id VARCHAR(36),
      title TEXT NOT NULL,
      description TEXT,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      duration_sec INTEGER,
      status pulse_video_status DEFAULT 'draft',
      tier pulse_video_tier DEFAULT 'free',
      is_ad BOOLEAN DEFAULT FALSE,
      ad_tier_id VARCHAR(36),
      author_name TEXT,
      author_avatar_url TEXT,
      tags TEXT[],
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS pulse_videos_city_idx ON pulse_videos(city_id)`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS pulse_videos_status_idx ON pulse_videos(status)`);
    const pvAlters = [
      `ALTER TABLE pulse_videos ADD COLUMN IF NOT EXISTS is_ad BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE pulse_videos ADD COLUMN IF NOT EXISTS ad_tier_id VARCHAR(36)`,
      `ALTER TABLE pulse_videos ADD COLUMN IF NOT EXISTS author_name TEXT`,
      `ALTER TABLE pulse_videos ADD COLUMN IF NOT EXISTS author_avatar_url TEXT`,
      `ALTER TABLE pulse_videos ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0`,
      `ALTER TABLE pulse_videos ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0`,
      `ALTER TABLE pulse_videos ADD COLUMN IF NOT EXISTS tier pulse_video_tier DEFAULT 'free'`,
    ];
    for (const q of pvAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] pulse_videos table ready");
  } catch (err) { console.error("[FeedSchema] pulse_videos (non-fatal):", err); }

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'podcast_status') THEN CREATE TYPE podcast_status AS ENUM ('pending','approved','rejected'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS local_podcasts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      slug VARCHAR NOT NULL,
      description TEXT,
      image_url TEXT,
      rss_url TEXT,
      website_url TEXT,
      apple_podcast_url TEXT,
      spotify_url TEXT,
      host_name VARCHAR,
      host_email VARCHAR,
      city_id VARCHAR REFERENCES cities(id),
      hub_slug VARCHAR,
      category VARCHAR,
      status podcast_status NOT NULL DEFAULT 'pending',
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      pro_tier BOOLEAN NOT NULL DEFAULT FALSE,
      subscriber_count INTEGER NOT NULL DEFAULT 0,
      submitted_by_email VARCHAR,
      approved_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS local_podcasts_slug_idx ON local_podcasts(slug)`).catch(() => {});
    await feedPool.query(`CREATE INDEX IF NOT EXISTS local_podcasts_status_idx ON local_podcasts(status)`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS local_podcasts_city_idx ON local_podcasts(city_id)`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS local_podcasts_category_idx ON local_podcasts(category)`);
    const lpAlters = [
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS apple_podcast_url TEXT`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS spotify_url TEXT`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS host_email VARCHAR`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS hub_slug VARCHAR`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS category VARCHAR`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS subscriber_count INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS submitted_by_email VARCHAR`,
      `ALTER TABLE local_podcasts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
    ];
    for (const q of lpAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] local_podcasts table ready");
  } catch (err) { console.error("[FeedSchema] local_podcasts (non-fatal):", err); }

  try {
    await feedPool.query(`CREATE TABLE IF NOT EXISTS local_podcast_episodes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      podcast_id VARCHAR NOT NULL REFERENCES local_podcasts(id) ON DELETE CASCADE,
      title VARCHAR NOT NULL,
      description TEXT,
      audio_url TEXT,
      external_url TEXT,
      published_at TIMESTAMP,
      duration_seconds INTEGER,
      episode_number INTEGER,
      season_number INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS local_podcast_episodes_podcast_idx ON local_podcast_episodes(podcast_id)`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS local_podcast_episodes_published_idx ON local_podcast_episodes(published_at)`);
    const lpeAlters = [
      `ALTER TABLE local_podcast_episodes ADD COLUMN IF NOT EXISTS external_url TEXT`,
      `ALTER TABLE local_podcast_episodes ADD COLUMN IF NOT EXISTS duration_seconds INTEGER`,
      `ALTER TABLE local_podcast_episodes ADD COLUMN IF NOT EXISTS episode_number INTEGER`,
      `ALTER TABLE local_podcast_episodes ADD COLUMN IF NOT EXISTS season_number INTEGER`,
    ];
    for (const q of lpeAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] local_podcast_episodes table ready");
  } catch (err) { console.error("[FeedSchema] local_podcast_episodes (non-fatal):", err); }

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curated_list_type') THEN CREATE TYPE curated_list_type AS ENUM ('TOP10','TOP25','CUSTOM'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS curated_lists (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      type curated_list_type NOT NULL DEFAULT 'TOP10',
      zone_id VARCHAR REFERENCES zones(id),
      category_id VARCHAR REFERENCES categories(id),
      description TEXT,
      image_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS curated_list_city_slug_idx ON curated_lists(city_id, slug)`).catch(() => {});
    const clAlters = [
      `ALTER TABLE curated_lists ADD COLUMN IF NOT EXISTS zone_id VARCHAR`,
      `ALTER TABLE curated_lists ADD COLUMN IF NOT EXISTS category_id VARCHAR`,
    ];
    for (const q of clAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] curated_lists table ready");
  } catch (err) { console.error("[FeedSchema] curated_lists (non-fatal):", err); }

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'digest_status') THEN CREATE TYPE digest_status AS ENUM ('draft','scheduled','sending','sent'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS digests (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      title TEXT NOT NULL,
      title_es TEXT,
      slug TEXT NOT NULL,
      topic TEXT,
      content TEXT,
      content_es TEXT,
      html_content TEXT,
      html_content_es TEXT,
      content_json JSON,
      digest_status digest_status NOT NULL DEFAULT 'draft',
      scheduled_for TIMESTAMP,
      sent_at TIMESTAMP,
      recipient_count INTEGER DEFAULT 0,
      published_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS digest_city_slug_idx ON digests(city_id, slug)`).catch(() => {});
    const dgAlters = [
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS title_es TEXT`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS topic TEXT`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS content_es TEXT`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS html_content TEXT`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS html_content_es TEXT`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS content_json JSON`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`,
      `ALTER TABLE digests ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 0`,
    ];
    for (const q of dgAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] digests table ready");
  } catch (err) { console.error("[FeedSchema] digests (non-fatal):", err); }

  try {
    await feedPool.query(`CREATE TABLE IF NOT EXISTS video_content (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      venue_channel_id VARCHAR REFERENCES venue_channels(id) ON DELETE CASCADE,
      business_id VARCHAR REFERENCES businesses(id) ON DELETE CASCADE,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      micro_hub_id VARCHAR,
      youtube_url TEXT,
      youtube_video_id VARCHAR,
      youtube_playlist_id VARCHAR,
      title VARCHAR NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      category_ids TEXT[] NOT NULL DEFAULT '{}',
      screen_eligible BOOLEAN NOT NULL DEFAULT FALSE,
      pulse_eligible BOOLEAN NOT NULL DEFAULT TRUE,
      duration_sec INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      audio_url TEXT,
      podcast_eligible BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS video_content_channel_idx ON video_content(venue_channel_id)`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS video_content_business_idx ON video_content(business_id)`);
    await feedPool.query(`CREATE INDEX IF NOT EXISTS video_content_city_idx ON video_content(city_id)`);
    const vcAlters = [
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS venue_channel_id VARCHAR`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS micro_hub_id VARCHAR`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS youtube_url TEXT`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS youtube_video_id VARCHAR`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS youtube_playlist_id VARCHAR`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS category_ids TEXT[] NOT NULL DEFAULT '{}'`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS screen_eligible BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS pulse_eligible BOOLEAN NOT NULL DEFAULT TRUE`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS audio_url TEXT`,
      `ALTER TABLE video_content ADD COLUMN IF NOT EXISTS podcast_eligible BOOLEAN NOT NULL DEFAULT FALSE`,
    ];
    for (const q of vcAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] video_content table ready");
  } catch (err) { console.error("[FeedSchema] video_content (non-fatal):", err); }

  try {
    await feedPool.query(`CREATE TABLE IF NOT EXISTS area_facts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      hub_region_id VARCHAR REFERENCES regions(id),
      zone_slug VARCHAR,
      category TEXT NOT NULL,
      fact_text TEXT NOT NULL,
      fact_text_es TEXT,
      source_attribution TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    const afAlters = [
      `ALTER TABLE area_facts ADD COLUMN IF NOT EXISTS hub_region_id VARCHAR`,
      `ALTER TABLE area_facts ADD COLUMN IF NOT EXISTS zone_slug VARCHAR`,
      `ALTER TABLE area_facts ADD COLUMN IF NOT EXISTS fact_text_es TEXT`,
      `ALTER TABLE area_facts ADD COLUMN IF NOT EXISTS source_attribution TEXT`,
      `ALTER TABLE area_facts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`,
    ];
    for (const q of afAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] area_facts table ready");
  } catch (err) { console.error("[FeedSchema] area_facts (non-fatal):", err); }

  try {
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_content_type') THEN CREATE TYPE cms_content_type AS ENUM ('article','press_release','shoutout','media_mention','digest','curated_list','attraction','page'); END IF; END $$`);
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_status') THEN CREATE TYPE cms_status AS ENUM ('draft','in_review','scheduled','published','archived'); END IF; END $$`);
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_visibility') THEN CREATE TYPE cms_visibility AS ENUM ('public','unlisted','private'); END IF; END $$`);
    await feedPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_language') THEN CREATE TYPE cms_language AS ENUM ('en','es'); END IF; END $$`);
    await feedPool.query(`CREATE TABLE IF NOT EXISTS cms_content_items (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type cms_content_type NOT NULL,
      title_en TEXT NOT NULL,
      title_es TEXT,
      slug TEXT NOT NULL,
      excerpt_en TEXT,
      excerpt_es TEXT,
      body_en TEXT,
      body_es TEXT,
      status cms_status NOT NULL DEFAULT 'draft',
      publish_at TIMESTAMP,
      unpublish_at TIMESTAMP,
      published_at TIMESTAMP,
      created_by_user_id VARCHAR,
      assigned_editor_user_id VARCHAR,
      assigned_reviewer_user_id VARCHAR,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      zone_id VARCHAR REFERENCES zones(id),
      category_id VARCHAR REFERENCES categories(id),
      language_primary cms_language NOT NULL DEFAULT 'en',
      seo_title_en TEXT,
      seo_title_es TEXT,
      seo_description_en TEXT,
      seo_description_es TEXT,
      long_tail_keywords TEXT[],
      questions_answered TEXT[],
      canonical_url TEXT,
      hero_image_asset_id VARCHAR,
      author_id VARCHAR REFERENCES authors(id),
      visibility cms_visibility NOT NULL DEFAULT 'public',
      allow_comments BOOLEAN NOT NULL DEFAULT FALSE,
      translation_status TEXT NOT NULL DEFAULT 'pending',
      translation_error TEXT,
      translation_attempts INTEGER NOT NULL DEFAULT 0,
      last_translation_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await feedPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS cms_content_type_slug_idx ON cms_content_items(content_type, slug)`).catch(() => {});
    const cmsAlters = [
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS title_es TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS excerpt_en TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS excerpt_es TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS body_en TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS body_es TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS unpublish_at TIMESTAMP`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS assigned_editor_user_id VARCHAR`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS assigned_reviewer_user_id VARCHAR`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS seo_title_en TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS seo_title_es TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS seo_description_en TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS seo_description_es TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS long_tail_keywords TEXT[]`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS questions_answered TEXT[]`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS canonical_url TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS hero_image_asset_id VARCHAR`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS author_id VARCHAR`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'pending'`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS translation_error TEXT`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS translation_attempts INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS last_translation_at TIMESTAMP`,
    ];
    for (const q of cmsAlters) { await feedPool.query(q).catch(() => {}); }
    console.log("[FeedSchema] cms_content_items table ready");
  } catch (err) { console.error("[FeedSchema] cms_content_items (non-fatal):", err); }

  try {
    await feedPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS is_event_source BOOLEAN NOT NULL DEFAULT FALSE`);
    await feedPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS feed_url TEXT`);
    await feedPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS source_type VARCHAR`);
    await feedPool.query(`ALTER TABLE metro_sources ADD COLUMN IF NOT EXISTS scrape_config JSON`);
    console.log("[FeedSchema] metro_sources columns synced");
  } catch (err) { console.error("[FeedSchema] metro_sources alter (non-fatal):", err); }

  try {
    const { pool: fcPool } = await import("./db");
    await fcPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'field_capture_type') THEN CREATE TYPE field_capture_type AS ENUM ('business','event','job_lead','creator_lead','marketplace','flyer','community_update','correction','story_lead','photo','voice_note','document','quick_note','other'); END IF; END $$`);
    await fcPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'field_capture_status') THEN CREATE TYPE field_capture_status AS ENUM ('new','reviewing','ready_to_convert','converted','discarded','needs_followup'); END IF; END $$`);
    await fcPool.query(`CREATE TABLE IF NOT EXISTS field_captures (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL,
      zone_id VARCHAR,
      capture_type field_capture_type NOT NULL DEFAULT 'quick_note',
      title TEXT NOT NULL,
      notes TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      business_name TEXT,
      event_name TEXT,
      location_text TEXT,
      source_url TEXT,
      photo_urls TEXT[],
      file_urls TEXT[],
      raw_data JSONB DEFAULT '{}',
      status field_capture_status NOT NULL DEFAULT 'new',
      target_type TEXT,
      converted_entity_id VARCHAR,
      converted_entity_table TEXT,
      review_notes TEXT,
      captured_by_user_id VARCHAR,
      captured_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await fcPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'field_capture_review' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'inbox_item_type')) THEN ALTER TYPE inbox_item_type ADD VALUE 'field_capture_review'; END IF; END $$`);
    console.log("[FieldCapture] Tables ready");
  } catch (err) {
    console.error("Field capture tables setup (non-fatal):", err);
  }

  try {
    const { pool: csPool } = await import("./db");
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_session_status') THEN CREATE TYPE capture_session_status AS ENUM ('open','processing','ready_for_review','partially_executed','completed','failed'); END IF; END $$`);
    await csPool.query(`CREATE TABLE IF NOT EXISTS capture_sessions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      metro_id VARCHAR NOT NULL,
      event_name TEXT,
      event_date TEXT,
      location TEXT,
      operator_user_id VARCHAR NOT NULL,
      operator_name TEXT,
      notes TEXT,
      status capture_session_status NOT NULL DEFAULT 'open',
      total_items INTEGER NOT NULL DEFAULT 0,
      processed_items INTEGER NOT NULL DEFAULT 0,
      proposal_id VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_item_processing_status') THEN CREATE TYPE capture_item_processing_status AS ENUM ('pending','extracting','resolved','low_confidence','proposal_ready','executed','failed'); END IF; END $$`);
    await csPool.query(`CREATE TABLE IF NOT EXISTS capture_session_items (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL REFERENCES capture_sessions(id),
      capture_type VARCHAR NOT NULL DEFAULT 'other',
      input_name TEXT,
      input_email TEXT,
      input_phone TEXT,
      input_company TEXT,
      input_job_title TEXT,
      input_website TEXT,
      input_address TEXT,
      input_notes TEXT,
      photo_urls TEXT[],
      raw_data JSONB,
      local_id VARCHAR,
      processing_status capture_item_processing_status NOT NULL DEFAULT 'pending',
      resolved_entity_id VARCHAR,
      resolved_entity_type VARCHAR,
      match_type VARCHAR,
      confidence VARCHAR,
      eligible_actions TEXT[],
      business_id VARCHAR,
      contact_id VARCHAR,
      dedup_of_item_id VARCHAR,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    console.log("[CaptureSession] Tables ready");
  } catch (err) {
    console.error("Capture session tables setup (non-fatal):", err);
  }

  try {
    const { pool: coraPool } = await import("./db");
    await coraPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cora_plan_status') THEN CREATE TYPE cora_plan_status AS ENUM ('draft','approved','rejected','built'); END IF; END $$`);
    await coraPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cora_build_type') THEN CREATE TYPE cora_build_type AS ENUM ('ui','backend','content','config'); END IF; END $$`);
    await coraPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cora_snapshot_type') THEN CREATE TYPE cora_snapshot_type AS ENUM ('db','files','config'); END IF; END $$`);
    await coraPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_asset_status') THEN CREATE TYPE outreach_asset_status AS ENUM ('draft','approved','sent','archived'); END IF; END $$`);
    await coraPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ui_change_proposal_status') THEN CREATE TYPE ui_change_proposal_status AS ENUM ('draft','approved','applied','reverted'); END IF; END $$`);

    await coraPool.query(`CREATE TABLE IF NOT EXISTS cora_plans (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      hat TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'metro',
      metro_id VARCHAR,
      tags JSON DEFAULT '[]',
      plan_json JSON NOT NULL,
      status cora_plan_status NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await coraPool.query(`CREATE INDEX IF NOT EXISTS cora_plans_status_idx ON cora_plans(status)`);

    await coraPool.query(`CREATE TABLE IF NOT EXISTS cora_build_logs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id VARCHAR NOT NULL REFERENCES cora_plans(id),
      build_type cora_build_type NOT NULL,
      changes_summary TEXT NOT NULL,
      files_modified JSON DEFAULT '[]',
      replit_prompt TEXT,
      result_summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await coraPool.query(`CREATE INDEX IF NOT EXISTS cora_build_logs_plan_idx ON cora_build_logs(plan_id)`);

    await coraPool.query(`CREATE TABLE IF NOT EXISTS cora_snapshots (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      build_log_id VARCHAR NOT NULL REFERENCES cora_build_logs(id),
      snapshot_type cora_snapshot_type NOT NULL,
      snapshot_data JSON DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await coraPool.query(`CREATE INDEX IF NOT EXISTS cora_snapshots_build_log_idx ON cora_snapshots(build_log_id)`);

    await coraPool.query(`CREATE TABLE IF NOT EXISTS outreach_assets (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      scope TEXT NOT NULL DEFAULT 'metro',
      metro_id VARCHAR,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subject_line TEXT,
      body TEXT NOT NULL,
      persona_name TEXT NOT NULL DEFAULT 'cora',
      target_type TEXT NOT NULL DEFAULT 'general',
      status outreach_asset_status NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL DEFAULT 'cora',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await coraPool.query(`CREATE INDEX IF NOT EXISTS outreach_assets_status_idx ON outreach_assets(status)`);
    await coraPool.query(`CREATE INDEX IF NOT EXISTS outreach_assets_type_idx ON outreach_assets(type)`);

    await coraPool.query(`CREATE TABLE IF NOT EXISTS ui_change_proposals (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      scope TEXT NOT NULL DEFAULT 'platform',
      metro_id VARCHAR,
      name TEXT NOT NULL,
      change_type TEXT NOT NULL,
      description TEXT NOT NULL,
      preview_config JSON DEFAULT '{}',
      code_snippet TEXT,
      status ui_change_proposal_status NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL DEFAULT 'cora',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await coraPool.query(`CREATE INDEX IF NOT EXISTS ui_change_proposals_status_idx ON ui_change_proposals(status)`);

    console.log("[Cora] Plan/Build/Revert/Outreach/UI-Proposal tables ready");
  } catch (err) {
    console.error("Cora tables setup (non-fatal):", err);
  }

  try {
    const { pool: wfPool } = await import("./db");

    await wfPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_source') THEN CREATE TYPE workflow_source AS ENUM ('activate','claim','story','crown','qr','cta','event','job','publication'); END IF; END $$`);
    await wfPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_step') THEN CREATE TYPE workflow_step AS ENUM ('entry','match','account_check','verification','attach_ownership','identity_router','basic_activation','story_builder','capability_activation','hub_category_setup','trust_signals','trusted_network_check','first_action','complete'); END IF; END $$`);
    await wfPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_status') THEN CREATE TYPE workflow_status AS ENUM ('active','paused','completed','abandoned','error'); END IF; END $$`);
    await wfPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_event_type') THEN CREATE TYPE workflow_event_type AS ENUM ('step_advance','step_skip','match_found','match_created','user_matched','identity_set','verification_sent','verification_passed','error','pause','resume','abandon'); END IF; END $$`);
    await wfPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_follow_up_channel') THEN CREATE TYPE workflow_follow_up_channel AS ENUM ('email','sms','internal_task','voice'); END IF; END $$`);
    await wfPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_follow_up_status') THEN CREATE TYPE workflow_follow_up_status AS ENUM ('pending','sent','completed','cancelled'); END IF; END $$`);

    await wfPool.query(`CREATE TABLE IF NOT EXISTS workflow_sessions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      source workflow_source NOT NULL,
      current_step workflow_step NOT NULL DEFAULT 'entry',
      status workflow_status NOT NULL DEFAULT 'active',
      entity_id VARCHAR,
      entity_type TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      contact_name TEXT,
      business_name TEXT,
      matched_business_id VARCHAR REFERENCES businesses(id),
      identity_role TEXT,
      presence_type TEXT,
      session_data JSON NOT NULL DEFAULT '{}',
      chat_session_id TEXT,
      flow_session_id VARCHAR,
      session_secret_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await wfPool.query(`CREATE TABLE IF NOT EXISTS workflow_events (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL REFERENCES workflow_sessions(id),
      from_step workflow_step,
      to_step workflow_step,
      event_type workflow_event_type NOT NULL,
      event_data JSON,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await wfPool.query(`CREATE TABLE IF NOT EXISTS workflow_follow_ups (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL REFERENCES workflow_sessions(id),
      channel workflow_follow_up_channel NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      message TEXT NOT NULL,
      status workflow_follow_up_status NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await wfPool.query(`CREATE TABLE IF NOT EXISTS workflow_action_recommendations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL REFERENCES workflow_sessions(id),
      action_type VARCHAR(100) NOT NULL,
      label VARCHAR(300) NOT NULL,
      description TEXT,
      target_url VARCHAR(500),
      priority INTEGER NOT NULL DEFAULT 0,
      dismissed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await wfPool.query(`CREATE INDEX IF NOT EXISTS wf_sessions_city_idx ON workflow_sessions(city_id)`);
    await wfPool.query(`CREATE INDEX IF NOT EXISTS wf_sessions_status_idx ON workflow_sessions(status)`);
    await wfPool.query(`CREATE INDEX IF NOT EXISTS wf_sessions_email_idx ON workflow_sessions(contact_email)`);
    await wfPool.query(`CREATE INDEX IF NOT EXISTS wf_events_session_idx ON workflow_events(session_id)`);
    await wfPool.query(`CREATE INDEX IF NOT EXISTS wf_recs_session_idx ON workflow_action_recommendations(session_id)`);
    await wfPool.query(`CREATE INDEX IF NOT EXISTS wf_followups_session_idx ON workflow_follow_ups(session_id)`);

    console.log("[Workflow] Tables + enums ready");
  } catch (err) {
    console.error("Workflow tables setup (non-fatal):", err);
  }

  try {
    const { pool: metroPool } = await import("./db");

    await metroPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'paused' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'metro_status')) THEN ALTER TYPE metro_status ADD VALUE 'paused'; END IF; END $$`);

    await metroPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metro_template_status') THEN CREATE TYPE metro_template_status AS ENUM ('active', 'archived'); END IF; END $$`);
    await metroPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metro_checklist_status') THEN CREATE TYPE metro_checklist_status AS ENUM ('pending', 'complete', 'blocked'); END IF; END $$`);

    await metroPool.query(`ALTER TABLE metro_projects ADD COLUMN IF NOT EXISTS template_id VARCHAR`);
    await metroPool.query(`ALTER TABLE metro_projects ADD COLUMN IF NOT EXISTS clone_manifest JSONB`);

    await metroPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS metro_templates_name_unique ON metro_templates(name)`).catch(() => {});

    await metroPool.query(`CREATE TABLE IF NOT EXISTS metro_templates (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      base_metro_id VARCHAR,
      description TEXT,
      includes_config_json JSONB,
      status metro_template_status NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    await metroPool.query(`CREATE TABLE IF NOT EXISTS metro_launch_checklist (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      metro_id VARCHAR NOT NULL REFERENCES metro_projects(id),
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      status metro_checklist_status NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await metroPool.query(`CREATE INDEX IF NOT EXISTS mlc_metro_idx ON metro_launch_checklist(metro_id)`);
    await metroPool.query(`CREATE INDEX IF NOT EXISTS mlc_status_idx ON metro_launch_checklist(status)`);

    const defaultTemplate = {
      copy_hub_structure: true,
      copy_categories: true,
      copy_tags: true,
      copy_content_settings: true,
      copy_pricing: true,
      copy_ai_personas: true,
      copy_outreach_templates: true,
    };
    const charlotteCity = await metroPool.query(`SELECT id FROM cities WHERE slug = 'charlotte' LIMIT 1`);
    const charlotteCityId = charlotteCity.rows[0]?.id || null;
    await metroPool.query(
      `INSERT INTO metro_templates (name, base_metro_id, description, includes_config_json)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET base_metro_id = EXCLUDED.base_metro_id, includes_config_json = EXCLUDED.includes_config_json`,
      ["Charlotte Base", charlotteCityId, "Default metro template based on Charlotte hub structure", JSON.stringify(defaultTemplate)]
    );

    console.log("[Metro] Templates + Checklist tables ready");
  } catch (err) {
    console.error("Metro template/checklist setup (non-fatal):", err);
  }

  try {
    const { pool: mpPool } = await import("./db");
    await mpPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'micro_pub_section_type') THEN CREATE TYPE micro_pub_section_type AS ENUM ('pets','family','senior','events','arts_entertainment'); END IF; END $$`);
    await mpPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'micro_pub_position') THEN CREATE TYPE micro_pub_position AS ENUM ('front1','front2','back1','back2','back3'); END IF; END $$`);
    await mpPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'micro_pub_status') THEN CREATE TYPE micro_pub_status AS ENUM ('draft','published','archived'); END IF; END $$`);

    await mpPool.query(`CREATE TABLE IF NOT EXISTS micro_publications (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id VARCHAR NOT NULL,
      hub_slug TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      cover_image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await mpPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS micro_pub_slug_idx ON micro_publications(city_id, slug)`);
    await mpPool.query(`CREATE INDEX IF NOT EXISTS micro_pub_hub_idx ON micro_publications(hub_slug)`);

    await mpPool.query(`CREATE TABLE IF NOT EXISTS micro_pub_issues (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      publication_id VARCHAR NOT NULL REFERENCES micro_publications(id),
      issue_number INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      publish_date TIMESTAMPTZ,
      status micro_pub_status NOT NULL DEFAULT 'draft',
      pickup_locations JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await mpPool.query(`CREATE INDEX IF NOT EXISTS micro_pub_issue_pub_idx ON micro_pub_issues(publication_id)`);
    await mpPool.query(`CREATE INDEX IF NOT EXISTS micro_pub_issue_status_idx ON micro_pub_issues(status)`);

    await mpPool.query(`CREATE TABLE IF NOT EXISTS micro_pub_sections (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      issue_id VARCHAR NOT NULL REFERENCES micro_pub_issues(id) ON DELETE CASCADE,
      section_type micro_pub_section_type NOT NULL,
      position micro_pub_position NOT NULL,
      story_title TEXT,
      story_body TEXT,
      story_image_url TEXT,
      nonprofit_name TEXT,
      nonprofit_url TEXT,
      sponsor_business_id VARCHAR,
      sponsor_name TEXT,
      sponsor_image_url TEXT,
      sponsor_link TEXT,
      sponsor_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await mpPool.query(`CREATE INDEX IF NOT EXISTS micro_pub_section_issue_idx ON micro_pub_sections(issue_id)`);

    await mpPool.query(`CREATE TABLE IF NOT EXISTS micro_pub_community_ads (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      issue_id VARCHAR NOT NULL REFERENCES micro_pub_issues(id) ON DELETE CASCADE,
      slot_number INTEGER NOT NULL,
      business_id VARCHAR,
      business_name TEXT,
      image_url TEXT,
      link TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await mpPool.query(`CREATE INDEX IF NOT EXISTS micro_pub_comm_ad_issue_idx ON micro_pub_community_ads(issue_id)`);

    console.log("[MicroPub] Tables ready");
  } catch (err) {
    console.error("MicroPub tables setup (non-fatal):", err);
  }

  try {
    const ccePool = (await import("pg")).default;
    const cceP = new ccePool.Pool({ connectionString: process.env.DATABASE_URL });
    await cceP.query(`CREATE TABLE IF NOT EXISTS card_contact_exchanges (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      card_id VARCHAR(36) NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      business_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await cceP.query(`CREATE INDEX IF NOT EXISTS cce_card_id_idx ON card_contact_exchanges(card_id)`);
    console.log("[CardContactExchanges] Table ready");
  } catch (err) {
    console.error("CardContactExchanges table setup (non-fatal):", err);
  }

  try {
    const mktPool = (await import("./db")).pool;
    await mktPool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS marketplace_listing_id VARCHAR`);
    await mktPool.query(`ALTER TABLE reviews ALTER COLUMN business_id DROP NOT NULL`);
    await mktPool.query(`CREATE INDEX IF NOT EXISTS reviews_mpl_idx ON reviews(marketplace_listing_id)`);
    await mktPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marketplace_transaction_status') THEN CREATE TYPE marketplace_transaction_status AS ENUM ('PENDING','COMPLETED','REFUNDED','DISPUTED','CANCELLED'); END IF; END $$`);
    await mktPool.query(`CREATE TABLE IF NOT EXISTS marketplace_transactions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id VARCHAR NOT NULL REFERENCES marketplace_listings(id),
      buyer_user_id VARCHAR REFERENCES public_users(id),
      seller_user_id VARCHAR REFERENCES public_users(id),
      seller_business_id VARCHAR REFERENCES businesses(id),
      city_id VARCHAR REFERENCES cities(id),
      amount_cents INTEGER NOT NULL,
      status marketplace_transaction_status NOT NULL DEFAULT 'PENDING',
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
      claim_code VARCHAR(12),
      claimed_at TIMESTAMPTZ,
      buyer_name TEXT,
      buyer_email TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await mktPool.query(`CREATE INDEX IF NOT EXISTS mkt_txn_listing_idx ON marketplace_transactions(listing_id)`);
    await mktPool.query(`CREATE INDEX IF NOT EXISTS mkt_txn_buyer_idx ON marketplace_transactions(buyer_user_id)`);
    await mktPool.query(`CREATE INDEX IF NOT EXISTS mkt_txn_claim_code_idx ON marketplace_transactions(claim_code)`);
    await mktPool.query(`CREATE TABLE IF NOT EXISTS marketplace_analytics_events (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id VARCHAR,
      city_id VARCHAR,
      event_type TEXT NOT NULL,
      actor_user_id VARCHAR,
      metadata TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await mktPool.query(`CREATE INDEX IF NOT EXISTS mkt_ae_listing_idx ON marketplace_analytics_events(listing_id)`);
    await mktPool.query(`CREATE INDEX IF NOT EXISTS mkt_ae_type_idx ON marketplace_analytics_events(event_type)`);
    console.log("[Marketplace] Reviews extension, transactions & analytics tables ready");
  } catch (err) {
    console.error("Marketplace schema extensions (non-fatal):", err);
  }

  try {
    const { loadTierPricesFromDb } = await import("./stripe/priceMap");
    await loadTierPricesFromDb();
  } catch (err) {
    console.error("Tier price load (non-fatal):", err);
  }

  try {
    const { startFollowupScheduler } = await import("./services/capture-followup-scheduler");
    startFollowupScheduler();
  } catch (err) {
    console.error("Follow-up scheduler start (non-fatal):", err);
  }

  try {
    const { pool: automationPool } = await import("./db");
    await automationPool.query(`
      DO $$ BEGIN
        CREATE TYPE automation_trigger_event AS ENUM ('booking_no_response','content_published','story_approved','lead_created','event_rsvp');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE automation_action_type AS ENUM ('send_email','update_status','generate_content','create_notification');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE TABLE IF NOT EXISTS automation_rules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT,
        description TEXT,
        trigger_event automation_trigger_event NOT NULL,
        delay_minutes INTEGER NOT NULL DEFAULT 0,
        action_type automation_action_type NOT NULL,
        action_config JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        city_id VARCHAR REFERENCES cities(id),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS automation_queue (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        rule_id VARCHAR NOT NULL REFERENCES automation_rules(id),
        trigger_event automation_trigger_event NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        fire_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS automation_log (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        queue_item_id VARCHAR REFERENCES automation_queue(id),
        rule_id VARCHAR REFERENCES automation_rules(id),
        action_type automation_action_type NOT NULL,
        result JSONB,
        error TEXT,
        executed_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log("[AutomationEngine] Tables ready");
    const { startAutomationScheduler } = await import("./services/automation-scheduler");
    startAutomationScheduler();
  } catch (err) {
    console.error("Automation scheduler start (non-fatal):", err);
  }

  try {
    const { startCharlotteTaskWorker } = await import("./services/charlotte-task-worker");
    startCharlotteTaskWorker(10000);
  } catch (err) {
    console.error("Charlotte task worker start (non-fatal):", err);
  }

  try {
    const { pool: insPool } = await import("./db");
    await insPool.query(`
      DO $$ BEGIN
        CREATE TYPE charlotte_insight_type AS ENUM ('trending_search','common_question','unanswered_query','demand_signal','hot_neighborhood');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await insPool.query(`
      CREATE TABLE IF NOT EXISTS charlotte_public_insights (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        insight_type charlotte_insight_type NOT NULL,
        content JSONB NOT NULL,
        time_window TEXT NOT NULL DEFAULT '24h',
        city_id VARCHAR REFERENCES cities(id),
        rank INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await insPool.query(`CREATE INDEX IF NOT EXISTS charlotte_insights_type_idx ON charlotte_public_insights(insight_type)`);
    await insPool.query(`CREATE INDEX IF NOT EXISTS charlotte_insights_window_idx ON charlotte_public_insights(time_window)`);
    await insPool.query(`CREATE INDEX IF NOT EXISTS charlotte_insights_city_idx ON charlotte_public_insights(city_id)`);
    await insPool.query(`CREATE INDEX IF NOT EXISTS charlotte_insights_created_idx ON charlotte_public_insights(created_at)`);
    console.log("[Insights] Table ready");
  } catch (err) {
    console.error("Charlotte insights table setup (non-fatal):", err);
  }

  try {
    const { startInsightsWorker } = await import("./services/charlotte-insights-worker");
    startInsightsWorker(1800000);
  } catch (err) {
    console.error("Charlotte insights worker start (non-fatal):", err);
  }

  try {
    const { pool: orchPool } = await import("./db");
    await orchPool.query(`
      CREATE TABLE IF NOT EXISTS orchestrator_decisions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        metro_id VARCHAR,
        source TEXT NOT NULL,
        user_id TEXT,
        mode TEXT NOT NULL,
        intent TEXT NOT NULL,
        confidence NUMERIC(3,2) NOT NULL DEFAULT 0,
        entity_count INTEGER NOT NULL DEFAULT 0,
        entities JSONB,
        target_engines TEXT[] DEFAULT '{}',
        requires_proposal BOOLEAN NOT NULL DEFAULT false,
        batch_mode BOOLEAN NOT NULL DEFAULT false,
        routing_steps JSONB,
        input_preview TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await orchPool.query(`CREATE INDEX IF NOT EXISTS orch_decisions_metro_idx ON orchestrator_decisions(metro_id)`);
    await orchPool.query(`CREATE INDEX IF NOT EXISTS orch_decisions_mode_idx ON orchestrator_decisions(mode)`);
    await orchPool.query(`CREATE INDEX IF NOT EXISTS orch_decisions_created_idx ON orchestrator_decisions(created_at)`);
    console.log("[Orchestrator] Decisions table ready");
  } catch (err) {
    console.error("Orchestrator decisions table (non-fatal):", err);
  }

  try {
    const { pool: propPool } = await import("./db");
    await propPool.query(`
      CREATE TABLE IF NOT EXISTS charlotte_proposals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        metro_id VARCHAR,
        user_id TEXT,
        source TEXT NOT NULL DEFAULT 'orchestrator',
        directive TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        mode TEXT,
        total_items INTEGER NOT NULL DEFAULT 0,
        confirmed_items INTEGER NOT NULL DEFAULT 0,
        executed_items INTEGER NOT NULL DEFAULT 0,
        failed_items INTEGER NOT NULL DEFAULT 0,
        batch_mode BOOLEAN NOT NULL DEFAULT false,
        orchestrator_decision_id VARCHAR,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await propPool.query(`CREATE INDEX IF NOT EXISTS cp_metro_idx ON charlotte_proposals(metro_id)`);
    await propPool.query(`CREATE INDEX IF NOT EXISTS cp_status_idx ON charlotte_proposals(status)`);
    await propPool.query(`CREATE INDEX IF NOT EXISTS cp_created_idx ON charlotte_proposals(created_at)`);

    await propPool.query(`
      CREATE TABLE IF NOT EXISTS charlotte_proposal_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        proposal_id VARCHAR NOT NULL REFERENCES charlotte_proposals(id) ON DELETE CASCADE,
        template_key TEXT NOT NULL,
        entity_type TEXT,
        entity_id VARCHAR,
        entity_name TEXT,
        status TEXT NOT NULL DEFAULT 'proposed',
        params JSONB,
        result JSONB,
        error_message TEXT,
        executed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await propPool.query(`CREATE INDEX IF NOT EXISTS cpi_proposal_idx ON charlotte_proposal_items(proposal_id)`);
    await propPool.query(`CREATE INDEX IF NOT EXISTS cpi_status_idx ON charlotte_proposal_items(status)`);
    await propPool.query(`CREATE INDEX IF NOT EXISTS cpi_entity_idx ON charlotte_proposal_items(entity_id)`);

    try {
      await propPool.query(`ALTER TYPE inbox_item_type ADD VALUE IF NOT EXISTS 'proposal_needs_review'`);
    } catch (_) {}
    try {
      await propPool.query(`ALTER TYPE inbox_item_type ADD VALUE IF NOT EXISTS 'new_event_capture'`);
    } catch (_) {}

    console.log("[ProposalEngine] Tables ready");
  } catch (err) {
    console.error("Proposal engine tables (non-fatal):", err);
  }

  try {
    const { pool: csPool } = await import("./db");
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_session_status') THEN CREATE TYPE capture_session_status AS ENUM ('open','uploading','processing','ready_for_review','partially_executed','complete','failed'); END IF; END $$`);
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_session_item_status') THEN CREATE TYPE capture_session_item_status AS ENUM ('pending','extracting','extracted','matched','unmatched','error'); END IF; END $$`);
    await csPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_session_item_type') THEN CREATE TYPE capture_session_item_type AS ENUM ('business_card','handwritten_note','booth_photo','ad_photo','document','contact_data','qr_data'); END IF; END $$`);
    await csPool.query(`CREATE TABLE IF NOT EXISTS capture_sessions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      event_name TEXT NOT NULL,
      event_date TEXT,
      location TEXT,
      operator_id VARCHAR,
      operator_name TEXT,
      hub_id VARCHAR,
      status capture_session_status NOT NULL DEFAULT 'open',
      total_items INTEGER NOT NULL DEFAULT 0,
      processed_items INTEGER NOT NULL DEFAULT 0,
      matched_existing INTEGER NOT NULL DEFAULT 0,
      matched_new INTEGER NOT NULL DEFAULT 0,
      proposal_id VARCHAR,
      notes TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS cs_status_idx ON capture_sessions(status)`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS cs_operator_idx ON capture_sessions(operator_id)`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS cs_hub_idx ON capture_sessions(hub_id)`);

    await csPool.query(`CREATE TABLE IF NOT EXISTS capture_session_items (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
      item_type capture_session_item_type NOT NULL DEFAULT 'business_card',
      status capture_session_item_status NOT NULL DEFAULT 'pending',
      image_url TEXT,
      raw_input JSONB,
      extracted_data JSONB,
      matched_entity_id VARCHAR,
      matched_entity_type TEXT,
      matched_entity_name TEXT,
      match_confidence TEXT,
      is_existing_entity BOOLEAN DEFAULT false,
      crm_contact_id VARCHAR,
      business_id VARCHAR,
      proposed_actions JSONB,
      processing_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS csi_session_idx ON capture_session_items(session_id)`);
    await csPool.query(`CREATE INDEX IF NOT EXISTS csi_status_idx ON capture_session_items(processing_status)`).catch(() => {});
    await csPool.query(`CREATE INDEX IF NOT EXISTS csi_entity_idx ON capture_session_items(resolved_entity_id)`).catch(() => {});

    console.log("[CaptureSessions] Tables ready");
  } catch (err) {
    console.error("Capture sessions tables (non-fatal):", err);
  }

  try {
    const { pool: caqPool } = await import("./db");
    const caqEnum = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_action_queue_status') THEN CREATE TYPE capture_action_queue_status AS ENUM ('pending','in_progress','completed','failed','cancelled'); END IF; END $$`;
    await caqPool.query(caqEnum);
    await caqPool.query(`CREATE TABLE IF NOT EXISTS capture_action_queue (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      source TEXT NOT NULL DEFAULT 'capture',
      action_type TEXT NOT NULL,
      entity_id VARCHAR,
      entity_type TEXT,
      entity_name TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      recommended_action TEXT NOT NULL,
      capture_session_id VARCHAR,
      capture_item_id VARCHAR,
      inbox_item_id VARCHAR,
      status capture_action_queue_status NOT NULL DEFAULT 'pending',
      metadata JSONB,
      resolved_by VARCHAR,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await caqPool.query(`CREATE INDEX IF NOT EXISTS caq_status_idx ON capture_action_queue(status)`);
    await caqPool.query(`CREATE INDEX IF NOT EXISTS caq_priority_idx ON capture_action_queue(priority)`);
    await caqPool.query(`CREATE INDEX IF NOT EXISTS caq_session_idx ON capture_action_queue(capture_session_id)`);
    console.log("[CaptureActionQueue] Table ready");
  } catch (err) {
    console.error("CaptureActionQueue (non-fatal):", err);
  }

  try {
    const { pool: cfPool } = await import("./db");
    await cfPool.query(`ALTER TABLE charlotte_flow_sessions ADD COLUMN IF NOT EXISTS onboarding_state JSONB`);
    console.log("[LifecycleHooks] Onboarding state column ready");
  } catch (err) {
    console.error("Lifecycle hooks migration (non-fatal):", err);
  }

  try {
    const { pool: catPool } = await import("./db");
    const govId = 'aaaaaaaa-0002-0001-0001-000000000001';
    const eduId = 'aaaaaaaa-0002-0001-0001-000000000002';
    await catPool.query(`
      INSERT INTO categories (id, name, slug, icon, sort_order) VALUES
        ($1, 'Government & Public Services', 'government-public-services', 'landmark', 14),
        ($2, 'Education', 'education', 'graduation-cap', 15)
      ON CONFLICT (slug) DO NOTHING
    `, [govId, eduId]);
    const govSubs = [
      ['aaaaaaaa-0002-0002-0001-000000000001', 'Public Schools', 'public-schools', govId],
      ['aaaaaaaa-0002-0002-0001-000000000002', 'Libraries', 'public-libraries', govId],
      ['aaaaaaaa-0002-0002-0001-000000000003', 'Courts & Legal Services', 'courts-legal-services', govId],
      ['aaaaaaaa-0002-0002-0001-000000000004', 'City & County Government', 'city-county-government', govId],
      ['aaaaaaaa-0002-0002-0001-000000000005', 'Public Safety', 'public-safety', govId],
      ['aaaaaaaa-0002-0002-0001-000000000006', 'DMV & Licensing', 'dmv-licensing', govId],
      ['aaaaaaaa-0002-0002-0001-000000000007', 'Parks & Recreation', 'govt-parks-recreation', govId],
      ['aaaaaaaa-0002-0002-0001-000000000008', 'Public Utilities & Infrastructure', 'public-utilities-infrastructure', govId],
    ];
    const eduSubs = [
      ['aaaaaaaa-0002-0002-0002-000000000001', 'Colleges & Universities', 'colleges-universities', eduId],
      ['aaaaaaaa-0002-0002-0002-000000000002', 'Trade & Vocational Schools', 'trade-vocational-schools', eduId],
      ['aaaaaaaa-0002-0002-0002-000000000003', 'Tutoring & Test Prep', 'tutoring-test-prep', eduId],
      ['aaaaaaaa-0002-0002-0002-000000000004', 'Early Childhood & Preschool', 'early-childhood-preschool', eduId],
      ['aaaaaaaa-0002-0002-0002-000000000005', 'After-School Programs', 'after-school-programs', eduId],
    ];
    for (const [id, name, slug, parentId] of [...govSubs, ...eduSubs]) {
      await catPool.query(
        `INSERT INTO categories (id, name, slug, parent_category_id, sort_order) VALUES ($1, $2, $3, $4, 0)
         ON CONFLICT (slug) DO UPDATE SET parent_category_id = EXCLUDED.parent_category_id`,
        [id, name, slug, parentId]
      );
    }
    console.log("[Categories] Government & Education categories seeded");

    const BACKFILL_KEY = 'gov_edu_faith_backfill_v1';
    const guardCheck = await catPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [BACKFILL_KEY]
    );
    if (guardCheck.rows.length > 0) {
      console.log("[Backfill] Gov/Edu/Faith category backfill already completed, skipping");
    } else {
      const { GOOGLE_TYPES_TO_L2_SLUGS: typeMap } = await import("./google-places");

      const allCats = await catPool.query(`SELECT id, slug FROM categories`);
      const catSlugToId = new Map<string, string>();
      for (const row of allCats.rows) catSlugToId.set(row.slug, row.id);

      const NAME_CATEGORY_RULES: Array<{ patterns: RegExp[]; slugs: string[] }> = [
        {
          patterns: [/\bchurch\b/i, /\bchapel\b/i, /\bworship\b/i, /\bministry\b/i, /\bcongregation\b/i, /\bparish\b/i, /\bfellowship\b/i, /\btabernacle\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship"],
        },
        {
          patterns: [/\bbaptist\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "baptist"],
        },
        {
          patterns: [/\bmethodist\b/i, /\bumc\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "methodist"],
        },
        {
          patterns: [/\bcatholic\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "catholic"],
        },
        {
          patterns: [/\bpresbyterian\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "presbyterian"],
        },
        {
          patterns: [/\blutheran\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "lutheran"],
        },
        {
          patterns: [/\bepiscopal\b/i, /\banglican\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "episcopal-anglican"],
        },
        {
          patterns: [/\bame\b/i, /\bafrican\s+methodist/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "ame-african-methodist"],
        },
        {
          patterns: [/\bpentecostal\b/i, /\bassembl(y|ies)\s+of\s+god/i, /\bcogic\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "pentecostal"],
        },
        {
          patterns: [/\bmosque\b/i, /\bmasjid\b/i, /\bislamic\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "islamic-mosque"],
        },
        {
          patterns: [/\bsynagogue\b/i, /\bjewish\b/i, /\bchabad\b/i, /\btemple\s+beth\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "jewish-synagogue"],
        },
        {
          patterns: [/\bhindu\b/i, /\bmandir\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "hindu-temple"],
        },
        {
          patterns: [/\bbuddhist\b/i, /\bzen\s+(center|temple|monastery)/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "buddhist-temple"],
        },
        {
          patterns: [/\bsikh\b/i, /\bgurdwara\b/i, /\bgurudwara\b/i],
          slugs: ["nonprofit-faith", "churches-places-of-worship", "sikh-gurdwara"],
        },
        {
          patterns: [/\belementary\s+school\b/i, /\bmiddle\s+school\b/i, /\bhigh\s+school\b/i, /\bprimary\s+school\b/i],
          slugs: ["government-public-services", "public-schools"],
        },
        {
          patterns: [/\buniversity\s+(of|at)\b/i, /^(university|college)\b/i, /\bcommunity\s+college\b/i, /\bUNC\s/],
          slugs: ["education", "colleges-universities"],
        },
        {
          patterns: [/\blibrary\b/i],
          slugs: ["government-public-services", "public-libraries"],
        },
        {
          patterns: [/\bfire\s+station\b/i, /\bfire\s+department\b/i, /\bpolice\b/i, /\bsheriff\b/i],
          slugs: ["government-public-services", "public-safety"],
        },
        {
          patterns: [/\bcity\s+hall\b/i, /\btown\s+hall\b/i, /\bmunicipal\b/i, /\bcounty\s+(office|building|government)/i],
          slugs: ["government-public-services", "city-county-government"],
        },
        {
          patterns: [/\bcourthouse\b/i, /\bcourt\s+house\b/i],
          slugs: ["government-public-services", "courts-legal-services"],
        },
        {
          patterns: [/\bdmv\b/i, /\bdriver.?s?\s+license/i, /\bmotor\s+vehicle/i],
          slugs: ["government-public-services", "dmv-licensing"],
        },
        {
          patterns: [/\bpost\s+office\b/i],
          slugs: ["government-public-services", "public-utilities-infrastructure"],
        },
        {
          patterns: [/\bdaycare\b/i, /\bpreschool\b/i, /\bpre-school\b/i, /\bchild\s*care\b/i, /\bmontessori\b/i],
          slugs: ["education", "early-childhood-preschool"],
        },
        {
          patterns: [/\btrade\s+school\b/i, /\bvocational\b/i, /\btechnical\s+(college|institute|school)\b/i],
          slugs: ["education", "trade-vocational-schools"],
        },
      ];

      const placeTypeMap = new Map<string, string[]>();
      const pirRows = await catPool.query(
        `SELECT pir.created_presence_id, pir.categories_json
         FROM place_import_results pir
         WHERE pir.created_presence_id IS NOT NULL AND pir.categories_json IS NOT NULL`
      );
      for (const row of pirRows.rows) {
        try {
          const types: string[] = typeof row.categories_json === 'string'
            ? JSON.parse(row.categories_json)
            : row.categories_json;
          if (Array.isArray(types)) {
            placeTypeMap.set(row.created_presence_id, types);
          }
        } catch { /* skip malformed JSON */ }
      }

      const allBiz = await catPool.query(`SELECT id, name, category_ids FROM businesses`);
      let backfillCount = 0;
      for (const biz of allBiz.rows) {
        const existingIds: string[] = biz.category_ids || [];
        const newCatIds = new Set<string>();

        const storedTypes = placeTypeMap.get(biz.id);
        if (storedTypes) {
          for (const gType of storedTypes) {
            const l2Slugs = typeMap[gType];
            if (l2Slugs) {
              for (const slug of l2Slugs) {
                const catId = catSlugToId.get(slug);
                if (catId && !existingIds.includes(catId)) {
                  newCatIds.add(catId);
                }
              }
            }
          }
        }

        for (const rule of NAME_CATEGORY_RULES) {
          const matched = rule.patterns.some(p => p.test(biz.name));
          if (matched) {
            for (const slug of rule.slugs) {
              const catId = catSlugToId.get(slug);
              if (catId && !existingIds.includes(catId)) {
                newCatIds.add(catId);
              }
            }
          }
        }

        if (newCatIds.size > 0) {
          const merged = [...new Set([...existingIds, ...newCatIds])];
          await catPool.query(
            `UPDATE businesses SET category_ids = $1 WHERE id = $2`,
            [merged, biz.id]
          );
          backfillCount++;
        }
      }

      await catPool.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
        [BACKFILL_KEY, JSON.stringify({ completedAt: new Date().toISOString() })]
      );
      console.log(`[Backfill] Gov/Edu/Faith category backfill complete: ${backfillCount} businesses updated`);
    }
  } catch (err) {
    console.error("Government/Education category seed (non-fatal):", err);
  }

  try {
    const { pool: evtPool } = await import("./db");
    const EVENT_SRC_KEY = 'event_source_categorize_v1';
    const [existingEvtKey] = (await evtPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [EVENT_SRC_KEY]
    )).rows;
    if (existingEvtKey) {
      console.log("[Backfill] Event-source categorization already completed, skipping");
    } else {
      const evtResult = await evtPool.query(`
        UPDATE rss_items SET
          content_type = 'event',
          category_core_slug = COALESCE(category_core_slug, 'arts-culture'),
          updated_at = NOW()
        WHERE metro_source_id IN (SELECT id FROM metro_sources WHERE is_event_source = true)
          AND (content_type = 'story' OR category_core_slug IS NULL)
      `);
      await evtPool.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
        [EVENT_SRC_KEY, JSON.stringify({ completedAt: new Date().toISOString() })]
      );
      console.log(`[Backfill] Event-source categorization complete: ${evtResult.rowCount} items updated`);
    }
  } catch (err) {
    console.error("Event-source categorization (non-fatal):", err);
  }

  try {
    const RSS_SRC_KEY = "backfill_rss_source_names_v2";
    const { pool: srcPool } = await import("./db");
    const [srcDone] = (await srcPool.query(`SELECT value FROM platform_settings WHERE key = $1`, [RSS_SRC_KEY])).rows;
    if (!srcDone) {
      const { normalizeSourceName } = await import("./services/feed-service");
      const distinctRes = await srcPool.query(`SELECT DISTINCT source_name FROM rss_items WHERE source_name IS NOT NULL`);
      let srcUpdated = 0;
      for (const row of distinctRes.rows) {
        const raw = row.source_name;
        const clean = normalizeSourceName(raw);
        if (clean && clean !== raw) {
          const r = await srcPool.query(
            `UPDATE rss_items SET source_name = $1 WHERE source_name = $2`,
            [clean, raw]
          );
          srcUpdated += r.rowCount || 0;
        }
      }
      await srcPool.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
        [RSS_SRC_KEY, JSON.stringify({ completedAt: new Date().toISOString(), updated: srcUpdated })]
      );
      if (srcUpdated > 0) {
        console.log(`[Backfill] RSS source names cleaned: ${srcUpdated} rows updated`);
      }
    }
  } catch (err) {
    console.error("RSS source name backfill (non-fatal):", err);
  }

  try {
    const AREA_IMPORT_KEY = 'area_places_import_pineville_southpark_indianland_ayrsley_v1';
    const { pool: areaPool } = await import("./db");
    const [existingAreaKey] = (await areaPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [AREA_IMPORT_KEY]
    )).rows;
    if (existingAreaKey) {
      console.log("[PlacesImport] Target area import already queued, skipping");
    } else {
      const { runImportJob } = await import("./google-places");
      const { storage: areaStorage } = await import("./storage");
      const AREA_SEARCHES = [
        { query: "restaurants in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "hair salon in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "dentist in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "auto repair in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "boutique shops in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "pet groomer veterinarian in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "daycare tutoring in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "senior care home health in Pineville NC", hub: "1fd2ed4b-3199-44ea-87c5-235bbe8dc33e", zip: "28134" },
        { query: "restaurants in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "hair salon spa in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "dentist doctor in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "boutique shops in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "yoga fitness studio in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "pet groomer veterinarian in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "daycare preschool tutoring in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "senior care assisted living in SouthPark Charlotte NC", hub: "79efde6c-7f6e-4a56-97ac-c197c6ac61c0", zip: "28211" },
        { query: "restaurants in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "hair salon in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "dentist in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "auto repair in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "shops in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "pet groomer veterinarian in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "daycare tutoring in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "senior care home health in Indian Land SC", hub: "7ab4e4bb-1b1b-41d6-8338-ff9a4de5dd04", zip: "29707" },
        { query: "restaurants in Ayrsley Charlotte NC", hub: null, zip: "28217" },
        { query: "salon spa in Ayrsley Charlotte NC", hub: null, zip: "28217" },
        { query: "shops services in Ayrsley Charlotte NC", hub: null, zip: "28217" },
        { query: "pet services in Ayrsley Charlotte NC", hub: null, zip: "28217" },
        { query: "daycare family services in Ayrsley Charlotte NC", hub: null, zip: "28217" },
      ];

      let totalImported = 0;
      let totalSkipped = 0;
      let jobsCompleted = 0;
      let jobsFailed = 0;

      console.log(`[PlacesImport] Starting target area import: ${AREA_SEARCHES.length} searches across Pineville, SouthPark, Indian Land, Ayrsley`);

      for (const search of AREA_SEARCHES) {
        try {
          const job = await areaStorage.createPlaceImportJob({
            mode: "text_search",
            areaMode: "zip",
            zipCode: search.zip,
            queryText: search.query,
            categoryKeyword: search.query.split(" in ")[0] || search.query,
            status: "queued",
            requestedCount: 20,
            autoPublish: true,
            importedCount: 0,
            ...(search.hub ? { hubRegionId: search.hub } : {}),
          });

          const summary = await runImportJob(job.id);
          jobsCompleted++;
          totalImported += summary.imported;
          totalSkipped += summary.skipped;

          console.log(`[PlacesImport] "${search.query}" → found: ${summary.totalFound}, imported: ${summary.imported}, skipped: ${summary.skipped}${summary.skipReasons.chain_brand ? ` (chains: ${summary.skipReasons.chain_brand})` : ""}`);

          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          jobsFailed++;
          if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
            console.log(`[PlacesImport] Daily API limit reached after ${jobsCompleted} jobs. Will resume on next restart.`);
            break;
          }
          console.error(`[PlacesImport] Failed: "${search.query}":`, err.message);
        }
      }

      await areaPool.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
        [AREA_IMPORT_KEY, JSON.stringify({ completedAt: new Date().toISOString(), imported: totalImported, skipped: totalSkipped, jobs: jobsCompleted, failed: jobsFailed })]
      );
      console.log(`[PlacesImport] Target area import complete: ${jobsCompleted} jobs, ${totalImported} imported, ${totalSkipped} skipped, ${jobsFailed} failed`);
    }
  } catch (err) {
    console.error("Target area places import (non-fatal):", err);
  }

  try {
    const WHITEHALL_KEY = 'area_places_import_whitehall_v1';
    const { pool: whPool } = await import("./db");
    const [whExists] = (await whPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [WHITEHALL_KEY]
    )).rows;
    if (whExists) {
      console.log("[PlacesImport] Whitehall import already completed, skipping");
    } else {
      const { runImportJob } = await import("./google-places");
      const { storage: whStorage } = await import("./storage");
      const WH_SEARCHES = [
        { query: "restaurants in Whitehall Charlotte NC", zip: "28273" },
        { query: "hair salon spa in Whitehall Charlotte NC", zip: "28273" },
        { query: "dentist doctor in Whitehall Charlotte NC", zip: "28273" },
        { query: "auto repair in Whitehall Charlotte NC", zip: "28273" },
        { query: "shops boutique in Whitehall Charlotte NC", zip: "28273" },
        { query: "pet groomer veterinarian in Whitehall Charlotte NC", zip: "28273" },
        { query: "daycare tutoring in Whitehall Charlotte NC", zip: "28273" },
        { query: "senior care home health in Whitehall Charlotte NC", zip: "28273" },
      ];

      let whImported = 0, whSkipped = 0, whJobs = 0, whFailed = 0;
      console.log(`[PlacesImport] Starting Whitehall import: ${WH_SEARCHES.length} searches`);

      for (const search of WH_SEARCHES) {
        try {
          const job = await whStorage.createPlaceImportJob({
            mode: "text_search",
            areaMode: "zip",
            zipCode: search.zip,
            queryText: search.query,
            categoryKeyword: search.query.split(" in ")[0] || search.query,
            status: "queued",
            requestedCount: 20,
            autoPublish: true,
            importedCount: 0,
          });
          const summary = await runImportJob(job.id);
          whJobs++;
          whImported += summary.imported;
          whSkipped += summary.skipped;
          console.log(`[PlacesImport] "${search.query}" → found: ${summary.totalFound}, imported: ${summary.imported}, skipped: ${summary.skipped}`);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          whFailed++;
          if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
            console.log(`[PlacesImport] Daily API limit reached. Will resume on next restart.`);
            break;
          }
          console.error(`[PlacesImport] Failed: "${search.query}":`, err.message);
        }
      }

      await whPool.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
        [WHITEHALL_KEY, JSON.stringify({ completedAt: new Date().toISOString(), imported: whImported, skipped: whSkipped, jobs: whJobs, failed: whFailed })]
      );
      console.log(`[PlacesImport] Whitehall import complete: ${whJobs} jobs, ${whImported} imported, ${whSkipped} skipped`);
    }
  } catch (err) {
    console.error("Whitehall places import (non-fatal):", err);
  }

  try {
    const COFFEE_KEY = 'area_places_import_coffee_v1';
    const { pool: cfPool } = await import("./db");
    const [cfExists] = (await cfPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [COFFEE_KEY]
    )).rows;
    if (cfExists) {
      console.log("[PlacesImport] Coffee shop import already completed, skipping");
    } else {
      const { runImportJob } = await import("./google-places");
      const { storage: cfStorage } = await import("./storage");
      const COFFEE_SEARCHES = [
        { query: "coffee shop cafe in Pineville NC", zip: "28134" },
        { query: "coffee shop cafe in SouthPark Charlotte NC", zip: "28211" },
        { query: "coffee shop cafe in Indian Land SC", zip: "29707" },
        { query: "coffee shop cafe in Whitehall Charlotte NC", zip: "28273" },
        { query: "coffee shop cafe in Ballantyne Charlotte NC", zip: "28277" },
        { query: "coffee shop cafe in Uptown Charlotte NC", zip: "28202" },
      ];

      let cfImported = 0, cfSkipped = 0, cfJobs = 0, cfFailed = 0;
      console.log(`[PlacesImport] Starting coffee shop import: ${COFFEE_SEARCHES.length} searches`);

      for (const search of COFFEE_SEARCHES) {
        try {
          const job = await cfStorage.createPlaceImportJob({
            mode: "text_search",
            areaMode: "zip",
            zipCode: search.zip,
            queryText: search.query,
            categoryKeyword: search.query.split(" in ")[0] || search.query,
            status: "queued",
            requestedCount: 20,
            autoPublish: true,
            importedCount: 0,
          });
          const summary = await runImportJob(job.id);
          cfJobs++;
          cfImported += summary.imported;
          cfSkipped += summary.skipped;
          console.log(`[PlacesImport] "${search.query}" → found: ${summary.totalFound}, imported: ${summary.imported}, skipped: ${summary.skipped}`);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          cfFailed++;
          if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
            console.log(`[PlacesImport] Daily API limit reached. Will resume on next restart.`);
            break;
          }
          console.error(`[PlacesImport] Failed: "${search.query}":`, err.message);
        }
      }

      await cfPool.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
        [COFFEE_KEY, JSON.stringify({ completedAt: new Date().toISOString(), imported: cfImported, skipped: cfSkipped, jobs: cfJobs, failed: cfFailed })]
      );
      console.log(`[PlacesImport] Coffee shop import complete: ${cfJobs} jobs, ${cfImported} imported, ${cfSkipped} skipped`);
    }
  } catch (err) {
    console.error("Coffee shop places import (non-fatal):", err);
  }

  try {
    const FM_KEY = 'area_places_import_fortmill_v1';
    const { pool: fmPool } = await import("./db");
    const [fmExists] = (await fmPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [FM_KEY]
    )).rows;
    if (fmExists) {
      console.log("[PlacesImport] Fort Mill import already completed, skipping");
    } else {
      const { runImportJob } = await import("./google-places");
      const { storage: fmStorage } = await import("./storage");
      const FM_SEARCHES = [
        { query: "restaurants in Fort Mill SC", zip: "29708" },
        { query: "hair salon barber in Fort Mill SC", zip: "29708" },
        { query: "dentist doctor in Fort Mill SC", zip: "29708" },
        { query: "auto repair mechanic in Fort Mill SC", zip: "29708" },
        { query: "shops boutique in Fort Mill SC", zip: "29708" },
        { query: "pet groomer veterinarian in Fort Mill SC", zip: "29708" },
        { query: "fitness gym yoga in Fort Mill SC", zip: "29708" },
        { query: "daycare tutoring in Fort Mill SC", zip: "29708" },
        { query: "coffee shop cafe in Fort Mill SC", zip: "29708" },
        { query: "senior care home health in Fort Mill SC", zip: "29708" },
        { query: "restaurants in Tega Cay SC", zip: "29715" },
        { query: "shops boutique services in Tega Cay SC", zip: "29715" },
      ];

      let fmImported = 0, fmSkipped = 0, fmJobs = 0, fmFailed = 0, fmHitLimit = false;
      console.log(`[PlacesImport] Starting Fort Mill import: ${FM_SEARCHES.length} searches`);

      for (const search of FM_SEARCHES) {
        try {
          const job = await fmStorage.createPlaceImportJob({
            mode: "text_search",
            areaMode: "zip",
            zipCode: search.zip,
            queryText: search.query,
            categoryKeyword: search.query.split(" in ")[0] || search.query,
            status: "queued",
            requestedCount: 20,
            autoPublish: true,
            importedCount: 0,
          });
          const summary = await runImportJob(job.id);
          fmJobs++;
          fmImported += summary.imported;
          fmSkipped += summary.skipped;
          console.log(`[PlacesImport] "${search.query}" → found: ${summary.totalFound}, imported: ${summary.imported}, skipped: ${summary.skipped}`);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          fmFailed++;
          if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
            console.log(`[PlacesImport] Daily API limit reached. Will resume on next restart.`);
            fmHitLimit = true;
            break;
          }
          console.error(`[PlacesImport] Failed: "${search.query}":`, err.message);
        }
      }

      if (!fmHitLimit) {
        await fmPool.query(
          `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
          [FM_KEY, JSON.stringify({ completedAt: new Date().toISOString(), imported: fmImported, skipped: fmSkipped, jobs: fmJobs, failed: fmFailed })]
        );
        console.log(`[PlacesImport] Fort Mill import complete: ${fmJobs} jobs, ${fmImported} imported, ${fmSkipped} skipped`);
      }
    }
  } catch (err) {
    console.error("Fort Mill places import (non-fatal):", err);
  }

  try {
    const CW_KEY = 'area_places_import_carowinds_v1';
    const { pool: cwPool } = await import("./db");
    const [cwExists] = (await cwPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [CW_KEY]
    )).rows;
    if (cwExists) {
      console.log("[PlacesImport] Carowinds corridor import already completed, skipping");
    } else {
      const { runImportJob } = await import("./google-places");
      const { storage: cwStorage } = await import("./storage");
      const CW_SEARCHES = [
        { query: "restaurants near Carowinds Blvd Charlotte NC", zip: "28273" },
        { query: "shops services near Carowinds Charlotte NC", zip: "28273" },
        { query: "auto repair near Carowinds Blvd Charlotte NC", zip: "28273" },
        { query: "restaurants near Carowinds Fort Mill SC", zip: "29708" },
        { query: "entertainment attractions family fun near Carowinds Charlotte NC", zip: "28273" },
        { query: "restaurants shops in Pineville NC near Carowinds", zip: "28134" },
      ];

      let cwImported = 0, cwSkipped = 0, cwJobs = 0, cwFailed = 0, cwHitLimit = false;
      console.log(`[PlacesImport] Starting Carowinds corridor import: ${CW_SEARCHES.length} searches`);

      for (const search of CW_SEARCHES) {
        try {
          const job = await cwStorage.createPlaceImportJob({
            mode: "text_search",
            areaMode: "zip",
            zipCode: search.zip,
            queryText: search.query,
            categoryKeyword: search.query.split(" in ")[0] || search.query,
            status: "queued",
            requestedCount: 20,
            autoPublish: true,
            importedCount: 0,
          });
          const summary = await runImportJob(job.id);
          cwJobs++;
          cwImported += summary.imported;
          cwSkipped += summary.skipped;
          console.log(`[PlacesImport] "${search.query}" → found: ${summary.totalFound}, imported: ${summary.imported}, skipped: ${summary.skipped}`);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          cwFailed++;
          if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
            console.log(`[PlacesImport] Daily API limit reached. Will resume on next restart.`);
            cwHitLimit = true;
            break;
          }
          console.error(`[PlacesImport] Failed: "${search.query}":`, err.message);
        }
      }

      if (!cwHitLimit) {
        await cwPool.query(
          `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
          [CW_KEY, JSON.stringify({ completedAt: new Date().toISOString(), imported: cwImported, skipped: cwSkipped, jobs: cwJobs, failed: cwFailed })]
        );
        console.log(`[PlacesImport] Carowinds corridor import complete: ${cwJobs} jobs, ${cwImported} imported, ${cwSkipped} skipped`);
      }
    }
  } catch (err) {
    console.error("Carowinds corridor places import (non-fatal):", err);
  }

  try {
    const SC_KEY = 'area_places_import_steelecreek_v1';
    const { pool: scPool } = await import("./db");
    const [scExists] = (await scPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [SC_KEY]
    )).rows;
    if (scExists) {
      console.log("[PlacesImport] Steele Creek import already completed, skipping");
    } else {
      const { runImportJob } = await import("./google-places");
      const { storage: scStorage } = await import("./storage");
      const SC_SEARCHES = [
        { query: "restaurants in Steele Creek Charlotte NC", zip: "28278" },
        { query: "hair salon barber in Steele Creek Charlotte NC", zip: "28278" },
        { query: "dentist doctor in Steele Creek Charlotte NC", zip: "28278" },
        { query: "auto repair mechanic in Steele Creek Charlotte NC", zip: "28278" },
        { query: "shops boutique in Steele Creek Charlotte NC", zip: "28278" },
        { query: "pet groomer veterinarian in Steele Creek Charlotte NC", zip: "28278" },
        { query: "fitness gym yoga in Steele Creek Charlotte NC", zip: "28278" },
        { query: "daycare tutoring in Steele Creek Charlotte NC", zip: "28278" },
        { query: "coffee shop cafe in Steele Creek Charlotte NC", zip: "28278" },
        { query: "senior care home health in Steele Creek Charlotte NC", zip: "28278" },
      ];

      let scImported = 0, scSkipped = 0, scJobs = 0, scFailed = 0, scHitLimit = false;
      console.log(`[PlacesImport] Starting Steele Creek import: ${SC_SEARCHES.length} searches`);

      for (const search of SC_SEARCHES) {
        try {
          const job = await scStorage.createPlaceImportJob({
            mode: "text_search",
            areaMode: "zip",
            zipCode: search.zip,
            queryText: search.query,
            categoryKeyword: search.query.split(" in ")[0] || search.query,
            status: "queued",
            requestedCount: 20,
            autoPublish: true,
            importedCount: 0,
          });
          const summary = await runImportJob(job.id);
          scJobs++;
          scImported += summary.imported;
          scSkipped += summary.skipped;
          console.log(`[PlacesImport] "${search.query}" → found: ${summary.totalFound}, imported: ${summary.imported}, skipped: ${summary.skipped}`);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          scFailed++;
          if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
            console.log(`[PlacesImport] Daily API limit reached. Will resume on next restart.`);
            scHitLimit = true;
            break;
          }
          console.error(`[PlacesImport] Failed: "${search.query}":`, err.message);
        }
      }

      if (!scHitLimit) {
        await scPool.query(
          `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
          [SC_KEY, JSON.stringify({ completedAt: new Date().toISOString(), imported: scImported, skipped: scSkipped, jobs: scJobs, failed: scFailed })]
        );
        console.log(`[PlacesImport] Steele Creek import complete: ${scJobs} jobs, ${scImported} imported, ${scSkipped} skipped`);
      }
    }
  } catch (err) {
    console.error("Steele Creek places import (non-fatal):", err);
  }

  try {
    const { pool: mlsPool } = await import("./db");
    await mlsPool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mls_embed_url TEXT`);
    console.log("[Housing] mls_embed_url column ready");
  } catch (err) {
    console.error("MLS embed column migration (non-fatal):", err);
  }

  try {
    const H_KEY = 'area_places_import_housing_v1';
    const { pool: hPool } = await import("./db");
    const [hExists] = (await hPool.query(
      `SELECT value FROM platform_settings WHERE key = $1`, [H_KEY]
    )).rows;
    if (hExists) {
      console.log("[PlacesImport] Housing import already completed, skipping");
    } else {
      const { runImportJob } = await import("./google-places");
      const { storage: hStorage } = await import("./storage");

      const HOUSING_SEARCHES = [
        { query: "apartment communities in Charlotte NC 28202", zip: "28202" },
        { query: "apartment complex in Charlotte NC 28203", zip: "28203" },
        { query: "apartment communities in Charlotte NC 28204", zip: "28204" },
        { query: "apartment complex in Charlotte NC 28205", zip: "28205" },
        { query: "apartment communities in Charlotte NC 28207", zip: "28207" },
        { query: "apartment complex in Charlotte NC 28209", zip: "28209" },
        { query: "apartment communities in Charlotte NC 28210", zip: "28210" },
        { query: "apartment complex in Charlotte NC 28211", zip: "28211" },
        { query: "apartment communities in Charlotte NC 28212", zip: "28212" },
        { query: "apartment complex in Charlotte NC 28226", zip: "28226" },
        { query: "apartment communities in Charlotte NC 28270", zip: "28270" },
        { query: "apartment complex in Charlotte NC 28277", zip: "28277" },
        { query: "apartment communities in Charlotte NC 28278", zip: "28278" },
        { query: "apartment communities in Huntersville NC 28078", zip: "28078" },
        { query: "apartment communities in Mooresville NC 28117", zip: "28117" },
        { query: "apartment communities in Fort Mill SC 29708", zip: "29708" },
        { query: "apartment communities in Indian Land SC 29707", zip: "29707" },
        { query: "real estate agency in Charlotte NC 28202", zip: "28202" },
        { query: "real estate agency in Charlotte NC 28203", zip: "28203" },
        { query: "real estate agency in Charlotte NC 28204", zip: "28204" },
        { query: "real estate agency in Charlotte NC 28209", zip: "28209" },
        { query: "real estate agency in Charlotte NC 28210", zip: "28210" },
        { query: "real estate agency in Charlotte NC 28211", zip: "28211" },
        { query: "real estate agency in Charlotte NC 28226", zip: "28226" },
        { query: "real estate agency in Charlotte NC 28277", zip: "28277" },
        { query: "real estate agent realtor in Charlotte NC 28205", zip: "28205" },
        { query: "real estate agent realtor in Matthews NC 28105", zip: "28105" },
        { query: "real estate agent in Huntersville NC 28078", zip: "28078" },
        { query: "real estate agent in Fort Mill SC 29708", zip: "29708" },
        { query: "property management company in Charlotte NC 28202", zip: "28202" },
        { query: "property management company in Charlotte NC 28203", zip: "28203" },
        { query: "property management company in Charlotte NC 28209", zip: "28209" },
        { query: "property management company in Charlotte NC 28210", zip: "28210" },
        { query: "property management company in Charlotte NC 28277", zip: "28277" },
        { query: "property management in Matthews NC 28105", zip: "28105" },
      ];

      const { categories: catTable } = await import("@shared/schema");
      const { db: hDb } = await import("./db");
      const allCats = await hDb.select().from(catTable);
      const catBySlug = new Map(allCats.map((c: { slug: string; id: string }) => [c.slug, c.id]));

      const HOUSING_SLUG_MAP: Record<string, string[]> = {
        "apartment": ["apartment-communities"],
        "real estate": ["real-estate", "residential-real-estate"],
        "realtor": ["real-estate", "residential-real-estate"],
        "property management": ["property-management"],
      };

      function getHousingCategoryIds(query: string): string[] {
        const lower = query.toLowerCase();
        let slugs: string[] = [];
        if (lower.includes("apartment")) slugs = HOUSING_SLUG_MAP["apartment"];
        else if (lower.includes("property management")) slugs = HOUSING_SLUG_MAP["property management"];
        else if (lower.includes("realtor")) slugs = HOUSING_SLUG_MAP["realtor"];
        else if (lower.includes("real estate")) slugs = HOUSING_SLUG_MAP["real estate"];
        return slugs.map(s => catBySlug.get(s)).filter((id): id is string => !!id);
      }

      let hImported = 0, hSkipped = 0, hJobs = 0, hFailed = 0, hHitLimit = false;
      console.log(`[PlacesImport] Starting Housing import: ${HOUSING_SEARCHES.length} searches`);

      for (const search of HOUSING_SEARCHES) {
        try {
          const job = await hStorage.createPlaceImportJob({
            mode: "text_search",
            areaMode: "zip",
            zipCode: search.zip,
            queryText: search.query,
            categoryKeyword: search.query.split(" in ")[0] || search.query,
            status: "queued",
            requestedCount: 20,
            autoPublish: true,
            importedCount: 0,
          });
          const summary = await runImportJob(job.id, { overrideCategoryIds: getHousingCategoryIds(search.query) });
          hJobs++;
          hImported += summary.imported;
          hSkipped += summary.skipped;
          console.log(`[PlacesImport] Housing "${search.query}" → found: ${summary.totalFound}, imported: ${summary.imported}, skipped: ${summary.skipped}`);
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          hFailed++;
          if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
            console.log(`[PlacesImport] Daily API limit reached during housing import. Will resume on next restart.`);
            hHitLimit = true;
            break;
          }
          console.error(`[PlacesImport] Housing failed: "${search.query}":`, err.message);
        }
      }

      if (!hHitLimit) {
        await hPool.query(
          `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
          [H_KEY, JSON.stringify({ completedAt: new Date().toISOString(), imported: hImported, skipped: hSkipped, jobs: hJobs, failed: hFailed })]
        );
        console.log(`[PlacesImport] Housing import complete: ${hJobs} jobs, ${hImported} imported, ${hSkipped} skipped`);
      }
    }
  } catch (err) {
    console.error("Housing places import (non-fatal):", err);
  }

  log("Seeds and tier prices loaded");
})();
