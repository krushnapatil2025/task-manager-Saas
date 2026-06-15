-- ============================================================================
-- Fix: Missing RPC + schema column additions
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================================

-- ── 1. get_workspace_members_full RPC ────────────────────────────────────────
-- Called by ManageUsers.jsx to get enriched member list with team info.
-- SECURITY DEFINER bypasses RLS for the JOIN without infinite recursion.

CREATE OR REPLACE FUNCTION get_workspace_members_full(p_workspace_id UUID)
RETURNS TABLE (
  user_id           UUID,
  name              TEXT,
  email             TEXT,
  job_profile       TEXT,
  department        TEXT,
  status            TEXT,
  profile_image_url TEXT,
  employee_id       TEXT,
  role              TEXT,
  joined_at         TIMESTAMPTZ,
  team_names        TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id                          AS user_id,
    p.name,
    u.email::TEXT,
    COALESCE(p.job_profile, wm.role, 'employee') AS job_profile,
    p.department,
    COALESCE(p.status, 'active')  AS status,
    p.profile_image_url,
    p.employee_id,
    wm.role,
    wm.joined_at,
    COALESCE(
      ARRAY(
        SELECT t.name
        FROM   team_members tm
        JOIN   teams        t  ON t.id = tm.team_id
        WHERE  tm.user_id = p.id
          AND  t.workspace_id = p_workspace_id
        ORDER  BY t.name
      ),
      '{}'::TEXT[]
    )                             AS team_names
  FROM  workspace_members wm
  JOIN  profiles          p  ON p.id  = wm.user_id
  LEFT JOIN auth.users    u  ON u.id  = p.id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_workspace_members_full(UUID) TO authenticated;

-- ── 2. Add missing columns to employee_invitations ───────────────────────────
-- The service layer references 'name' and 'personal_message' columns.
-- We add them safely with IF NOT EXISTS.

ALTER TABLE employee_invitations
  ADD COLUMN IF NOT EXISTS personal_message TEXT;

-- 'name' column already exists in phase7 schema (TEXT), but ensure it:
-- ALTER TABLE employee_invitations ADD COLUMN IF NOT EXISTS name TEXT;
-- (already present — skipped to avoid error)

-- ── 3. Fix status CHECK to include 'revoked' ─────────────────────────────────
-- The current CHECK only allows pending/accepted/expired.
-- Add 'revoked' so admin revoke actions work cleanly.

ALTER TABLE employee_invitations
  DROP CONSTRAINT IF EXISTS employee_invitations_status_check;

ALTER TABLE employee_invitations
  ADD CONSTRAINT employee_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));
