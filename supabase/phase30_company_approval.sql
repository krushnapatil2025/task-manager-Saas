-- ============================================================
-- PHASE 30 — Company Registration Approval Workflow
-- Run this in: Supabase Dashboard → SQL Editor
--
-- ARCHITECTURE:
--   Approval is on the PROFILE (admin user), NOT the workspace.
--   When a new company admin registers via AdminRegister.jsx:
--     → bootstrap_company_admin sets profiles.account_approval_status = 'pending'
--     → Super Admin reviews and approves/rejects the admin profile
--     → Once approved, the admin can freely use the app and create workspaces
--   Workspaces themselves are NEVER gated — they belong to the approved user.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. Add approval columns to PROFILES (not workspaces)
-- ─────────────────────────────────────────────────────────────────

-- Add the approval status column on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_approval_status TEXT DEFAULT 'approved'
  CHECK (account_approval_status IN ('pending', 'approved', 'rejected', 'restricted'));

-- Add audit columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_approval_note        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_approval_reviewed_at TIMESTAMPTZ;

-- Ensure existing users (already active) are approved — only brand-new registrations start as pending
UPDATE profiles
SET account_approval_status = 'approved'
WHERE account_approval_status IS NULL
   OR (setup_completed = true AND account_approval_status = 'pending' AND created_at < NOW() - INTERVAL '1 hour');

-- Ensure profiles has company_info columns (added by bootstrap_company_admin)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_industry TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_size     TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name     TEXT DEFAULT '';

-- Fast index for pending registrations queue
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status
  ON profiles(account_approval_status)
  WHERE account_approval_status = 'pending';

-- ─────────────────────────────────────────────────────────────────
-- 2. Workspaces table — remove old approval gating columns
--    Workspaces do NOT need approval — only the company admin does.
--    We keep the columns if they exist (safe to remove later) but
--    auto-approve ALL workspaces so nothing is blocked.
-- ─────────────────────────────────────────────────────────────────

-- If approval_status exists on workspaces, set all to 'approved' so no workspace is ever blocked
UPDATE workspaces SET approval_status = 'approved' WHERE approval_status != 'approved';

-- Change default to approved for any future workspace inserts
ALTER TABLE workspaces ALTER COLUMN approval_status SET DEFAULT 'approved';

-- ─────────────────────────────────────────────────────────────────
-- 3. Update workspaces_with_stats view
--    Now shows owner's account_approval_status for the SA review panel.
-- ─────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS workspaces_with_stats CASCADE;

CREATE VIEW workspaces_with_stats AS
SELECT
  w.id,
  w.name,
  w.slug,
  w.plan,
  w.logo_url,
  w.created_at,
  -- Include the profile-level approval status for SA review portal
  p.account_approval_status                                     AS approval_status,
  p.account_approval_note                                       AS approval_note,
  p.account_approval_reviewed_at                                AS approval_reviewed_at,
  w.brand_color,
  w.brand_color_light,
  w.brand_color_text,
  w.brand_color_name,
  COALESCE(w.company_name, p.company_name, w.name)              AS company_name,
  p.company_industry                                            AS company_industry,
  p.company_size                                                AS company_size,
  p.name                                                        AS owner_name,
  p.phone                                                       AS owner_phone,
  (SELECT email FROM auth.users WHERE id = w.owner_id)          AS owner_email,
  COUNT(DISTINCT wm.user_id)                                    AS member_count,
  COUNT(DISTINCT t.id)                                          AS task_count
FROM workspaces w
LEFT JOIN profiles          p  ON p.id = w.owner_id
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN tasks             t  ON t.workspace_id  = w.id
GROUP BY w.id, w.name, w.slug, w.plan, w.logo_url, w.created_at,
         w.brand_color, w.brand_color_light, w.brand_color_text, w.brand_color_name,
         w.company_name,
         p.account_approval_status, p.account_approval_note, p.account_approval_reviewed_at,
         p.company_name, p.company_industry, p.company_size,
         p.name, p.phone;


-- ─────────────────────────────────────────────────────────────────
-- 4. Remove workspace-based approval RLS policies
--    And recreate security helper functions with Profile-level Approval Gating
-- ─────────────────────────────────────────────────────────────────

-- Remove old workspace-approval helper functions (no longer needed for gating)
DROP FUNCTION IF EXISTS get_my_approved_workspace_ids() CASCADE;
DROP FUNCTION IF EXISTS is_workspace_approved(UUID) CASCADE;

-- Helper function to check if the current user's profile is approved
CREATE OR REPLACE FUNCTION is_my_profile_approved()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   profiles
    WHERE  id = auth.uid()
      AND  account_approval_status = 'approved'
  );
$$;

-- Redefine get_my_workspace_ids to check profile approval
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM   workspace_members
  WHERE  user_id = auth.uid()
    AND  is_my_profile_approved();
$$;

-- Redefine is_workspace_admin to check profile approval
CREATE OR REPLACE FUNCTION is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role         IN ('company_admin', 'admin')
  ) AND is_my_profile_approved();
$$;

-- Redefine has_write_access to check profile approval
CREATE OR REPLACE FUNCTION has_write_access(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role         IN ('company_admin', 'manager', 'employee')
  ) AND is_my_profile_approved();
$$;

-- Recreate SELECT policies dropped by CASCADE
DROP POLICY IF EXISTS "Tasks select policy" ON tasks;
CREATE POLICY "Tasks select policy" ON tasks FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()) OR workspace_id IS NULL);

DROP POLICY IF EXISTS "Assignments select policy" ON task_assignments;
CREATE POLICY "Assignments select policy" ON task_assignments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE workspace_id IN (SELECT get_my_workspace_ids()) OR workspace_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Checklist select policy" ON todo_checklist;
CREATE POLICY "Checklist select policy" ON todo_checklist FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE workspace_id IN (SELECT get_my_workspace_ids()) OR workspace_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Files select policy" ON task_files;
CREATE POLICY "Files select policy" ON task_files FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "Teams select policy" ON teams;
CREATE POLICY "Teams select policy" ON teams FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "Team members select policy" ON team_members;
CREATE POLICY "Team members select policy" ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );



-- ─────────────────────────────────────────────────────────────────
-- 5. review_company_registration RPC
--    Now updates profiles.account_approval_status, not workspaces.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION review_company_registration(
  p_workspace_id UUID,     -- The initial workspace ID from the registration
  p_status       TEXT,     -- 'approved' | 'rejected' | 'restricted'
  p_note         TEXT,     -- Reason for the decision
  p_secret       TEXT      -- Super Admin secret token
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id     UUID;
  v_owner_email  TEXT;
  v_owner_name   TEXT;
  v_company_name TEXT;
  v_sa_secret    TEXT := 'sa_strideo_2026_secret_xK9mQ';  -- Must match VITE_SUPER_ADMIN_SECRET
BEGIN
  -- Validate the super admin secret
  IF p_secret IS NULL OR p_secret <> v_sa_secret THEN
    RAISE EXCEPTION 'Access denied. Invalid super admin secret.';
  END IF;

  -- Validate status value
  IF p_status NOT IN ('approved', 'rejected', 'restricted') THEN
    RAISE EXCEPTION 'Invalid status. Must be approved, rejected, or restricted.';
  END IF;

  -- Find the owner of the workspace
  SELECT owner_id, name INTO v_owner_id, v_company_name
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found.';
  END IF;

  -- ✅ Update the PROFILE (company admin's account), not the workspace
  UPDATE profiles
  SET
    account_approval_status      = p_status,
    account_approval_note        = p_note,
    account_approval_reviewed_at = NOW()
  WHERE id = v_owner_id;

  -- Get owner details for the email response
  SELECT p.name, u.email
  INTO v_owner_name, v_owner_email
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = v_owner_id;

  -- Log to audit log
  PERFORM log_audit_event(
    p_workspace_id,
    'company.registration.' || p_status,
    'profiles',
    v_owner_id,
    jsonb_build_object(
      'status',      p_status,
      'note',        p_note,
      'workspace_id', p_workspace_id
    )
  );

  RETURN jsonb_build_object(
    'success',       true,
    'owner_email',   v_owner_email,
    'owner_name',    v_owner_name,
    'company_name',  v_company_name
  );
END;
$$;

-- Grant execute to anon (SA portal has no Supabase session) and authenticated
GRANT EXECUTE ON FUNCTION review_company_registration(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION review_company_registration(UUID, TEXT, TEXT, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 6. create_workspace_with_admin — always approved (no gating)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_workspace_with_admin(
  p_name     TEXT,
  p_slug     TEXT,
  p_logo_url TEXT DEFAULT NULL
)
RETURNS workspaces AS $$
DECLARE
  v_workspace workspaces;
BEGIN
  -- Workspaces are ALWAYS approved. Only the profile (admin account) needs approval.
  INSERT INTO workspaces (name, slug, logo_url, owner_id, approval_status)
  VALUES (p_name, p_slug, p_logo_url, auth.uid(), 'approved')
  RETURNING * INTO v_workspace;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace.id, auth.uid(), 'company_admin');

  UPDATE profiles
  SET current_workspace_id = v_workspace.id,
      job_profile          = 'company_admin',
      setup_completed      = true
  WHERE id = auth.uid();

  RETURN v_workspace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
