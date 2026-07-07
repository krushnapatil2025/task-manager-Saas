-- ============================================================================
-- Phase 32 — Approval Gateway Hardening
-- Run this in: Supabase Dashboard → SQL Editor
--
-- This patch ensures:
--   1. bootstrap_company_admin always sets account_approval_status = 'pending'
--      (already in the function — this re-runs it to guarantee it's up to date)
--   2. The review_company_registration RPC also returns company_name from
--      the profile (company_name) not just the workspace name
--   3. A safe index exists on profiles.account_approval_status for fast queries
--   4. Any profiles inserted without an approval status (edge cases) get 'pending'
--      if they are company_admin role with setup_completed = true
--   5. Grant execute permissions are correct for both RPCs
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Re-deploy bootstrap_company_admin to guarantee pending status
--    (idempotent — safe to run again even if already correct)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION bootstrap_company_admin(
  p_user_id          UUID,
  p_name             TEXT,
  p_phone            TEXT     DEFAULT NULL,
  p_company_name     TEXT     DEFAULT '',
  p_company_industry TEXT     DEFAULT '',
  p_company_size     TEXT     DEFAULT '',
  p_workspace_name   TEXT     DEFAULT '',
  p_workspace_slug   TEXT     DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_slug         TEXT;
BEGIN
  -- 1. Upsert profile — set account_approval_status = 'pending' so the
  --    new company admin is held in the review queue until a Super Admin approves.
  INSERT INTO profiles (
    id, name, phone,
    job_profile, company_name, company_industry, company_size,
    setup_completed, status, role,
    account_approval_status   -- <-- profile-level approval gate
  )
  VALUES (
    p_user_id, p_name, p_phone,
    'company_admin', p_company_name, p_company_industry, p_company_size,
    true, 'active', 'admin',
    'pending'                 -- awaiting Super Admin review
  )
  ON CONFLICT (id) DO UPDATE SET
    name                    = EXCLUDED.name,
    phone                   = EXCLUDED.phone,
    job_profile             = 'company_admin',
    company_name            = EXCLUDED.company_name,
    company_industry        = EXCLUDED.company_industry,
    company_size            = EXCLUDED.company_size,
    setup_completed         = true,
    status                  = 'active',
    role                    = 'admin',
    account_approval_status = 'pending';

  -- 2. Build a unique slug
  v_slug := LOWER(REGEXP_REPLACE(p_workspace_slug, '[^a-z0-9\-]', '-', 'g'));
  IF EXISTS (SELECT 1 FROM workspaces WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
  END IF;

  -- 3. Create workspace — always 'approved' (workspaces are never gated).
  --    Only the company admin's PROFILE requires Super Admin approval.
  INSERT INTO workspaces (name, slug, owner_id, approval_status)
  VALUES (p_workspace_name, v_slug, p_user_id, 'approved')
  RETURNING id INTO v_workspace_id;

  -- 4. Add user as company_admin workspace member
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_user_id, 'company_admin')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'company_admin';

  -- 5. Update profile with workspace ID
  UPDATE profiles
  SET current_workspace_id = v_workspace_id
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success',      true,
    'workspace_id', v_workspace_id,
    'user_id',      p_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM
  );
END;
$$;

-- Grant execute to the anon/authenticated roles so client can call it
GRANT EXECUTE ON FUNCTION bootstrap_company_admin(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)
  TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Patch review_company_registration to return company_name from PROFILE
--    (the profile.company_name is more reliable than the workspace name)
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_ws_name      TEXT;
  v_industry     TEXT;
  v_size         TEXT;
  v_phone        TEXT;
  v_slug         TEXT;
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

  -- Find the owner and workspace details
  SELECT w.owner_id, w.name, w.slug
  INTO v_owner_id, v_ws_name, v_slug
  FROM workspaces w
  WHERE w.id = p_workspace_id;

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

  -- Get full owner + company details for the email response
  SELECT
    p.name,
    p.company_name,
    p.company_industry,
    p.company_size,
    p.phone,
    u.email
  INTO
    v_owner_name,
    v_company_name,
    v_industry,
    v_size,
    v_phone,
    v_owner_email
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
      'status',       p_status,
      'note',         p_note,
      'workspace_id', p_workspace_id
    )
  );

  RETURN jsonb_build_object(
    'success',        true,
    'owner_email',    v_owner_email,
    'owner_name',     v_owner_name,
    'owner_phone',    v_phone,
    'company_name',   COALESCE(v_company_name, v_ws_name),
    'company_industry', v_industry,
    'company_size',   v_size,
    'workspace_slug', v_slug
  );
END;
$$;

-- Grant execute to anon (SA portal has no Supabase session) and authenticated
GRANT EXECUTE ON FUNCTION review_company_registration(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION review_company_registration(UUID, TEXT, TEXT, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ensure fast index on profiles.account_approval_status
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_approval_status_all
  ON profiles(account_approval_status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix any existing company_admin profiles stuck without an approval status
--    (edge case: if any were inserted without the column being set)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE profiles
SET account_approval_status = 'pending'
WHERE
  job_profile = 'company_admin'
  AND (account_approval_status IS NULL OR account_approval_status = '');


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Rebuild workspaces_with_stats view to include all new columns
--    returned by the patched review_company_registration RPC
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS workspaces_with_stats CASCADE;

CREATE VIEW workspaces_with_stats AS
SELECT
  w.id,
  w.name,
  w.slug,
  w.plan,
  w.logo_url,
  w.created_at,
  -- Approval status is on the PROFILE (company admin), not the workspace
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
GROUP BY
  w.id, w.name, w.slug, w.plan, w.logo_url, w.created_at,
  w.brand_color, w.brand_color_light, w.brand_color_text, w.brand_color_name,
  w.company_name,
  p.account_approval_status, p.account_approval_note, p.account_approval_reviewed_at,
  p.company_name, p.company_industry, p.company_size,
  p.name, p.phone;

-- Grant access to authenticated users (SA reads this view)
GRANT SELECT ON workspaces_with_stats TO authenticated;

-- Recreate SELECT policies dropped by CASCADE (from phase30)
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
