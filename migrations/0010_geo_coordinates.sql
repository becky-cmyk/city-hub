-- Add latitude/longitude columns to events, articles, and job_listings
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude NUMERIC;

ALTER TABLE articles ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS longitude NUMERIC;

ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS longitude NUMERIC;
