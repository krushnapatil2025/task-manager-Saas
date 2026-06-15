-- ============================================================================
-- Auto-create profile row when a new user signs up
-- This trigger fires on INSERT into auth.users (handled by Supabase internally)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Function that creates the profile row from auth metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    job_profile,
    status,
    setup_completed,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'job_profile',
      NEW.raw_user_meta_data->>'role',
      'employee'
    ),
    'active',
    false,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO NOTHING;  -- safe to re-run, won't overwrite existing rows

  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
