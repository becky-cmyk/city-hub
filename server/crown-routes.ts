import { Router, type Request, type Response } from "express";
import { db, pool } from "./db";
import { z } from "zod";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import {
  crownCategories, crownParticipants, crownVotes, crownWinners, crownVoteFlags,
  crownHubCategoryAssignments, crownInvitations, crownEvents,
  crownParentProfiles, crownChildLocations,
  crownHubActivations, crownHubConfig,
  insertCrownCategorySchema, insertCrownParticipantSchema,
  insertCrownHubCategoryAssignmentSchema, insertCrownEventSchema,
  insertCrownParentProfileSchema, insertCrownChildLocationSchema,
  CROWN_VOTE_THRESHOLDS, CROWN_CATEGORIES_LAUNCH,
  publicUsers, cities, regions, businesses, emailTemplates,
  type CrownCategory, type CrownParticipant, type CrownVote, type CrownWinner, type CrownVoteFlag,
  type CrownParentProfile, type CrownChildLocation,
  type CrownHubActivation, type CrownHubConfig,
  type CrownInvitation,
} from "@shared/schema";
import crypto from "crypto";

type CrownInvitationChannel = "email" | "sms" | "admin_manual" | "printed_letter" | "qr_code" | "creator_referral" | "event_outreach";
type CrownInvitationStatus = "NOT_SENT" | "SENT" | "VIEWED" | "CLAIM_STARTED" | "CLAIM_COMPLETED" | "DECLINED" | "EXPIRED";
type CrownInviteTier = "anchor" | "strong" | "emerging";
type CrownParticipantStatus = "candidate" | "invited" | "accepted" | "verified_participant" | "nominee" | "qualified_nominee" | "crown_winner";

const VALID_CHANNELS: Set<string> = new Set(["email", "sms", "admin_manual", "printed_letter", "qr_code", "creator_referral", "event_outreach"]);
const VALID_TIERS: Set<string> = new Set(["anchor", "strong", "emerging"]);
const VALID_STATUSES: Set<string> = new Set(["candidate", "invited", "accepted", "verified_participant", "nominee", "qualified_nominee", "crown_winner"]);

function toChannel(val: string | undefined, fallback: CrownInvitationChannel = "email"): CrownInvitationChannel {
  return val && VALID_CHANNELS.has(val) ? val as CrownInvitationChannel : fallback;
}
function toTier(score: number): CrownInviteTier {
  return score >= 80 ? "anchor" : score >= 50 ? "strong" : "emerging";
}

type AdminMiddleware = (req: Request, res: Response, next: Function) => void;
let _adminMiddleware: AdminMiddleware | null = null;

export function initCrownRoutes(adminMiddleware: AdminMiddleware) {
  _adminMiddleware = adminMiddleware;
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!_adminMiddleware) {
    return res.status(500).json({ message: "Admin middleware not initialized" });
  }
  _adminMiddleware(req, res, next);
}

async function getAuthorizedCityId(req: Request, requestedCityId?: string): Promise<{ cityId: string | null; forbidden: boolean }> {
  const session = req.session as Record<string, unknown>;
  const userId = session.userId as string | undefined;
  if (!userId) return { cityId: null, forbidden: true };
  const { storage } = await import("./storage");
  const user = await storage.getUserById(userId);
  if (!user) return { cityId: null, forbidden: true };
  const platformRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"];
  if (platformRoles.includes(user.role || "")) {
    return { cityId: requestedCityId || null, forbidden: false };
  }
  if (user.role === "CITY_ADMIN" && user.cityId) {
    if (requestedCityId && requestedCityId !== user.cityId) {
      return { cityId: null, forbidden: true };
    }
    return { cityId: user.cityId, forbidden: false };
  }
  return { cityId: null, forbidden: true };
}

const router = Router();

function getPublicUserId(req: Request): string | null {
  return (req.session as any).publicUserId || null;
}

async function requireVerifiedUser(req: Request, res: Response, next: Function) {
  const userId = getPublicUserId(req);
  if (!userId) return res.status(401).json({ message: "Login required" });
  const [user] = await db.select({ isVerified: publicUsers.isVerified }).from(publicUsers).where(eq(publicUsers.id, userId));
  if (!user) return res.status(401).json({ message: "Account not found" });
  if (!user.isVerified) return res.status(403).json({ message: "Verified account required to vote" });
  next();
}

async function ensureCrownTables() {
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crown_participant_type') THEN
        CREATE TYPE crown_participant_type AS ENUM ('business','creator','networking_group','community_org');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crown_participant_status') THEN
        CREATE TYPE crown_participant_status AS ENUM ('candidate','invited','accepted','verified_participant','nominee','qualified_nominee','crown_winner');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crown_competition_level') THEN
        CREATE TYPE crown_competition_level AS ENUM ('high','mid','community');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS crown_categories (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      name VARCHAR NOT NULL,
      slug VARCHAR NOT NULL,
      description TEXT,
      competition_level crown_competition_level NOT NULL DEFAULT 'mid',
      vote_threshold INTEGER NOT NULL DEFAULT 40,
      participant_type crown_participant_type NOT NULL DEFAULT 'business',
      hub_id VARCHAR,
      season_year INTEGER NOT NULL DEFAULT 2026,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS cc_city_idx ON crown_categories(city_id);
    CREATE UNIQUE INDEX IF NOT EXISTS cc_city_slug_year_idx ON crown_categories(city_id, slug, season_year);

    CREATE TABLE IF NOT EXISTS crown_participants (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      category_id VARCHAR NOT NULL REFERENCES crown_categories(id) ON DELETE CASCADE,
      hub_id VARCHAR,
      parent_id VARCHAR,
      business_id VARCHAR,
      name VARCHAR NOT NULL,
      slug VARCHAR NOT NULL,
      participant_type crown_participant_type NOT NULL DEFAULT 'business',
      status crown_participant_status NOT NULL DEFAULT 'candidate',
      email VARCHAR,
      phone VARCHAR,
      image_url TEXT,
      bio TEXT,
      website_url TEXT,
      social_links JSONB,
      invite_token VARCHAR,
      invited_at TIMESTAMP,
      verified_at TIMESTAMP,
      nominated_at TIMESTAMP,
      has_paid BOOLEAN NOT NULL DEFAULT false,
      stripe_session_id VARCHAR,
      vote_count INTEGER NOT NULL DEFAULT 0,
      season_year INTEGER NOT NULL DEFAULT 2026,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cp_city_idx ON crown_participants(city_id);
    CREATE INDEX IF NOT EXISTS cp_category_idx ON crown_participants(category_id);
    CREATE INDEX IF NOT EXISTS cp_parent_idx ON crown_participants(parent_id);
    CREATE INDEX IF NOT EXISTS cp_status_idx ON crown_participants(status);
    CREATE INDEX IF NOT EXISTS cp_invite_token_idx ON crown_participants(invite_token);
    CREATE UNIQUE INDEX IF NOT EXISTS cp_category_slug_year_idx ON crown_participants(category_id, slug, season_year);

    CREATE TABLE IF NOT EXISTS crown_votes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      participant_id VARCHAR NOT NULL REFERENCES crown_participants(id) ON DELETE CASCADE,
      category_id VARCHAR NOT NULL REFERENCES crown_categories(id) ON DELETE CASCADE,
      city_id VARCHAR NOT NULL,
      hub_id VARCHAR,
      voter_user_id VARCHAR REFERENCES public_users(id),
      voter_ip VARCHAR,
      voter_fingerprint VARCHAR,
      voter_email VARCHAR,
      is_flagged BOOLEAN NOT NULL DEFAULT false,
      flag_reason VARCHAR,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cv_participant_idx ON crown_votes(participant_id);
    CREATE INDEX IF NOT EXISTS cv_category_idx ON crown_votes(category_id);
    CREATE INDEX IF NOT EXISTS cv_voter_idx ON crown_votes(voter_user_id);
    CREATE INDEX IF NOT EXISTS cv_ip_idx ON crown_votes(voter_ip);
    CREATE INDEX IF NOT EXISTS cv_fingerprint_idx ON crown_votes(voter_fingerprint);

    CREATE TABLE IF NOT EXISTS crown_winners (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      category_id VARCHAR NOT NULL REFERENCES crown_categories(id) ON DELETE CASCADE,
      participant_id VARCHAR NOT NULL REFERENCES crown_participants(id) ON DELETE CASCADE,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      season_year INTEGER NOT NULL DEFAULT 2026,
      rank INTEGER NOT NULL DEFAULT 1,
      announced_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cw_category_idx ON crown_winners(category_id);
    CREATE INDEX IF NOT EXISTS cw_city_year_idx ON crown_winners(city_id, season_year);
    CREATE UNIQUE INDEX IF NOT EXISTS cw_category_rank_year_idx ON crown_winners(category_id, rank, season_year);

    CREATE TABLE IF NOT EXISTS crown_vote_flags (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      vote_id VARCHAR NOT NULL REFERENCES crown_votes(id) ON DELETE CASCADE,
      flag_type VARCHAR NOT NULL,
      reason TEXT,
      resolved_by VARCHAR,
      resolved_at TIMESTAMP,
      resolution VARCHAR,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cvf_vote_idx ON crown_vote_flags(vote_id);
    CREATE INDEX IF NOT EXISTS cvf_type_idx ON crown_vote_flags(flag_type);

    CREATE TABLE IF NOT EXISTS crown_hub_category_assignments (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      hub_id VARCHAR NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
      category_id VARCHAR NOT NULL REFERENCES crown_categories(id) ON DELETE CASCADE,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      season_year INTEGER NOT NULL DEFAULT 2026,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS chca_hub_idx ON crown_hub_category_assignments(hub_id);
    CREATE INDEX IF NOT EXISTS chca_category_idx ON crown_hub_category_assignments(category_id);
    CREATE UNIQUE INDEX IF NOT EXISTS chca_hub_cat_year_idx ON crown_hub_category_assignments(hub_id, category_id, season_year);

    CREATE TABLE IF NOT EXISTS crown_invitations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      participant_id VARCHAR NOT NULL REFERENCES crown_participants(id) ON DELETE CASCADE,
      category_id VARCHAR NOT NULL REFERENCES crown_categories(id) ON DELETE CASCADE,
      hub_id VARCHAR,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      invite_token VARCHAR NOT NULL,
      invited_by VARCHAR,
      invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMP,
      declined_at TIMESTAMP,
      expires_at TIMESTAMP,
      status VARCHAR NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS ci_participant_idx ON crown_invitations(participant_id);
    CREATE INDEX IF NOT EXISTS ci_token_idx ON crown_invitations(invite_token);
    CREATE INDEX IF NOT EXISTS ci_city_idx ON crown_invitations(city_id);

    CREATE TABLE IF NOT EXISTS crown_events (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      hub_id VARCHAR,
      category_id VARCHAR,
      participant_id VARCHAR,
      parent_profile_id VARCHAR,
      title VARCHAR NOT NULL,
      description TEXT,
      event_type VARCHAR NOT NULL DEFAULT 'meetup',
      start_at TIMESTAMP,
      end_at TIMESTAMP,
      location VARCHAR,
      is_recurring BOOLEAN NOT NULL DEFAULT false,
      recurrence_rule VARCHAR,
      max_attendees INTEGER,
      season_year INTEGER NOT NULL DEFAULT 2026,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ce_city_idx ON crown_events(city_id);
    CREATE INDEX IF NOT EXISTS ce_hub_idx ON crown_events(hub_id);
    CREATE INDEX IF NOT EXISTS ce_category_idx ON crown_events(category_id);

    CREATE TABLE IF NOT EXISTS crown_parent_profiles (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      participant_id VARCHAR NOT NULL REFERENCES crown_participants(id) ON DELETE CASCADE,
      org_name VARCHAR NOT NULL,
      org_type VARCHAR NOT NULL DEFAULT 'business',
      total_locations INTEGER NOT NULL DEFAULT 1,
      is_locally_owned BOOLEAN NOT NULL DEFAULT true,
      is_franchise BOOLEAN NOT NULL DEFAULT false,
      headquarters_city VARCHAR,
      year_established INTEGER,
      contact_email VARCHAR,
      contact_phone VARCHAR,
      website_url VARCHAR,
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cpp_participant_idx ON crown_parent_profiles(participant_id);
    CREATE UNIQUE INDEX IF NOT EXISTS cpp_participant_uniq ON crown_parent_profiles(participant_id);

    CREATE TABLE IF NOT EXISTS crown_child_locations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      parent_profile_id VARCHAR NOT NULL REFERENCES crown_parent_profiles(id) ON DELETE CASCADE,
      participant_id VARCHAR NOT NULL REFERENCES crown_participants(id) ON DELETE CASCADE,
      location_name VARCHAR NOT NULL,
      location_type VARCHAR NOT NULL DEFAULT 'branch',
      address VARCHAR,
      neighborhood VARCHAR,
      hub_id VARCHAR,
      is_active BOOLEAN NOT NULL DEFAULT true,
      chapter_activity_score INTEGER NOT NULL DEFAULT 0,
      event_attendance_count INTEGER NOT NULL DEFAULT 0,
      last_activity_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ccl_parent_idx ON crown_child_locations(parent_profile_id);
    CREATE INDEX IF NOT EXISTS ccl_participant_idx ON crown_child_locations(participant_id);
    CREATE INDEX IF NOT EXISTS ccl_hub_idx ON crown_child_locations(hub_id);
  `);

  try {
    await pool.query(`ALTER TABLE crown_votes ADD COLUMN IF NOT EXISTS city_id VARCHAR NOT NULL DEFAULT ''`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TABLE crown_votes ADD COLUMN IF NOT EXISTS hub_id VARCHAR`);
  } catch (_) {}
  try {
    await pool.query(`DROP INDEX IF EXISTS cv_user_category_uniq`);
  } catch (_) {}
  try {
    await pool.query(`DROP INDEX IF EXISTS cv_user_category_hub_uniq`);
  } catch (_) {}
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS cv_user_cat_hub_uniq ON crown_votes(voter_user_id, category_id, COALESCE(hub_id, '__none__'))`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TYPE crown_participant_status ADD VALUE IF NOT EXISTS 'accepted' AFTER 'invited'`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS hub_id VARCHAR`);
  } catch (_) {}
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS cp_hub_idx ON crown_participants(hub_id)`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TABLE crown_events ADD COLUMN IF NOT EXISTS participant_id VARCHAR`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TABLE crown_events ADD COLUMN IF NOT EXISTS parent_profile_id VARCHAR`);
  } catch (_) {}
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS ce_participant_idx ON crown_events(participant_id)`);
  } catch (_) {}
  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE crown_hub_status AS ENUM ('INACTIVE','SCANNING','READY_FOR_ACTIVATION','NOMINATIONS_OPEN','VOTING_OPEN','WINNERS_DECLARED','ARCHIVED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (_) {}
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crown_hub_activations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      hub_id VARCHAR NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      season_year INTEGER NOT NULL DEFAULT 2026,
      status crown_hub_status NOT NULL DEFAULT 'INACTIVE',
      categories_scanned INTEGER NOT NULL DEFAULT 0,
      categories_ready INTEGER NOT NULL DEFAULT 0,
      total_qualified_businesses INTEGER NOT NULL DEFAULT 0,
      ready_category_names JSONB NOT NULL DEFAULT '[]'::jsonb,
      launched_category_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommended_business_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      scan_results JSONB,
      last_scanned_at TIMESTAMP,
      activated_at TIMESTAMP,
      activated_by VARCHAR,
      nominations_opened_at TIMESTAMP,
      voting_opened_at TIMESTAMP,
      winners_announced_at TIMESTAMP,
      archived_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cha_hub_idx ON crown_hub_activations(hub_id);
    CREATE INDEX IF NOT EXISTS cha_city_idx ON crown_hub_activations(city_id);
    CREATE INDEX IF NOT EXISTS cha_status_idx ON crown_hub_activations(status);
    CREATE UNIQUE INDEX IF NOT EXISTS cha_hub_season_uniq ON crown_hub_activations(hub_id, season_year);

    CREATE TABLE IF NOT EXISTS crown_hub_config (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      season_year INTEGER NOT NULL DEFAULT 2026,
      min_categories_for_launch INTEGER NOT NULL DEFAULT 3,
      min_qualified_businesses INTEGER NOT NULL DEFAULT 15,
      category_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
      default_category_minimum INTEGER NOT NULL DEFAULT 5,
      scan_radius_miles INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS chc_city_year_uniq ON crown_hub_config(city_id, season_year);
  `);
  try {
    await pool.query(`ALTER TYPE pulse_signal_type ADD VALUE IF NOT EXISTS 'CROWN_HUB_READY'`);
  } catch (_) {}

  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE crown_invitation_channel AS ENUM ('email','sms','admin_manual','printed_letter','qr_code','creator_referral','event_outreach');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (_) {}
  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE crown_invitation_status AS ENUM ('NOT_SENT','SENT','VIEWED','CLAIM_STARTED','CLAIM_COMPLETED','DECLINED','EXPIRED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (_) {}
  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE crown_invite_tier AS ENUM ('anchor','strong','emerging');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (_) {}

  try { await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS crown_candidate_score INTEGER`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS invite_priority INTEGER`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS invite_tier crown_invite_tier`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS category_match_reason TEXT`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS ready_for_venue_tv BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS ready_for_creator_feature BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_participants ADD COLUMN IF NOT EXISTS ready_for_crown_story BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}

  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS invitation_channel crown_invitation_channel`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS invitation_status crown_invitation_status NOT NULL DEFAULT 'NOT_SENT'`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS claim_started_at TIMESTAMP`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS claim_completed_at TIMESTAMP`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_invitations ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMP`); } catch (_) {}
  try { await pool.query(`CREATE INDEX IF NOT EXISTS ci_invitation_status_idx ON crown_invitations(invitation_status)`); } catch (_) {}

  try { await pool.query(`ALTER TYPE email_template_key ADD VALUE IF NOT EXISTS 'crown_nomination_invite'`); } catch (_) {}
  try { await pool.query(`ALTER TYPE email_template_key ADD VALUE IF NOT EXISTS 'crown_claim_listing'`); } catch (_) {}
  try { await pool.query(`ALTER TYPE email_template_key ADD VALUE IF NOT EXISTS 'crown_follow_up'`); } catch (_) {}
  try { await pool.query(`ALTER TYPE email_classification ADD VALUE IF NOT EXISTS 'crown_outreach'`); } catch (_) {}

  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE crown_campaign_status AS ENUM ('DRAFT','READY','LAUNCHED','NOMINATIONS_OPEN','VOTING_OPEN','WINNERS_ANNOUNCED','ARCHIVED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (_) {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crown_campaigns (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      hub_id VARCHAR REFERENCES regions(id) ON DELETE CASCADE,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      season_year INTEGER NOT NULL DEFAULT 2026,
      status crown_campaign_status NOT NULL DEFAULT 'DRAFT',
      headline VARCHAR,
      subheadline VARCHAR,
      description TEXT,
      rules TEXT,
      featured_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      featured_nominees JSONB NOT NULL DEFAULT '[]'::jsonb,
      nominations_open_at TIMESTAMP,
      nominations_close_at TIMESTAMP,
      voting_open_at TIMESTAMP,
      voting_close_at TIMESTAMP,
      winners_announce_at TIMESTAMP,
      launched_at TIMESTAMP,
      archived_at TIMESTAMP,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_content JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by VARCHAR,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ccmp_city_idx ON crown_campaigns(city_id);
    CREATE INDEX IF NOT EXISTS ccmp_hub_idx ON crown_campaigns(hub_id);
    CREATE INDEX IF NOT EXISTS ccmp_status_idx ON crown_campaigns(status);
    CREATE UNIQUE INDEX IF NOT EXISTS ccmp_hub_season_uniq ON crown_campaigns(hub_id, season_year);
  `);

  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE crown_package_status AS ENUM ('active','assigned','completed','canceled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  } catch (_) {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crown_marketing_packages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR REFERENCES cities(id),
      name VARCHAR NOT NULL,
      description TEXT,
      included_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
      display_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_included_perk BOOLEAN NOT NULL DEFAULT false,
      price_cents INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cmp_city_idx ON crown_marketing_packages(city_id);
    CREATE INDEX IF NOT EXISTS cmp_active_idx ON crown_marketing_packages(is_active);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crown_package_assignments (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      package_id VARCHAR NOT NULL REFERENCES crown_marketing_packages(id) ON DELETE CASCADE,
      participant_id VARCHAR NOT NULL REFERENCES crown_participants(id) ON DELETE CASCADE,
      assigned_by VARCHAR,
      assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
      status crown_package_status NOT NULL DEFAULT 'assigned',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cpa_package_idx ON crown_package_assignments(package_id);
    CREATE INDEX IF NOT EXISTS cpa_participant_idx ON crown_package_assignments(participant_id);
    CREATE UNIQUE INDEX IF NOT EXISTS cpa_pkg_part_uniq ON crown_package_assignments(package_id, participant_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crown_campaign_config (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      city_id VARCHAR NOT NULL REFERENCES cities(id),
      season_year INTEGER NOT NULL DEFAULT 2026,
      tone VARCHAR NOT NULL DEFAULT 'community_celebration',
      award_naming_format VARCHAR NOT NULL DEFAULT 'Crown Award',
      year_format VARCHAR NOT NULL DEFAULT 'full',
      include_editorial BOOLEAN NOT NULL DEFAULT true,
      include_peoples_choice BOOLEAN NOT NULL DEFAULT true,
      enable_creator_coverage BOOLEAN NOT NULL DEFAULT true,
      enable_venue_tv BOOLEAN NOT NULL DEFAULT true,
      enable_print BOOLEAN NOT NULL DEFAULT false,
      custom_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ccc_city_year_uniq ON crown_campaign_config(city_id, season_year);
  `);

  try { await pool.query(`ALTER TABLE crown_campaigns ADD COLUMN IF NOT EXISTS ready_for_creator_feature BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_campaigns ADD COLUMN IF NOT EXISTS creator_story_requested BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_campaigns ADD COLUMN IF NOT EXISTS creator_interview_scheduled BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}
  try { await pool.query(`ALTER TABLE crown_campaigns ADD COLUMN IF NOT EXISTS distribution_log JSONB NOT NULL DEFAULT '{}'::jsonb`); } catch (_) {}

  await seedCrownEmailTemplates();
  await seedDefaultMarketingPackages();
}

async function seedDefaultMarketingPackages() {
  const packages = [
    { name: "Nominee Promo Pack", description: "Basic promotional package for all Crown nominees", included_items: ["Hub listing badge", "Category page featured placement", "Social share card"], is_included_perk: true, price_cents: 0, eligibility_rules: { min_status: "nominee" }, display_channels: ["hub_page", "social"] },
    { name: "Spotlight Pack", description: "Enhanced visibility with featured content and creator coverage", included_items: ["Creator feature story", "Pulse story draft", "Extended hub listing", "Social media kit"], is_included_perk: false, price_cents: 4900, eligibility_rules: { min_status: "nominee" }, display_channels: ["hub_page", "pulse", "social", "creator"] },
    { name: "Winner Feature Pack", description: "Premium winner celebration package", included_items: ["Winner badge and certificate", "Venue TV winner slide", "Winner announcement story", "Window cling design", "Social media winner kit"], is_included_perk: true, price_cents: 0, eligibility_rules: { min_status: "crown_winner" }, display_channels: ["hub_page", "venue_tv", "pulse", "print", "social"] },
    { name: "Print Feature Pack", description: "Print advertising and collateral bundle", included_items: ["Print ad placement", "Certificate of recognition", "Door sticker design", "Framed award insert"], is_included_perk: false, price_cents: 7900, eligibility_rules: { min_status: "nominee" }, display_channels: ["print"] },
    { name: "Event Participation Pack", description: "Crown event hosting and participation bundle", included_items: ["Event listing placement", "Sponsor badge", "Event recap coverage", "Networking access"], is_included_perk: false, price_cents: 2900, eligibility_rules: { min_status: "verified_participant" }, display_channels: ["events", "hub_page"] },
  ];
  for (const pkg of packages) {
    try {
      const exists = await pool.query(`SELECT id FROM crown_marketing_packages WHERE name = $1 LIMIT 1`, [pkg.name]);
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO crown_marketing_packages (name, description, included_items, is_included_perk, price_cents, eligibility_rules, display_channels)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [pkg.name, pkg.description, JSON.stringify(pkg.included_items), pkg.is_included_perk, pkg.price_cents, JSON.stringify(pkg.eligibility_rules), JSON.stringify(pkg.display_channels)]
        );
      }
    } catch (_) {}
  }
}

async function seedCrownEmailTemplates() {
  const templates = [
    {
      templateKey: "crown_nomination_invite",
      classification: "crown_outreach",
      name: "Crown Nomination Invitation",
      subject: "{{businessName}} — You've been nominated for a Crown Award on CLT Metro Hub!",
      htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #5B1D8F 0%, #7B2FBF 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">CLT Metro Hub</h1>
      <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">Crown Awards &bull; Charlotte's Best</p>
    </div>
    <div style="padding: 32px 32px 24px;">
      <p style="color: #1a1a2e; font-size: 18px; font-weight: 600; line-height: 1.4; margin: 0 0 16px;">Congratulations, <strong>{{businessName}}</strong>!</p>
      <p style="color: #555; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">You've been nominated for <strong>{{categoryName}}</strong> in the CLT Metro Hub Crown Awards. This is Charlotte's neighborhood-first recognition program celebrating the best local businesses, creators, and community organizations.</p>
      <p style="color: #555; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">To participate, claim your listing and activate your Hub Presence. It takes just a few minutes and unlocks community voting, featured placement, and more.</p>
      <p style="text-align: center; margin: 0 0 16px;">
        <a href="{{claimUrl}}" style="display: inline-block; padding: 16px 40px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">Claim Your Listing &amp; Accept Nomination</a>
      </p>
    </div>
    <div style="background: #f9f7fc; padding: 20px 32px; border-top: 1px solid #f0ecf5;">
      <p style="color: #777; font-size: 12px; margin: 0 0 4px; text-align: center;">This invitation expires in 14 days. Questions? Reply to this email.</p>
    </div>
    <div style="padding: 16px 32px; text-align: center; color: #aaa; font-size: 11px;">
      <p style="margin: 0 0 4px;">CLT Metro Hub Crown Awards &bull; Charlotte, NC</p>
    </div>
  </div>`,
      status: "active",
    },
    {
      templateKey: "crown_follow_up",
      classification: "crown_outreach",
      name: "Crown Follow-Up Reminder",
      subject: "Reminder: {{businessName}} — your Crown Award nomination is waiting",
      htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #5B1D8F 0%, #7B2FBF 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">CLT Metro Hub</h1>
      <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">Crown Awards &bull; Reminder</p>
    </div>
    <div style="padding: 32px 32px 24px;">
      <p style="color: #1a1a2e; font-size: 18px; font-weight: 600; line-height: 1.4; margin: 0 0 16px;">Hi <strong>{{businessName}}</strong>,</p>
      <p style="color: #555; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">Your nomination for <strong>{{categoryName}}</strong> in the Crown Awards is still waiting for you. Claim your listing to participate in Charlotte's community voting program.</p>
      <p style="text-align: center; margin: 0 0 16px;">
        <a href="{{claimUrl}}" style="display: inline-block; padding: 16px 40px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">Claim Now</a>
      </p>
    </div>
    <div style="padding: 16px 32px; text-align: center; color: #aaa; font-size: 11px;">
      <p style="margin: 0;">CLT Metro Hub Crown Awards &bull; Charlotte, NC</p>
    </div>
  </div>`,
      status: "active",
    },
    {
      templateKey: "crown_claim_listing",
      classification: "crown_outreach",
      name: "Crown Claim Listing Confirmation",
      subject: "{{businessName}} — your Crown Award claim is confirmed!",
      htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #5B1D8F 0%, #7B2FBF 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">CLT Metro Hub</h1>
      <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 13px;">Crown Awards &bull; Claim Confirmed</p>
    </div>
    <div style="padding: 32px 32px 24px;">
      <p style="color: #1a1a2e; font-size: 18px; font-weight: 600; line-height: 1.4; margin: 0 0 16px;">Welcome, <strong>{{businessName}}</strong>!</p>
      <p style="color: #555; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">Your listing for <strong>{{categoryName}}</strong> in the CLT Metro Hub Crown Awards has been claimed. You're now an active participant in Charlotte's community recognition program.</p>
      <p style="color: #555; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">Complete your profile to maximize your visibility and start receiving community votes.</p>
      <p style="text-align: center; margin: 0 0 16px;">
        <a href="{{claimUrl}}" style="display: inline-block; padding: 16px 40px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">View Your Profile</a>
      </p>
    </div>
    <div style="padding: 16px 32px; text-align: center; color: #aaa; font-size: 11px;">
      <p style="margin: 0 0 4px;">CLT Metro Hub Crown Awards &bull; Charlotte, NC</p>
    </div>
  </div>`,
      status: "active",
    },
  ];

  for (const t of templates) {
    try {
      const exists = await pool.query(
        `SELECT id FROM email_templates WHERE template_key = $1 LIMIT 1`,
        [t.templateKey]
      );
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO email_templates (id, template_key, classification, name, subject, html_body, status, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [t.templateKey, t.classification, t.name, t.subject, t.htmlBody, t.status]
        );
        console.log(`[Crown-Email] Seeded template: ${t.templateKey}`);
      }
    } catch (err) {
      console.log(`[Crown-Email] Template seed skipped for ${t.templateKey}: ${(err as Error).message}`);
    }
  }
}

let tablesReady = false;
async function ensureReady() {
  if (!tablesReady) {
    await ensureCrownTables();
    tablesReady = true;
  }
}

router.get("/api/admin/crown/categories", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const cats = await db.select().from(crownCategories)
      .where(and(eq(crownCategories.cityId, cityId), eq(crownCategories.seasonYear, seasonYear)))
      .orderBy(asc(crownCategories.sortOrder));
    res.json(cats);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/categories", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const parsed = insertCrownCategorySchema.parse(req.body);
    const [cat] = await db.insert(crownCategories).values(parsed).returning();
    res.json(cat);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
});

router.patch("/api/admin/crown/categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Record<string, any> = {};
    const allowedFields = ["name", "slug", "description", "competitionLevel", "voteThreshold", "participantType", "hubId", "isActive", "sortOrder"];
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No fields to update" });
    const [cat] = await db.update(crownCategories).set(updates).where(eq(crownCategories.id, id)).returning();
    if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json(cat);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/api/admin/crown/categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [cat] = await db.delete(crownCategories).where(eq(crownCategories.id, req.params.id)).returning();
    if (!cat) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/seed-categories", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    let created = 0;
    for (let i = 0; i < CROWN_CATEGORIES_LAUNCH.length; i++) {
      const cat = CROWN_CATEGORIES_LAUNCH[i];
      const existing = await db.select({ id: crownCategories.id }).from(crownCategories)
        .where(and(eq(crownCategories.cityId, cityId), eq(crownCategories.slug, cat.slug), eq(crownCategories.seasonYear, 2026)));
      if (existing.length === 0) {
        await db.insert(crownCategories).values({
          cityId,
          name: cat.name,
          slug: cat.slug,
          competitionLevel: cat.level,
          voteThreshold: CROWN_VOTE_THRESHOLDS[cat.level],
          participantType: cat.type,
          seasonYear: 2026,
          sortOrder: i,
        });
        created++;
      }
    }
    res.json({ created, total: CROWN_CATEGORIES_LAUNCH.length });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

const SAMPLE_PARTICIPANTS: Array<{
  catSlug: string; name: string; slug: string; type: "business" | "creator" | "networking_group";
  status: "nominee" | "verified_participant" | "candidate"; bio: string;
  isParent?: boolean; parentSlug?: string;
}> = [
  { catSlug: "best-coffee", name: "Undercurrent Coffee", slug: "undercurrent-coffee", type: "business", status: "nominee", bio: "Specialty coffee roaster in Plaza Midwood with direct-trade beans and pour-over bar." },
  { catSlug: "best-coffee", name: "Magnolia Coffee", slug: "magnolia-coffee", type: "business", status: "nominee", bio: "South End favorite known for artisan lattes, local pastries, and cozy atmosphere." },
  { catSlug: "best-coffee", name: "Daily Press Coffee", slug: "daily-press-coffee", type: "business", status: "nominee", bio: "Community-focused coffee shop in NoDa with rotating single-origin selections." },
  { catSlug: "best-restaurant", name: "The Crunkleton", slug: "the-crunkleton", type: "business", status: "nominee", bio: "Upscale neighborhood restaurant with craft cocktails and farm-to-table small plates." },
  { catSlug: "best-restaurant", name: "Soul CLT Kitchen", slug: "soul-clt-kitchen", type: "business", status: "nominee", bio: "Soul food done right with locally sourced ingredients and grandma-approved recipes." },
  { catSlug: "best-food-truck", name: "Papi Queso", slug: "papi-queso", type: "business", status: "nominee", bio: "Famous grilled cheese food truck found across Charlotte festivals and breweries." },
  { catSlug: "best-food-truck", name: "Tin Kitchen", slug: "tin-kitchen", type: "business", status: "nominee", bio: "Award-winning food truck serving globally inspired comfort food." },
  { catSlug: "best-brewery", name: "NoDa Brewing Company", slug: "noda-brewing-company", type: "business", status: "nominee", bio: "Craft brewery pioneering the Charlotte beer scene since 2011." },
  { catSlug: "best-brewery", name: "Birdsong Brewing Co", slug: "birdsong-brewing-co", type: "business", status: "nominee", bio: "Community-focused brewery in NoDa with award-winning IPAs and seasonal releases." },
  { catSlug: "best-local-creator", name: "Maya Chen Creates", slug: "maya-chen-creates", type: "creator", status: "nominee", bio: "Charlotte content creator spotlighting hidden gems, local food, and Queen City culture." },
  { catSlug: "best-local-creator", name: "CLT Views by Jordan", slug: "clt-views-jordan", type: "creator", status: "nominee", bio: "Photographer and videographer capturing Charlotte's evolving skyline and neighborhoods." },
  { catSlug: "best-networking-group", name: "Charlotte Biz Connect", slug: "charlotte-biz-connect", type: "networking_group", status: "nominee", bio: "Monthly networking events for Charlotte entrepreneurs and small business owners.", isParent: true },
  { catSlug: "best-networking-group", name: "CLT Biz Connect - South End Chapter", slug: "clt-biz-connect-south-end", type: "networking_group", status: "verified_participant", bio: "South End chapter hosting weekly coffee meetups and quarterly mixers.", parentSlug: "charlotte-biz-connect" },
  { catSlug: "best-networking-group", name: "CLT Biz Connect - NoDa Chapter", slug: "clt-biz-connect-noda", type: "networking_group", status: "verified_participant", bio: "NoDa chapter focused on arts district businesses and creative entrepreneurs.", parentSlug: "charlotte-biz-connect" },
  { catSlug: "best-restaurant", name: "CLT Eats Group", slug: "clt-eats-group", type: "business", status: "nominee", bio: "Multi-location restaurant group operating three Charlotte concepts.", isParent: true },
  { catSlug: "best-restaurant", name: "CLT Eats - Uptown Location", slug: "clt-eats-uptown", type: "business", status: "verified_participant", bio: "Uptown flagship location with rooftop dining and craft cocktails.", parentSlug: "clt-eats-group" },
  { catSlug: "best-restaurant", name: "CLT Eats - South End Location", slug: "clt-eats-south-end", type: "business", status: "candidate", bio: "South End location featuring casual dining and live music weekends.", parentSlug: "clt-eats-group" },
  { catSlug: "best-community-connector", name: "Queen City Collective", slug: "queen-city-collective", type: "networking_group", status: "nominee", bio: "Community organization connecting Charlotte neighborhoods through volunteer projects and block parties.", isParent: true },
  { catSlug: "best-community-connector", name: "QCC - West Side Chapter", slug: "qcc-west-side", type: "networking_group", status: "verified_participant", bio: "West Charlotte chapter running monthly cleanup drives and mentorship programs.", parentSlug: "queen-city-collective" },
];

router.post("/api/admin/crown/seed-all", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    let catCreated = 0;
    const catMap: Record<string, string> = {};
    for (let i = 0; i < CROWN_CATEGORIES_LAUNCH.length; i++) {
      const cat = CROWN_CATEGORIES_LAUNCH[i];
      const existing = await db.select({ id: crownCategories.id }).from(crownCategories)
        .where(and(eq(crownCategories.cityId, cityId), eq(crownCategories.slug, cat.slug), eq(crownCategories.seasonYear, 2026)));
      if (existing.length === 0) {
        const [created] = await db.insert(crownCategories).values({
          cityId,
          name: cat.name,
          slug: cat.slug,
          competitionLevel: cat.level,
          voteThreshold: CROWN_VOTE_THRESHOLDS[cat.level],
          participantType: cat.type,
          seasonYear: 2026,
          sortOrder: i,
        }).returning();
        catMap[cat.slug] = created.id;
        catCreated++;
      } else {
        catMap[cat.slug] = existing[0].id;
      }
    }

    let partCreated = 0;
    const slugToId: Record<string, string> = {};
    const parents = SAMPLE_PARTICIPANTS.filter(sp => !sp.parentSlug);
    const children = SAMPLE_PARTICIPANTS.filter(sp => sp.parentSlug);

    for (const sp of parents) {
      const catId = catMap[sp.catSlug];
      if (!catId) continue;
      const existing = await db.select({ id: crownParticipants.id }).from(crownParticipants)
        .where(and(eq(crownParticipants.categoryId, catId), eq(crownParticipants.slug, sp.slug), eq(crownParticipants.seasonYear, 2026)));
      if (existing.length === 0) {
        const [created] = await db.insert(crownParticipants).values({
          categoryId: catId,
          cityId,
          name: sp.name,
          slug: sp.slug,
          participantType: sp.type,
          status: sp.status,
          bio: sp.bio,
          seasonYear: 2026,
          inviteToken: crypto.randomBytes(16).toString("hex"),
          hasPaid: sp.status !== "candidate",
          verifiedAt: sp.status !== "candidate" ? new Date() : null,
          nominatedAt: sp.status === "nominee" ? new Date() : null,
        }).returning();
        slugToId[sp.slug] = created.id;
        partCreated++;
      } else {
        slugToId[sp.slug] = existing[0].id;
      }
    }

    for (const sp of children) {
      const catId = catMap[sp.catSlug];
      if (!catId) continue;
      const parentId = sp.parentSlug ? slugToId[sp.parentSlug] : undefined;
      const existing = await db.select({ id: crownParticipants.id }).from(crownParticipants)
        .where(and(eq(crownParticipants.categoryId, catId), eq(crownParticipants.slug, sp.slug), eq(crownParticipants.seasonYear, 2026)));
      if (existing.length === 0) {
        const [created] = await db.insert(crownParticipants).values({
          categoryId: catId,
          cityId,
          name: sp.name,
          slug: sp.slug,
          participantType: sp.type,
          status: sp.status,
          bio: sp.bio,
          seasonYear: 2026,
          inviteToken: crypto.randomBytes(16).toString("hex"),
          hasPaid: sp.status !== "candidate",
          verifiedAt: sp.status !== "candidate" ? new Date() : null,
          parentId: parentId || null,
        }).returning();
        slugToId[sp.slug] = created.id;
        partCreated++;
      }
    }

    const parentSlugs = SAMPLE_PARTICIPANTS.filter(sp => sp.isParent).map(sp => sp.slug);
    for (const parentSlug of parentSlugs) {
      const parentPartId = slugToId[parentSlug];
      if (!parentPartId) continue;
      const existingProfiles = await db.select({ id: crownParentProfiles.id }).from(crownParentProfiles)
        .where(eq(crownParentProfiles.participantId, parentPartId));
      if (existingProfiles.length > 0) continue;
      const parentSample = SAMPLE_PARTICIPANTS.find(sp => sp.slug === parentSlug);
      if (!parentSample) continue;
      const [profile] = await db.insert(crownParentProfiles).values({
        participantId: parentPartId,
        orgName: parentSample.name,
        orgType: parentSample.type === "networking_group" ? "networking_org" : "multi_location_business",
        totalLocations: SAMPLE_PARTICIPANTS.filter(sp => sp.parentSlug === parentSlug).length,
        isLocallyOwned: true,
        isFranchise: false,
        headquartersCity: "Charlotte",
      }).returning();

      const childSamples = SAMPLE_PARTICIPANTS.filter(sp => sp.parentSlug === parentSlug);
      for (const child of childSamples) {
        const childPartId = slugToId[child.slug];
        if (!childPartId) continue;
        await db.insert(crownChildLocations).values({
          parentProfileId: profile.id,
          participantId: childPartId,
          locationName: child.name,
          locationType: parentSample.type === "networking_group" ? "chapter" : "branch",
          neighborhood: child.slug.includes("south-end") ? "South End" : child.slug.includes("noda") ? "NoDa" : child.slug.includes("uptown") ? "Uptown" : "West Charlotte",
          chapterActivityScore: child.status === "verified_participant" ? 5 : 0,
          eventAttendanceCount: child.status === "verified_participant" ? 3 : 0,
          lastActivityAt: child.status === "verified_participant" ? new Date() : null,
        });
      }
    }

    const coffeeCatId = catMap["best-coffee"];
    const firstCoffee = slugToId["undercurrent-coffee"];
    if (coffeeCatId && firstCoffee) {
      const existingWinners = await db.select({ id: crownWinners.id }).from(crownWinners)
        .where(and(eq(crownWinners.categoryId, coffeeCatId), eq(crownWinners.seasonYear, 2026)));
      if (existingWinners.length === 0) {
        await db.insert(crownWinners).values({
          categoryId: coffeeCatId,
          participantId: firstCoffee,
          cityId,
          seasonYear: 2026,
          rank: 1,
          announcedAt: new Date(),
        });
      }
    }

    const hubRows = await db.select({ id: regions.id, name: regions.name }).from(regions)
      .where(and(eq(regions.cityId, cityId), eq(regions.type, "hub")));
    if (hubRows.length > 0) {
      let assignIdx = 0;
      const catIds = Object.values(catMap);
      for (const catIdVal of catIds) {
        const hub = hubRows[assignIdx % hubRows.length];
        const existingAssign = await db.select({ id: crownHubCategoryAssignments.id }).from(crownHubCategoryAssignments)
          .where(and(eq(crownHubCategoryAssignments.hubId, hub.id), eq(crownHubCategoryAssignments.categoryId, catIdVal), eq(crownHubCategoryAssignments.seasonYear, 2026)));
        if (existingAssign.length === 0) {
          await db.insert(crownHubCategoryAssignments).values({
            hubId: hub.id,
            categoryId: catIdVal,
            cityId,
            seasonYear: 2026,
          });
        }
        assignIdx++;
      }
    }

    res.json({ categoriesCreated: catCreated, participantsCreated: partCreated });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/participants", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const categoryId = req.query.categoryId as string;
    const status = req.query.status as string;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    let conditions = [eq(crownParticipants.cityId, cityId)];
    if (categoryId) conditions.push(eq(crownParticipants.categoryId, categoryId));
    if (status && VALID_STATUSES.has(status)) conditions.push(eq(crownParticipants.status, status as CrownParticipantStatus));

    const participants = await db.select({
      participant: crownParticipants,
      categoryName: crownCategories.name,
      categorySlug: crownCategories.slug,
    })
      .from(crownParticipants)
      .leftJoin(crownCategories, eq(crownParticipants.categoryId, crownCategories.id))
      .where(and(...conditions))
      .orderBy(desc(crownParticipants.voteCount));

    res.json(participants.map(p => ({ ...p.participant, categoryName: p.categoryName, categorySlug: p.categorySlug })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/participants", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const body = { ...req.body };
    if (!body.inviteToken) {
      body.inviteToken = crypto.randomBytes(16).toString("hex");
    }
    const parsed = insertCrownParticipantSchema.parse(body);
    const [p] = await db.insert(crownParticipants).values(parsed).returning();
    res.json(p);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
});

router.patch("/api/admin/crown/participants/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, id));
    if (!existing) return res.status(404).json({ message: "Not found" });

    const updates: Record<string, any> = {};
    const allowedFields = ["name", "slug", "status", "email", "phone", "imageUrl", "bio", "websiteUrl", "socialLinks", "parentId", "businessId", "hubId", "hasPaid", "categoryId", "crownCandidateScore", "invitePriority", "inviteTier", "categoryMatchReason", "readyForVenueTv", "readyForCreatorFeature", "readyForCrownStory"];
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    const newStatus = req.body.status;
    if (newStatus) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        candidate: ["invited"],
        invited: ["accepted", "candidate"],
        accepted: ["verified_participant", "candidate"],
        verified_participant: ["nominee", "accepted"],
        nominee: ["qualified_nominee", "verified_participant"],
        qualified_nominee: ["crown_winner", "nominee"],
        crown_winner: ["qualified_nominee"],
      };
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(newStatus)) {
        return res.status(400).json({ message: `Cannot transition from ${existing.status} to ${newStatus}` });
      }

      if (newStatus === "verified_participant") {
        if (!existing.hasPaid) {
          return res.status(400).json({ message: "Participant must have active Hub Presence (payment) before becoming a verified participant" });
        }
      }

      if (newStatus === "nominee") {
        const eligibilityIssues: string[] = [];
        if (!existing.hasPaid) eligibilityIssues.push("Hub Presence payment required");
        if (!existing.name || existing.name.trim().length < 2) eligibilityIssues.push("Complete profile name required");
        if (!existing.bio || existing.bio.trim().length < 10) eligibilityIssues.push("Profile bio must be at least 10 characters");

        const [parentProfile] = await db.select().from(crownParentProfiles).where(eq(crownParentProfiles.participantId, id));
        if (parentProfile) {
          if (!parentProfile.isLocallyOwned || parentProfile.isFranchise) {
            eligibilityIssues.push("Must be locally owned and not a franchise/chain");
          }
        }

        if (existing.participantType === "networking_group" || existing.participantType === "community_org") {
          const childLocs = existing.parentId
            ? await db.select().from(crownChildLocations).where(eq(crownChildLocations.participantId, id))
            : [];
          if (existing.parentId && childLocs.length > 0) {
            const loc = childLocs[0];
            if (loc.chapterActivityScore < 3) {
              eligibilityIssues.push("Chapter must have an activity score of at least 3");
            }
            if (loc.eventAttendanceCount < 1) {
              eligibilityIssues.push("Chapter must have attended at least 1 qualifying event");
            }
          }
        }

        if (eligibilityIssues.length > 0) {
          return res.status(400).json({ message: `Eligibility check failed: ${eligibilityIssues.join("; ")}` });
        }
        if (!updates.nominatedAt) updates.nominatedAt = new Date();
      }

      if (newStatus === "qualified_nominee") {
        const [cat] = await db.select().from(crownCategories).where(eq(crownCategories.id, existing.categoryId));
        const threshold = cat ? CROWN_VOTE_THRESHOLDS[cat.competitionLevel as keyof typeof CROWN_VOTE_THRESHOLDS] || 10 : 10;
        const [{ count: voteCount }] = await db.select({ count: sql<number>`count(*)::int` })
          .from(crownVotes)
          .where(and(eq(crownVotes.participantId, id), eq(crownVotes.isFlagged, false)));
        if (voteCount < threshold) {
          return res.status(400).json({ message: `Participant needs ${threshold} unflagged votes to qualify (currently has ${voteCount})` });
        }
      }

      if (newStatus === "verified_participant" && !updates.verifiedAt) {
        updates.verifiedAt = new Date();
      }
      if (newStatus === "invited" && !updates.invitedAt) {
        updates.invitedAt = new Date();
      }
    }

    const [p] = await db.update(crownParticipants).set(updates).where(eq(crownParticipants.id, id)).returning();
    res.json(p);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/api/admin/crown/participants/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [p] = await db.delete(crownParticipants).where(eq(crownParticipants.id, req.params.id)).returning();
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/participants/:id/invite", requireAdmin, async (req: Request, res: Response) => {
  try {
    const token = crypto.randomBytes(16).toString("hex");
    const [p] = await db.update(crownParticipants).set({
      status: "invited",
      inviteToken: token,
      invitedAt: new Date(),
    }).where(eq(crownParticipants.id, req.params.id)).returning();
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/parent-profiles", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const participantId = req.query.participantId as string;
    if (!participantId) return res.status(400).json({ message: "participantId required" });
    const profiles = await db.select().from(crownParentProfiles).where(eq(crownParentProfiles.participantId, participantId));
    res.json(profiles[0] || null);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/parent-profiles", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const data = insertCrownParentProfileSchema.parse(req.body);
    const [profile] = await db.insert(crownParentProfiles).values(data).returning();
    res.json(profile);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
});

router.patch("/api/admin/crown/parent-profiles/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const allowedFields = ["orgName", "orgType", "totalLocations", "isLocallyOwned", "isFranchise", "headquartersCity", "yearEstablished", "contactEmail", "contactPhone", "websiteUrl", "description"];
    const updates: Record<string, any> = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    updates.updatedAt = new Date();
    const [p] = await db.update(crownParentProfiles).set(updates).where(eq(crownParentProfiles.id, req.params.id)).returning();
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/api/admin/crown/parent-profiles/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [p] = await db.delete(crownParentProfiles).where(eq(crownParentProfiles.id, req.params.id)).returning();
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/child-locations", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const parentProfileId = req.query.parentProfileId as string;
    if (!parentProfileId) return res.status(400).json({ message: "parentProfileId required" });
    const locations = await db.select().from(crownChildLocations).where(eq(crownChildLocations.parentProfileId, parentProfileId));
    res.json(locations);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/child-locations", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const data = insertCrownChildLocationSchema.parse(req.body);
    const [loc] = await db.insert(crownChildLocations).values(data).returning();
    res.json(loc);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
});

router.patch("/api/admin/crown/child-locations/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const allowedFields = ["locationName", "locationType", "address", "neighborhood", "hubId", "isActive", "chapterActivityScore", "eventAttendanceCount", "lastActivityAt"];
    const updates: Record<string, any> = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [loc] = await db.update(crownChildLocations).set(updates).where(eq(crownChildLocations.id, req.params.id)).returning();
    if (!loc) return res.status(404).json({ message: "Not found" });
    res.json(loc);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/api/admin/crown/child-locations/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [loc] = await db.delete(crownChildLocations).where(eq(crownChildLocations.id, req.params.id)).returning();
    if (!loc) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/votes", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const categoryId = req.query.categoryId as string;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    let conditions: any[] = [eq(crownParticipants.cityId, cityId)];
    if (categoryId) conditions.push(eq(crownVotes.categoryId, categoryId));

    const votes = await db.select({
      vote: crownVotes,
      participantName: crownParticipants.name,
      categoryName: crownCategories.name,
    })
      .from(crownVotes)
      .innerJoin(crownParticipants, eq(crownVotes.participantId, crownParticipants.id))
      .leftJoin(crownCategories, eq(crownVotes.categoryId, crownCategories.id))
      .where(and(...conditions))
      .orderBy(desc(crownVotes.createdAt))
      .limit(200);

    res.json(votes.map(v => ({ ...v.vote, participantName: v.participantName, categoryName: v.categoryName })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/api/admin/crown/votes/:id/flag", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isFlagged, flagReason } = req.body;
    const [existing] = await db.select({ isFlagged: crownVotes.isFlagged, participantId: crownVotes.participantId })
      .from(crownVotes).where(eq(crownVotes.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Not found" });

    const wasFlagged = existing.isFlagged;
    const nowFlagged = !!isFlagged;

    const [v] = await db.update(crownVotes).set({ isFlagged: nowFlagged, flagReason: flagReason || null })
      .where(eq(crownVotes.id, req.params.id)).returning();

    if (!wasFlagged && nowFlagged) {
      await db.update(crownParticipants)
        .set({ voteCount: sql`GREATEST(0, vote_count - 1)` })
        .where(eq(crownParticipants.id, existing.participantId));
    } else if (wasFlagged && !nowFlagged) {
      await db.update(crownParticipants)
        .set({ voteCount: sql`vote_count + 1` })
        .where(eq(crownParticipants.id, existing.participantId));
    }
    if (nowFlagged && !wasFlagged) {
      await db.insert(crownVoteFlags).values({
        voteId: req.params.id,
        flagType: "admin_manual",
        reason: flagReason || "Manually flagged by admin",
      });
    }

    res.json(v);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/vote-flags", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const resolved = req.query.resolved as string;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    let conditions: any[] = [eq(crownVotes.cityId, cityId)];
    if (resolved === "false") conditions.push(sql`crown_vote_flags.resolved_at IS NULL`);
    if (resolved === "true") conditions.push(sql`crown_vote_flags.resolved_at IS NOT NULL`);

    const flags = await db.select({
      flag: crownVoteFlags,
      voterIp: crownVotes.voterIp,
      participantName: crownParticipants.name,
      categoryName: crownCategories.name,
    })
      .from(crownVoteFlags)
      .innerJoin(crownVotes, eq(crownVoteFlags.voteId, crownVotes.id))
      .innerJoin(crownParticipants, eq(crownVotes.participantId, crownParticipants.id))
      .leftJoin(crownCategories, eq(crownVotes.categoryId, crownCategories.id))
      .where(and(...conditions))
      .orderBy(desc(crownVoteFlags.createdAt))
      .limit(200);

    res.json(flags.map(f => ({ ...f.flag, voterIp: f.voterIp, participantName: f.participantName, categoryName: f.categoryName })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/api/admin/crown/vote-flags/:id/resolve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { resolution, resolvedBy } = req.body;
    const [flag] = await db.update(crownVoteFlags).set({
      resolution: resolution || "dismissed",
      resolvedBy: resolvedBy || "admin",
      resolvedAt: new Date(),
    }).where(eq(crownVoteFlags.id, req.params.id)).returning();

    if (!flag) return res.status(404).json({ message: "Flag not found" });
    res.json(flag);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/winners", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const winners = await db.select({
      winner: crownWinners,
      participantName: crownParticipants.name,
      participantImage: crownParticipants.imageUrl,
      categoryName: crownCategories.name,
      categorySlug: crownCategories.slug,
    })
      .from(crownWinners)
      .leftJoin(crownParticipants, eq(crownWinners.participantId, crownParticipants.id))
      .leftJoin(crownCategories, eq(crownWinners.categoryId, crownCategories.id))
      .where(and(eq(crownWinners.cityId, cityId), eq(crownWinners.seasonYear, seasonYear)))
      .orderBy(asc(crownWinners.rank));

    res.json(winners.map(w => ({
      ...w.winner,
      participantName: w.participantName,
      participantImage: w.participantImage,
      categoryName: w.categoryName,
      categorySlug: w.categorySlug,
    })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/winners", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { categoryId, participantId, cityId, seasonYear, rank } = req.body;
    const [w] = await db.insert(crownWinners).values({
      categoryId, participantId, cityId,
      seasonYear: seasonYear || 2026,
      rank: rank || 1,
      announcedAt: new Date(),
    }).returning();

    await db.update(crownParticipants).set({ status: "crown_winner" })
      .where(eq(crownParticipants.id, participantId));

    res.json(w);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
});

router.get("/api/admin/crown/hub-assignments", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const assignments = await db.select({
      assignment: crownHubCategoryAssignments,
      hubName: regions.name,
      categoryName: crownCategories.name,
      categorySlug: crownCategories.slug,
    })
      .from(crownHubCategoryAssignments)
      .leftJoin(regions, eq(crownHubCategoryAssignments.hubId, regions.id))
      .leftJoin(crownCategories, eq(crownHubCategoryAssignments.categoryId, crownCategories.id))
      .where(and(eq(crownHubCategoryAssignments.cityId, cityId), eq(crownHubCategoryAssignments.seasonYear, seasonYear)))
      .orderBy(asc(regions.name));

    res.json(assignments.map(a => ({ ...a.assignment, hubName: a.hubName, categoryName: a.categoryName, categorySlug: a.categorySlug })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/hub-assignments", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const parsed = insertCrownHubCategoryAssignmentSchema.parse(req.body);
    const [a] = await db.insert(crownHubCategoryAssignments).values(parsed).returning();
    res.json(a);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
});

router.delete("/api/admin/crown/hub-assignments/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(crownHubCategoryAssignments).where(eq(crownHubCategoryAssignments.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/events", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const events = await db.select().from(crownEvents)
      .where(eq(crownEvents.cityId, cityId))
      .orderBy(desc(crownEvents.startAt));

    res.json(events);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/events", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const parsed = insertCrownEventSchema.parse(req.body);
    const [ev] = await db.insert(crownEvents).values(parsed).returning();
    res.json(ev);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
});

router.patch("/api/admin/crown/events/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const updates: Record<string, any> = {};
    const allowed = ["title", "description", "eventType", "startAt", "endAt", "location", "isRecurring", "recurrenceRule", "maxAttendees", "isActive", "hubId", "categoryId"];
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const [ev] = await db.update(crownEvents).set(updates).where(eq(crownEvents.id, req.params.id)).returning();
    if (!ev) return res.status(404).json({ message: "Event not found" });
    res.json(ev);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/api/admin/crown/events/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(crownEvents).where(eq(crownEvents.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const [catCount] = await db.select({ count: sql<number>`count(*)` }).from(crownCategories)
      .where(and(eq(crownCategories.cityId, cityId), eq(crownCategories.isActive, true)));
    const [partCount] = await db.select({ count: sql<number>`count(*)` }).from(crownParticipants)
      .where(eq(crownParticipants.cityId, cityId));
    const [voteCount] = await db.select({ count: sql<number>`count(*)` }).from(crownVotes)
      .innerJoin(crownParticipants, eq(crownVotes.participantId, crownParticipants.id))
      .where(eq(crownParticipants.cityId, cityId));
    const [winnerCount] = await db.select({ count: sql<number>`count(*)` }).from(crownWinners)
      .where(eq(crownWinners.cityId, cityId));

    const statusBreakdown = await db.select({
      status: crownParticipants.status,
      count: sql<number>`count(*)`,
    }).from(crownParticipants)
      .where(eq(crownParticipants.cityId, cityId))
      .groupBy(crownParticipants.status);

    const invitedCount = statusBreakdown.find(s => s.status === "invited")?.count || 0;
    const acceptedCount = statusBreakdown.find(s => s.status === "accepted")?.count || 0;
    const postOnboardingStatuses = ["verified_participant", "nominee", "qualified_nominee", "crown_winner"];
    const completedCount = statusBreakdown
      .filter(s => postOnboardingStatuses.includes(s.status))
      .reduce((sum, s) => sum + Number(s.count), 0);
    const totalInvited = Number(invitedCount) + Number(acceptedCount) + completedCount;
    const totalCompleted = completedCount;
    const onboardingRate = totalInvited > 0 ? Math.round((totalCompleted / totalInvited) * 100) : 0;

    res.json({
      categories: Number(catCount.count),
      participants: Number(partCount.count),
      votes: Number(voteCount.count),
      winners: Number(winnerCount.count),
      statusBreakdown: statusBreakdown.map(s => ({ status: s.status, count: Number(s.count) })),
      onboarding: {
        totalInvited,
        totalAccepted: Number(acceptedCount) + completedCount,
        totalCompleted,
        completionRate: onboardingRate,
      },
    });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/crown/:citySlug/categories", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const city = await db.select().from(cities).where(eq(cities.slug, req.params.citySlug));
    if (city.length === 0) return res.status(404).json({ message: "City not found" });

    const cats = await db.select().from(crownCategories)
      .where(and(eq(crownCategories.cityId, city[0].id), eq(crownCategories.isActive, true)))
      .orderBy(asc(crownCategories.sortOrder));

    res.json(cats);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/crown/:citySlug/categories/:categorySlug/nominees", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const city = await db.select().from(cities).where(eq(cities.slug, req.params.citySlug));
    if (city.length === 0) return res.status(404).json({ message: "City not found" });

    const [cat] = await db.select().from(crownCategories)
      .where(and(eq(crownCategories.cityId, city[0].id), eq(crownCategories.slug, req.params.categorySlug)));
    if (!cat) return res.status(404).json({ message: "Category not found" });

    const nominees = await db.select().from(crownParticipants)
      .where(and(
        eq(crownParticipants.categoryId, cat.id),
        inArray(crownParticipants.status, ["nominee", "qualified_nominee", "crown_winner"]),
      ))
      .orderBy(desc(crownParticipants.voteCount));

    res.json({ category: cat, nominees });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

const MAX_VOTES_PER_IP_PER_CATEGORY = 3;

router.post("/api/crown/:citySlug/vote", requireVerifiedUser, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { participantId, fingerprint } = req.body;
    const voterUserId = getPublicUserId(req);
    const voterIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";

    if (!participantId) return res.status(400).json({ message: "participantId required" });

    const city = await db.select().from(cities).where(eq(cities.slug, req.params.citySlug));
    if (city.length === 0) return res.status(404).json({ message: "City not found" });

    const [participant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId));
    if (!participant) return res.status(404).json({ message: "Participant not found" });
    if (participant.cityId !== city[0].id) return res.status(400).json({ message: "Participant does not belong to this city" });
    if (!["nominee", "qualified_nominee"].includes(participant.status)) {
      return res.status(400).json({ message: "This participant is not accepting votes" });
    }

    const categoryId = participant.categoryId;

    let hubId = participant.hubId || null;
    if (!hubId) {
      const [assignment] = await db.select({ hubId: crownHubCategoryAssignments.hubId })
        .from(crownHubCategoryAssignments)
        .where(and(
          eq(crownHubCategoryAssignments.categoryId, categoryId),
          eq(crownHubCategoryAssignments.cityId, city[0].id),
          eq(crownHubCategoryAssignments.isActive, true),
        ));
      hubId = assignment?.hubId || null;
    }

    if (voterUserId) {
      let voteConditions: any[] = [eq(crownVotes.categoryId, categoryId), eq(crownVotes.voterUserId, voterUserId)];
      if (hubId) {
        voteConditions.push(eq(crownVotes.hubId, hubId));
      }
      const existingUserVote = await db.select({ id: crownVotes.id })
        .from(crownVotes)
        .where(and(...voteConditions))
        .limit(1);

      if (existingUserVote.length > 0) {
        return res.status(409).json({ message: "You have already voted in this category" });
      }
    }

    let isFlagged = false;
    let flagReason: string | null = null;

    if (voterIp) {
      const recentIpVotes = await db.select({ count: sql<number>`count(*)` })
        .from(crownVotes)
        .where(and(
          eq(crownVotes.categoryId, categoryId),
          eq(crownVotes.voterIp, voterIp),
          sql`created_at > NOW() - INTERVAL '24 hours'`,
        ));
      if (Number(recentIpVotes[0].count) >= MAX_VOTES_PER_IP_PER_CATEGORY) {
        isFlagged = true;
        flagReason = `IP ${voterIp} exceeded ${MAX_VOTES_PER_IP_PER_CATEGORY} votes in 24h for this category`;
      }
    }

    if (fingerprint) {
      const recentFpVotes = await db.select({ count: sql<number>`count(*)` })
        .from(crownVotes)
        .where(and(
          eq(crownVotes.categoryId, categoryId),
          eq(crownVotes.voterFingerprint, fingerprint),
          sql`created_at > NOW() - INTERVAL '24 hours'`,
        ));
      if (Number(recentFpVotes[0].count) >= MAX_VOTES_PER_IP_PER_CATEGORY) {
        isFlagged = true;
        flagReason = `Fingerprint exceeded ${MAX_VOTES_PER_IP_PER_CATEGORY} votes in 24h`;
      }
    }

    const flagReasons: { type: string; reason: string }[] = [];
    if (isFlagged && flagReason) {
      flagReasons.push({ type: voterIp ? "ip_abuse" : "fingerprint_abuse", reason: flagReason });
    }

    const [vote] = await db.insert(crownVotes).values({
      participantId,
      categoryId,
      cityId: city[0].id,
      hubId,
      voterUserId,
      voterIp,
      voterFingerprint: fingerprint || null,
      isFlagged,
      flagReason,
    }).returning();

    if (flagReasons.length > 0) {
      for (const fr of flagReasons) {
        await db.insert(crownVoteFlags).values({
          voteId: vote.id,
          flagType: fr.type,
          reason: fr.reason,
        });
      }
    }

    if (!isFlagged) {
      await db.update(crownParticipants)
        .set({ voteCount: sql`vote_count + 1` })
        .where(eq(crownParticipants.id, participantId));

      const [updated] = await db.select({ voteCount: crownParticipants.voteCount, categoryId: crownParticipants.categoryId })
        .from(crownParticipants).where(eq(crownParticipants.id, participantId));

      if (updated) {
        const [cat] = await db.select({ voteThreshold: crownCategories.voteThreshold })
          .from(crownCategories).where(eq(crownCategories.id, updated.categoryId));
        if (cat && updated.voteCount >= cat.voteThreshold && participant.status === "nominee") {
          await db.update(crownParticipants).set({ status: "qualified_nominee" })
            .where(eq(crownParticipants.id, participantId));
        }
      }
    }

    res.json({ success: true, isFlagged });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/crown/:citySlug/winners", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const city = await db.select().from(cities).where(eq(cities.slug, req.params.citySlug));
    if (city.length === 0) return res.status(404).json({ message: "City not found" });
    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;

    const winners = await db.select({
      winner: crownWinners,
      participantName: crownParticipants.name,
      participantImage: crownParticipants.imageUrl,
      participantBio: crownParticipants.bio,
      participantWebsite: crownParticipants.websiteUrl,
      categoryName: crownCategories.name,
      categorySlug: crownCategories.slug,
    })
      .from(crownWinners)
      .leftJoin(crownParticipants, eq(crownWinners.participantId, crownParticipants.id))
      .leftJoin(crownCategories, eq(crownWinners.categoryId, crownCategories.id))
      .where(and(eq(crownWinners.cityId, city[0].id), eq(crownWinners.seasonYear, seasonYear)))
      .orderBy(asc(crownWinners.rank));

    res.json(winners.map(w => ({
      ...w.winner,
      participantName: w.participantName,
      participantImage: w.participantImage,
      participantBio: w.participantBio,
      participantWebsite: w.participantWebsite,
      categoryName: w.categoryName,
      categorySlug: w.categorySlug,
    })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/crown/:citySlug/events", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const city = await db.select().from(cities).where(eq(cities.slug, req.params.citySlug));
    if (city.length === 0) return res.status(404).json({ message: "City not found" });
    const hubId = req.query.hubId as string;
    const categoryId = req.query.categoryId as string;

    let conditions: any[] = [eq(crownEvents.cityId, city[0].id), eq(crownEvents.isActive, true)];
    if (hubId) conditions.push(eq(crownEvents.hubId, hubId));
    if (categoryId) conditions.push(eq(crownEvents.categoryId, categoryId));

    const events = await db.select().from(crownEvents)
      .where(and(...conditions))
      .orderBy(asc(crownEvents.startAt));

    res.json(events);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/crown/invitation/:token", async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const [p] = await db.select({
      participant: crownParticipants,
      categoryName: crownCategories.name,
      categorySlug: crownCategories.slug,
    })
      .from(crownParticipants)
      .leftJoin(crownCategories, eq(crownParticipants.categoryId, crownCategories.id))
      .where(eq(crownParticipants.inviteToken, req.params.token));

    if (!p) return res.status(404).json({ message: "Invalid invitation link" });

    const invitation = await db.select().from(crownInvitations)
      .where(eq(crownInvitations.participantId, p.participant.id))
      .then(r => r[0]);

    if (invitation) {
      if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
        if (invitation.invitationStatus !== "EXPIRED" && invitation.invitationStatus !== "CLAIM_COMPLETED") {
          await db.update(crownInvitations).set({
            invitationStatus: "EXPIRED",
          }).where(eq(crownInvitations.id, invitation.id));
        }
        return res.status(410).json({ message: "Invitation has expired" });
      }
      if (invitation.invitationStatus === "SENT") {
        await db.update(crownInvitations).set({
          invitationStatus: "VIEWED",
          viewedAt: new Date(),
        }).where(eq(crownInvitations.id, invitation.id));
      }
    }

    res.json({ ...p.participant, categoryName: p.categoryName, categorySlug: p.categorySlug });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/crown/invitation/:token/accept", async (req: Request, res: Response) => {
  try {
    const [p] = await db.select().from(crownParticipants)
      .where(eq(crownParticipants.inviteToken, req.params.token));
    if (!p) return res.status(404).json({ message: "Invalid invitation link" });
    if (!["invited", "candidate"].includes(p.status)) return res.status(400).json({ message: "Invitation already accepted or expired" });

    const invitation = await db.select().from(crownInvitations)
      .where(eq(crownInvitations.participantId, p.id))
      .then(r => r[0]);

    if (invitation) {
      if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
        await db.update(crownInvitations).set({
          invitationStatus: "EXPIRED",
        }).where(eq(crownInvitations.id, invitation.id));
        return res.status(410).json({ message: "Invitation has expired" });
      }
      if (["SENT", "VIEWED"].includes(invitation.invitationStatus)) {
        await db.update(crownInvitations).set({
          invitationStatus: "CLAIM_STARTED",
          claimStartedAt: new Date(),
        }).where(eq(crownInvitations.id, invitation.id));
      }
    }

    const updates: Record<string, any> = { status: "accepted" };
    if (req.body.bio) updates.bio = req.body.bio;
    if (req.body.imageUrl) updates.imageUrl = req.body.imageUrl;
    if (req.body.websiteUrl) updates.websiteUrl = req.body.websiteUrl;
    if (req.body.socialLinks) updates.socialLinks = req.body.socialLinks;

    const [updated] = await db.update(crownParticipants).set(updates)
      .where(eq(crownParticipants.id, p.id)).returning();

    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/crown/checkout", async (req: Request, res: Response) => {
  try {
    const { participantId, citySlug, inviteToken } = req.body;
    if (!participantId || !citySlug) return res.status(400).json({ message: "participantId and citySlug required" });
    if (!inviteToken) return res.status(400).json({ message: "inviteToken required for checkout authorization" });

    const [p] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId));
    if (!p) return res.status(404).json({ message: "Participant not found" });
    if (p.inviteToken !== inviteToken) return res.status(403).json({ message: "Invalid invite token" });
    if (p.hasPaid) return res.status(400).json({ message: "Already paid" });

    const { getStripe } = await import("./stripe/webhook");
    const { resolvePriceId, resolveCheckoutMode } = await import("./stripe/priceMap");
    const { storage } = await import("./storage");

    const city = await storage.getCityBySlug(citySlug);
    if (!city) return res.status(404).json({ message: "City not found" });

    const priceId = resolvePriceId("CROWN_HUB_PRESENCE") || resolvePriceId("LISTING_TIER", "ENHANCED");
    if (!priceId) return res.status(400).json({ message: "No Stripe price configured for Crown Hub Presence" });

    const email = p.email;
    if (!email) return res.status(400).json({ message: "Participant has no email" });

    const stripe = getStripe();
    let stripeCustomerId: string;
    const existing = await storage.getStripeCustomerByEmail(email, city.id);
    if (existing) {
      stripeCustomerId = existing.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({ email, metadata: { city_id: city.id } });
      await storage.createStripeCustomer({ cityId: city.id, email, stripeCustomerId: customer.id });
      stripeCustomerId = customer.id;
    }

    const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
    const mode = resolveCheckoutMode("CROWN_HUB_PRESENCE");

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/${citySlug}/crown/onboarding?checkout=success&participant=${participantId}`,
      cancel_url: `${appUrl}/${citySlug}/crown`,
      metadata: {
        city_id: city.id,
        city_slug: citySlug,
        subject_type: "CROWN_PARTICIPANT",
        subject_id: participantId,
        product_type: "CROWN_VERIFICATION",
      },
    });

    await db.update(crownParticipants).set({ stripeSessionId: session.id })
      .where(eq(crownParticipants.id, participantId));

    res.json({ url: session.url });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  "best-coffee": ["coffee", "cafe", "espresso", "roaster", "coffeehouse"],
  "best-restaurant": ["restaurant", "dining", "bistro", "eatery", "grill", "kitchen", "food"],
  "best-brewery": ["brewery", "brewpub", "taproom", "craft beer", "beer"],
  "best-food-truck": ["food truck", "mobile kitchen", "street food"],
  "best-realtor": ["realtor", "real estate", "realty", "property", "homes"],
  "best-insurance-advisor": ["insurance", "insurer", "coverage"],
  "best-mortgage-broker": ["mortgage", "lender", "loan", "lending"],
  "best-date-night-spot": ["date night", "romantic", "cocktail", "lounge", "wine bar", "fine dining"],
  "best-local-creator": ["creator", "content", "influencer", "media"],
  "best-podcast": ["podcast", "audio", "show"],
  "best-networking-group": ["networking", "business group", "chamber", "meetup", "association"],
  "best-community-connector": ["community", "nonprofit", "foundation", "outreach", "connector"],
  "best-fitness-studio": ["gym", "fitness", "yoga", "pilates", "training", "crossfit", "workout"],
  "best-salon": ["salon", "hair", "beauty", "stylist", "barbershop"],
  "best-barber": ["barber", "barbershop", "grooming", "men's hair"],
  "best-boutique": ["boutique", "shop", "clothing", "fashion", "retail"],
};

const CATEGORY_VIABILITY_MINIMUMS: Record<string, number> = {
  "best-coffee": 6,
  "best-restaurant": 10,
  "best-brewery": 5,
  "best-food-truck": 5,
  "best-realtor": 6,
  "best-insurance-advisor": 4,
  "best-mortgage-broker": 4,
  "best-date-night-spot": 6,
  "best-local-creator": 5,
  "best-podcast": 4,
  "best-networking-group": 4,
  "best-community-connector": 4,
  "best-fitness-studio": 5,
  "best-salon": 6,
  "best-barber": 6,
  "best-boutique": 5,
};

const DEFAULT_VIABILITY_MINIMUM = 5;

interface CrownCandidateOutput {
  business_id: string;
  business_name: string;
  category_name: string;
  hub_name: string;
  category_match_reason: string;
  address: string | null;
  distance_from_hub_center: number | null;
  claimed_status: string;
  profile_completeness_percent: number;
  google_rating: number | null;
  google_review_count: number | null;
  internal_review_count: number;
  social_followers_combined: number;
  activity_last_90_days: number;
  reputation_score: number;
  audience_score: number;
  activity_score: number;
  platform_readiness_score: number;
  crown_candidate_score: number;
  invite_priority: "HIGH" | "MEDIUM" | "LOW";
  invite_tier: "ANCHOR" | "STRONG" | "EMERGING";
  manual_review_required: boolean;
  ready_for_claim_invite: boolean;
  ready_for_voting_campaign: boolean;
  ready_for_venue_tv: boolean;
  ready_for_creator_feature: boolean;
  ready_for_winner_spotlight: boolean;
  notes: string;
}

interface CategoryDiscoveryResult {
  category_name: string;
  category_slug: string;
  hub_name: string;
  hub_id: string;
  total_businesses_found: number;
  total_qualified: number;
  category_status: "READY" | "NOT_READY" | "MANUAL_REVIEW";
  viability_minimum: number;
  candidates: CrownCandidateOutput[];
}

interface HubDiscoverySummary {
  hub_id: string;
  hub_name: string;
  center_lat: number | null;
  center_lng: number | null;
  categories_scanned: number;
  categories_ready: number;
  categories_not_ready: number;
  best_launch_categories: string[];
  recommended_first_5_categories: string[];
  recommended_first_10_businesses: { name: string; category: string; score: number }[];
  hub_ready_for_crown: boolean;
  category_results: CategoryDiscoveryResult[];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeProfileCompleteness(biz: Record<string, unknown>): number {
  const fields = [
    "name", "description", "address", "phone", "website_url", "image_url",
    "social_links", "hours_of_operation", "category_ids",
  ];
  const filled = fields.filter((f) => {
    const v = biz[f];
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;
  const galleryBonus = Array.isArray(biz.gallery_images) && biz.gallery_images.length > 0 ? 1 : 0;
  const micrositeBonus = biz.microsite_enabled ? 1 : 0;
  return Math.round(((filled + galleryBonus + micrositeBonus) / (fields.length + 2)) * 100);
}

function estimateSocialFollowers(socialLinks: Record<string, string> | null): number {
  if (!socialLinks) return 0;
  let count = 0;
  const platforms = Object.keys(socialLinks).filter((k) => socialLinks[k]);
  count = platforms.length * 250;
  return count;
}

function computeReputationScore(googleRating: number | null, googleReviewCount: number | null, internalReviewCount: number): number {
  let score = 0;
  if (googleRating !== null) {
    if (googleRating >= 4.8) score += 40;
    else if (googleRating >= 4.5) score += 35;
    else if (googleRating >= 4.2) score += 28;
    else if (googleRating >= 4.0) score += 22;
    else if (googleRating >= 3.5) score += 12;
    else score += 5;
  }
  if (googleReviewCount !== null) {
    if (googleReviewCount >= 200) score += 35;
    else if (googleReviewCount >= 100) score += 28;
    else if (googleReviewCount >= 50) score += 22;
    else if (googleReviewCount >= 15) score += 15;
    else if (googleReviewCount >= 5) score += 8;
  }
  if (internalReviewCount >= 20) score += 25;
  else if (internalReviewCount >= 10) score += 18;
  else if (internalReviewCount >= 5) score += 12;
  else if (internalReviewCount >= 1) score += 5;
  return Math.min(score, 100);
}

function computeAudienceScore(socialFollowers: number): number {
  if (socialFollowers >= 10000) return 100;
  if (socialFollowers >= 5000) return 80;
  if (socialFollowers >= 2500) return 60;
  if (socialFollowers >= 1000) return 45;
  if (socialFollowers >= 500) return 30;
  if (socialFollowers >= 250) return 15;
  return 5;
}

function computeActivityScore(eventsLast90: number, postsLast90: number, hasRecentUpdate: boolean): number {
  let score = 0;
  score += Math.min(eventsLast90 * 10, 40);
  score += Math.min(postsLast90 * 5, 30);
  if (hasRecentUpdate) score += 20;
  if (score === 0) score = 5;
  return Math.min(score, 100);
}

function computePlatformReadinessScore(biz: Record<string, unknown>, completeness: number, hasBadges: boolean): number {
  let score = 0;
  score += Math.round(completeness * 0.4);
  if (biz.claim_status === "CLAIMED") score += 25;
  else if (biz.claim_status === "CLAIM_SENT") score += 10;
  if (biz.is_verified) score += 15;
  if (hasBadges) score += 10;
  if (biz.microsite_enabled) score += 10;
  return Math.min(score, 100);
}

function computeCrownScore(rep: number, aud: number, act: number, plat: number): number {
  return Math.round(rep * 0.40 + aud * 0.25 + act * 0.15 + plat * 0.20);
}

function classifyTier(score: number): "ANCHOR" | "STRONG" | "EMERGING" {
  if (score >= 70) return "ANCHOR";
  if (score >= 45) return "STRONG";
  return "EMERGING";
}

function classifyPriority(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function passesHardFilters(
  googleRating: number | null,
  googleReviewCount: number | null,
  socialFollowers: number,
  internalReviewCount: number,
  _categorySlug: string
): { passes: boolean; manualReview: boolean } {
  const rating = googleRating ?? 0;
  const reviews = googleReviewCount ?? 0;
  if (rating < 4.0 || reviews < 15) {
    if (rating >= 3.5 && (socialFollowers >= 2000 || internalReviewCount >= 5 || reviews >= 30)) {
      return { passes: false, manualReview: true };
    }
    return { passes: false, manualReview: false };
  }
  const hasAudience = socialFollowers >= 1000;
  const hasStrongReviews = reviews >= 50;
  const hasCommunitySupport = internalReviewCount >= 10;
  if (hasAudience || hasStrongReviews || hasCommunitySupport) {
    return { passes: true, manualReview: false };
  }
  return { passes: false, manualReview: true };
}

async function resolveHubZoneIds(hubId: string): Promise<Set<string>> {
  const hubRow = await pool.query("SELECT name FROM regions WHERE id = $1", [hubId]);
  const hubNameStr = hubRow.rows[0]?.name || "";
  const hubNameTokens = hubNameStr.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
  const hubZoneRows = await pool.query(
    `SELECT z.id FROM zones z WHERE z.name ILIKE ANY(ARRAY(SELECT '%' || unnest || '%' FROM unnest($1::text[])))`,
    [hubNameTokens.length > 0 ? hubNameTokens : ["__no_match__"]]
  );
  return new Set(hubZoneRows.rows.map((r: { id: string }) => r.id));
}

export async function discoverCandidatesForCategory(
  hubId: string,
  hubName: string,
  hubCenterLat: number | null,
  hubCenterLng: number | null,
  hubRadiusMiles: number,
  categorySlug: string,
  categoryName: string,
  cityId: string,
  precomputedHubZoneIds?: Set<string>
): Promise<CategoryDiscoveryResult> {
  const keywords = CATEGORY_KEYWORD_MAP[categorySlug] || [categoryName.replace(/^Best\s+/i, "").toLowerCase()];
  const viabilityMin = CATEGORY_VIABILITY_MINIMUMS[categorySlug] || DEFAULT_VIABILITY_MINIMUM;

  const keywordPattern = keywords.join("|");

  const hubZoneIds = precomputedHubZoneIds ?? await resolveHubZoneIds(hubId);

  const businessRows = await pool.query(`
    SELECT b.*, 
      COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id AND r.status = 'APPROVED'), 0)::int AS internal_review_count,
      COALESCE((SELECT COUNT(*) FROM events e WHERE e.host_business_id = b.id AND e.start_date_time >= NOW() - INTERVAL '90 days'), 0)::int AS events_last_90,
      COALESCE((SELECT COUNT(*) FROM posts pp WHERE pp.business_id = b.id AND pp.created_at >= NOW() - INTERVAL '90 days'), 0)::int AS posts_last_90,
      EXISTS(SELECT 1 FROM profile_badges pb WHERE pb.business_id = b.id AND pb.enabled = true) AS has_badges,
      pra.primary_region_id AS assigned_region_id
    FROM businesses b
    LEFT JOIN presence_region_assignment pra ON pra.presence_id = b.id
    WHERE b.city_id = $1
      AND b.presence_status = 'ACTIVE'
      AND (
        b.name ~* $2
        OR b.description ~* $2
        OR EXISTS (
          SELECT 1 FROM categories c
          WHERE c.id = ANY(b.category_ids)
          AND (c.name ~* $2 OR c.slug ~* $2)
        )
      )
    ORDER BY b.google_review_count DESC NULLS LAST
    LIMIT 200
  `, [cityId, keywordPattern]);

  const candidates: CrownCandidateOutput[] = [];

  for (const biz of businessRows.rows) {
    let matchReason = "keyword match in ";
    const nameLower = (biz.name || "").toLowerCase();
    const descLower = (biz.description || "").toLowerCase();
    if (keywords.some((k) => nameLower.includes(k))) matchReason += "name";
    else if (keywords.some((k) => descLower.includes(k))) matchReason += "description";
    else matchReason += "category taxonomy";

    let distance: number | null = null;
    let hubRelevant = false;
    if (hubCenterLat !== null && hubCenterLng !== null && biz.latitude && biz.longitude) {
      distance = haversineDistance(hubCenterLat, hubCenterLng, parseFloat(biz.latitude), parseFloat(biz.longitude));
      hubRelevant = distance <= hubRadiusMiles;
    }
    if (!hubRelevant && biz.assigned_region_id === hubId) hubRelevant = true;
    if (!hubRelevant && biz.zone_id && hubZoneIds.has(biz.zone_id)) hubRelevant = true;
    if (!hubRelevant && biz.is_service_area && Array.isArray(biz.service_area_zone_ids)) {
      const serviceZones = biz.service_area_zone_ids as string[];
      if (serviceZones.some((zid: string) => hubZoneIds.has(zid))) {
        hubRelevant = true;
        matchReason += " (service area)";
      }
    }

    if (!hubRelevant && hubCenterLat !== null && distance !== null && distance <= hubRadiusMiles * 2) {
      hubRelevant = true;
      matchReason += " (extended radius)";
    }

    if (!hubRelevant) continue;

    const socialLinks = biz.social_links || null;
    const socialFollowers = estimateSocialFollowers(socialLinks);
    const googleRating = biz.google_rating ? parseFloat(biz.google_rating) : null;
    const googleReviewCount = biz.google_review_count || null;
    const internalReviewCount = biz.internal_review_count || 0;
    const completeness = computeProfileCompleteness(biz);

    const repScore = computeReputationScore(googleRating, googleReviewCount, internalReviewCount);
    const audScore = computeAudienceScore(socialFollowers);
    const actScore = computeActivityScore(biz.events_last_90, biz.posts_last_90, biz.updated_at && new Date(biz.updated_at) > new Date(Date.now() - 90 * 86400000));
    const platScore = computePlatformReadinessScore(biz, completeness, biz.has_badges);
    const crownScore = computeCrownScore(repScore, audScore, actScore, platScore);

    const { passes, manualReview } = passesHardFilters(googleRating, googleReviewCount, socialFollowers, internalReviewCount, categorySlug);

    const tier = classifyTier(crownScore);
    const priority = classifyPriority(crownScore);
    const activityLast90 = (biz.events_last_90 || 0) + (biz.posts_last_90 || 0);
    const categoryReady = passes || manualReview;

    candidates.push({
      business_id: biz.id,
      business_name: biz.name,
      category_name: categoryName,
      hub_name: hubName,
      category_match_reason: matchReason,
      address: biz.address,
      distance_from_hub_center: distance !== null ? Math.round(distance * 100) / 100 : null,
      claimed_status: biz.claim_status,
      profile_completeness_percent: completeness,
      google_rating: googleRating,
      google_review_count: googleReviewCount,
      internal_review_count: internalReviewCount,
      social_followers_combined: socialFollowers,
      activity_last_90_days: activityLast90,
      reputation_score: repScore,
      audience_score: audScore,
      activity_score: actScore,
      platform_readiness_score: platScore,
      crown_candidate_score: crownScore,
      invite_priority: priority,
      invite_tier: tier,
      manual_review_required: manualReview,
      ready_for_claim_invite: passes && biz.claim_status !== "CLAIMED",
      ready_for_voting_campaign: passes,
      ready_for_venue_tv: audScore >= 45 || actScore >= 40,
      ready_for_creator_feature: repScore >= 40 && actScore >= 25,
      ready_for_winner_spotlight: crownScore >= 65 && passes,
      notes: manualReview ? "Borderline candidate — admin review recommended" : passes ? "" : "Does not meet hard filter thresholds",
    });
  }

  candidates.sort((a, b) => b.crown_candidate_score - a.crown_candidate_score);

  const qualified = candidates.filter((c) => c.ready_for_voting_campaign || c.manual_review_required);
  let categoryStatus: "READY" | "NOT_READY" | "MANUAL_REVIEW" = "NOT_READY";
  if (qualified.length >= viabilityMin) categoryStatus = "READY";
  else if (qualified.length >= Math.ceil(viabilityMin * 0.6)) categoryStatus = "MANUAL_REVIEW";

  return {
    category_name: categoryName,
    category_slug: categorySlug,
    hub_name: hubName,
    hub_id: hubId,
    total_businesses_found: candidates.length,
    total_qualified: qualified.length,
    category_status: categoryStatus,
    viability_minimum: viabilityMin,
    candidates: candidates.slice(0, 10),
  };
}

router.get("/api/admin/crown/discover", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { hubId, categorySlug, cityId, radiusMiles } = req.query;
    if (!hubId || !cityId) return res.status(400).json({ message: "hubId and cityId required" });

    const hubRow = await pool.query("SELECT id, name, center_lat, center_lng FROM regions WHERE id = $1", [hubId]);
    if (hubRow.rows.length === 0) return res.status(404).json({ message: "Hub not found" });
    const hub = hubRow.rows[0];
    const hubLat = hub.center_lat ? parseFloat(hub.center_lat) : null;
    const hubLng = hub.center_lng ? parseFloat(hub.center_lng) : null;
    const radius = radiusMiles ? parseFloat(radiusMiles as string) : 5;

    if (categorySlug) {
      const catName = (categorySlug as string).split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const result = await discoverCandidatesForCategory(
        hub.id, hub.name, hubLat, hubLng, radius,
        categorySlug as string, catName, cityId as string
      );
      return res.json(result);
    }

    const dbCats = await pool.query(
      "SELECT name, slug FROM crown_categories WHERE city_id = $1 AND is_active = true ORDER BY sort_order",
      [cityId]
    );
    const categories: { name: string; slug: string }[] = dbCats.rows.length > 0
      ? dbCats.rows
      : CROWN_CATEGORIES_LAUNCH.map((c) => ({ name: c.name, slug: c.slug }));

    const results: CategoryDiscoveryResult[] = [];
    for (const cat of categories) {
      const result = await discoverCandidatesForCategory(
        hub.id, hub.name, hubLat, hubLng, radius,
        cat.slug, cat.name, cityId as string
      );
      results.push(result);
    }

    const categoriesReady = results.filter((r) => r.category_status === "READY");
    const categoriesNotReady = results.filter((r) => r.category_status === "NOT_READY");
    const bestLaunch = categoriesReady
      .sort((a, b) => b.total_qualified - a.total_qualified)
      .map((r) => r.category_name);

    const allCandidates = results
      .flatMap((r) => r.candidates.filter((c) => c.ready_for_voting_campaign))
      .sort((a, b) => b.crown_candidate_score - a.crown_candidate_score);

    const summary: HubDiscoverySummary = {
      hub_id: hub.id,
      hub_name: hub.name,
      center_lat: hubLat,
      center_lng: hubLng,
      categories_scanned: results.length,
      categories_ready: categoriesReady.length,
      categories_not_ready: categoriesNotReady.length,
      best_launch_categories: bestLaunch.slice(0, 5),
      recommended_first_5_categories: bestLaunch.slice(0, 5),
      recommended_first_10_businesses: allCandidates.slice(0, 10).map((c) => ({
        name: c.business_name,
        category: c.category_name,
        score: c.crown_candidate_score,
      })),
      hub_ready_for_crown: categoriesReady.length >= 3 && allCandidates.length >= 15,
      category_results: results,
    };

    res.json(summary);
  } catch (err: any) {
    console.error("[Crown Discovery] error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/crown/discover/hubs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, radiusMiles } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const radius = radiusMiles ? parseFloat(radiusMiles as string) : 5;

    const cityRow = await pool.query("SELECT id FROM cities WHERE id = $1", [cityId]);
    if (cityRow.rows.length === 0) return res.status(404).json({ message: "City not found" });

    const hubRows = await pool.query(
      `SELECT r.id, r.name, r.center_lat, r.center_lng FROM regions r
       WHERE r.region_type = 'hub' AND r.is_active = true AND r.city_id = $1
       ORDER BY r.name`,
      [cityId]
    );

    const dbCats = await pool.query(
      "SELECT name, slug FROM crown_categories WHERE city_id = $1 AND is_active = true ORDER BY sort_order",
      [cityId]
    );
    const categories: { name: string; slug: string }[] = dbCats.rows.length > 0
      ? dbCats.rows
      : CROWN_CATEGORIES_LAUNCH.map((c) => ({ name: c.name, slug: c.slug }));

    const summaries: HubDiscoverySummary[] = [];
    for (const hub of hubRows.rows) {
      const hubLat = hub.center_lat ? parseFloat(hub.center_lat) : null;
      const hubLng = hub.center_lng ? parseFloat(hub.center_lng) : null;
      const hubZoneIds = await resolveHubZoneIds(hub.id);
      const results: CategoryDiscoveryResult[] = [];
      for (const cat of categories) {
        const result = await discoverCandidatesForCategory(
          hub.id, hub.name, hubLat, hubLng, radius,
          cat.slug, cat.name, cityId as string, hubZoneIds
        );
        results.push(result);
      }

      const categoriesReady = results.filter((r) => r.category_status === "READY");
      const allCandidates = results
        .flatMap((r) => r.candidates.filter((c) => c.ready_for_voting_campaign))
        .sort((a, b) => b.crown_candidate_score - a.crown_candidate_score);

      summaries.push({
        hub_id: hub.id,
        hub_name: hub.name,
        center_lat: hubLat,
        center_lng: hubLng,
        categories_scanned: results.length,
        categories_ready: categoriesReady.length,
        categories_not_ready: results.length - categoriesReady.length,
        best_launch_categories: categoriesReady.sort((a, b) => b.total_qualified - a.total_qualified).map((r) => r.category_name).slice(0, 5),
        recommended_first_5_categories: categoriesReady.map((r) => r.category_name).slice(0, 5),
        recommended_first_10_businesses: allCandidates.slice(0, 10).map((c) => ({
          name: c.business_name,
          category: c.category_name,
          score: c.crown_candidate_score,
        })),
        hub_ready_for_crown: categoriesReady.length >= 3 && allCandidates.length >= 15,
        category_results: results,
      });
    }

    summaries.sort((a, b) => b.categories_ready - a.categories_ready);
    res.json(summaries);
  } catch (err: any) {
    console.error("[Crown Discovery Hubs] error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ==================== HUB READINESS & ACTIVATION ENGINE ====================

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  INACTIVE: ["SCANNING"],
  SCANNING: ["READY_FOR_ACTIVATION", "INACTIVE"],
  READY_FOR_ACTIVATION: ["NOMINATIONS_OPEN", "INACTIVE"],
  NOMINATIONS_OPEN: ["VOTING_OPEN"],
  VOTING_OPEN: ["WINNERS_DECLARED"],
  WINNERS_DECLARED: ["ARCHIVED"],
  ARCHIVED: ["INACTIVE"],
};

async function getOrCreateConfig(cityId: string, seasonYear: number): Promise<CrownHubConfig> {
  const [existing] = await db.select().from(crownHubConfig)
    .where(and(eq(crownHubConfig.cityId, cityId), eq(crownHubConfig.seasonYear, seasonYear)));
  if (existing) return existing;
  const [created] = await db.insert(crownHubConfig).values({ cityId, seasonYear }).returning();
  return created;
}

function getCategoryMinimum(config: CrownHubConfig, categorySlug: string): number {
  const thresholds = config.categoryThresholds || {};
  return thresholds[categorySlug] ?? config.defaultCategoryMinimum;
}

router.get("/api/admin/crown/hubs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;

    const hubRows = await pool.query(
      `SELECT r.id, r.name, r.center_lat, r.center_lng, r.slug
       FROM regions r
       WHERE r.region_type = 'hub' AND r.is_active = true AND r.city_id = $1
       ORDER BY r.name`,
      [cityId]
    );

    const activations = await db.select().from(crownHubActivations)
      .where(and(eq(crownHubActivations.cityId, cityId as string), eq(crownHubActivations.seasonYear, seasonYear)));

    const activationMap = new Map(activations.map(a => [a.hubId, a]));

    const results = hubRows.rows.map((hub: Record<string, unknown>) => ({
      hub_id: hub.id,
      hub_name: hub.name,
      hub_slug: hub.slug,
      center_lat: hub.center_lat ? parseFloat(hub.center_lat as string) : null,
      center_lng: hub.center_lng ? parseFloat(hub.center_lng as string) : null,
      activation: activationMap.get(hub.id as string) || null,
      crown_status: activationMap.get(hub.id as string)?.status || "INACTIVE",
    }));

    res.json(results);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Crown Hubs List] error:", msg);
    res.status(500).json({ message: msg });
  }
});

router.post("/api/admin/crown/hubs/:hubId/scan", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { hubId } = req.params;
    const { cityId } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const seasonYear = parseInt(req.body.seasonYear) || 2026;
    const config = await getOrCreateConfig(cityId, seasonYear);

    const hubRow = await pool.query("SELECT id, name, center_lat, center_lng FROM regions WHERE id = $1 AND city_id = $2", [hubId, cityId]);
    if (hubRow.rows.length === 0) return res.status(404).json({ message: "Hub not found in this city" });
    const hub = hubRow.rows[0];
    const hubLat = hub.center_lat ? parseFloat(hub.center_lat) : null;
    const hubLng = hub.center_lng ? parseFloat(hub.center_lng) : null;
    const radius = config.scanRadiusMiles;

    const [activation] = await db.select().from(crownHubActivations)
      .where(and(eq(crownHubActivations.hubId, hubId), eq(crownHubActivations.seasonYear, seasonYear)));

    if (activation && !["INACTIVE", "SCANNING", "READY_FOR_ACTIVATION"].includes(activation.status)) {
      return res.status(400).json({ message: `Cannot scan hub in ${activation.status} state` });
    }

    if (!activation) {
      await db.insert(crownHubActivations).values({
        hubId, cityId, seasonYear, status: "SCANNING",
      });
    } else {
      await db.update(crownHubActivations)
        .set({ status: "SCANNING", updatedAt: new Date() })
        .where(eq(crownHubActivations.id, activation.id));
    }

    const dbCats = await pool.query(
      "SELECT name, slug FROM crown_categories WHERE city_id = $1 AND is_active = true ORDER BY sort_order",
      [cityId]
    );
    const categories: { name: string; slug: string }[] = dbCats.rows.length > 0
      ? dbCats.rows
      : CROWN_CATEGORIES_LAUNCH.map((c) => ({ name: c.name, slug: c.slug }));

    const hubZoneIds = await resolveHubZoneIds(hubId);

    const results: CategoryDiscoveryResult[] = [];
    for (const cat of categories) {
      const result = await discoverCandidatesForCategory(
        hub.id, hub.name, hubLat, hubLng, radius,
        cat.slug, cat.name, cityId, hubZoneIds
      );
      results.push(result);
    }

    const categoriesReady = results.filter((r) => {
      const minBiz = getCategoryMinimum(config, r.category_slug);
      return r.total_qualified >= minBiz;
    });
    const totalQualified = results.reduce((s, r) => s + r.total_qualified, 0);
    const readyCatNames = categoriesReady.map(r => r.category_name);
    const topBizIds = results
      .flatMap(r => r.candidates.filter(c => c.ready_for_voting_campaign))
      .sort((a, b) => b.crown_candidate_score - a.crown_candidate_score)
      .slice(0, 20)
      .map(c => c.business_id);

    const hubReady = categoriesReady.length >= config.minCategoriesForLaunch
      && totalQualified >= config.minQualifiedBusinesses;
    const newStatus = hubReady ? "READY_FOR_ACTIVATION" : "INACTIVE";

    await db.update(crownHubActivations)
      .set({
        status: newStatus,
        categoriesScanned: results.length,
        categoriesReady: categoriesReady.length,
        totalQualifiedBusinesses: totalQualified,
        readyCategoryNames: readyCatNames,
        recommendedBusinessIds: topBizIds,
        scanResults: { categories: results } as Record<string, unknown>,
        lastScannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(crownHubActivations.hubId, hubId), eq(crownHubActivations.seasonYear, seasonYear)));

    if (hubReady) {
      await pool.query(`
        INSERT INTO pulse_signals (id, metro_id, signal_type, entity_type, entity_id, title, summary, data_json, score, status, created_at)
        VALUES (gen_random_uuid(), $1, 'CROWN_HUB_READY', 'hub', $2, $3, $4,
          $5::jsonb, 80, 'new', NOW())
        ON CONFLICT DO NOTHING
      `, [
        cityId,
        hubId,
        `Crown Program: ${hub.name} is ready`,
        `Hub "${hub.name}" has ${categoriesReady.length} ready categories and ${totalQualified} qualified businesses. Recommended for Crown activation.`,
        JSON.stringify({
          hub_name: hub.name,
          ready_categories: readyCatNames,
          qualified_business_count: totalQualified,
          recommended_launch_categories: readyCatNames.slice(0, 5),
          recommended_businesses_to_invite: topBizIds.slice(0, 10),
        }),
      ]);
    }

    const [updated] = await db.select().from(crownHubActivations)
      .where(and(eq(crownHubActivations.hubId, hubId), eq(crownHubActivations.seasonYear, seasonYear)));

    res.json({
      activation: updated,
      hub_ready: hubReady,
      summary: {
        hub_name: hub.name,
        hub_id: hubId,
        total_businesses_detected: results.reduce((s, r) => s + r.total_businesses_found, 0),
        total_qualified_businesses: totalQualified,
        categories_scanned: results.length,
        categories_ready: categoriesReady.length,
        categories_not_ready: results.length - categoriesReady.length,
        recommended_launch_categories: readyCatNames.slice(0, 5),
        recommended_invite_businesses: topBizIds.slice(0, 10),
        hub_crown_status: newStatus,
      },
      category_results: results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Crown Hub Scan] error:", msg);
    res.status(500).json({ message: msg });
  }
});

router.post("/api/admin/crown/hubs/:hubId/activate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { hubId } = req.params;
    const { cityId, categorySlugs } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const seasonYear = parseInt(req.body.seasonYear) || 2026;
    const session = req.session as Record<string, unknown>;
    const adminUserId = session.userId as string || "admin";

    const hubCheck = await pool.query("SELECT id FROM regions WHERE id = $1 AND city_id = $2", [hubId, cityId]);
    if (hubCheck.rows.length === 0) return res.status(404).json({ message: "Hub not found in this city" });

    const [activation] = await db.select().from(crownHubActivations)
      .where(and(eq(crownHubActivations.hubId, hubId), eq(crownHubActivations.cityId, cityId), eq(crownHubActivations.seasonYear, seasonYear)));

    if (!activation) return res.status(404).json({ message: "Hub has not been scanned yet. Run a scan first." });
    if (activation.status !== "READY_FOR_ACTIVATION") {
      return res.status(400).json({ message: `Hub is in ${activation.status} state. Must be READY_FOR_ACTIVATION to activate.` });
    }

    const scanResults = activation.scanResults as { categories?: CategoryDiscoveryResult[] } | null;
    const readyCatResults = scanResults?.categories?.filter(c => c.category_status === "READY") || [];
    const slugsToActivate: string[] = Array.isArray(categorySlugs) && categorySlugs.length > 0
      ? categorySlugs
      : readyCatResults.map(c => c.category_slug);

    const createdCategoryIds: string[] = [];
    for (const slug of slugsToActivate) {
      const catResult = readyCatResults.find(c => c.category_slug === slug);
      if (!catResult) continue;

      const existingCat = await pool.query(
        "SELECT id FROM crown_categories WHERE city_id = $1 AND slug = $2 AND season_year = $3",
        [cityId, slug, seasonYear]
      );

      let catId: string;
      if (existingCat.rows.length > 0) {
        catId = existingCat.rows[0].id;
        await pool.query("UPDATE crown_categories SET is_active = true, hub_id = $1 WHERE id = $2", [hubId, catId]);
      } else {
        const launchDef = CROWN_CATEGORIES_LAUNCH.find(c => c.slug === slug);
        const insertResult = await pool.query(
          `INSERT INTO crown_categories (id, city_id, name, slug, competition_level, participant_type, hub_id, season_year, is_active, sort_order)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, $8) RETURNING id`,
          [cityId, catResult.category_name, slug,
           launchDef?.level || "mid", launchDef?.type || "business",
           hubId, seasonYear, createdCategoryIds.length]
        );
        catId = insertResult.rows[0].id;
      }
      createdCategoryIds.push(catId);

      await pool.query(`
        INSERT INTO crown_hub_category_assignments (id, hub_id, category_id, city_id, season_year, is_active)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
        ON CONFLICT (hub_id, category_id, season_year) DO UPDATE SET is_active = true
      `, [hubId, catId, cityId, seasonYear]);

      const qualifiedCandidates = catResult.candidates
        .filter(c => c.ready_for_voting_campaign)
        .sort((a, b) => b.crown_candidate_score - a.crown_candidate_score);

      for (const candidate of qualifiedCandidates) {
        const existingParticipant = await pool.query(
          "SELECT id FROM crown_participants WHERE category_id = $1 AND business_id = $2 AND season_year = $3",
          [catId, candidate.business_id, seasonYear]
        );
        if (existingParticipant.rows.length > 0) continue;

        const participantSlug = (candidate.business_name || "").toLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `biz-${candidate.business_id.slice(0, 8)}`;

        await pool.query(`
          INSERT INTO crown_participants (id, city_id, category_id, hub_id, business_id, name, slug, participant_type, status, season_year, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'business', 'candidate', $7, NOW())
          ON CONFLICT (category_id, slug, season_year) DO NOTHING
        `, [cityId, catId, hubId, candidate.business_id, candidate.business_name, participantSlug, seasonYear]);
      }
    }

    await db.update(crownHubActivations)
      .set({
        status: "NOMINATIONS_OPEN",
        launchedCategoryIds: createdCategoryIds,
        activatedAt: new Date(),
        activatedBy: adminUserId,
        nominationsOpenedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crownHubActivations.id, activation.id));

    const [updated] = await db.select().from(crownHubActivations)
      .where(eq(crownHubActivations.id, activation.id));

    res.json({
      message: `Crown activated for hub. ${createdCategoryIds.length} categories launched.`,
      activation: updated,
      categories_activated: createdCategoryIds.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Crown Hub Activate] error:", msg);
    res.status(500).json({ message: msg });
  }
});

router.patch("/api/admin/crown/hubs/:hubId/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { hubId } = req.params;
    const { status: newStatus, cityId } = req.body;
    const seasonYear = parseInt(req.body.seasonYear) || 2026;

    if (!newStatus) return res.status(400).json({ message: "status required" });
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const hubCheck = await pool.query("SELECT id FROM regions WHERE id = $1 AND city_id = $2", [hubId, cityId]);
    if (hubCheck.rows.length === 0) return res.status(404).json({ message: "Hub not found in this city" });

    const [activation] = await db.select().from(crownHubActivations)
      .where(and(eq(crownHubActivations.hubId, hubId), eq(crownHubActivations.cityId, cityId), eq(crownHubActivations.seasonYear, seasonYear)));

    if (!activation) return res.status(404).json({ message: "No activation found for this hub" });

    const validTransitions = VALID_STATUS_TRANSITIONS[activation.status] || [];
    if (!validTransitions.includes(newStatus)) {
      return res.status(400).json({
        message: `Cannot transition from ${activation.status} to ${newStatus}. Valid: ${validTransitions.join(", ")}`,
      });
    }

    const updates: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
    if (newStatus === "NOMINATIONS_OPEN") updates.nominationsOpenedAt = new Date();
    if (newStatus === "VOTING_OPEN") updates.votingOpenedAt = new Date();
    if (newStatus === "WINNERS_DECLARED") updates.winnersAnnouncedAt = new Date();
    if (newStatus === "ARCHIVED") updates.archivedAt = new Date();

    await db.update(crownHubActivations).set(updates).where(eq(crownHubActivations.id, activation.id));

    const [updated] = await db.select().from(crownHubActivations)
      .where(eq(crownHubActivations.id, activation.id));

    res.json({ activation: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Crown Hub Status] error:", msg);
    res.status(500).json({ message: msg });
  }
});

router.get("/api/admin/crown/config", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = req.query;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;
    const config = await getOrCreateConfig(cityId as string, seasonYear);
    res.json(config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

router.patch("/api/admin/crown/config", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId, seasonYear: sy, minCategoriesForLaunch, minQualifiedBusinesses,
            categoryThresholds, defaultCategoryMinimum, scanRadiusMiles } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const seasonYear = parseInt(sy) || 2026;
    const config = await getOrCreateConfig(cityId, seasonYear);

    const updates: Partial<CrownHubConfig> = { updatedAt: new Date() };
    if (minCategoriesForLaunch !== undefined) updates.minCategoriesForLaunch = parseInt(minCategoriesForLaunch);
    if (minQualifiedBusinesses !== undefined) updates.minQualifiedBusinesses = parseInt(minQualifiedBusinesses);
    if (categoryThresholds !== undefined) updates.categoryThresholds = categoryThresholds;
    if (defaultCategoryMinimum !== undefined) updates.defaultCategoryMinimum = parseInt(defaultCategoryMinimum);
    if (scanRadiusMiles !== undefined) updates.scanRadiusMiles = parseInt(scanRadiusMiles);

    await db.update(crownHubConfig).set(updates).where(eq(crownHubConfig.id, config.id));
    const [updated] = await db.select().from(crownHubConfig).where(eq(crownHubConfig.id, config.id));
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

router.get("/api/admin/crown/hubs/:hubId/readiness", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { hubId } = req.params;
    const { cityId } = req.query;
    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    const hubCheck = await pool.query("SELECT id, name FROM regions WHERE id = $1 AND city_id = $2", [hubId, cityId]);
    if (hubCheck.rows.length === 0) return res.status(404).json({ message: "Hub not found in this city" });

    const [activation] = await db.select().from(crownHubActivations)
      .where(and(eq(crownHubActivations.hubId, hubId), eq(crownHubActivations.cityId, cityId as string), eq(crownHubActivations.seasonYear, seasonYear)));

    if (!activation) {
      return res.json({
        hub_id: hubId,
        hub_name: hubCheck.rows[0].name,
        status: "INACTIVE",
        needs_scan: true,
        activation: null,
      });
    }
    const scanResults = activation.scanResults as { categories?: CategoryDiscoveryResult[] } | null;

    res.json({
      hub_id: hubId,
      hub_name: hubCheck.rows[0]?.name || "Unknown",
      status: activation.status,
      needs_scan: !activation.lastScannedAt,
      activation,
      category_results: scanResults?.categories || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message: msg });
  }
});

function renderCrownMergeTags(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

async function getCrownEmailContent(
  templateKey: "crown_nomination_invite" | "crown_follow_up" | "crown_claim_listing",
  vars: { businessName: string; claimUrl: string; categoryName: string; followUpNumber?: number }
): Promise<{ subject: string; html: string }> {
  const [template] = await db.select().from(emailTemplates)
    .where(eq(emailTemplates.templateKey, templateKey));
  if (!template?.htmlBody || !template?.subject) {
    throw new Error(`Crown email template '${templateKey}' not found in email_templates table. Run ensureCrownTables() to seed templates.`);
  }
  const mergeVars: Record<string, string> = {
    businessName: vars.businessName,
    name: vars.businessName,
    claimUrl: vars.claimUrl,
    categoryName: vars.categoryName,
  };
  if (vars.followUpNumber) mergeVars.followUpNumber = String(vars.followUpNumber);
  return {
    subject: renderCrownMergeTags(template.subject, mergeVars),
    html: renderCrownMergeTags(template.htmlBody, mergeVars),
  };
}

async function sendCrownOutreachEmail(
  to: string,
  templateKey: "crown_nomination_invite" | "crown_follow_up" | "crown_claim_listing",
  vars: { businessName: string; claimUrl: string; categoryName: string; followUpNumber?: number },
  cityId?: string
): Promise<boolean> {
  const templateToMessagingKey: Record<string, string> = {
    crown_nomination_invite: "nominee_invitation",
    crown_follow_up: "profile_completion_reminder",
    crown_claim_listing: "claim_invitation",
  };
  const messagingKey = templateToMessagingKey[templateKey];
  const messaging = generateClaimMessaging({
    hub_name: "",
    business_name: vars.businessName,
    category_name: vars.categoryName,
    claim_link: vars.claimUrl,
    voting_link: "",
  });
  const generated = (messaging[messagingKey] || {}) as Record<string, unknown>;
  const generatedEmail = generated.email as { subject: string; body: string } | undefined;

  let subject: string;
  let html: string;
  if (generatedEmail) {
    subject = generatedEmail.subject;
    html = generatedEmail.body;
  } else {
    const fallback = await getCrownEmailContent(templateKey, vars);
    subject = fallback.subject;
    html = fallback.html;
  }

  const { sendClaimEmail } = await import("./routes");
  const result = await sendClaimEmail(to, vars.businessName, vars.claimUrl, "", undefined, undefined, subject, undefined, html);

  try {
    const { recordPlatformMessage } = await import("./message-center-routes");
    await recordPlatformMessage({
      cityId: cityId || null,
      sourceEngine: "crown",
      channel: "email",
      status: result ? "sent" : "failed",
      recipientAddress: to,
      recipientName: vars.businessName,
      subject,
      bodyPreview: html.substring(0, 500),
      metadata: { templateKey, messagingKey, categoryName: vars.categoryName },
    });
  } catch (logErr) {
    console.warn("[CrownOutreach] Failed to log outreach email:", logErr instanceof Error ? logErr.message : logErr);
  }

  return result;
}

router.post("/api/admin/crown/candidates/import", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId, candidates } = req.body;
    if (!cityId || !Array.isArray(candidates)) return res.status(400).json({ message: "cityId and candidates array required" });

    let imported = 0;
    let updated = 0;
    for (const c of candidates) {
      if (!c.name || !c.categoryId) continue;
      const slug = c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const existing = await db.select({ id: crownParticipants.id }).from(crownParticipants)
        .where(and(eq(crownParticipants.categoryId, c.categoryId), eq(crownParticipants.slug, slug), eq(crownParticipants.seasonYear, 2026)));

      const score = c.score || c.crownCandidateScore || 0;
      const tier: CrownInviteTier = toTier(score);
      const priority = score >= 80 ? 1 : score >= 50 ? 2 : 3;

      const readyForVenueTv = score >= 85;
      const readyForCreatorFeature = score >= 70;
      const readyForCrownStory = score >= 60;

      if (existing.length > 0) {
        await db.update(crownParticipants).set({
          crownCandidateScore: score,
          inviteTier: tier,
          invitePriority: priority,
          categoryMatchReason: c.categoryMatchReason || null,
          readyForVenueTv,
          readyForCreatorFeature,
          readyForCrownStory,
          ...(c.email ? { email: c.email } : {}),
          ...(c.phone ? { phone: c.phone } : {}),
          ...(c.websiteUrl ? { websiteUrl: c.websiteUrl } : {}),
          ...(c.socialLinks ? { socialLinks: c.socialLinks } : {}),
          ...(c.hubId ? { hubId: c.hubId } : {}),
          ...(c.businessId ? { businessId: c.businessId } : {}),
        }).where(eq(crownParticipants.id, existing[0].id));
        updated++;
      } else {
        await db.insert(crownParticipants).values({
          cityId,
          categoryId: c.categoryId,
          name: c.name,
          slug,
          participantType: c.participantType || "business",
          status: "candidate",
          email: c.email || null,
          phone: c.phone || null,
          imageUrl: c.imageUrl || null,
          bio: c.bio || null,
          websiteUrl: c.websiteUrl || null,
          socialLinks: c.socialLinks || null,
          inviteToken: crypto.randomBytes(16).toString("hex"),
          crownCandidateScore: score,
          inviteTier: tier,
          invitePriority: priority,
          categoryMatchReason: c.categoryMatchReason || null,
          readyForVenueTv,
          readyForCreatorFeature,
          readyForCrownStory,
          hubId: c.hubId || null,
          businessId: c.businessId || null,
          seasonYear: 2026,
        });
        imported++;
      }
    }

    res.json({ imported, updated, total: candidates.length });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/outreach/send-invitation", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { participantId, channel } = req.body;
    if (!participantId) return res.status(400).json({ message: "participantId required" });

    const [participant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId));
    if (!participant) return res.status(404).json({ message: "Participant not found" });

    const [category] = await db.select().from(crownCategories).where(eq(crownCategories.id, participant.categoryId));
    const categoryName = category?.name || "Crown Award";

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const nextFollowUp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const city = await db.select().from(cities).where(eq(cities.id, participant.cityId)).then(r => r[0]);
    const citySlug = city?.slug || "charlotte";
    const appUrl = process.env.APP_PUBLIC_URL || `https://cltcityhub.com`;
    const claimUrl = `${appUrl}/${citySlug}/crown/invitation/${token}`;

    const existingInvitation = await db.select().from(crownInvitations)
      .where(eq(crownInvitations.participantId, participantId))
      .then(r => r[0]);

    let invitation: CrownInvitation;
    if (existingInvitation) {
      [invitation] = await db.update(crownInvitations).set({
        inviteToken: token,
        invitationChannel: toChannel(channel),
        invitationStatus: "SENT",
        invitedAt: new Date(),
        expiresAt,
        nextFollowUpAt: nextFollowUp,
        status: "sent",
      }).where(eq(crownInvitations.id, existingInvitation.id)).returning();
    } else {
      [invitation] = await db.insert(crownInvitations).values({
        participantId,
        categoryId: participant.categoryId,
        hubId: participant.hubId || null,
        cityId: participant.cityId,
        inviteToken: token,
        invitationChannel: toChannel(channel),
        invitationStatus: "SENT",
        expiresAt,
        nextFollowUpAt: nextFollowUp,
        status: "sent",
      }).returning();
    }

    await db.update(crownParticipants).set({
      status: "invited",
      inviteToken: token,
      invitedAt: new Date(),
    }).where(eq(crownParticipants.id, participantId));

    if (participant.email && (channel === "email" || !channel)) {
      await sendCrownOutreachEmail(participant.email, "crown_nomination_invite", {
        businessName: participant.name, claimUrl, categoryName,
      });
    }

    res.json({ invitation, claimUrl });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/outreach/batch-send", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId, hubId, tier, channel, limit: sendLimit } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    let conditions: any[] = [
      eq(crownParticipants.cityId, cityId),
      eq(crownParticipants.status, "candidate"),
    ];
    if (hubId) conditions.push(eq(crownParticipants.hubId, hubId));
    if (tier && VALID_TIERS.has(tier)) conditions.push(eq(crownParticipants.inviteTier, tier as CrownInviteTier));

    const candidates = await db.select().from(crownParticipants)
      .where(and(...conditions))
      .orderBy(sql`${crownParticipants.invitePriority} ASC NULLS LAST`, sql`${crownParticipants.crownCandidateScore} DESC NULLS LAST`)
      .limit(sendLimit || 50);

    let sent = 0;
    for (const candidate of candidates) {
      try {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const nextFollowUp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        const city = await db.select().from(cities).where(eq(cities.id, candidate.cityId)).then(r => r[0]);
        const citySlug = city?.slug || "charlotte";
        const appUrl = process.env.APP_PUBLIC_URL || `https://cltcityhub.com`;
        const claimUrl = `${appUrl}/${citySlug}/crown/invitation/${token}`;

        const [category] = await db.select().from(crownCategories).where(eq(crownCategories.id, candidate.categoryId));
        const categoryName = category?.name || "Crown Award";

        const existingInv = await db.select().from(crownInvitations)
          .where(eq(crownInvitations.participantId, candidate.id))
          .then(r => r[0]);

        if (existingInv) {
          await db.update(crownInvitations).set({
            inviteToken: token,
            invitationChannel: toChannel(channel),
            invitationStatus: "SENT",
            invitedAt: new Date(),
            expiresAt,
            nextFollowUpAt: nextFollowUp,
            status: "sent",
          }).where(eq(crownInvitations.id, existingInv.id));
        } else {
          await db.insert(crownInvitations).values({
            participantId: candidate.id,
            categoryId: candidate.categoryId,
            hubId: candidate.hubId || null,
            cityId: candidate.cityId,
            inviteToken: token,
            invitationChannel: toChannel(channel),
            invitationStatus: "SENT",
            expiresAt,
            nextFollowUpAt: nextFollowUp,
            status: "sent",
          });
        }

        await db.update(crownParticipants).set({
          status: "invited",
          inviteToken: token,
          invitedAt: new Date(),
        }).where(eq(crownParticipants.id, candidate.id));

        if (candidate.email && (channel === "email" || !channel)) {
          await sendCrownOutreachEmail(candidate.email, "crown_nomination_invite", {
            businessName: candidate.name, claimUrl, categoryName,
          });
        }

        sent++;
      } catch (err: any) {
        console.error(`[Crown-Outreach] Error sending to ${candidate.name}:`, err.message);
      }
    }

    res.json({ sent, total: candidates.length });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/outreach/mark-contacted", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { participantId, channel } = req.body;
    if (!participantId) return res.status(400).json({ message: "participantId required" });

    await db.update(crownParticipants).set({
      status: "invited",
      invitedAt: new Date(),
    }).where(eq(crownParticipants.id, participantId));

    const existingInv = await db.select().from(crownInvitations)
      .where(eq(crownInvitations.participantId, participantId)).then(r => r[0]);

    if (existingInv) {
      await db.update(crownInvitations).set({
        invitationChannel: toChannel(channel, "admin_manual"),
        invitationStatus: "SENT",
        invitedAt: new Date(),
        status: "sent",
      }).where(eq(crownInvitations.id, existingInv.id));
    } else {
      const [participant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId));
      if (participant) {
        const token = participant.inviteToken || crypto.randomBytes(32).toString("hex");
        if (!participant.inviteToken) {
          await db.update(crownParticipants).set({ inviteToken: token }).where(eq(crownParticipants.id, participantId));
        }
        await db.insert(crownInvitations).values({
          participantId,
          categoryId: participant.categoryId,
          hubId: participant.hubId || null,
          cityId: participant.cityId,
          inviteToken: token,
          invitationChannel: toChannel(channel, "admin_manual"),
          invitationStatus: "SENT",
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: "sent",
        });
      }
    }

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/outreach/mark-declined", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { participantId } = req.body;
    if (!participantId) return res.status(400).json({ message: "participantId required" });

    const existingInv = await db.select().from(crownInvitations)
      .where(eq(crownInvitations.participantId, participantId)).then(r => r[0]);

    if (existingInv) {
      await db.update(crownInvitations).set({
        invitationStatus: "DECLINED",
        declinedAt: new Date(),
        status: "declined",
      }).where(eq(crownInvitations.id, existingInv.id));
    } else {
      const [participant] = await db.select().from(crownParticipants).where(eq(crownParticipants.id, participantId));
      if (participant) {
        const token = participant.inviteToken || crypto.randomBytes(32).toString("hex");
        if (!participant.inviteToken) {
          await db.update(crownParticipants).set({ inviteToken: token }).where(eq(crownParticipants.id, participantId));
        }
        await db.insert(crownInvitations).values({
          participantId,
          categoryId: participant.categoryId,
          hubId: participant.hubId || null,
          cityId: participant.cityId,
          inviteToken: token,
          invitationChannel: "admin_manual" satisfies CrownInvitationChannel,
          invitationStatus: "DECLINED",
          declinedAt: new Date(),
          status: "declined",
        });
      }
    }

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/outreach/candidates", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const hubId = req.query.hubId as string;
    const status = req.query.status as string;
    const tier = req.query.tier as string;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    let conditions: any[] = [eq(crownParticipants.cityId, cityId)];
    if (hubId) conditions.push(eq(crownParticipants.hubId, hubId));
    if (status && VALID_STATUSES.has(status)) conditions.push(eq(crownParticipants.status, status as CrownParticipantStatus));
    if (tier && VALID_TIERS.has(tier)) conditions.push(eq(crownParticipants.inviteTier, tier as CrownInviteTier));

    const results = await db.select({
      participant: crownParticipants,
      categoryName: crownCategories.name,
      categorySlug: crownCategories.slug,
    })
      .from(crownParticipants)
      .leftJoin(crownCategories, eq(crownParticipants.categoryId, crownCategories.id))
      .where(and(...conditions))
      .orderBy(sql`${crownParticipants.invitePriority} ASC NULLS LAST`, sql`${crownParticipants.crownCandidateScore} DESC NULLS LAST`);

    const participantIds = results.map(r => r.participant.id);
    let invitationMap: Record<string, any> = {};
    if (participantIds.length > 0) {
      const invitations = await db.select().from(crownInvitations)
        .where(inArray(crownInvitations.participantId, participantIds));
      for (const inv of invitations) {
        invitationMap[inv.participantId] = inv;
      }
    }

    res.json(results.map(r => ({
      ...r.participant,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      invitation: invitationMap[r.participant.id] || null,
    })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/api/admin/crown/outreach/process-follow-ups", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const now = new Date();

    const dueInvitations = await db.select({
      invitation: crownInvitations,
      participantName: crownParticipants.name,
      participantEmail: crownParticipants.email,
      categoryName: crownCategories.name,
      cityId: crownParticipants.cityId,
    })
      .from(crownInvitations)
      .innerJoin(crownParticipants, eq(crownInvitations.participantId, crownParticipants.id))
      .leftJoin(crownCategories, eq(crownInvitations.categoryId, crownCategories.id))
      .where(and(
        inArray(crownInvitations.invitationStatus, ["SENT", "VIEWED"]),
        sql`${crownInvitations.nextFollowUpAt} <= ${now}`,
        sql`${crownInvitations.followUpCount} < 3`,
      ));

    let sent = 0;
    for (const row of dueInvitations) {
      const inv = row.invitation;
      const followUpNumber = inv.followUpCount + 1;

      const nextFollowUp = followUpNumber < 3
        ? new Date(now.getTime() + (followUpNumber === 1 ? 4 : 7) * 24 * 60 * 60 * 1000)
        : null;

      const city = await db.select().from(cities).where(eq(cities.id, row.cityId)).then(r => r[0]);
      const citySlug = city?.slug || "charlotte";
      const appUrl = process.env.APP_PUBLIC_URL || `https://cltcityhub.com`;
      const claimUrl = `${appUrl}/${citySlug}/crown/invitation/${inv.inviteToken}`;

      if (row.participantEmail) {
        await sendCrownOutreachEmail(row.participantEmail, "crown_follow_up", {
          businessName: row.participantName, claimUrl, categoryName: row.categoryName || "Crown Award", followUpNumber,
        });
      }

      await db.update(crownInvitations).set({
        followUpCount: followUpNumber,
        lastFollowUpAt: now,
        nextFollowUpAt: nextFollowUp,
      }).where(eq(crownInvitations.id, inv.id));

      sent++;
    }

    res.json({ processed: sent, total: dueInvitations.length });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/api/admin/crown/outreach/conversion-metrics", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const cityId = req.query.cityId as string;
    const hubId = req.query.hubId as string;
    if (!cityId) return res.status(400).json({ message: "cityId required" });

    let participantConditions: any[] = [eq(crownParticipants.cityId, cityId)];
    if (hubId) participantConditions.push(eq(crownParticipants.hubId, hubId));

    const [totalCandidates] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownParticipants).where(and(...participantConditions));

    let invConditions: any[] = [eq(crownInvitations.cityId, cityId)];
    if (hubId) invConditions.push(eq(crownInvitations.hubId, hubId));

    const [invSent] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownInvitations)
      .where(and(...invConditions, inArray(crownInvitations.invitationStatus, ["SENT", "VIEWED", "CLAIM_STARTED", "CLAIM_COMPLETED"])));

    const [invViewed] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownInvitations)
      .where(and(...invConditions, inArray(crownInvitations.invitationStatus, ["VIEWED", "CLAIM_STARTED", "CLAIM_COMPLETED"])));

    const [claimsStarted] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownInvitations)
      .where(and(...invConditions, inArray(crownInvitations.invitationStatus, ["CLAIM_STARTED", "CLAIM_COMPLETED"])));

    const [claimsCompleted] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownInvitations)
      .where(and(...invConditions, eq(crownInvitations.invitationStatus, "CLAIM_COMPLETED")));

    const [participantsActivated] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownParticipants)
      .where(and(...participantConditions, inArray(crownParticipants.status, ["verified_participant", "nominee", "qualified_nominee", "crown_winner"])));

    const [nomineesCreated] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownParticipants)
      .where(and(...participantConditions, inArray(crownParticipants.status, ["nominee", "qualified_nominee", "crown_winner"])));

    const [pendingOutreach] = await db.select({ count: sql<number>`count(*)::int` })
      .from(crownParticipants)
      .where(and(...participantConditions, eq(crownParticipants.status, "candidate")));

    res.json({
      totalCandidates: totalCandidates.count,
      invitationsSent: invSent.count,
      invitationsViewed: invViewed.count,
      claimsStarted: claimsStarted.count,
      claimsCompleted: claimsCompleted.count,
      participantsActivated: participantsActivated.count,
      nomineesCreated: nomineesCreated.count,
      pendingOutreach: pendingOutreach.count,
    });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export async function handleCrownClaimCompletion(businessId: string): Promise<void> {
  try {
    const participants = await db.select().from(crownParticipants)
      .where(eq(crownParticipants.businessId, businessId));

    for (const participant of participants) {
      const invitations = await db.select().from(crownInvitations)
        .where(eq(crownInvitations.participantId, participant.id));

      for (const inv of invitations) {
        await db.update(crownInvitations).set({
          invitationStatus: "CLAIM_COMPLETED",
          claimCompletedAt: new Date(),
          status: "accepted",
          acceptedAt: new Date(),
        }).where(eq(crownInvitations.id, inv.id));
      }

      await db.update(crownParticipants).set({
        status: "verified_participant",
        verifiedAt: new Date(),
      }).where(eq(crownParticipants.id, participant.id));

      const [category] = await db.select().from(crownCategories)
        .where(eq(crownCategories.id, participant.categoryId));

      if (category) {
        await db.update(crownParticipants).set({
          status: "nominee",
          nominatedAt: new Date(),
        }).where(eq(crownParticipants.id, participant.id));
      }

      if (participant.email) {
        const city = await db.select().from(cities).where(eq(cities.id, participant.cityId)).then(r => r[0]);
        const citySlug = city?.slug || "charlotte";
        const appUrl = process.env.APP_PUBLIC_URL || `https://cltcityhub.com`;
        const profileUrl = `${appUrl}/${citySlug}/crown`;
        const categoryName = category?.name || "Crown Award";
        try {
          await sendCrownOutreachEmail(participant.email, "crown_claim_listing", {
            businessName: participant.name, claimUrl: profileUrl, categoryName,
          });
        } catch (emailErr) {
          console.log(`[Crown-Claim] Claim confirmation email failed for ${participant.email}:`, emailErr);
        }
      }
    }

    if (participants.length > 0) {
      console.log(`[Crown-Claim] Business ${businessId}: ${participants.length} Crown participants transitioned (verified_participant → nominee)`);
    }
  } catch (err: any) {
    console.error(`[Crown-Claim] Error processing Crown claim completion for ${businessId}:`, err.message);
  }
}

const CAMPAIGN_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["READY"],
  READY: ["LAUNCHED", "DRAFT"],
  LAUNCHED: ["NOMINATIONS_OPEN", "ARCHIVED"],
  NOMINATIONS_OPEN: ["VOTING_OPEN", "ARCHIVED"],
  VOTING_OPEN: ["WINNERS_ANNOUNCED", "ARCHIVED"],
  WINNERS_ANNOUNCED: ["ARCHIVED"],
  ARCHIVED: [],
};

function applyTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
  }
  return result;
}

function generateLaunchContent(campaign: Record<string, unknown>, hubName: string, categories: string[]): Record<string, unknown> {
  const headline = (campaign.headline as string) || `Crown Awards are live in ${hubName}`;
  const subheadline = (campaign.subheadline as string) || `Charlotte's community-powered recognition program`;
  const year = campaign.season_year || 2026;
  return {
    stage: "launch",
    headline,
    subheadline,
    summary: `The ${year} Crown Awards are now live in ${hubName}. ${categories.length} categories celebrating the best local businesses, creators, and community organizations.`,
    how_to_participate: `Get nominated or self-nominate in any of the ${categories.length} categories. Claim your listing on CLT Metro Hub to activate your participation.`,
    how_to_vote: `Community voting opens soon. Verified accounts can vote once per category per hub.`,
    claim_your_listing: `Claim your free Hub Presence listing to be eligible for Crown Awards recognition.`,
    launch_cta: `Explore ${hubName} Crown Awards`,
    formats: {
      hub_banner: { headline, subheadline, cta: `Explore ${hubName} Crown Awards` },
      pulse_story: { title: headline, body: `The ${year} Crown Awards are now live in ${hubName}. ${categories.length} categories open for nominations.`, cta: `See categories` },
      email_block: { subject: `${hubName} Crown Awards ${year} — Now Live`, preview: `${categories.length} categories celebrating Charlotte's best.`, cta: `Explore awards` },
      social_caption: `The ${year} Crown Awards are live in ${hubName}! ${categories.length} categories celebrating Charlotte's best local businesses. #CrownAwards #CLTMetroHub`,
      venue_tv: { line1: `Crown Awards — ${hubName}`, line2: `${categories.length} Categories Now Open`, line3: `Vote for Charlotte's Best` },
    },
    categories_featured: categories,
    generated_at: new Date().toISOString(),
  };
}

function generateNominationsContent(campaign: Record<string, unknown>, hubName: string, nomineeCount: number): Record<string, unknown> {
  const year = campaign.season_year || 2026;
  return {
    stage: "nominations",
    headline: `Nominations Open — ${hubName} Crown Awards ${year}`,
    subheadline: `${nomineeCount} nominees and counting`,
    summary: `Nominations are officially open for the ${hubName} Crown Awards. Know a great local business or creator? Nominate them now.`,
    formats: {
      hub_banner: { headline: `Nominations Open`, subheadline: `${nomineeCount} nominees so far`, cta: `Nominate now` },
      pulse_story: { title: `${hubName} Crown Awards — Nominations Open`, body: `${nomineeCount} local favorites nominated so far. Submit your nomination before voting begins.` },
      email_block: { subject: `Nominate Charlotte's Best — ${hubName} Crown Awards`, preview: `Nominations are open. ${nomineeCount} nominees and counting.` },
      social_caption: `Nominations are OPEN for ${hubName} Crown Awards! ${nomineeCount} nominees so far. Who deserves Charlotte's Crown? #CrownAwards`,
      venue_tv: { line1: `Crown Awards Nominations`, line2: `${hubName} — ${nomineeCount} Nominees`, line3: `Nominate at CLT Metro Hub` },
    },
    generated_at: new Date().toISOString(),
  };
}

function generateVotingContent(campaign: Record<string, unknown>, hubName: string, categoryCount: number, nomineeCount: number): Record<string, unknown> {
  const year = campaign.season_year || 2026;
  const votingCloseDate = campaign.voting_close_at ? new Date(campaign.voting_close_at as string).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "soon";
  return {
    stage: "voting",
    headline: `Vote Now — ${hubName} Crown Awards ${year}`,
    subheadline: `${nomineeCount} nominees across ${categoryCount} categories`,
    summary: `Community voting is live for the ${hubName} Crown Awards. Cast your vote for Charlotte's best in ${categoryCount} categories.`,
    vote_now_messages: [
      `Vote for your favorites in the ${hubName} Crown Awards. Every vote counts.`,
      `${nomineeCount} nominees, ${categoryCount} categories. Who gets your vote?`,
      `Voting closes ${votingCloseDate}. Make your voice heard.`,
    ],
    category_vote_prompt: `Which [CATEGORY] business deserves the Crown? Cast your vote before ${votingCloseDate}.`,
    nominee_share_copy: {
      template: `I'm a Crown Award nominee for [CATEGORY] in ${hubName}! Vote for us: [VOTING_LINK]`,
      social: `Proud to be nominated for [CATEGORY] in the ${hubName} Crown Awards ${year}. Your vote means everything! #CrownAwards`,
      email_ask: `Hey! I've been nominated for [CATEGORY] in the ${hubName} Crown Awards. Would love your vote — it takes just a minute.`,
    },
    formats: {
      hub_banner: { headline: `Vote Now`, subheadline: `${categoryCount} categories open for voting`, cta: `Cast your vote` },
      pulse_story: { title: `Vote Now — ${hubName} Crown Awards`, body: `${nomineeCount} nominees across ${categoryCount} categories. Voting closes ${votingCloseDate}.` },
      email_block: { subject: `Vote Now — ${hubName} Crown Awards ${year}`, preview: `${nomineeCount} nominees need your vote. Voting closes ${votingCloseDate}.` },
      social_caption: `VOTE NOW! ${hubName} Crown Awards ${year} — ${nomineeCount} nominees, ${categoryCount} categories. Voting closes ${votingCloseDate}. #CrownAwards #CLTMetroHub`,
      qr_short_cta: `Scan to vote for Charlotte's best`,
      venue_tv: { line1: `VOTE NOW`, line2: `${hubName} Crown Awards`, line3: `${categoryCount} Categories — Closes ${votingCloseDate}` },
      creator_angle: `Cover the top contenders in ${hubName}. Interview nominees about what the Crown means to their business.`,
      print_ballot: { headline: `${hubName} Crown Awards ${year}`, instruction: `Vote online or scan QR code`, categories_count: categoryCount },
    },
    generated_at: new Date().toISOString(),
  };
}

function generateWinnersContent(campaign: Record<string, unknown>, hubName: string, winners: Array<{ name: string; category: string }>): Record<string, unknown> {
  const year = campaign.season_year || 2026;
  const winnerNames = winners.map(w => w.name).slice(0, 5);
  return {
    stage: "winners",
    headline: `${year} ${hubName} Crown Award Winners`,
    subheadline: `Charlotte has spoken — meet the winners`,
    short_announcement: `Congratulations to the ${year} ${hubName} Crown Award winners! ${winners.length} categories, ${winners.length} champions chosen by the community.`,
    long_announcement: `The votes are in. Charlotte's community has spoken, and the ${year} ${hubName} Crown Award winners have been crowned. From ${winners.length} categories spanning local businesses, creators, and community organizations, these winners represent the best of what ${hubName} has to offer.`,
    formats: {
      hub_banner: { headline: `${year} Crown Winners`, subheadline: `${winners.length} winners announced`, cta: `See all winners` },
      pulse_story: { title: `${year} ${hubName} Crown Award Winners Announced`, body: `${winners.length} winners chosen by Charlotte's community.`, featured: winnerNames },
      email_block: { subject: `${year} ${hubName} Crown Award Winners Announced`, preview: `${winners.length} winners chosen by the community. See who earned the Crown.` },
      social_caption: `Congratulations to the ${year} ${hubName} Crown Award Winners! ${winners.length} categories, chosen by Charlotte. #CrownAwards #CLTMetroHub`,
      venue_tv: { line1: `CROWN WINNERS ${year}`, line2: hubName, line3: `${winners.length} Categories — Congratulations!` },
      badge_text: `${year} Crown Award Winner`,
      certificate_text: `This certifies that {{business_name}} has been awarded the ${year} Crown Award for {{category_name}} in ${hubName}, as voted by the Charlotte community through CLT Metro Hub.`,
      window_cling_text: `${year} Crown Award Winner — ${hubName}`,
    },
    winners: winners.map(w => ({ name: w.name, category: w.category, badge: `${year} Crown Award Winner`, certificate: `${year} Crown Award — ${w.category}` })),
    generated_at: new Date().toISOString(),
  };
}

function generateFinalistsContent(campaign: Record<string, unknown>, hubName: string, finalistCount: number, categoryCount: number): Record<string, unknown> {
  const year = campaign.season_year || 2026;
  return {
    stage: "finalists",
    headline: `${year} ${hubName} Crown Finalists Announced`,
    subheadline: `${finalistCount} finalists across ${categoryCount} categories`,
    short_announcement: `${finalistCount} finalists have been selected across ${categoryCount} categories in the ${year} ${hubName} Crown Awards. Community voting is next.`,
    long_announcement: `The field has narrowed. After nominations closed, ${finalistCount} businesses and organizations across ${categoryCount} categories have made the cut as ${year} ${hubName} Crown Award finalists. These finalists represent the best of Charlotte — and now it is up to the community to choose the winners. Voting opens soon.`,
    formats: {
      hub_banner: { headline: `${year} Crown Finalists`, subheadline: `${finalistCount} finalists across ${categoryCount} categories`, cta: "See the finalists" },
      pulse_story: { title: `${year} ${hubName} Crown Finalists Revealed`, body: `${finalistCount} finalists selected across ${categoryCount} categories. Community voting opens soon.` },
      email_block: { subject: `${year} ${hubName} Crown Finalists — Voting Opens Soon`, preview: `${finalistCount} finalists across ${categoryCount} categories. See who made the cut.` },
      social_caption: `${finalistCount} finalists announced for the ${year} ${hubName} Crown Awards! Community voting opens soon. #CrownAwards #CLTMetroHub`,
      venue_tv: { headline: `CROWN FINALISTS ${year}`, subheadline: hubName, bodyLine: `${finalistCount} Finalists — Voting Next` },
      creator_angle: `Cover the ${year} ${hubName} Crown finalists. Interview top contenders about their journey and what community recognition means.`,
    },
    generated_at: new Date().toISOString(),
  };
}

function generateClaimMessaging(vars: Record<string, string>): Record<string, unknown> {
  const defaults = { hub_name: "", business_name: "", category_name: "", claim_link: "", voting_link: "", deadline: "14 days" };
  const v = { ...defaults, ...vars };
  return {
    claim_invitation: {
      email: { subject: `${v.business_name} — You've been nominated for a Crown Award`, body: `Congratulations, ${v.business_name}! You've been nominated for ${v.category_name} in the ${v.hub_name} Crown Awards. Claim your listing to participate: ${v.claim_link}` },
      sms: `${v.business_name}: Nominated for ${v.category_name} Crown Award in ${v.hub_name}. Claim now: ${v.claim_link}`,
      print: `Dear ${v.business_name},\n\nYou have been nominated for ${v.category_name} in the ${v.hub_name} Crown Awards. To participate, visit: ${v.claim_link}\n\nExpires: ${v.deadline}`,
      admin_copy: `${v.business_name} nominated for ${v.category_name}. Claim link: ${v.claim_link}`,
    },
    nominee_notification: {
      email: { subject: `You're a Crown Nominee — ${v.category_name}`, body: `${v.business_name}, you are now an official Crown Award nominee for ${v.category_name} in ${v.hub_name}. Community voting begins soon.` },
      sms: `${v.business_name}: You're an official Crown nominee for ${v.category_name}! Voting opens soon.`,
      print: `Dear ${v.business_name},\n\nCongratulations! You are now an official Crown Award nominee for ${v.category_name} in ${v.hub_name}. Community voting begins soon.`,
      admin_copy: `${v.business_name} confirmed as Crown nominee for ${v.category_name}.`,
    },
    nominee_invitation: {
      email: { subject: `Crown Award Nomination Invitation — ${v.category_name}`, body: `${v.business_name}, we'd like to invite you to participate as a Crown Award nominee for ${v.category_name} in ${v.hub_name}. Your business has been recognized by the community. Accept your nomination: ${v.claim_link}` },
      sms: `${v.business_name}: Invited to join the ${v.hub_name} Crown Awards for ${v.category_name}. Accept: ${v.claim_link}`,
      print: `Dear ${v.business_name},\n\nYou are invited to participate in the ${v.hub_name} Crown Awards as a nominee for ${v.category_name}. To accept this invitation, visit: ${v.claim_link}\n\nDeadline: ${v.deadline}`,
      admin_copy: `Nominee invitation sent to ${v.business_name} for ${v.category_name}. Claim: ${v.claim_link}`,
    },
    profile_completion_reminder: {
      email: { subject: `Complete your Crown profile — ${v.business_name}`, body: `${v.business_name}, your Crown Award profile for ${v.category_name} is incomplete. A complete profile helps voters find and support you.` },
      sms: `${v.business_name}: Complete your Crown profile to maximize votes. Visit your listing now.`,
      print: `Dear ${v.business_name},\n\nYour Crown Award profile for ${v.category_name} is incomplete. Please update it so voters can learn more about your business.`,
      admin_copy: `Profile completion reminder sent to ${v.business_name} for ${v.category_name}.`,
    },
    voting_share_reminder: {
      email: { subject: `Share your Crown voting link — ${v.category_name}`, body: `${v.business_name}, voting is live for ${v.category_name} in ${v.hub_name}. Share your voting link with supporters: ${v.voting_link}` },
      sms: `${v.business_name}: Voting is LIVE. Share your link: ${v.voting_link}`,
      print: `Dear ${v.business_name},\n\nVoting is now live for ${v.category_name} in ${v.hub_name}. Share your voting link with your customers and community: ${v.voting_link}`,
      admin_copy: `Voting share reminder sent to ${v.business_name}. Link: ${v.voting_link}`,
    },
    generated_at: new Date().toISOString(),
  };
}

router.get("/api/admin/crown/campaigns", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
    if (forbidden) return res.status(403).json({ message: "Not authorized for this city" });
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const hubId = req.query.hubId as string | undefined;
    const status = req.query.status as string | undefined;
    const conditions = ["city_id = $1"];
    const params: unknown[] = [cityId];
    let idx = 2;
    if (hubId) { conditions.push(`hub_id = $${idx++}`); params.push(hubId); }
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    const result = await pool.query(
      `SELECT c.*, r.name as hub_name FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE ${conditions.join(" AND ")} ORDER BY c.updated_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/api/admin/crown/campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const result = await pool.query(
      `SELECT c.*, r.name as hub_name FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const { forbidden } = await getAuthorizedCityId(req, result.rows[0].city_id);
    if (forbidden) return res.status(403).json({ message: "Not authorized for this city" });
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

const createCampaignSchema = z.object({
  cityId: z.string().min(1),
  hubId: z.string().optional(),
  seasonYear: z.number().default(2026),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  description: z.string().optional(),
  rules: z.string().optional(),
  featuredCategories: z.array(z.string()).optional(),
  nominationsOpenAt: z.string().optional(),
  nominationsCloseAt: z.string().optional(),
  votingOpenAt: z.string().optional(),
  votingCloseAt: z.string().optional(),
  winnersAnnounceAt: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

router.post("/api/admin/crown/campaigns", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    const d = parsed.data;
    const { forbidden } = await getAuthorizedCityId(req, d.cityId);
    if (forbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const session = req.session as Record<string, unknown>;
    const adminUser = session.adminUser as Record<string, unknown> | undefined;
    const createdBy = adminUser?.id as string || "admin";
    const result = await pool.query(
      `INSERT INTO crown_campaigns (city_id, hub_id, season_year, headline, subheadline, description, rules, featured_categories, nominations_open_at, nominations_close_at, voting_open_at, voting_close_at, winners_announce_at, config, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [d.cityId, d.hubId || null, d.seasonYear, d.headline || null, d.subheadline || null, d.description || null, d.rules || null, JSON.stringify(d.featuredCategories || []), d.nominationsOpenAt || null, d.nominationsCloseAt || null, d.votingOpenAt || null, d.votingCloseAt || null, d.winnersAnnounceAt || null, JSON.stringify(d.config || {}), createdBy]
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

const updateCampaignSchema = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  description: z.string().optional(),
  rules: z.string().optional(),
  featuredCategories: z.array(z.string()).optional(),
  featuredNominees: z.array(z.string()).optional(),
  nominationsOpenAt: z.string().nullable().optional(),
  nominationsCloseAt: z.string().nullable().optional(),
  votingOpenAt: z.string().nullable().optional(),
  votingCloseAt: z.string().nullable().optional(),
  winnersAnnounceAt: z.string().nullable().optional(),
  config: z.record(z.unknown()).optional(),
});

router.patch("/api/admin/crown/campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const ownerCheck = await pool.query("SELECT city_id FROM crown_campaigns WHERE id = $1", [req.params.id]);
    if (ownerCheck.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const { forbidden } = await getAuthorizedCityId(req, ownerCheck.rows[0].city_id);
    if (forbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const parsed = updateCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    const d = parsed.data;
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      headline: "headline", subheadline: "subheadline", description: "description", rules: "rules",
      nominationsOpenAt: "nominations_open_at", nominationsCloseAt: "nominations_close_at",
      votingOpenAt: "voting_open_at", votingCloseAt: "voting_close_at", winnersAnnounceAt: "winners_announce_at",
    };
    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      const val = d[jsKey as keyof typeof d];
      if (val !== undefined) { fields.push(`${dbCol} = $${idx++}`); params.push(val); }
    }
    if (d.featuredCategories !== undefined) { fields.push(`featured_categories = $${idx++}`); params.push(JSON.stringify(d.featuredCategories)); }
    if (d.featuredNominees !== undefined) { fields.push(`featured_nominees = $${idx++}`); params.push(JSON.stringify(d.featuredNominees)); }
    if (d.config !== undefined) { fields.push(`config = $${idx++}`); params.push(JSON.stringify(d.config)); }
    if (fields.length === 0) return res.status(400).json({ message: "No fields to update" });
    fields.push("updated_at = NOW()");
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE crown_campaigns SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/api/admin/crown/campaigns/:id/transition", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { targetStatus } = req.body;
    if (!targetStatus) return res.status(400).json({ message: "targetStatus required" });
    const existing = await pool.query("SELECT * FROM crown_campaigns WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const campaign = existing.rows[0];
    const { forbidden } = await getAuthorizedCityId(req, campaign.city_id);
    if (forbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const allowed = CAMPAIGN_STATUS_TRANSITIONS[campaign.status] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({ message: `Cannot transition from ${campaign.status} to ${targetStatus}. Allowed: ${allowed.join(", ")}` });
    }
    const timestampFields: Record<string, string> = {
      LAUNCHED: "launched_at", ARCHIVED: "archived_at",
    };
    const extraFields = timestampFields[targetStatus] ? `, ${timestampFields[targetStatus]} = NOW()` : "";
    const result = await pool.query(
      `UPDATE crown_campaigns SET status = $1, updated_at = NOW()${extraFields} WHERE id = $2 RETURNING *`,
      [targetStatus, req.params.id]
    );
    const updated = result.rows[0];

    const statusToStage: Record<string, string> = {
      LAUNCHED: "launch",
      NOMINATIONS_OPEN: "nominations",
      VOTING_OPEN: "voting",
      WINNERS_ANNOUNCED: "winners",
    };
    const autoStage = statusToStage[targetStatus];

    if (autoStage) {
      try {
        const hubName = campaign.hub_name || (await pool.query("SELECT r.name FROM regions r WHERE r.id = $1", [campaign.hub_id])).rows[0]?.name || "Charlotte Metro";
        const hubSlug = campaign.hub_slug || (await pool.query("SELECT r.slug FROM regions r WHERE r.id = $1", [campaign.hub_id])).rows[0]?.slug || null;
        let autoContent: Record<string, unknown> | null = null;

        if (autoStage === "launch") {
          const catIds = (campaign.featured_categories as string[]) || [];
          let categoryNames: string[] = [];
          if (catIds.length > 0) {
            const catResult = await pool.query("SELECT name FROM crown_categories WHERE id = ANY($1)", [catIds]);
            categoryNames = catResult.rows.map((r: Record<string, unknown>) => r.name as string);
          }
          autoContent = generateLaunchContent(campaign, hubName, categoryNames);
        } else if (autoStage === "nominations") {
          const nomineeResult = await pool.query(
            `SELECT COUNT(*) FROM crown_participants WHERE city_id = $1 AND status IN ('nominee','qualified_nominee')`, [campaign.city_id]
          );
          autoContent = generateNominationsContent(campaign, hubName, parseInt(nomineeResult.rows[0].count));
        } else if (autoStage === "voting") {
          const catCountResult = await pool.query(`SELECT COUNT(*) FROM crown_categories WHERE city_id = $1 AND is_active = true`, [campaign.city_id]);
          const nomineeCountResult = await pool.query(
            `SELECT COUNT(*) FROM crown_participants WHERE city_id = $1 AND status IN ('nominee','qualified_nominee')`, [campaign.city_id]
          );
          autoContent = generateVotingContent(campaign, hubName, parseInt(catCountResult.rows[0].count), parseInt(nomineeCountResult.rows[0].count));
        } else if (autoStage === "winners") {
          const winnersResult = await pool.query(
            `SELECT p.name, c.name as category FROM crown_winners w
             JOIN crown_participants p ON w.participant_id = p.id
             JOIN crown_categories c ON w.category_id = c.id
             WHERE w.city_id = $1 AND w.season_year = $2 ORDER BY c.name`,
            [campaign.city_id, campaign.season_year]
          );
          autoContent = generateWinnersContent(campaign, hubName, winnersResult.rows.map((r: Record<string, unknown>) => ({ name: r.name as string, category: r.category as string })));
        }

        if (autoContent) {
          const existingContent = (updated.generated_content || {}) as Record<string, unknown>;
          existingContent[autoStage] = autoContent;
          await pool.query(
            "UPDATE crown_campaigns SET generated_content = $1, updated_at = NOW() WHERE id = $2",
            [JSON.stringify(existingContent), req.params.id]
          );
          updated.generated_content = existingContent;

          const suggestions = generateCreatorCoverageSuggestions(campaign, hubName);
          const distLog = (updated.distribution_log || {}) as Record<string, unknown>;
          distLog.creatorSuggestions = suggestions;

          const formats = ((autoContent.formats || {}) as Record<string, Record<string, unknown>>);

          const pulseStory = formats.pulse_story || {};
          const pulseTitle = (pulseStory.title as string) || (autoContent.headline as string) || `Crown Awards ${autoStage} — ${hubName}`;
          const pulseBody = (pulseStory.body as string) || (autoContent.long_announcement as string) || (autoContent.short_announcement as string) || `Crown Awards ${autoStage} update for ${hubName}.`;
          const existingPulse = (distLog.pulse || []) as Array<Record<string, unknown>>;
          const existingForStagePulse = existingPulse.find(p => p.stage === autoStage);
          if (!existingForStagePulse) {
            try {
              const crownMeta = JSON.stringify({
                engine: "crown", campaignId: req.params.id, campaignTitle: campaign.title,
                stage: autoStage, hubId: campaign.hub_id, hubName, seasonYear: campaign.season_year, autoGenerated: true,
              });
              const postResult = await pool.query(
                `INSERT INTO posts (city_id, source_type, media_type, title, body, status, primary_tag, trust_score, moderation_notes)
                 VALUES ($1, 'staff', 'image', $2, $3, 'draft', 'crown-awards', 80, $4) RETURNING id, title, status, created_at`,
                [campaign.city_id, pulseTitle, pulseBody, crownMeta]
              );
              existingPulse.push({ postId: postResult.rows[0].id, stage: autoStage, title: pulseTitle, createdAt: new Date().toISOString(), auto: true });
              distLog.pulse = existingPulse;
              await pool.query(
                "UPDATE crown_campaigns SET distribution_log = $1, updated_at = NOW() WHERE id = $2",
                [JSON.stringify(distLog), req.params.id]
              );
            } catch (pulseErr) {
              console.error("[CrownTransition] Auto Pulse draft failed:", pulseErr instanceof Error ? pulseErr.message : pulseErr);
            }
          }

          const tvContent = (formats.venue_tv || {}) as Record<string, unknown>;
          const existingTv = (distLog.venue_tv || []) as Array<Record<string, unknown>>;
          const existingForStageTv = existingTv.find(t => t.stage === autoStage);
          if (!existingForStageTv) {
            try {
              const templateKeyMap: Record<string, string> = {
                launch: "crown_launch", nominations: "crown_nominations",
                finalists: "crown_finalists", voting: "crown_voting", winners: "crown_winner",
              };
              const tvHeadline = (tvContent.headline as string) || (tvContent.line1 as string) || (autoContent.headline as string) || `Crown Awards — ${hubName}`;
              const tvSubheadline = (tvContent.subheadline as string) || (tvContent.line2 as string) || hubName;
              const stageLabel = autoStage.charAt(0).toUpperCase() + autoStage.slice(1);
              const slideData = {
                headline: tvHeadline,
                subheadline: tvSubheadline,
                bodyLine: (tvContent.bodyLine as string) || (tvContent.line3 as string) || stageLabel,
                stage: autoStage,
                campaignId: req.params.id,
                hubName,
                autoGenerated: true,
              };
              const targetSlug = hubSlug || null;
              const tvItemResult = await pool.query(
                `INSERT INTO tv_items (title, type, source_scope, city_id, hub_slug, template_key, data, duration_sec, priority, enabled, tags, source_entity_type, source_entity_id)
                 VALUES ($1, 'slide', 'hub', $2, $3, $4, $5, 12, 8, true, $6, 'crown_campaign', $7) RETURNING id, title, template_key`,
                [
                  tvHeadline, campaign.city_id, targetSlug, templateKeyMap[autoStage],
                  JSON.stringify(slideData), JSON.stringify(["crown-awards", autoStage]),
                  req.params.id,
                ]
              );
              existingTv.push({ tvItemId: tvItemResult.rows[0].id, stage: autoStage, title: tvHeadline, createdAt: new Date().toISOString(), auto: true, targetHubSlug: targetSlug });
              distLog.venue_tv = existingTv;
              await pool.query(
                "UPDATE crown_campaigns SET distribution_log = $1, updated_at = NOW() WHERE id = $2",
                [JSON.stringify(distLog), req.params.id]
              );
            } catch (tvErr) {
              console.error("[CrownTransition] Auto TV slide failed:", tvErr instanceof Error ? tvErr.message : tvErr);
            }
          }

          updated.distribution_log = distLog;

          try {
            const { recordPlatformMessage } = await import("./message-center-routes");
            await recordPlatformMessage({
              cityId: campaign.city_id,
              sourceEngine: "crown",
              channel: "in_app",
              status: "sent",
              subject: `Crown ${autoStage} auto-distributed — ${hubName}`,
              bodyPreview: `Content generated, Pulse draft created, TV slide queued for stage: ${autoStage}`,
              metadata: { campaignId: req.params.id, stage: autoStage, autoGenerated: true },
            });
          } catch (logErr) {
            console.error("[CrownTransition] Failed to log auto-distribution:", logErr);
          }
        }
      } catch (genErr) {
        console.error("[CrownCampaign] Auto-distribution on transition failed:", genErr);
      }
    }

    res.json(updated);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/api/admin/crown/campaigns/:id/generate", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { stage } = req.body;
    if (!stage || !["launch", "nominations", "finalists", "voting", "winners"].includes(stage)) {
      return res.status(400).json({ message: "stage must be one of: launch, nominations, finalists, voting, winners" });
    }
    const campaignResult = await pool.query(
      `SELECT c.*, r.name as hub_name FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const campaign = campaignResult.rows[0];
    const { forbidden: genForbidden } = await getAuthorizedCityId(req, campaign.city_id);
    if (genForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const hubName = campaign.hub_name || "Charlotte Metro";

    let content: Record<string, unknown>;

    if (stage === "launch") {
      const catIds = (campaign.featured_categories as string[]) || [];
      let categoryNames: string[] = [];
      if (catIds.length > 0) {
        const catResult = await pool.query(
          `SELECT name FROM crown_categories WHERE id = ANY($1)`, [catIds]
        );
        categoryNames = catResult.rows.map((r: Record<string, unknown>) => r.name as string);
      }
      content = generateLaunchContent(campaign, hubName, categoryNames);
    } else if (stage === "nominations") {
      const nomineeResult = await pool.query(
        `SELECT COUNT(*) FROM crown_participants WHERE city_id = $1 AND status IN ('nominee','qualified_nominee')`,
        [campaign.city_id]
      );
      content = generateNominationsContent(campaign, hubName, parseInt(nomineeResult.rows[0].count));
    } else if (stage === "finalists") {
      const finalistResult = await pool.query(
        `SELECT COUNT(*) FROM crown_participants WHERE city_id = $1 AND status IN ('nominee','qualified_nominee')`,
        [campaign.city_id]
      );
      const catCountResult = await pool.query(`SELECT COUNT(*) FROM crown_categories WHERE city_id = $1 AND is_active = true`, [campaign.city_id]);
      content = generateFinalistsContent(campaign, hubName, parseInt(finalistResult.rows[0].count), parseInt(catCountResult.rows[0].count));
    } else if (stage === "voting") {
      const catCountResult = await pool.query(`SELECT COUNT(*) FROM crown_categories WHERE city_id = $1 AND is_active = true`, [campaign.city_id]);
      const nomineeCountResult = await pool.query(
        `SELECT COUNT(*) FROM crown_participants WHERE city_id = $1 AND status IN ('nominee','qualified_nominee')`,
        [campaign.city_id]
      );
      content = generateVotingContent(campaign, hubName, parseInt(catCountResult.rows[0].count), parseInt(nomineeCountResult.rows[0].count));
    } else {
      const winnersResult = await pool.query(
        `SELECT p.name, c.name as category FROM crown_winners w
         JOIN crown_participants p ON w.participant_id = p.id
         JOIN crown_categories c ON w.category_id = c.id
         WHERE w.city_id = $1 AND w.season_year = $2 ORDER BY c.name`,
        [campaign.city_id, campaign.season_year]
      );
      content = generateWinnersContent(campaign, hubName, winnersResult.rows.map((r: Record<string, unknown>) => ({ name: r.name as string, category: r.category as string })));
    }

    const existingContent = (campaign.generated_content || {}) as Record<string, unknown>;
    existingContent[stage] = content;

    const suggestions = generateCreatorCoverageSuggestions(campaign, hubName);
    const distLog = (campaign.distribution_log || {}) as Record<string, unknown>;
    distLog.creatorSuggestions = suggestions;

    const formats = ((content.formats || {}) as Record<string, Record<string, unknown>>);
    const pulseStory = formats.pulse_story || {};
    const pulseTitle = (pulseStory.title as string) || (content.headline as string) || `Crown Awards ${stage} — ${hubName}`;
    const pulseBody = (pulseStory.body as string) || (content.long_announcement as string) || (content.short_announcement as string) || `Crown Awards ${stage} update for ${hubName}.`;
    const existingPulse = (distLog.pulse || []) as Array<Record<string, unknown>>;
    const existingForStagePulse = existingPulse.find(p => p.stage === stage);
    if (!existingForStagePulse) {
      try {
        const crownMeta = JSON.stringify({
          engine: "crown", campaignId: req.params.id, campaignTitle: campaign.title,
          stage, hubId: campaign.hub_id, hubName, seasonYear: campaign.season_year, autoGenerated: true,
        });
        const postResult = await pool.query(
          `INSERT INTO posts (city_id, source_type, media_type, title, body, status, primary_tag, trust_score, moderation_notes)
           VALUES ($1, 'staff', 'image', $2, $3, 'draft', 'crown-awards', 80, $4) RETURNING id`,
          [campaign.city_id, pulseTitle, pulseBody, crownMeta]
        );
        existingPulse.push({ postId: postResult.rows[0].id, stage, title: pulseTitle, createdAt: new Date().toISOString(), auto: true });
        distLog.pulse = existingPulse;
      } catch (pulseErr) {
        console.error("[CrownGenerate] Auto Pulse draft failed:", pulseErr instanceof Error ? pulseErr.message : pulseErr);
      }
    }

    const tvContent = (formats.venue_tv || {}) as Record<string, unknown>;
    const existingTv = (distLog.venue_tv || []) as Array<Record<string, unknown>>;
    const existingForStageTv = existingTv.find(t => t.stage === stage);
    if (!existingForStageTv) {
      try {
        const templateKeyMap: Record<string, string> = {
          launch: "crown_launch", nominations: "crown_nominations",
          finalists: "crown_finalists", voting: "crown_voting", winners: "crown_winner",
        };
        const hubSlugResult = await pool.query("SELECT slug FROM regions WHERE id = $1", [campaign.hub_id]);
        const targetSlug = hubSlugResult.rows[0]?.slug || null;
        const tvHeadline = (tvContent.headline as string) || (tvContent.line1 as string) || (content.headline as string) || `Crown Awards — ${hubName}`;
        const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1);
        const slideData = {
          headline: tvHeadline,
          subheadline: (tvContent.subheadline as string) || (tvContent.line2 as string) || hubName,
          bodyLine: (tvContent.bodyLine as string) || (tvContent.line3 as string) || stageLabel,
          stage, campaignId: req.params.id, hubName, autoGenerated: true,
        };
        const tvItemResult = await pool.query(
          `INSERT INTO tv_items (title, type, source_scope, city_id, hub_slug, template_key, data, duration_sec, priority, enabled, tags, source_entity_type, source_entity_id)
           VALUES ($1, 'slide', 'hub', $2, $3, $4, $5, 12, 8, true, $6, 'crown_campaign', $7) RETURNING id, title, template_key`,
          [tvHeadline, campaign.city_id, targetSlug, templateKeyMap[stage], JSON.stringify(slideData), JSON.stringify(["crown-awards", stage]), req.params.id]
        );
        existingTv.push({ tvItemId: tvItemResult.rows[0].id, stage, title: tvHeadline, createdAt: new Date().toISOString(), auto: true, targetHubSlug: targetSlug });
        distLog.venue_tv = existingTv;
      } catch (tvErr) {
        console.error("[CrownGenerate] Auto TV slide failed:", tvErr instanceof Error ? tvErr.message : tvErr);
      }
    }

    await pool.query(
      `UPDATE crown_campaigns SET generated_content = $1, distribution_log = $2, updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(existingContent), JSON.stringify(distLog), req.params.id]
    );

    try {
      const { recordPlatformMessage } = await import("./message-center-routes");
      await recordPlatformMessage({
        cityId: campaign.city_id,
        sourceEngine: "crown",
        channel: "in_app",
        status: "sent",
        subject: `Crown ${stage} content generated and distributed — ${hubName}`,
        bodyPreview: `Content generated, Pulse draft and TV slide auto-created for stage: ${stage}`,
        metadata: { campaignId: req.params.id, stage, hubName },
      });
    } catch (logErr) {
      console.warn("[CrownGenerate] Failed to log generation:", logErr instanceof Error ? logErr.message : logErr);
    }

    res.json({ stage, content, creatorSuggestions: suggestions });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/api/admin/crown/campaigns/:id/claim-messaging", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const campaignResult = await pool.query(
      `SELECT c.*, r.name as hub_name FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const campaign = campaignResult.rows[0];
    const { forbidden: claimForbidden } = await getAuthorizedCityId(req, campaign.city_id);
    if (claimForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const hubName = campaign.hub_name || "Charlotte Metro";
    const vars = {
      hub_name: hubName,
      ...(req.body.variables || {}),
    };
    const messaging = generateClaimMessaging(vars);

    try {
      const { recordPlatformMessage } = await import("./message-center-routes");
      await recordPlatformMessage({
        cityId: campaign.city_id,
        sourceEngine: "crown",
        channel: "in_app",
        status: "sent",
        subject: `Crown claim messaging generated — ${hubName}`,
        bodyPreview: JSON.stringify(messaging).substring(0, 300),
        metadata: { campaignId: req.params.id, type: "claim_messaging" },
      });
    } catch (logErr) {
      console.warn("[CrownCampaign] Failed to log claim messaging:", logErr instanceof Error ? logErr.message : logErr);
    }

    res.json(messaging);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/api/admin/crown/packages", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId, forbidden: pkgForbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
    if (pkgForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const conditions = [];
    const params: unknown[] = [];
    let idx = 1;
    if (cityId) { conditions.push(`(city_id = $${idx++} OR city_id IS NULL)`); params.push(cityId); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM crown_marketing_packages ${where} ORDER BY name`, params);
    res.json(result.rows);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

const createPackageSchema = z.object({
  cityId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  includedItems: z.array(z.string()).optional(),
  eligibilityRules: z.record(z.unknown()).optional(),
  displayChannels: z.array(z.string()).optional(),
  isIncludedPerk: z.boolean().default(false),
  priceCents: z.number().default(0),
});

router.post("/api/admin/crown/packages", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const parsed = createPackageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    const d = parsed.data;
    if (d.cityId) {
      const { forbidden: cpForbidden } = await getAuthorizedCityId(req, d.cityId);
      if (cpForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    }
    const result = await pool.query(
      `INSERT INTO crown_marketing_packages (city_id, name, description, included_items, eligibility_rules, display_channels, is_included_perk, price_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [d.cityId || null, d.name, d.description || null, JSON.stringify(d.includedItems || []), JSON.stringify(d.eligibilityRules || {}), JSON.stringify(d.displayChannels || []), d.isIncludedPerk, d.priceCents]
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.patch("/api/admin/crown/packages/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const pkgOwner = await pool.query("SELECT city_id FROM crown_marketing_packages WHERE id = $1", [req.params.id]);
    if (pkgOwner.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    if (pkgOwner.rows[0].city_id) {
      const { forbidden: patchForbidden } = await getAuthorizedCityId(req, pkgOwner.rows[0].city_id);
      if (patchForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    } else {
      const { forbidden: globalForbidden } = await getAuthorizedCityId(req);
      if (globalForbidden) return res.status(403).json({ message: "Not authorized" });
      const session = req.session as Record<string, unknown>;
      const userId = session.userId as string | undefined;
      if (userId) {
        const { storage } = await import("./storage");
        const u = await storage.getUserById(userId);
        const platformRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"];
        if (!u || !platformRoles.includes(u.role || "")) return res.status(403).json({ message: "Platform admin required for global packages" });
      }
    }
    const d = req.body;
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (d.name !== undefined) { fields.push(`name = $${idx++}`); params.push(d.name); }
    if (d.description !== undefined) { fields.push(`description = $${idx++}`); params.push(d.description); }
    if (d.includedItems !== undefined) { fields.push(`included_items = $${idx++}`); params.push(JSON.stringify(d.includedItems)); }
    if (d.eligibilityRules !== undefined) { fields.push(`eligibility_rules = $${idx++}`); params.push(JSON.stringify(d.eligibilityRules)); }
    if (d.displayChannels !== undefined) { fields.push(`display_channels = $${idx++}`); params.push(JSON.stringify(d.displayChannels)); }
    if (d.isIncludedPerk !== undefined) { fields.push(`is_included_perk = $${idx++}`); params.push(d.isIncludedPerk); }
    if (d.priceCents !== undefined) { fields.push(`price_cents = $${idx++}`); params.push(d.priceCents); }
    if (d.isActive !== undefined) { fields.push(`is_active = $${idx++}`); params.push(d.isActive); }
    if (fields.length === 0) return res.status(400).json({ message: "No fields" });
    fields.push("updated_at = NOW()");
    params.push(req.params.id);
    const result = await pool.query(`UPDATE crown_marketing_packages SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, params);
    if (result.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.delete("/api/admin/crown/packages/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const delOwner = await pool.query("SELECT city_id FROM crown_marketing_packages WHERE id = $1", [req.params.id]);
    if (delOwner.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    if (delOwner.rows[0].city_id) {
      const { forbidden: delForbidden } = await getAuthorizedCityId(req, delOwner.rows[0].city_id);
      if (delForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    } else {
      const { forbidden: globalDelForbidden } = await getAuthorizedCityId(req);
      if (globalDelForbidden) return res.status(403).json({ message: "Not authorized" });
      const delSession = req.session as Record<string, unknown>;
      const delUserId = delSession.userId as string | undefined;
      if (delUserId) {
        const { storage } = await import("./storage");
        const delU = await storage.getUserById(delUserId);
        const platformRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"];
        if (!delU || !platformRoles.includes(delU.role || "")) return res.status(403).json({ message: "Platform admin required for global packages" });
      }
    }
    await pool.query("DELETE FROM crown_package_assignments WHERE package_id = $1", [req.params.id]);
    await pool.query("DELETE FROM crown_marketing_packages WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/api/admin/crown/packages/:id/assign", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const assignOwner = await pool.query("SELECT city_id FROM crown_marketing_packages WHERE id = $1", [req.params.id]);
    if (assignOwner.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    if (assignOwner.rows[0].city_id) {
      const { forbidden: assignForbidden } = await getAuthorizedCityId(req, assignOwner.rows[0].city_id);
      if (assignForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    } else {
      const { forbidden: globalAssignForbidden } = await getAuthorizedCityId(req);
      if (globalAssignForbidden) return res.status(403).json({ message: "Not authorized" });
      const assignSession = req.session as Record<string, unknown>;
      const assignUserId = assignSession.userId as string | undefined;
      if (assignUserId) {
        const { storage } = await import("./storage");
        const assignU = await storage.getUserById(assignUserId);
        const platformRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"];
        if (!assignU || !platformRoles.includes(assignU.role || "")) return res.status(403).json({ message: "Platform admin required for global packages" });
      }
    }
    const { participantId, notes } = req.body;
    if (!participantId) return res.status(400).json({ message: "participantId required" });
    const session = req.session as Record<string, unknown>;
    const adminUser = session.adminUser as Record<string, unknown> | undefined;
    const assignedBy = adminUser?.id as string || "admin";
    const result = await pool.query(
      `INSERT INTO crown_package_assignments (package_id, participant_id, assigned_by, notes)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (package_id, participant_id) DO UPDATE SET status = 'assigned', assigned_at = NOW(), notes = EXCLUDED.notes
       RETURNING *`,
      [req.params.id, participantId, assignedBy, notes || null]
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/api/admin/crown/packages/:id/assignments", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const assListOwner = await pool.query("SELECT city_id FROM crown_marketing_packages WHERE id = $1", [req.params.id]);
    if (assListOwner.rows.length === 0) return res.status(404).json({ message: "Package not found" });
    if (assListOwner.rows[0].city_id) {
      const { forbidden: assListForbidden } = await getAuthorizedCityId(req, assListOwner.rows[0].city_id);
      if (assListForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    }
    const result = await pool.query(
      `SELECT a.*, p.name as participant_name, p.status as participant_status
       FROM crown_package_assignments a
       JOIN crown_participants p ON a.participant_id = p.id
       WHERE a.package_id = $1 ORDER BY a.assigned_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/api/admin/crown/campaign-config", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId, forbidden: cfgGetForbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
    if (cfgGetForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const seasonYear = parseInt(req.query.seasonYear as string) || 2026;
    const result = await pool.query(
      `SELECT * FROM crown_campaign_config WHERE city_id = $1 AND season_year = $2`,
      [cityId, seasonYear]
    );
    if (result.rows.length === 0) {
      return res.json({ tone: "community_celebration", award_naming_format: "Crown Award", year_format: "full", include_editorial: true, include_peoples_choice: true, enable_creator_coverage: true, enable_venue_tv: true, enable_print: false, custom_settings: {} });
    }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.put("/api/admin/crown/campaign-config", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const { cityId, seasonYear = 2026, tone, awardNamingFormat, yearFormat, includeEditorial, includePeoplesChoice, enableCreatorCoverage, enableVenueTv, enablePrint, customSettings } = req.body;
    if (!cityId) return res.status(400).json({ message: "cityId required" });
    const { forbidden: cfgPutForbidden } = await getAuthorizedCityId(req, cityId);
    if (cfgPutForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const result = await pool.query(
      `INSERT INTO crown_campaign_config (city_id, season_year, tone, award_naming_format, year_format, include_editorial, include_peoples_choice, enable_creator_coverage, enable_venue_tv, enable_print, custom_settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (city_id, season_year) DO UPDATE SET
         tone = EXCLUDED.tone, award_naming_format = EXCLUDED.award_naming_format, year_format = EXCLUDED.year_format,
         include_editorial = EXCLUDED.include_editorial, include_peoples_choice = EXCLUDED.include_peoples_choice,
         enable_creator_coverage = EXCLUDED.enable_creator_coverage, enable_venue_tv = EXCLUDED.enable_venue_tv,
         enable_print = EXCLUDED.enable_print, custom_settings = EXCLUDED.custom_settings, updated_at = NOW()
       RETURNING *`,
      [cityId, seasonYear, tone || "community_celebration", awardNamingFormat || "Crown Award", yearFormat || "full",
       includeEditorial !== false, includePeoplesChoice !== false, enableCreatorCoverage !== false,
       enableVenueTv !== false, enablePrint === true, JSON.stringify(customSettings || {})]
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/api/admin/crown/campaigns/:id/distribute/pulse", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const campaignResult = await pool.query(
      `SELECT c.*, r.name as hub_name FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const campaign = campaignResult.rows[0];
    const { forbidden: distForbidden } = await getAuthorizedCityId(req, campaign.city_id);
    if (distForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const hubName = campaign.hub_name || "Charlotte Metro";
    const generatedContent = (campaign.generated_content || {}) as Record<string, Record<string, unknown>>;
    const stage = (req.body.stage as string) || campaign.status?.toLowerCase().replace(/_/g, " ");
    const validStages = ["launch", "nominations", "finalists", "voting", "winners"];
    const stageKey = validStages.includes(stage) ? stage : null;
    if (!stageKey) return res.status(400).json({ message: "stage must be one of: launch, nominations, finalists, voting, winners" });
    const distLog = (campaign.distribution_log || {}) as Record<string, unknown>;
    const existingPulse = (distLog.pulse || []) as Array<Record<string, unknown>>;
    const existingForStage = existingPulse.find(p => p.stage === stageKey);
    if (existingForStage) {
      return res.json({ postId: existingForStage.postId, title: existingForStage.title, status: "exists", stage: stageKey, duplicate: true });
    }
    const content = generatedContent[stageKey] as Record<string, unknown> | undefined;
    const formats = (content?.formats || {}) as Record<string, Record<string, unknown>>;
    const pulseStory = formats.pulse_story || {};
    const title = (pulseStory.title as string) || (content?.headline as string) || `Crown Awards ${stageKey} — ${hubName}`;
    const body = (pulseStory.body as string) || (content?.summary as string) || `Crown Awards ${stageKey} update for ${hubName}.`;
    const crownMeta = JSON.stringify({
      engine: "crown",
      campaignId: req.params.id,
      campaignTitle: campaign.title,
      stage: stageKey,
      hubId: campaign.hub_id,
      hubName,
      seasonYear: campaign.season_year,
      autoGenerated: true,
    });
    const postResult = await pool.query(
      `INSERT INTO posts (city_id, source_type, media_type, title, body, status, primary_tag, trust_score, moderation_notes)
       VALUES ($1, 'staff', 'image', $2, $3, 'draft', 'crown-awards', 80, $4) RETURNING id, title, status, created_at`,
      [campaign.city_id, title, body, crownMeta]
    );
    const newPost = postResult.rows[0];
    const pulseLog = existingPulse;
    pulseLog.push({ postId: newPost.id, stage: stageKey, title, createdAt: new Date().toISOString() });
    distLog.pulse = pulseLog;
    await pool.query(
      `UPDATE crown_campaigns SET distribution_log = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(distLog), req.params.id]
    );
    try {
      const { recordPlatformMessage } = await import("./message-center-routes");
      await recordPlatformMessage({
        cityId: campaign.city_id,
        sourceEngine: "crown",
        channel: "pulse_draft",
        status: "draft",
        subject: `Crown Pulse Draft: ${title}`,
        bodyPreview: body.substring(0, 500),
        campaignId: req.params.id,
        metadata: { postId: newPost.id, stage: stageKey, hubName },
      });
    } catch (logErr) {
      console.warn("[CrownDistribute] Failed to log pulse draft:", logErr instanceof Error ? logErr.message : logErr);
    }
    res.json({ postId: newPost.id, title: newPost.title, status: newPost.status, stage: stageKey });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/api/admin/crown/campaigns/:id/distribute/tv", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const campaignResult = await pool.query(
      `SELECT c.*, r.name as hub_name, r.slug as hub_slug FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const campaign = campaignResult.rows[0];
    const { forbidden: tvForbidden } = await getAuthorizedCityId(req, campaign.city_id);
    if (tvForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const hubName = campaign.hub_name || "Charlotte Metro";
    const hubSlug = campaign.hub_slug || null;
    const generatedContent = (campaign.generated_content || {}) as Record<string, Record<string, unknown>>;
    const stage = (req.body.stage as string) || "launch";
    const tvValidStages = ["launch", "nominations", "finalists", "voting", "winners"];
    const stageKey = tvValidStages.includes(stage) ? stage : null;
    if (!stageKey) return res.status(400).json({ message: "stage must be one of: launch, nominations, finalists, voting, winners" });
    const tvDistLog = (campaign.distribution_log || {}) as Record<string, unknown>;
    const existingTvItems = (tvDistLog.venue_tv || []) as Array<Record<string, unknown>>;
    const existingTvForStage = existingTvItems.find(t => t.stage === stageKey);
    if (existingTvForStage) {
      return res.json({ tvItemId: existingTvForStage.tvItemId, title: existingTvForStage.title, templateKey: `crown_${stageKey === "winners" ? "winner" : stageKey}`, stage: stageKey, duplicate: true });
    }
    const content = generatedContent[stageKey] as Record<string, unknown> | undefined;
    const formats = (content?.formats || {}) as Record<string, Record<string, unknown>>;
    const tvData = formats.venue_tv || {};
    const templateKeyMap: Record<string, string> = {
      launch: "crown_launch",
      nominations: "crown_nominations",
      finalists: "crown_finalists",
      voting: "crown_voting",
      winners: "crown_winner",
    };
    const tvTitle = (tvData.headline as string) || (tvData.line1 as string) || `Crown Awards — ${hubName}`;
    const sponsorLine = (req.body.sponsorLine as string) || null;
    const durationSec = (req.body.durationSec as number) || 12;
    const targetHubSlug = (req.body.targetHubSlug as string) || hubSlug;
    const startAt = campaign[`${stageKey === "launch" ? "launched" : stageKey === "nominations" ? "nominations_open" : stageKey === "voting" ? "voting_open" : "winners_announce"}_at`] || null;
    const endAt = stageKey === "voting" ? campaign.voting_close_at : stageKey === "nominations" ? campaign.nominations_close_at : null;
    const qrUrl = (req.body.qrUrl as string) || null;
    const stageLabel = stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
    const slideData = {
      headline: (tvData.headline as string) || (tvData.line1 as string) || `Crown Awards — ${hubName}`,
      subheadline: (tvData.subheadline as string) || (tvData.line2 as string) || stageLabel,
      bodyLine: (tvData.bodyLine as string) || (tvData.line3 as string) || "CLT Metro Hub",
      qrUrl: qrUrl || (tvData.qrUrl as string) || null,
      qrPrompt: qrUrl ? `Scan to ${stageKey === "voting" ? "vote now" : stageKey === "nominations" ? "nominate" : "learn more"}` : null,
      sponsorLine: sponsorLine || null,
      validFrom: startAt || null,
      validUntil: endAt || null,
      campaignId: req.params.id,
      stage: stageKey,
      hubName,
    };
    const tvItemResult = await pool.query(
      `INSERT INTO tv_items (title, type, source_scope, city_id, hub_slug, template_key, data, duration_sec, start_at, end_at, priority, enabled, tags)
       VALUES ($1, 'slide', 'hub', $2, $3, $4, $5, $6, $7, $8, 8, true, $9) RETURNING id, title, template_key, enabled, created_at`,
      [
        tvTitle, campaign.city_id, targetHubSlug, templateKeyMap[stageKey],
        JSON.stringify(slideData), durationSec,
        startAt || null, endAt || null,
        JSON.stringify(["crown-awards", stageKey]),
      ]
    );
    const newTvItem = tvItemResult.rows[0];
    existingTvItems.push({ tvItemId: newTvItem.id, stage: stageKey, title: tvTitle, targetHubSlug, createdAt: new Date().toISOString() });
    tvDistLog.venue_tv = existingTvItems;
    await pool.query(
      `UPDATE crown_campaigns SET distribution_log = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(tvDistLog), req.params.id]
    );
    try {
      const { recordPlatformMessage } = await import("./message-center-routes");
      await recordPlatformMessage({
        cityId: campaign.city_id,
        sourceEngine: "crown",
        channel: "venue_tv",
        status: "sent",
        subject: `Crown TV Slide: ${tvTitle}`,
        bodyPreview: JSON.stringify(slideData).substring(0, 500),
        campaignId: req.params.id,
        metadata: { tvItemId: newTvItem.id, stage: stageKey, hubName, templateKey: templateKeyMap[stageKey] },
      });
    } catch (logErr) {
      console.warn("[CrownDistribute] Failed to log tv item:", logErr instanceof Error ? logErr.message : logErr);
    }
    res.json({ tvItemId: newTvItem.id, title: newTvItem.title, templateKey: newTvItem.template_key, stage: stageKey });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/api/admin/crown/campaigns/:id/distribute/creator", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const campaignResult = await pool.query(
      `SELECT c.*, r.name as hub_name FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const campaign = campaignResult.rows[0];
    const { forbidden: creatorForbidden } = await getAuthorizedCityId(req, campaign.city_id);
    if (creatorForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const hubName = campaign.hub_name || "Charlotte Metro";
    const { action } = req.body;
    if (!action || !["ready_for_feature", "request_story", "schedule_interview"].includes(action)) {
      return res.status(400).json({ message: "action must be one of: ready_for_feature, request_story, schedule_interview" });
    }
    const flagMap: Record<string, string> = {
      ready_for_feature: "ready_for_creator_feature",
      request_story: "creator_story_requested",
      schedule_interview: "creator_interview_scheduled",
    };
    const dbCol = flagMap[action];
    await pool.query(
      `UPDATE crown_campaigns SET ${dbCol} = true, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    let sourceRequestId: string | null = null;
    const distLog = (campaign.distribution_log || {}) as Record<string, unknown>;
    const creatorLog = (distLog.creator || []) as Array<Record<string, unknown>>;
    if (action === "request_story") {
      const generatedContent = (campaign.generated_content || {}) as Record<string, Record<string, unknown>>;
      const votingContent = generatedContent.voting as Record<string, unknown> | undefined;
      const formats = (votingContent?.formats || generatedContent.launch?.formats || {}) as Record<string, Record<string, string>>;
      const creatorAngle = formats.creator_angle || `Cover the Crown Award nominees and winners in ${hubName}.`;
      const session = req.session as Record<string, unknown>;
      const adminUser = session.adminUser as Record<string, unknown> | undefined;
      const createdByUserId = (adminUser?.id as string) || null;
      const srResult = await pool.query(
        `INSERT INTO source_requests (title, description, request_type, city_id, status, created_by_user_id)
         VALUES ($1, $2, 'creator_feature', $3, 'open', $4) RETURNING id, title, status`,
        [
          `Crown Award Coverage — ${hubName}`,
          typeof creatorAngle === "string" ? creatorAngle : `Cover the Crown Award nominees and winners in ${hubName}. Interview top contenders about what the Crown means to their business.`,
          campaign.city_id,
          createdByUserId,
        ]
      );
      sourceRequestId = srResult.rows[0].id;
      creatorLog.push({ sourceRequestId, action, hubName, createdAt: new Date().toISOString() });
    } else {
      creatorLog.push({ action, flagSet: dbCol, createdAt: new Date().toISOString() });
    }
    distLog.creator = creatorLog;
    const coverageSuggestions = generateCreatorCoverageSuggestions(campaign, hubName);
    distLog.creatorSuggestions = coverageSuggestions;
    await pool.query(
      `UPDATE crown_campaigns SET distribution_log = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(distLog), req.params.id]
    );
    try {
      const { recordPlatformMessage } = await import("./message-center-routes");
      await recordPlatformMessage({
        cityId: campaign.city_id,
        sourceEngine: "crown",
        channel: "in_app",
        status: "sent",
        subject: `Crown Creator ${action.replace(/_/g, " ")} — ${hubName}`,
        bodyPreview: sourceRequestId ? `Source request created: ${sourceRequestId}` : `Creator flag set: ${dbCol}`,
        campaignId: req.params.id,
        metadata: { action, sourceRequestId, hubName, coverageSuggestions },
      });
    } catch (logErr) {
      console.warn("[CrownDistribute] Failed to log creator action:", logErr instanceof Error ? logErr.message : logErr);
    }
    res.json({
      action,
      flagSet: dbCol,
      sourceRequestId,
      coverageSuggestions,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

function generateCreatorCoverageSuggestions(campaign: Record<string, unknown>, hubName: string): Array<Record<string, string>> {
  const year = campaign.season_year || 2026;
  return [
    { type: "nominee_interview", title: `Meet the ${hubName} Crown Nominees`, description: `Interview top Crown Award nominees about their businesses and what community recognition means to them.` },
    { type: "winner_spotlight", title: `${year} ${hubName} Crown Award Winners`, description: `Feature story spotlighting Crown Award winners — their journey, community impact, and what the Crown means.` },
    { type: "category_guide", title: `Best of ${hubName} — Category Deep Dive`, description: `Local guide covering top nominees across categories. Pair with voting links for community engagement.` },
    { type: "voting_roundup", title: `Where to Vote — ${hubName} Crown Awards`, description: `Roundup of voting highlights, close races, and community engagement trends in the ${hubName} Crown Awards.` },
    { type: "behind_the_scenes", title: `Behind the Crown — How ${hubName} Picks Its Best`, description: `Show the community how Crown Awards work — from nominations to voting to winners. Feature local voices.` },
  ];
}

router.get("/api/admin/crown/campaigns/:id/distribution-status", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureReady();
    const campaignResult = await pool.query(
      `SELECT c.id, c.city_id, c.distribution_log, c.ready_for_creator_feature, c.creator_story_requested, c.creator_interview_scheduled, r.name as hub_name
       FROM crown_campaigns c LEFT JOIN regions r ON c.hub_id = r.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });
    const campaign = campaignResult.rows[0];
    const { forbidden: statusForbidden } = await getAuthorizedCityId(req, campaign.city_id);
    if (statusForbidden) return res.status(403).json({ message: "Not authorized for this city" });
    const distLog = (campaign.distribution_log || {}) as Record<string, unknown>;
    const pulseDrafts = (distLog.pulse || []) as Array<Record<string, unknown>>;
    const tvItems = (distLog.venue_tv || []) as Array<Record<string, unknown>>;
    const creatorActions = (distLog.creator || []) as Array<Record<string, unknown>>;
    let pulsePostDetails: Array<Record<string, unknown>> = [];
    if (pulseDrafts.length > 0) {
      const postIds = pulseDrafts.map(p => p.postId as string).filter(Boolean);
      if (postIds.length > 0) {
        const postsResult = await pool.query(
          `SELECT id, title, status, created_at FROM posts WHERE id = ANY($1)`,
          [postIds]
        );
        pulsePostDetails = postsResult.rows;
      }
    }
    let tvItemDetails: Array<Record<string, unknown>> = [];
    if (tvItems.length > 0) {
      const tvIds = tvItems.map(t => t.tvItemId as string).filter(Boolean);
      if (tvIds.length > 0) {
        const tvResult = await pool.query(
          `SELECT id, title, template_key, enabled, created_at FROM tv_items WHERE id = ANY($1)`,
          [tvIds]
        );
        tvItemDetails = tvResult.rows;
      }
    }
    let sourceRequestDetails: Array<Record<string, unknown>> = [];
    if (creatorActions.length > 0) {
      const srIds = creatorActions.map(c => c.sourceRequestId as string).filter(Boolean);
      if (srIds.length > 0) {
        const srResult = await pool.query(
          `SELECT id, title, status, created_at FROM source_requests WHERE id = ANY($1)`,
          [srIds]
        );
        sourceRequestDetails = srResult.rows;
      }
    }
    const creatorSuggestions = (distLog.creatorSuggestions || []) as Array<Record<string, unknown>>;
    res.json({
      campaignId: campaign.id,
      hubName: campaign.hub_name,
      creatorFlags: {
        readyForCreatorFeature: campaign.ready_for_creator_feature,
        creatorStoryRequested: campaign.creator_story_requested,
        creatorInterviewScheduled: campaign.creator_interview_scheduled,
      },
      pulse: { drafts: pulseDrafts, postDetails: pulsePostDetails },
      venueTv: { items: tvItems, itemDetails: tvItemDetails },
      creator: { actions: creatorActions, sourceRequests: sourceRequestDetails, suggestions: creatorSuggestions },
    });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Error" });
  }
});

export default router;
