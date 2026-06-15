-- ============================================================================
-- FIX: Admin user showing as "Employee" in Team Members / Teams pages
-- ============================================================================
-- Root cause: profiles.job_profile defaults to 'employee' at signup.
-- When a user registers as a company admin via /admin/register and creates
-- a workspace, the create_workspace_with_admin() function updates job_profile
-- to 'company_admin' — but only if the trigger + function ran correctly.
-- Some existing users may have been created before this was in place.
--
-- This script syncs profiles.job_profile for any workspace admin whose
-- profile still shows 'employee' (or any non-admin value).
--
-- HOW TO APPLY:
--   1. Go to: https://supabase.com/dashboard/project/gxfnmpqbuamzilgeogfh/sql/new
--   2. Paste this entire file and click "Run"
--   3. You should see a row count of how many profiles were updated
-- ============================================================================

-- Step 1: Update profiles for all workspace company_admins whose
--         job_profile is NOT already 'company_admin'
UPDATE profiles p
SET
  job_profile      = 'company_admin',
  setup_completed  = true
FROM workspace_members wm
WHERE wm.user_id       = p.id
  AND wm.role          = 'company_admin'
  AND p.job_profile   != 'company_admin';

-- Step 2: Also ensure role column = 'admin' for these users
--         (the role column drives the sidebar badge and PrivateRoute)
UPDATE profiles p
SET role = 'admin'
FROM workspace_members wm
WHERE wm.user_id    = p.id
  AND wm.role       = 'company_admin'
  AND p.role       != 'admin';

-- Step 3: Verify — run this SELECT to see all admin users after the fix
SELECT
  p.id,
  p.name,
  p.role           AS profile_role,
  p.job_profile,
  wm.role          AS workspace_role,
  wm.workspace_id
FROM profiles p
JOIN workspace_members wm ON wm.user_id = p.id
WHERE wm.role = 'company_admin'
ORDER BY p.name;
