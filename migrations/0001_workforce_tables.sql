DO $$ BEGIN
  CREATE TYPE availability_type AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL', 'FLEXIBLE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE credential_verification_status AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE hiring_status AS ENUM ('ACTIVELY_HIRING', 'OPEN_TO_CANDIDATES', 'NOT_HIRING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE employment_type AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'SEASONAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE compensation_type AS ENUM ('HOURLY', 'SALARY', 'COMMISSION', 'TIPS', 'STIPEND');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'FILLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE skill_level AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS applicant_profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL REFERENCES public_users(id),
  zone_id VARCHAR REFERENCES zones(id),
  headline TEXT,
  summary TEXT,
  availability_type availability_type NOT NULL DEFAULT 'FULL_TIME',
  desired_roles TEXT[] DEFAULT '{}',
  desired_industries TEXT[] DEFAULT '{}',
  willing_to_relocate BOOLEAN NOT NULL DEFAULT false,
  preferred_radius INTEGER,
  years_experience INTEGER,
  highest_education TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  hired_through_hub BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ap_user_uniq ON applicant_profiles(user_id);
CREATE INDEX IF NOT EXISTS ap_zone_idx ON applicant_profiles(zone_id);

CREATE TABLE IF NOT EXISTS skill_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_subcategories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id VARCHAR NOT NULL REFERENCES skill_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ss_category_idx ON skill_subcategories(category_id);

CREATE TABLE IF NOT EXISTS skills (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subcategory_id VARCHAR NOT NULL REFERENCES skill_subcategories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sk_subcategory_idx ON skills(subcategory_id);

CREATE TABLE IF NOT EXISTS applicant_skills (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  skill_id VARCHAR NOT NULL REFERENCES skills(id),
  level skill_level NOT NULL DEFAULT 'INTERMEDIATE',
  years_used INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS as_applicant_skill_uniq ON applicant_skills(applicant_id, skill_id);
CREATE INDEX IF NOT EXISTS as_applicant_idx ON applicant_skills(applicant_id);

CREATE TABLE IF NOT EXISTS credential_directory (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  issuing_body TEXT,
  category TEXT,
  typical_expiration_years INTEGER,
  requires_jurisdiction BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applicant_credentials (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  credential_id VARCHAR NOT NULL REFERENCES credential_directory(id),
  verification_status credential_verification_status NOT NULL DEFAULT 'PENDING',
  issued_date TIMESTAMP,
  expiration_date TIMESTAMP,
  jurisdiction TEXT,
  credential_number TEXT,
  document_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ac_applicant_idx ON applicant_credentials(applicant_id);
CREATE INDEX IF NOT EXISTS ac_verification_idx ON applicant_credentials(verification_status);

CREATE TABLE IF NOT EXISTS applicant_resumes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ar_applicant_idx ON applicant_resumes(applicant_id);

CREATE TABLE IF NOT EXISTS business_hiring_profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id VARCHAR NOT NULL REFERENCES businesses(id),
  hiring_status hiring_status NOT NULL DEFAULT 'NOT_HIRING',
  company_description TEXT,
  typical_roles TEXT[] DEFAULT '{}',
  industries TEXT[] DEFAULT '{}',
  benefits_offered TEXT[] DEFAULT '{}',
  application_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bhp_business_uniq ON business_hiring_profiles(business_id);
CREATE INDEX IF NOT EXISTS bhp_hiring_status_idx ON business_hiring_profiles(hiring_status);

CREATE TABLE IF NOT EXISTS job_listings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id VARCHAR NOT NULL REFERENCES businesses(id),
  zone_id VARCHAR REFERENCES zones(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  employment_type employment_type NOT NULL DEFAULT 'FULL_TIME',
  compensation_type compensation_type NOT NULL DEFAULT 'HOURLY',
  compensation_min INTEGER,
  compensation_max INTEGER,
  status job_status NOT NULL DEFAULT 'DRAFT',
  location TEXT,
  is_remote BOOLEAN NOT NULL DEFAULT false,
  required_skills TEXT[] DEFAULT '{}',
  required_credentials TEXT[] DEFAULT '{}',
  applicants_count INTEGER NOT NULL DEFAULT 0,
  interviews_count INTEGER NOT NULL DEFAULT 0,
  hires_count INTEGER NOT NULL DEFAULT 0,
  job_closed_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jl_business_idx ON job_listings(business_id);
CREATE INDEX IF NOT EXISTS jl_zone_idx ON job_listings(zone_id);
CREATE INDEX IF NOT EXISTS jl_status_idx ON job_listings(status);

CREATE TABLE IF NOT EXISTS job_applications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_listing_id VARCHAR NOT NULL REFERENCES job_listings(id),
  applicant_id VARCHAR NOT NULL REFERENCES applicant_profiles(id),
  resume_id VARCHAR REFERENCES applicant_resumes(id),
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  applied_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ja_job_applicant_uniq ON job_applications(job_listing_id, applicant_id);
CREATE INDEX IF NOT EXISTS ja_job_idx ON job_applications(job_listing_id);
CREATE INDEX IF NOT EXISTS ja_applicant_idx ON job_applications(applicant_id);

CREATE TABLE IF NOT EXISTS employer_hiring_metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id VARCHAR NOT NULL REFERENCES businesses(id),
  month TEXT NOT NULL,
  jobs_posted INTEGER NOT NULL DEFAULT 0,
  applications_received INTEGER NOT NULL DEFAULT 0,
  interviews_conducted INTEGER NOT NULL DEFAULT 0,
  hires_made INTEGER NOT NULL DEFAULT 0,
  avg_time_to_fill_days INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ehm_business_month_uniq ON employer_hiring_metrics(business_id, month);
CREATE INDEX IF NOT EXISTS ehm_business_idx ON employer_hiring_metrics(business_id);
