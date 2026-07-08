-- ============================================================================
-- SQL Migration: Custom Password Reset with Brevo OTP
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Create table for password reset OTPs
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  otp_code    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for safety
-- (We define no policies, so it's inaccessible to public REST APIs except via our RPCs)
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- 2. Function to generate a 6-digit OTP and save it
CREATE OR REPLACE FUNCTION public.generate_reset_otp(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_exists boolean;
  v_otp text;
  v_chars text := '0123456789';
  v_i integer;
BEGIN
  -- Check if email exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN NULL;
  END IF;

  -- Generate 6-digit OTP
  v_otp := '';
  FOR v_i IN 1..6 LOOP
    v_otp := v_otp || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
  END LOOP;

  -- Delete any old OTPs for this email
  DELETE FROM public.password_reset_otps WHERE email = LOWER(TRIM(p_email));

  -- Insert new OTP valid for 15 minutes
  INSERT INTO public.password_reset_otps (email, otp_code, expires_at)
  VALUES (LOWER(TRIM(p_email)), v_otp, NOW() + INTERVAL '15 minutes');

  RETURN v_otp;
END;
$$;

-- 3. Function to verify the OTP is valid (used by frontend for step-validation)
CREATE OR REPLACE FUNCTION public.verify_reset_otp(p_email text, p_otp text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.password_reset_otps
    WHERE email = LOWER(TRIM(p_email))
      AND otp_code = UPPER(TRIM(p_otp))
      AND expires_at > NOW()
  );
END;
$$;

-- 4. Function to reset the password if the OTP matches
CREATE OR REPLACE FUNCTION public.reset_password_with_otp(
  p_email text,
  p_otp text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_valid boolean;
BEGIN
  -- Verify OTP
  SELECT EXISTS (
    SELECT 1 FROM public.password_reset_otps
    WHERE email = LOWER(TRIM(p_email))
      AND otp_code = UPPER(TRIM(p_otp))
      AND expires_at > NOW()
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN FALSE;
  END IF;

  -- Update password in auth.users
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
  WHERE email = LOWER(TRIM(p_email));

  -- Clean up OTP
  DELETE FROM public.password_reset_otps WHERE email = LOWER(TRIM(p_email));

  RETURN TRUE;
END;
$$;
