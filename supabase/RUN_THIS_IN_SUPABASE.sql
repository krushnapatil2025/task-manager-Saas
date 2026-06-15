-- ============================================================================
-- ONE-TIME SETUP: Run ALL of these in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/gxfnmpqbuamzilgeogfh/sql/new
-- Run each block separately (or all at once — all are idempotent)
-- ============================================================================


-- ── 1. get_workspace_members_full (fixes the 400 RPC error) ──────────────────
DROP FUNCTION IF EXISTS get_workspace_members_full(UUID);

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    u.email::TEXT,
    COALESCE(p.job_profile, wm.role, 'employee'),
    p.department,
    COALESCE(p.status, 'active'),
    p.profile_image_url,
    p.employee_id,
    wm.role,
    wm.joined_at,
    COALESCE(
      ARRAY(
        SELECT t.name FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.user_id = p.id AND t.workspace_id = p_workspace_id
        ORDER BY t.name
      ), '{}'::TEXT[]
    )
  FROM workspace_members wm
  JOIN profiles p ON p.id = wm.user_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_workspace_members_full(UUID) TO authenticated;


-- ── 2. Fix admin users showing as "Employee" in Teams/Members pages ───────────
UPDATE profiles p
SET job_profile = 'company_admin', setup_completed = true
FROM workspace_members wm
WHERE wm.user_id = p.id
  AND wm.role = 'company_admin'
  AND p.job_profile != 'company_admin';

UPDATE profiles p
SET role = 'admin'
FROM workspace_members wm
WHERE wm.user_id = p.id
  AND wm.role = 'company_admin'
  AND p.role != 'admin';


-- ── 3. Fix employee_invitations status CHECK to include 'revoked' ─────────────
ALTER TABLE employee_invitations
  DROP CONSTRAINT IF EXISTS employee_invitations_status_check;

ALTER TABLE employee_invitations
  ADD CONSTRAINT employee_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));


-- ── 4. Ensure permission_overrides table exists with correct RLS ──────────────
CREATE TABLE IF NOT EXISTS permission_overrides (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id)   ON DELETE CASCADE NOT NULL,
  permission   TEXT NOT NULL,
  granted      BOOLEAN DEFAULT true,
  granted_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id, permission)
);

ALTER TABLE permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company admins manage permission_overrides" ON permission_overrides;
DROP POLICY IF EXISTS "Users read own permission_overrides"        ON permission_overrides;

CREATE POLICY "Company admins manage permission_overrides"
  ON permission_overrides FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'manager')
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'manager')
  ));

CREATE POLICY "Users read own permission_overrides"
  ON permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON permission_overrides TO authenticated;


-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running, reload your browser. All 400 errors should be gone.
