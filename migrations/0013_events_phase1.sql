-- Events Phase 1: Self-Service Engine & Admin Command Center

-- Add lifecycle status and analytics counters to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS lifecycle_status varchar NOT NULL DEFAULT 'published';
ALTER TABLE events ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_count integer NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS outbound_ticket_clicks integer NOT NULL DEFAULT 0;

-- Add archived_at to event_series
ALTER TABLE event_series ADD COLUMN IF NOT EXISTS archived_at timestamp;

-- Create event_lifecycle_status enum (for reference, using varchar for flexibility)
DO $$ BEGIN
  CREATE TYPE event_lifecycle_status AS ENUM ('draft', 'under_review', 'published', 'live', 'completed', 'canceled', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event Ticket Types table
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id varchar REFERENCES events(id),
  event_series_id varchar REFERENCES event_series(id),
  name text NOT NULL,
  description text,
  price_display text,
  quantity integer,
  quantity_sold integer NOT NULL DEFAULT 0,
  sale_start_at timestamp,
  sale_end_at timestamp,
  external_checkout_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_type_event_idx ON event_ticket_types(event_id);
CREATE INDEX IF NOT EXISTS ticket_type_series_idx ON event_ticket_types(event_series_id);

-- Event Article Mentions junction table
CREATE TABLE IF NOT EXISTS event_article_mentions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id varchar NOT NULL REFERENCES events(id),
  rss_item_id varchar,
  article_id varchar,
  title text,
  url text,
  source_name text,
  image_url text,
  published_at timestamp,
  added_by_user_id varchar,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_mention_event_idx ON event_article_mentions(event_id);
CREATE INDEX IF NOT EXISTS event_mention_rss_idx ON event_article_mentions(rss_item_id);

-- Event RSS Suppressions / Blocklist table
CREATE TABLE IF NOT EXISTS event_rss_suppressions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id varchar NOT NULL REFERENCES cities(id),
  source_pattern text,
  source_name text,
  title_pattern text,
  reason text,
  suppressed_by_user_id varchar,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rss_suppression_city_idx ON event_rss_suppressions(city_id);

-- Index on lifecycle_status for pipeline queries
CREATE INDEX IF NOT EXISTS event_lifecycle_status_idx ON events(lifecycle_status);
