ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_claim_status" varchar(32) DEFAULT 'UNCLAIMED';
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_claim_token_hash" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_claim_token_expires_at" timestamp;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_claimed_by_user_id" varchar;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_claimed_at" timestamp;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizer_name" varchar(255);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizer_email" varchar(255);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizer_phone" varchar(50);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ai_extracted_data" jsonb;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ai_confidence_scores" jsonb;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ai_gap_flags" text[] DEFAULT '{}';
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "capture_source" varchar;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "capture_photo_url" text;

CREATE INDEX IF NOT EXISTS "events_claim_status_idx" ON "events" ("event_claim_status");
CREATE INDEX IF NOT EXISTS "event_claim_token_hash_idx" ON "events" ("event_claim_token_hash");
