-- ============================================================================
-- SQL Migration: Auto-Confirm User Registrations
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Fixes: 400 (Bad Request) / "Email not confirmed" errors on login.
-- Cause: Supabase has email confirmation enabled by default, blocking logins 
--        until the user clicks the confirmation link in their email.
-- ============================================================================

-- 1. Update any existing unconfirmed users in the database to be confirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL OR confirmed_at IS NULL;

-- 2. Create helper trigger function to auto-confirm all future signups
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  NEW.email_confirmed_at := NOW();
  NEW.confirmed_at := NOW();
  RETURN NEW;
END;
$$;

-- 3. Drop trigger if it already exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;

CREATE TRIGGER on_auth_user_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_users();
