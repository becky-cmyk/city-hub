ALTER TABLE content_feeds ADD COLUMN IF NOT EXISTS default_business_id VARCHAR REFERENCES businesses(id);
