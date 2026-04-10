-- Content Output Engine: extend content_deliverables and content_packages tables

-- Add new enum values to content_deliverable_type
ALTER TYPE content_deliverable_type ADD VALUE IF NOT EXISTS 'newsletter';
ALTER TYPE content_deliverable_type ADD VALUE IF NOT EXISTS 'video_script';

-- Add new columns to content_deliverables
ALTER TABLE content_deliverables ADD COLUMN IF NOT EXISTS variant text;
ALTER TABLE content_deliverables ADD COLUMN IF NOT EXISTS scheduled_at timestamp;
ALTER TABLE content_deliverables ADD COLUMN IF NOT EXISTS published_externally_at timestamp;

-- Add content_item_id FK to content_packages
ALTER TABLE content_packages ADD COLUMN IF NOT EXISTS content_item_id varchar;

-- Add FK constraint (safe: does nothing if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_packages_content_item_id_fk'
  ) THEN
    ALTER TABLE content_packages
      ADD CONSTRAINT content_packages_content_item_id_fk
      FOREIGN KEY (content_item_id) REFERENCES cms_content_items(id);
  END IF;
END $$;
