-- ============================================================================
-- Phase 34: Employee ID support in Onboarding & Invitation
-- Run this in: Supabase Dashboard → SQL Editor (https://supabase.com/dashboard/project/gxfnmpqbuamzilgeogfh/sql/new)
-- ============================================================================

-- 1. Add employee_id column to employee_invitations if not exists
ALTER TABLE employee_invitations 
  ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- 2. Drop the old get_employee_invite_by_token function
DROP FUNCTION IF EXISTS get_employee_invite_by_token(TEXT);

-- 3. Re-create get_employee_invite_by_token to include employee_id
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
  temp_password  TEXT,
  employee_id    TEXT
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
    ei.temp_password,
    ei.employee_id
  FROM employee_invitations ei
  LEFT JOIN teams t ON t.id = ei.team_id
  LEFT JOIN workspaces w ON w.id = ei.workspace_id
  WHERE ei.token = p_token;
END;
$$;

-- 4. Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_employee_invite_by_token(TEXT) TO anon, authenticated;
