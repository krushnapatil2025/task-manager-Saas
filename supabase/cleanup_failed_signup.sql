-- ============================================================================
-- cleanup_failed_signup RPC
-- Automatically cleans up uncompleted/failed signup attempts when an employee
-- retries their invitation onboarding or uses a resent setup link.
-- Safe because it ONLY deletes users who have no active workspace memberships
-- and are not super admins.
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_failed_signup(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_member_count INT;
BEGIN
  -- 1. Get the email from the pending invitation
  SELECT email INTO v_email
  FROM employee_invitations
  WHERE token = p_token AND status = 'pending';

  -- If no pending invitation, do nothing
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Find the user ID in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  -- If user doesn't exist, we're good (no cleanup needed)
  IF v_user_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- 3. Check if they are in workspace_members
  SELECT COUNT(*) INTO v_member_count
  FROM workspace_members
  WHERE user_id = v_user_id;

  -- 4. If they have no workspace memberships, safe to delete and retry fresh
  IF v_member_count = 0 THEN
    -- Ensure they are not a super admin (safety check)
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND is_super_admin = true) THEN
      RETURN FALSE;
    END IF;

    -- Delete from auth.users (cascades to profiles)
    DELETE FROM auth.users WHERE id = v_user_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Grant execute to anon and authenticated roles so client can call it
GRANT EXECUTE ON FUNCTION cleanup_failed_signup(TEXT) TO anon, authenticated;
