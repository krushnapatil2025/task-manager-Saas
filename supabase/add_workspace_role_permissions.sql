-- =============================================================================
-- FEATURE: Workspace Role-Level Permission Customization
-- Run this in: Supabase Dashboard → SQL Editor
--
-- This script:
-- 1. Creates `workspace_role_permissions` table to store custom workspace role settings.
-- 2. Enables Row Level Security (RLS) on the table.
-- 3. Sets up policies allowing members to read and workspace admins to manage.
-- =============================================================================

CREATE TABLE IF NOT EXISTS workspace_role_permissions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  role         TEXT NOT NULL,
  permission   TEXT NOT NULL,
  granted      BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, role, permission)
);

CREATE INDEX IF NOT EXISTS idx_workspace_role_perms_ws ON workspace_role_permissions(workspace_id);

ALTER TABLE workspace_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read workspace_role_permissions" ON workspace_role_permissions;
DROP POLICY IF EXISTS "Admins manage workspace_role_permissions" ON workspace_role_permissions;

CREATE POLICY "Members read workspace_role_permissions"
  ON workspace_role_permissions FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "Admins manage workspace_role_permissions"
  ON workspace_role_permissions FOR ALL
  USING (is_workspace_admin(workspace_id));
