-- =============================================================================
-- Phase 31: Extended Super Admin Controls & Audit Log Infrastructure
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Create Email Logs Table (for monitoring outbound communications)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient    TEXT NOT NULL,
  type         TEXT NOT NULL, -- 'approval' | 'rejection' | 'restriction' | 'registration'
  status       TEXT DEFAULT 'sent', -- 'sent' | 'failed'
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  error_msg    TEXT
);

-- Enable RLS for email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Select/Insert policies gated by is_super_admin status
CREATE POLICY "Super admins can manage email_logs"
  ON public.email_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- 2. Create Platform Settings Table (for dynamic feature controls)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable RLS for platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Read policy: accessible by anyone (needed for registration & public checks)
CREATE POLICY "Anyone can read platform_settings"
  ON public.platform_settings FOR SELECT
  USING ( true );

-- Write policy: restricted to super admins
CREATE POLICY "Super admins can write platform_settings"
  ON public.platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Seed default platform configurations
INSERT INTO public.platform_settings (key, value) VALUES
  ('allow_new_registrations',    'true'),
  ('auto_approve_registrations', 'false'),
  ('platform_name',              '"Strideo"'),
  ('support_email',              '"support@Strideo.com"'),
  ('sender_name',                '"Strideo Notifications"'),
  ('max_users_free',             '5'),
  ('max_users_pro',              '50'),
  ('max_users_enterprise',       '500'),
  ('feature_ai_assistant',       'true'),
  ('feature_google_drive',       'false'),
  ('feature_public_boards',      'true')
ON CONFLICT (key) DO NOTHING;

-- 3. Administrative RPCs

-- RPC: Update profile admin status
CREATE OR REPLACE FUNCTION public.set_user_super_admin_status(
  p_user_id UUID,
  p_is_super_admin BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check: Must be a super admin to assign super admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only super admins can update super admin status.';
  END IF;

  UPDATE profiles
  SET is_super_admin = p_is_super_admin,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- RPC: Suspend or restore user account
CREATE OR REPLACE FUNCTION public.set_user_approval_status(
  p_user_id UUID,
  p_status TEXT -- 'pending' | 'approved' | 'rejected' | 'restricted'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only super admins can update user approval status.';
  END IF;

  IF p_status NOT IN ('pending', 'approved', 'rejected', 'restricted') THEN
    RAISE EXCEPTION 'Invalid status. Must be pending, approved, rejected, or restricted.';
  END IF;

  UPDATE profiles
  SET account_approval_status = p_status,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- RPC: Set workspace suspension/approval status
CREATE OR REPLACE FUNCTION public.set_workspace_approval_status(
  p_workspace_id UUID,
  p_status TEXT -- 'pending' | 'approved' | 'rejected' | 'restricted'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only super admins can update workspace status.';
  END IF;

  IF p_status NOT IN ('pending', 'approved', 'rejected', 'restricted') THEN
    RAISE EXCEPTION 'Invalid status. Must be pending, approved, rejected, or restricted.';
  END IF;

  UPDATE workspaces
  SET approval_status = p_status,
      updated_at = NOW()
  WHERE id = p_workspace_id;
END;
$$;
