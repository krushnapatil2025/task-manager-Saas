-- =============================================================================
-- DATABASE CONSOLIDATION: Restrict Roles to 3-Tier Enterprise Hierarchy
-- Run this in: Supabase Dashboard → SQL Editor
--
-- This script:
-- 1. Updates any legacy/deprecated role values to 'employee' to prevent constraint errors.
-- 2. Restricts the CHECK constraints on all tables to ONLY:
--    'company_admin', 'manager', 'employee', 'intern'
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


-- ── 2. Update profiles check constraint ──────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_job_profile_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_job_profile_check
  CHECK (job_profile IN ('company_admin', 'manager', 'employee', 'intern'));


-- ── 3. Update employee_invitations check constraint ──────────────────────────
ALTER TABLE employee_invitations DROP CONSTRAINT IF EXISTS employee_invitations_job_profile_check;
ALTER TABLE employee_invitations ADD CONSTRAINT employee_invitations_job_profile_check
  CHECK (job_profile IN ('company_admin', 'manager', 'employee', 'intern'));


-- ── 4. Update workspace_members check constraint ─────────────────────────────
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('company_admin', 'manager', 'employee', 'intern'));


-- ── 5. Update workspace_invitations check constraint ──────────────────────────
ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;
ALTER TABLE workspace_invitations ADD CONSTRAINT workspace_invitations_role_check
  CHECK (role IN ('company_admin', 'manager', 'employee', 'intern'));


-- ── 6. Update default role values ────────────────────────────────────────────
ALTER TABLE profiles ALTER COLUMN job_profile SET DEFAULT 'employee';
ALTER TABLE employee_invitations ALTER COLUMN job_profile SET DEFAULT 'employee';
ALTER TABLE workspace_members ALTER COLUMN role SET DEFAULT 'employee';
ALTER TABLE workspace_invitations ALTER COLUMN role SET DEFAULT 'employee';


-- ── 7. Update notify_admin_on_employee_setup trigger function ────────────────
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
