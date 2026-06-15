-- =============================================================================
-- FIX: Invitation Flow RPC Functions
-- Run this in: Supabase Dashboard → SQL Editor
--
-- This script:
-- 1. Creates get_employee_invite_by_token() to allow anonymous visitors
--    to look up their invitation details securely via token.
-- 2. Creates accept_employee_invitation() to assign the user to the workspace
--    and team once they set their password and sign in.
-- =============================================================================

-- ── 1. get_employee_invite_by_token ──────────────────────────────────────────
DROP FUNCTION IF EXISTS get_employee_invite_by_token(TEXT);

CREATE OR REPLACE FUNCTION get_employee_invite_by_token(p_token TEXT)
RETURNS TABLE (
  id             UUID,
  email          TEXT,
  name           TEXT,
  job_profile    TEXT,
  department     TEXT,
  status         TEXT,
  expires_at     TIMESTAMPTZ,
  team_id        UUID,
  team_name      TEXT,
  workspace_id   UUID,
  workspace_name TEXT,
  workspace_logo TEXT,
  temp_password  TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ei.id,
    ei.email,
    ei.name,
    ei.job_profile,
    ei.department,
    ei.status,
    ei.expires_at,
    ei.team_id,
    t.name AS team_name,
    ei.workspace_id,
    w.name AS workspace_name,
    w.logo_url AS workspace_logo,
    ei.temp_password
  FROM employee_invitations ei
  LEFT JOIN teams t ON t.id = ei.team_id
  LEFT JOIN workspaces w ON w.id = ei.workspace_id
  WHERE ei.token = p_token;
END;
$$;

-- Allow anyone (including anonymous setup page visitors) to lookup by token
GRANT EXECUTE ON FUNCTION get_employee_invite_by_token(TEXT) TO anon, authenticated;


-- ── 2. accept_employee_invitation ────────────────────────────────────────────
DROP FUNCTION IF EXISTS accept_employee_invitation(TEXT);

CREATE OR REPLACE FUNCTION accept_employee_invitation(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- 1. Fetch and validate the invitation
  SELECT * INTO v_invite
  FROM employee_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid or has expired';
  END IF;

  -- 2. Insert/Update workspace membership
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.job_profile)
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- 3. Insert/Update team membership if team_id is set
  IF v_invite.team_id IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id)
    VALUES (v_invite.team_id, auth.uid())
    ON CONFLICT (team_id, user_id) DO NOTHING;
  END IF;

  -- 4. Mark invitation as accepted
  UPDATE employee_invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN TRUE;
END;
$$;

-- Allow authenticated users (who just signed in with temp password) to accept invite
GRANT EXECUTE ON FUNCTION accept_employee_invitation(TEXT) TO authenticated;
