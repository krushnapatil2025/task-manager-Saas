-- ============================================================
-- FIX: infinite recursion in workspace_members RLS policies
--
-- Root cause: the SELECT policy on workspace_members queries
-- workspace_members itself, which re-triggers the same policy
-- → infinite recursion.
--
-- Fix: SECURITY DEFINER helper functions that run as the DB
-- owner (bypassing RLS), used in all policies that need to
-- check workspace membership.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. HELPER FUNCTIONS (SECURITY DEFINER = no RLS applied)
-- ─────────────────────────────────────────────────────────────

-- Returns all workspace IDs the current user belongs to.
-- Bypasses RLS so policies can call this without recursion.
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM   workspace_members
  WHERE  user_id = auth.uid();
$$;

-- Returns true if the current user is an admin of the given workspace.
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
      AND  role         = 'admin'
  );
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. FIX workspace_members policies (the recursive ones)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can read workspace_members"          ON workspace_members;
DROP POLICY IF EXISTS "Admins can insert workspace_members"         ON workspace_members;
DROP POLICY IF EXISTS "Admins or self can delete workspace_members" ON workspace_members;

-- SELECT: user is in the same workspace (uses helper, no recursion)
CREATE POLICY "Members can read workspace_members"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (SELECT get_my_workspace_ids())
  );

-- INSERT: workspace admin, or the user is joining themselves (onboarding)
CREATE POLICY "Admins can insert workspace_members"
  ON workspace_members FOR INSERT
  WITH CHECK (
    is_workspace_admin(workspace_id)
    OR auth.uid() = user_id
  );

-- DELETE: workspace admin, or the user is removing themselves
CREATE POLICY "Admins or self can delete workspace_members"
  ON workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_workspace_admin(workspace_id)
  );


-- ─────────────────────────────────────────────────────────────
-- 3. FIX workspaces policies (they call workspace_members which
--    was recursive — now safe, but use helpers for clarity)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can read their workspaces"     ON workspaces;
DROP POLICY IF EXISTS "Workspace admins can update workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspace admins can delete workspace" ON workspaces;

CREATE POLICY "Members can read their workspaces"
  ON workspaces FOR SELECT
  USING (id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "Workspace admins can update workspace"
  ON workspaces FOR UPDATE
  USING (is_workspace_admin(id));

CREATE POLICY "Workspace admins can delete workspace"
  ON workspaces FOR DELETE
  USING (is_workspace_admin(id));


-- ─────────────────────────────────────────────────────────────
-- 4. FIX workspace_invitations policies (same pattern)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can create invitations"             ON workspace_invitations;
DROP POLICY IF EXISTS "Admins can read own workspace invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations"             ON workspace_invitations;

CREATE POLICY "Admins can create invitations"
  ON workspace_invitations FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "Admins can read own workspace invitations"
  ON workspace_invitations FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Admins can delete invitations"
  ON workspace_invitations FOR DELETE
  USING (is_workspace_admin(workspace_id));


-- ─────────────────────────────────────────────────────────────
-- 5. FIX audit_logs SELECT policy (same pattern)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace admins read audit logs" ON audit_logs;

CREATE POLICY "Workspace admins read audit logs"
  ON audit_logs FOR SELECT
  USING (is_workspace_admin(workspace_id));


-- ─────────────────────────────────────────────────────────────
-- 6. FIX tasks policies that reference workspace_members
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members read tasks"       ON tasks;
DROP POLICY IF EXISTS "Workspace admins create tasks"      ON tasks;
DROP POLICY IF EXISTS "Workspace admins update tasks"      ON tasks;
DROP POLICY IF EXISTS "Workspace admins delete tasks"      ON tasks;

CREATE POLICY "Workspace members read tasks"
  ON tasks FOR SELECT
  USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR workspace_id IS NULL
  );

CREATE POLICY "Workspace admins create tasks"
  ON tasks FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins update tasks"
  ON tasks FOR UPDATE
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins delete tasks"
  ON tasks FOR DELETE
  USING (is_workspace_admin(workspace_id));
