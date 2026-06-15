-- ============================================================
-- PHASE 5 — Super Admin Console
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. Add is_super_admin to profiles
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Create an index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin ON profiles(is_super_admin) WHERE is_super_admin = true;

-- ─────────────────────────────────────────────────────────────────
-- 2. PLATFORM_STATS view — aggregated data for Super Admin dashboard
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW platform_stats AS
SELECT
  (SELECT COUNT(*) FROM workspaces)                    AS total_workspaces,
  (SELECT COUNT(*) FROM profiles)                      AS total_users,
  (SELECT COUNT(*) FROM tasks)                         AS total_tasks,
  (SELECT COUNT(*) FROM tasks WHERE status = 'Completed') AS completed_tasks,
  (SELECT COUNT(*) FROM task_comments)                 AS total_comments,
  (SELECT COUNT(*) FROM workspace_members)             AS total_memberships,
  (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,
  (SELECT COUNT(*) FROM workspaces WHERE created_at >= NOW() - INTERVAL '30 days') AS new_workspaces_30d,
  (SELECT COUNT(*) FROM tasks WHERE created_at >= NOW() - INTERVAL '30 days')     AS new_tasks_30d;

-- ─────────────────────────────────────────────────────────────────
-- 3. WORKSPACES_WITH_STATS view — all workspaces enriched
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW workspaces_with_stats AS
SELECT
  w.id,
  w.name,
  w.slug,
  w.plan,
  w.logo_url,
  w.created_at,
  p.name                                                        AS owner_name,
  (SELECT email FROM auth.users WHERE id = w.owner_id)          AS owner_email,
  COUNT(DISTINCT wm.user_id)                                    AS member_count,
  COUNT(DISTINCT t.id)                                          AS task_count
FROM workspaces w
LEFT JOIN profiles          p  ON p.id = w.owner_id
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN tasks             t  ON t.workspace_id  = w.id
GROUP BY w.id, w.name, w.slug, w.plan, w.logo_url, w.created_at, p.name;

-- ─────────────────────────────────────────────────────────────────
-- 4. RLS — Super Admins can read everything (bypass workspace scoping)
-- ─────────────────────────────────────────────────────────────────

-- Helper function to check super admin status efficiently
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Super admins can read ALL workspaces
CREATE POLICY "Super admins read all workspaces"
  ON workspaces FOR SELECT
  USING (is_super_admin());

-- Super admins can update workspace plan (for manual override)
CREATE POLICY "Super admins update workspace plan"
  ON workspaces FOR UPDATE
  USING (is_super_admin());

-- Super admins can read ALL profiles
CREATE POLICY "Super admins read all profiles"
  ON profiles FOR SELECT
  USING (is_super_admin());

-- Super admins can update profiles (e.g. grant/revoke super admin)
CREATE POLICY "Super admins update profiles"
  ON profiles FOR UPDATE
  USING (is_super_admin());

-- Super admins can read ALL audit logs
CREATE POLICY "Super admins read all audit logs"
  ON audit_logs FOR SELECT
  USING (is_super_admin());

-- ─────────────────────────────────────────────────────────────────
-- 5. FUNCTION — update_workspace_plan
--    Super admin manually overrides a workspace's plan.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_workspace_plan(
  p_workspace_id UUID,
  p_plan         TEXT
)
RETURNS void AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied. Super admin only.';
  END IF;

  UPDATE workspaces SET plan = p_plan WHERE id = p_workspace_id;

  PERFORM log_audit_event(
    p_workspace_id,
    'workspace.plan_changed',
    'workspaces',
    p_workspace_id,
    jsonb_build_object('new_plan', p_plan, 'changed_by_super_admin', auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 6. FUNCTION — grant/revoke super admin
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_super_admin(p_user_id UUID, p_value BOOLEAN)
RETURNS void AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied. Super admin only.';
  END IF;
  UPDATE profiles SET is_super_admin = p_value WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
