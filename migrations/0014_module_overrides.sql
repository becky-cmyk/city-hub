ALTER TABLE businesses ADD COLUMN IF NOT EXISTS module_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
