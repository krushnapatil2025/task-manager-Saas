-- ============================================================
-- Access Control: permission_overrides table enhancements
-- Run this in: Supabase Dashboard → SQL Editor
--
-- The permission_overrides table already exists from phase7.
-- This migration ensures the RLS policies are correct for the
-- new per-user access toggle UI.
-- ============================================================

-- Ensure table exists (idempotent)
CREATE TABLE IF NOT EXISTS permission_overrides (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id)   ON DELETE CASCADE NOT NULL,
  permission   TEXT NOT NULL,
  granted      BOOLEAN DEFAULT true,
  granted_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_perm_overrides_ws   ON permission_overrides(workspace_id);
CREATE INDEX IF NOT EXISTS idx_perm_overrides_user ON permission_overrides(user_id);

ALTER TABLE permission_overrides ENABLE ROW LEVEL SECURITY;

-- Drop old policies to recreate cleanly
DROP POLICY IF EXISTS "Company admins manage permission_overrides" ON permission_overrides;
DROP POLICY IF EXISTS "Users read own permission_overrides"        ON permission_overrides;

-- Company admins (and HR) can manage overrides for their workspace
CREATE POLICY "Company admins manage permission_overrides"
  ON permission_overrides FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('company_admin', 'manager')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('company_admin', 'manager')
    )
  );

-- Every authenticated user can read their OWN permission overrides
-- (needed by the usePermissions hook to load live overrides)
CREATE POLICY "Users read own permission_overrides"
  ON permission_overrides FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Grant table access to authenticated role (Supabase Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON permission_overrides TO authenticated;
