-- =============================================================================
-- DATABASE CONSOLIDATION: Restrict Roles to 4-Role Hierarchy
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ── 1. Clean Up Legacy Values ────────────────────────────────────────────────
UPDATE profiles
SET    job_profile = 'employee'
WHERE  job_profile NOT IN ('company_admin', 'manager', 'employee', 'intern');

UPDATE employee_invitations
SET    job_profile = 'employee'
WHERE  job_profile NOT IN ('company_admin', 'manager', 'employee', 'intern');

UPDATE workspace_members
SET    role = 'employee'
WHERE  role NOT IN ('company_admin', 'manager', 'employee', 'intern');

UPDATE workspace_invitations
SET    role = 'employee'
WHERE  role NOT IN ('company_admin', 'manager', 'employee', 'intern');


-- ── 2. Recreate CHECK Constraints ───────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_job_profile_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_job_profile_check
  CHECK (job_profile IN ('company_admin', 'manager', 'employee', 'intern'));

ALTER TABLE employee_invitations DROP CONSTRAINT IF EXISTS employee_invitations_job_profile_check;
ALTER TABLE employee_invitations ADD CONSTRAINT employee_invitations_job_profile_check
  CHECK (job_profile IN ('company_admin', 'manager', 'employee', 'intern'));

ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('company_admin', 'manager', 'employee', 'intern'));

ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;
ALTER TABLE workspace_invitations ADD CONSTRAINT workspace_invitations_role_check
  CHECK (role IN ('company_admin', 'manager', 'employee', 'intern'));


-- ── 3. Update Default Column Values ──────────────────────────────────────────
ALTER TABLE profiles ALTER COLUMN job_profile SET DEFAULT 'employee';
ALTER TABLE employee_invitations ALTER COLUMN job_profile SET DEFAULT 'employee';
ALTER TABLE workspace_members ALTER COLUMN role SET DEFAULT 'employee';
ALTER TABLE workspace_invitations ALTER COLUMN role SET DEFAULT 'employee';


-- ── 4. Recreate notify_admin_on_employee_setup Trigger Function ──────────────
CREATE OR REPLACE FUNCTION notify_admin_on_employee_setup()
RETURNS TRIGGER AS $$
DECLARE
  v_inviter_id UUID;
  v_job_label  TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    v_inviter_id := OLD.invited_by;

    -- Map job profile to human label
    v_job_label := CASE OLD.job_profile
      WHEN 'company_admin' THEN 'Company Admin'
      WHEN 'manager'       THEN 'Manager'
      WHEN 'intern'        THEN 'Intern'
      ELSE 'Employee'
    END;

    IF v_inviter_id IS NOT NULL THEN
      PERFORM create_notification(
        v_inviter_id,
        'employee_joined',
        'New team member joined! 🎉',
        OLD.email || ' has set up their account as ' || v_job_label
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 5. Recreate get_user_permissions Function ────────────────────────────────
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
    WHEN 'intern' THEN
      v_permissions := ARRAY['tasks.view', 'tasks.change_status', 'tasks.comment', 'teams.view', 'users.view'];
    ELSE
      -- employee / standard member
      v_permissions := ARRAY['tasks.*', 'users.view', 'teams.*', 'reports.view'];
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
