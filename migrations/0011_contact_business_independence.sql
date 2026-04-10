-- Migration: Contact/Business Independence
-- Adds crmContactId FK and source to business_contacts
-- Adds crmContactId FK to communication_log
-- Backfills existing records by matching email/name+phone

-- Step 1: Add columns
ALTER TABLE business_contacts ADD COLUMN IF NOT EXISTS crm_contact_id VARCHAR REFERENCES crm_contacts(id);
ALTER TABLE business_contacts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'MANUAL';
ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS crm_contact_id VARCHAR REFERENCES crm_contacts(id);

-- Step 2: Backfill business_contacts.crm_contact_id by email match
UPDATE business_contacts bc
SET crm_contact_id = cc.id
FROM crm_contacts cc
WHERE bc.crm_contact_id IS NULL
  AND bc.email IS NOT NULL
  AND bc.email != ''
  AND LOWER(bc.email) = LOWER(cc.email);

-- Step 3: Backfill business_contacts.crm_contact_id by name+phone fallback
UPDATE business_contacts bc
SET crm_contact_id = cc.id
FROM crm_contacts cc
WHERE bc.crm_contact_id IS NULL
  AND LOWER(bc.name) = LOWER(cc.name)
  AND bc.phone IS NOT NULL
  AND bc.phone != ''
  AND bc.phone = cc.phone;

-- Step 4: Backfill communication_log.crm_contact_id through business_contacts chain
UPDATE communication_log cl
SET crm_contact_id = bc.crm_contact_id
FROM business_contacts bc
WHERE cl.crm_contact_id IS NULL
  AND cl.contact_id IS NOT NULL
  AND cl.contact_id = bc.id
  AND bc.crm_contact_id IS NOT NULL;

-- Step 5: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_contacts_crm_contact_id ON business_contacts(crm_contact_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_crm_contact_id ON communication_log(crm_contact_id);
