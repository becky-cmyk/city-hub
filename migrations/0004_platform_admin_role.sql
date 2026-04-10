-- Add PLATFORM_ADMIN to user_role enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PLATFORM_ADMIN'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'PLATFORM_ADMIN';
  END IF;
END
$$;
