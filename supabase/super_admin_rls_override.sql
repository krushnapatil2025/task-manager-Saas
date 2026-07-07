-- =============================================================================
-- SQL Migration: Super Admin RLS Overrides
-- Bypasses Row Level Security select restrictions for Super Admins.
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Helper function (SECURITY DEFINER) to bypass RLS recursion check
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;

-- 2. Update PROFILES select policy
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users read all profiles" ON public.profiles;

CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT
  USING (
    auth.uid() = id 
    OR id IN (
      SELECT user_id FROM public.workspace_members 
      WHERE workspace_id IN (SELECT public.get_my_workspace_ids())
    )
    OR public.is_current_user_super_admin()
  );

-- 3. Update WORKSPACES select policy
DROP POLICY IF EXISTS "Workspaces select policy" ON public.workspaces;

CREATE POLICY "Workspaces select policy" ON public.workspaces FOR SELECT
  USING (
    id IN (SELECT public.get_my_workspace_ids())
    OR public.is_current_user_super_admin()
  );

-- 4. Update WORKSPACE_MEMBERS select policy
DROP POLICY IF EXISTS "Workspace members select policy" ON public.workspace_members;

CREATE POLICY "Workspace members select policy" ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    OR public.is_current_user_super_admin()
  );

-- 5. Update TASKS select policy
DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;

CREATE POLICY "Tasks select policy" ON public.tasks FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids()) 
    OR workspace_id IS NULL
    OR public.is_current_user_super_admin()
  );

-- 6. Update AUDIT_LOGS select policy
DROP POLICY IF EXISTS "Audit logs select policy" ON public.audit_logs;

CREATE POLICY "Audit logs select policy" ON public.audit_logs FOR SELECT
  USING (
    public.is_workspace_admin(workspace_id)
    OR public.is_current_user_super_admin()
  );
