-- Migration: Expand marketplace into full classifieds platform
-- All new enums, columns, and indexes for marketplace_listings

-- New enum types (idempotent: DO NOTHING if already exists)
DO $$ BEGIN
  CREATE TYPE marketplace_subtype AS ENUM (
    'APARTMENT_COMMUNITY', 'APARTMENT_UNIT', 'HOUSE_FOR_RENT', 'HOUSE_FOR_SALE_FSBO',
    'ROOM_FOR_RENT', 'SHORT_TERM_RENTAL', 'LOOKING_FOR_RENTAL', 'LOOKING_FOR_ROOMMATE',
    'HOUSING_WANTED', 'COMMERCIAL_FOR_LEASE', 'COMMERCIAL_FOR_SALE', 'OFFICE_SUBLEASE',
    'RETAIL_SPACE', 'INDUSTRIAL_WAREHOUSE', 'SHARED_COMMERCIAL_SPACE',
    'LOCAL_SERVICE', 'FREELANCER_SERVICE', 'HOME_SERVICE', 'PROFESSIONAL_SERVICE',
    'FURNITURE', 'EQUIPMENT', 'OFFICE_EQUIPMENT', 'BUSINESS_LIQUIDATION', 'LOCAL_RESALE',
    'LOST_AND_FOUND', 'COMMUNITY_NOTICE', 'VOLUNTEER_OPPORTUNITY', 'CASTING_CALL',
    'AUDITION', 'GENERAL_OPPORTUNITY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE marketplace_owner_type AS ENUM ('READER', 'HUB_PRESENCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE marketplace_lease_or_sale AS ENUM ('LEASE', 'SALE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE marketplace_service_area_type AS ENUM ('AT_LOCATION', 'MOBILE', 'REMOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new listing type enum values
DO $$ BEGIN
  ALTER TYPE marketplace_listing_type ADD VALUE IF NOT EXISTS 'HOUSING_SUPPLY';
  ALTER TYPE marketplace_listing_type ADD VALUE IF NOT EXISTS 'HOUSING_DEMAND';
  ALTER TYPE marketplace_listing_type ADD VALUE IF NOT EXISTS 'COMMERCIAL_PROPERTY';
END $$;

-- Add new status enum values
DO $$ BEGIN
  ALTER TYPE marketplace_listing_status ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
  ALTER TYPE marketplace_listing_status ADD VALUE IF NOT EXISTS 'ARCHIVED';
  ALTER TYPE marketplace_listing_status ADD VALUE IF NOT EXISTS 'REJECTED';
END $$;

-- Add new columns to marketplace_listings (all nullable, backward compatible)
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS subtype marketplace_subtype;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS owner_type marketplace_owner_type NOT NULL DEFAULT 'READER';
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS contact_method text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS hub_presence_id varchar REFERENCES businesses(id);
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}';
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS verification_required boolean NOT NULL DEFAULT false;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS featured_flag boolean NOT NULL DEFAULT false;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS sponsored_flag boolean NOT NULL DEFAULT false;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS visibility_level text NOT NULL DEFAULT 'public';
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS moderation_notes text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS published_at timestamp;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS active_until timestamp;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS address_line_2 text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS address_city text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS address_state text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS address_zip text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS hub_id varchar;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS district_id varchar;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS property_type text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS bathrooms integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS square_feet integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS lot_size text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS furnished boolean;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS smoking_policy text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS available_date timestamp;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS lease_term text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS roommate_ok boolean;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS utilities_included boolean;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS parking_details text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS desired_budget_min integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS desired_budget_max integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS desired_area_text text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS desired_hubs text[] DEFAULT '{}';
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS move_in_timeframe text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS household_size integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pets_flag boolean;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS roommate_preference_text text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS accessibility_needs_text text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS demand_notes text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS lease_or_sale marketplace_lease_or_sale;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS commercial_type text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS zoning_text text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS use_case_text text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS buildout_status text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS parking_count integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS signage_flag boolean;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS service_category text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS service_area_type marketplace_service_area_type;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS service_area_text text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS starting_price integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS license_cert_text text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS item_condition text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pickup_only boolean;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS shipping_available boolean;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS event_date timestamp;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS urgency_level text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS organization_name text;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS salary text;

-- Add indexes
CREATE INDEX IF NOT EXISTS mpl_subtype_idx ON marketplace_listings(subtype);
CREATE INDEX IF NOT EXISTS mpl_owner_type_idx ON marketplace_listings(owner_type);
CREATE INDEX IF NOT EXISTS mpl_hub_idx ON marketplace_listings(hub_id);
CREATE INDEX IF NOT EXISTS mpl_neighborhood_idx ON marketplace_listings(neighborhood);
