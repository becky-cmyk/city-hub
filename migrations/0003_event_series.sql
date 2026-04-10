DO $$ BEGIN
  CREATE TYPE event_series_recurrence_type AS ENUM ('weekly', 'monthly', 'custom', 'none');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_series_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE venue_submission_status AS ENUM ('pending', 'approved', 'rejected', 'converted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE venue_submission_status ADD VALUE IF NOT EXISTS 'converted';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_occurrence_status AS ENUM ('scheduled', 'skipped', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE event_occurrence_status ADD VALUE IF NOT EXISTS 'completed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS event_series (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_es TEXT,
  slug TEXT NOT NULL,
  description TEXT,
  description_es TEXT,
  image_url TEXT,
  host_presence_id VARCHAR REFERENCES businesses(id),
  venue_presence_id VARCHAR REFERENCES businesses(id),
  hub_id VARCHAR,
  city_id VARCHAR NOT NULL REFERENCES cities(id),
  zone_id VARCHAR REFERENCES zones(id),
  category_id VARCHAR,
  visibility_default VARCHAR NOT NULL DEFAULT 'public',
  recurrence_type event_series_recurrence_type NOT NULL DEFAULT 'none',
  recurrence_rule_json TEXT,
  default_start_time TEXT,
  default_end_time TEXT,
  default_duration_minutes INTEGER,
  default_location_name TEXT,
  default_address TEXT,
  default_city TEXT,
  default_state TEXT,
  default_zip TEXT,
  default_cost_text TEXT,
  default_max_capacity INTEGER,
  default_rsvp_enabled BOOLEAN NOT NULL DEFAULT false,
  status event_series_status NOT NULL DEFAULT 'draft',
  pulse_announcement_post_id VARCHAR,
  created_by_user_id VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_series_city_slug_idx ON event_series(city_id, slug);
CREATE INDEX IF NOT EXISTS event_series_host_idx ON event_series(host_presence_id);
CREATE INDEX IF NOT EXISTS event_series_venue_idx ON event_series(venue_presence_id);
CREATE INDEX IF NOT EXISTS event_series_status_idx ON event_series(status);

CREATE TABLE IF NOT EXISTS venue_event_submissions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_presence_id VARCHAR NOT NULL REFERENCES businesses(id),
  submitter_presence_id VARCHAR REFERENCES businesses(id),
  submitter_user_id VARCHAR,
  submitter_name TEXT,
  submitter_email TEXT,
  title TEXT NOT NULL,
  description TEXT,
  proposed_start_date_time TIMESTAMP,
  proposed_end_date_time TIMESTAMP,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_description TEXT,
  cost_text TEXT,
  image_url TEXT,
  category_id VARCHAR,
  status venue_submission_status NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_by_user_id VARCHAR,
  reviewed_at TIMESTAMP,
  converted_event_id VARCHAR,
  converted_series_id VARCHAR,
  city_id VARCHAR NOT NULL REFERENCES cities(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venue_sub_venue_idx ON venue_event_submissions(venue_presence_id);
CREATE INDEX IF NOT EXISTS venue_sub_status_idx ON venue_event_submissions(status);

ALTER TABLE events ADD COLUMN IF NOT EXISTS event_series_id VARCHAR;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_presence_id VARCHAR;
ALTER TABLE events ADD COLUMN IF NOT EXISTS occurrence_status VARCHAR DEFAULT 'scheduled';

DO $$ BEGIN
  ALTER TABLE events ALTER COLUMN occurrence_status DROP DEFAULT;
  ALTER TABLE events ALTER COLUMN occurrence_status TYPE event_occurrence_status USING occurrence_status::event_occurrence_status;
  ALTER TABLE events ALTER COLUMN occurrence_status SET DEFAULT 'scheduled';
EXCEPTION WHEN others THEN null;
END $$;
ALTER TABLE events ADD COLUMN IF NOT EXISTS occurrence_index INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS pulse_reminder_enabled BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_event_series_id_fkey
    FOREIGN KEY (event_series_id) REFERENCES event_series(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_venue_presence_id_fkey
    FOREIGN KEY (venue_presence_id) REFERENCES businesses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS events_series_idx ON events(event_series_id);
CREATE INDEX IF NOT EXISTS events_venue_presence_idx ON events(venue_presence_id);
