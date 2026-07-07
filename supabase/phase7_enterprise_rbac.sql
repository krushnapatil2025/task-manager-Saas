-- ============================================================
-- PHASE 7 — Enterprise RBAC, Teams & Job Profiles
-- Run this in: Supabase Dashboard → SQL Editor
--
-- This migration upgrades workspace_members from a simple
-- admin/member model to full enterprise role management with
-- granular job profiles, multi-team support, and employee
-- invitation flow.
--
-- Prerequisites: schema.sql, phase1_workspaces.sql,
--               phase2_realtime.sql, phase4_security.sql,
--               phase5_superadmin.sql, phase6_api.sql
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- SECTION 1: Upgrade workspace_members role constraint
-- Old roles: 'admin', 'member', 'viewer'
-- New roles: granular job profiles + 'viewer'
-- ══════════════════════════════════════════════════════════════

-- Drop existing inline check constraint (auto-named by PostgreSQL)
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;

-- Migrate existing role values before adding new constraint
UPDATE workspace_members SET role = 'company_admin' WHERE role = 'admin';
UPDATE workspace_members SET role = 'employee'      WHERE role = 'member';

-- Add new expanded role constraint
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN (
    'company_admin', 'manager', 'hr', 'developer', 'designer',
    'qa_engineer', 'devops', 'finance', 'sales', 'employee', 'viewer'
  ));

-- Update default from 'member' to 'employee'
ALTER TABLE workspace_members ALTER COLUMN role SET DEFAULT 'employee';


-- ══════════════════════════════════════════════════════════════
-- SECTION 2: Upgrade workspace_invitations role constraint
-- ══════════════════════════════════════════════════════════════

ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;

ALTER TABLE workspace_invitations ADD CONSTRAINT workspace_invitations_role_check
  CHECK (role IN (
    'company_admin', 'manager', 'hr', 'developer', 'designer',
    'qa_engineer', 'devops', 'finance', 'sales', 'employee', 'viewer'
  ));

ALTER TABLE workspace_invitations ALTER COLUMN role SET DEFAULT 'employee';


-- ══════════════════════════════════════════════════════════════
-- SECTION 3: Extend PROFILES table with enterprise fields
-- ══════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_profile TEXT DEFAULT 'employee'
  CHECK (job_profile IN (
    'company_admin', 'manager', 'hr', 'developer', 'designer',
    'qa_engineer', 'devops', 'finance', 'sales', 'employee'
  ));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_id     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio             TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'pending_setup'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by      UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false;

-- Stored temporarily; cleared after employee completes account setup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS temp_password_hash TEXT;

-- Back-fill job_profile for existing company admins from workspace_members
UPDATE profiles p
SET    job_profile = 'company_admin',
       setup_completed = true
FROM   workspace_members wm
WHERE  wm.user_id = p.id
  AND  wm.role   = 'company_admin'
  AND  p.job_profile = 'employee';


-- ══════════════════════════════════════════════════════════════
-- SECTION 4: New TEAMS table
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS teams (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT DEFAULT '#6366f1',
  icon         TEXT DEFAULT 'users',
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teams_workspace ON teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ══════════════════════════════════════════════════════════════
-- SECTION 5: New TEAM_MEMBERS table
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS team_members (
  team_id   UUID REFERENCES teams(id)    ON DELETE CASCADE,
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);


-- ══════════════════════════════════════════════════════════════
-- SECTION 6: New EMPLOYEE_INVITATIONS table
-- Separate from workspace_invitations (which is kept for back-compat).
-- This table drives the Brevo email + guided setup wizard flow.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employee_invitations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  email        TEXT NOT NULL,
  name         TEXT,
  job_profile  TEXT NOT NULL CHECK (job_profile IN (
    'company_admin', 'manager', 'hr', 'developer', 'designer',
    'qa_engineer', 'devops', 'finance', 'sales', 'employee'
  )),
  department   TEXT,
  team_id      UUID REFERENCES teams(id) ON DELETE SET NULL,
  invited_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token        TEXT UNIQUE NOT NULL,
  -- Plaintext stored briefly only until employee completes setup
  temp_password TEXT NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_inv_workspace ON employee_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_emp_inv_email     ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_emp_inv_token     ON employee_invitations(token);
CREATE INDEX IF NOT EXISTS idx_emp_inv_status    ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_emp_inv_expires   ON employee_invitations(expires_at);


-- ══════════════════════════════════════════════════════════════
-- SECTION 7: New PERMISSION_OVERRIDES table
-- Fine-grained per-user permission grants/revocations on top of
-- the base role permissions.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS permission_overrides (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id)   ON DELETE CASCADE NOT NULL,
  -- e.g. 'tasks.create', 'users.manage', 'reports.export'
  permission   TEXT NOT NULL,
  granted      BOOLEAN DEFAULT true,
  granted_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_perm_overrides_ws   ON permission_overrides(workspace_id);
CREATE INDEX IF NOT EXISTS idx_perm_overrides_user ON permission_overrides(user_id);


-- ══════════════════════════════════════════════════════════════
-- SECTION 8: Extend TASKS table with team + visibility
-- ══════════════════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'workspace'
  CHECK (visibility IN ('workspace', 'team', 'private'));

CREATE INDEX IF NOT EXISTS idx_tasks_team       ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_visibility ON tasks(visibility);


-- ══════════════════════════════════════════════════════════════
-- SECTION 9: Row Level Security — new tables
-- ══════════════════════════════════════════════════════════════

ALTER TABLE teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_overrides ENABLE ROW LEVEL SECURITY;

-- ── TEAMS ────────────────────────────────────────────────────

CREATE POLICY "Workspace members read teams"
  ON teams FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins and managers create teams"
  ON teams FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'manager')
  ));

CREATE POLICY "Admins and managers update teams"
  ON teams FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'manager')
  ));

CREATE POLICY "Company admins delete teams"
  ON teams FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

-- ── TEAM_MEMBERS ─────────────────────────────────────────────

CREATE POLICY "Workspace members read team_members"
  ON team_members FOR SELECT
  USING (team_id IN (
    SELECT t.id FROM teams t
    JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
    WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Admins and managers manage team_members"
  ON team_members FOR ALL
  USING (team_id IN (
    SELECT t.id FROM teams t
    JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.role IN ('company_admin', 'manager')
  ));

-- ── EMPLOYEE_INVITATIONS ─────────────────────────────────────

-- company_admin and hr can read invitations for their workspace
CREATE POLICY "Admins and HR read employee_invitations"
  ON employee_invitations FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
  ));

CREATE POLICY "Admins and HR create employee_invitations"
  ON employee_invitations FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
  ));

-- Allows resend / revoke (status update)
CREATE POLICY "Admins and HR update employee_invitations"
  ON employee_invitations FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
  ));

-- Token-based lookup for the /setup-account flow is done via the
-- Edge Function which uses the service_role key (bypasses RLS).

-- ── PERMISSION_OVERRIDES ─────────────────────────────────────

CREATE POLICY "Company admins manage permission_overrides"
  ON permission_overrides FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

-- Each user can read their own overrides (used by usePermissions hook)
CREATE POLICY "Users read own permission_overrides"
  ON permission_overrides FOR SELECT
  USING (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
-- SECTION 10: Update existing RLS policies broken by role rename
-- phase1_workspaces.sql used role = 'admin'; now it's 'company_admin'
-- ══════════════════════════════════════════════════════════════

-- Workspaces
DROP POLICY IF EXISTS "Workspace admins can update workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspace admins can delete workspace" ON workspaces;

CREATE POLICY "Company admins update workspace"
  ON workspaces FOR UPDATE
  USING (id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

CREATE POLICY "Company admins delete workspace"
  ON workspaces FOR DELETE
  USING (id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

-- Workspace members table
DROP POLICY IF EXISTS "Admins can insert workspace_members"         ON workspace_members;
DROP POLICY IF EXISTS "Admins or self can delete workspace_members" ON workspace_members;

CREATE POLICY "Company admins insert workspace_members"
  ON workspace_members FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'company_admin'
    )
    OR auth.uid() = user_id  -- allow self-join during onboarding
  );

CREATE POLICY "Company admins or self delete workspace_members"
  ON workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'company_admin'
    )
  );

-- Tasks
DROP POLICY IF EXISTS "Workspace admins create tasks" ON tasks;
DROP POLICY IF EXISTS "Workspace admins update tasks" ON tasks;
DROP POLICY IF EXISTS "Workspace admins delete tasks" ON tasks;

-- Managers can also create and update tasks
CREATE POLICY "Admins and managers create tasks"
  ON tasks FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'manager')
  ));

CREATE POLICY "Admins and managers update tasks"
  ON tasks FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'manager')
  ));

CREATE POLICY "Company admins delete tasks"
  ON tasks FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

-- Workspace_invitations policies from phase4 checked role = 'admin'
DROP POLICY IF EXISTS "Admins can create invitations"               ON workspace_invitations;
DROP POLICY IF EXISTS "Admins can read own workspace invitations"   ON workspace_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations"              ON workspace_invitations;

CREATE POLICY "Admins and HR create workspace invitations"
  ON workspace_invitations FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
  ));

CREATE POLICY "Admins and HR read workspace invitations"
  ON workspace_invitations FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
  ));

CREATE POLICY "Admins and HR delete workspace invitations"
  ON workspace_invitations FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
  ));


-- ══════════════════════════════════════════════════════════════
-- SECTION 11: Helper Functions
-- ══════════════════════════════════════════════════════════════

-- is_company_admin: fast check used in policies and application code
CREATE OR REPLACE FUNCTION is_company_admin(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id      = auth.uid()
      AND role         = 'company_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- get_user_permissions: returns base permission strings for the
-- caller's role plus any individual overrides in this workspace.
CREATE OR REPLACE FUNCTION get_user_permissions(p_workspace_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  v_role        TEXT;
  v_permissions TEXT[];
BEGIN
  SELECT role INTO v_role
  FROM   workspace_members
  WHERE  workspace_id = p_workspace_id
    AND  user_id      = auth.uid();

  CASE v_role
    WHEN 'company_admin' THEN
      v_permissions := ARRAY['tasks.*', 'users.*', 'teams.*', 'reports.*', 'settings.*'];
    WHEN 'manager' THEN
      v_permissions := ARRAY['tasks.*', 'users.view', 'teams.*', 'reports.view'];
    WHEN 'hr' THEN
      v_permissions := ARRAY['users.*', 'tasks.view', 'reports.view'];
    WHEN 'developer' THEN
      v_permissions := ARRAY['tasks.view', 'tasks.update_own', 'tasks.comment', 'teams.view'];
    WHEN 'designer' THEN
      v_permissions := ARRAY['tasks.view', 'tasks.update_own', 'tasks.comment', 'teams.view'];
    WHEN 'qa_engineer' THEN
      v_permissions := ARRAY['tasks.view', 'tasks.update_own', 'tasks.comment', 'teams.view'];
    WHEN 'devops' THEN
      v_permissions := ARRAY['tasks.view', 'tasks.update_own', 'tasks.comment', 'teams.view', 'settings.view'];
    WHEN 'finance' THEN
      v_permissions := ARRAY['tasks.view', 'reports.view'];
    WHEN 'sales' THEN
      v_permissions := ARRAY['tasks.view', 'tasks.update_own', 'tasks.comment', 'reports.view'];
    WHEN 'viewer' THEN
      v_permissions := ARRAY['tasks.view'];
    ELSE
      v_permissions := ARRAY['tasks.view', 'tasks.update_own'];
  END CASE;

  -- Merge granted overrides
  SELECT array_agg(permission) INTO v_permissions
  FROM (
    SELECT unnest(v_permissions) AS permission
    UNION
    SELECT permission
    FROM   permission_overrides
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  granted      = true
  ) merged;

  -- Remove explicitly revoked permissions
  SELECT array_agg(p) INTO v_permissions
  FROM   unnest(v_permissions) p
  WHERE  p NOT IN (
    SELECT permission
    FROM   permission_overrides
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  granted      = false
  );

  RETURN COALESCE(v_permissions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Update create_workspace_with_admin to use company_admin ──

CREATE OR REPLACE FUNCTION create_workspace_with_admin(
  p_name     TEXT,
  p_slug     TEXT,
  p_logo_url TEXT DEFAULT NULL
)
RETURNS workspaces AS $$
DECLARE
  v_workspace workspaces;
BEGIN
  -- approval_status = 'approved' explicitly because this function is only called
  -- by users who have already completed company registration and been verified.
  -- The 'pending' state is only applied by bootstrap_company_admin (signup flow).
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


-- ══════════════════════════════════════════════════════════════
-- SECTION 12: Update handle_new_user trigger
-- Now also populates job_profile from signup metadata.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, name, role, job_profile,
    profile_image_url, status, setup_completed
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    COALESCE(NEW.raw_user_meta_data->>'job_profile', 'employee'),
    NEW.raw_user_meta_data->>'profile_image_url',
    -- Employees invited via token start as pending_setup; direct signups are active
    CASE WHEN NEW.raw_user_meta_data->>'invited' = 'true'
         THEN 'pending_setup'
         ELSE 'active'
    END,
    -- Invited employees have not completed setup yet
    CASE WHEN NEW.raw_user_meta_data->>'invited' = 'true'
         THEN false
         ELSE true
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ══════════════════════════════════════════════════════════════
-- SECTION 13: Auto-expire old invitations (optional helper)
-- Can be scheduled via Supabase pg_cron (requires pg_cron ext)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE employee_invitations
  SET    status = 'expired'
  WHERE  status    = 'pending'
    AND  expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- To schedule via pg_cron (run once per hour):
-- SELECT cron.schedule('expire-invitations', '0 * * * *', 'SELECT expire_old_invitations()');


-- ══════════════════════════════════════════════════════════════
-- DONE — Phase 7 Enterprise RBAC schema applied.
-- Next: Phase B → AdminRegister page + route changes (src/)
-- ══════════════════════════════════════════════════════════════
