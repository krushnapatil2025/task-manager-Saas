-- ============================================================================
-- FIX: get_workspace_members_full  — 400 Bad Request error
-- ============================================================================
-- The ManageUsers page calls this RPC to get an enriched member list with
-- team names joined in.  If the function doesn't exist in the DB the client
-- gets a 400 (function does not exist).
--
-- HOW TO APPLY:
--   1. Go to: https://supabase.com/dashboard/project/gxfnmpqbuamzilgeogfh/sql/new
--   2. Paste this entire file and click "Run"
--   3. You should see: "Success. No rows returned"
-- ============================================================================

-- Drop old version if it exists (avoids return-type conflicts)
DROP FUNCTION IF EXISTS get_workspace_members_full(UUID);

-- Create the function
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
    p.id                                              AS user_id,
    p.name,
    u.email::TEXT,
    COALESCE(p.job_profile, wm.role, 'employee')     AS job_profile,
    p.department,
    COALESCE(p.status, 'active')                     AS status,
    p.profile_image_url,
    p.employee_id,
    wm.role,
    wm.joined_at,
    COALESCE(
      ARRAY(
        SELECT t.name
        FROM   team_members tm
        JOIN   teams        t  ON t.id = tm.team_id
        WHERE  tm.user_id      = p.id
          AND  t.workspace_id  = p_workspace_id
        ORDER  BY t.name
      ),
      '{}'::TEXT[]
    )                                                 AS team_names
  FROM  workspace_members wm
  JOIN  profiles          p   ON p.id  = wm.user_id
  LEFT JOIN auth.users    u   ON u.id  = p.id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY p.name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_workspace_members_full(UUID) TO authenticated;
