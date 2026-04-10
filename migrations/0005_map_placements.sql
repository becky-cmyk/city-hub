DO $$ BEGIN
  CREATE TYPE map_placement_type AS ENUM ('promoted_pin', 'zone_overlay', 'business_card_ad');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS map_placements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id VARCHAR NOT NULL REFERENCES cities(id),
  type map_placement_type NOT NULL DEFAULT 'promoted_pin',
  business_id VARCHAR REFERENCES businesses(id),
  zone_id VARCHAR,
  title TEXT,
  tagline TEXT,
  logo_url TEXT,
  cta_url TEXT,
  cta_text TEXT,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_placements_city_idx ON map_placements(city_id);
CREATE INDEX IF NOT EXISTS map_placements_active_idx ON map_placements(city_id, is_active) WHERE is_active = true;
