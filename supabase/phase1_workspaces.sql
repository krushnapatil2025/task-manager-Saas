-- ============================================================
-- PHASE 1 — Multi-Tenant Workspaces
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. WORKSPACES table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,           -- url-friendly identifier
  logo_url    TEXT,
  plan        TEXT DEFAULT 'free'
              CHECK (plan IN ('free', 'pro', 'enterprise')),
  owner_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  max_members INTEGER DEFAULT 5,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- 2. WORKSPACE_MEMBERS (many-to-many: users ↔ workspaces)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES profiles(id)   ON DELETE CASCADE,
  role         TEXT DEFAULT 'member'
               CHECK (role IN ('admin', 'member', 'viewer')),
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────
-- 3. Add workspace_id to tasks
--    (NULL for now; existing tasks get migrated separately)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- 4. Add current_workspace_id to profiles (tracks active workspace)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────
-- 5. Performance indexes
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspaces_owner        ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_wm_workspace            ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user                 ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace         ON tasks(workspace_id);

-- ─────────────────────────────────────────────────────────────────
-- 6. Auto-update updated_at trigger for workspaces
-- ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY — Workspaces
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE workspaces       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can CREATE a workspace (they become owner)
CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Members can READ workspaces they belong to
CREATE POLICY "Members can read their workspaces"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Only workspace admins can UPDATE their workspace
CREATE POLICY "Workspace admins can update workspace"
  ON workspaces FOR UPDATE
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only workspace admins can DELETE their workspace
CREATE POLICY "Workspace admins can delete workspace"
  ON workspaces FOR DELETE
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY — Workspace Members
-- ─────────────────────────────────────────────────────────────────

-- Members can see other members in their shared workspaces
CREATE POLICY "Members can read workspace_members"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Workspace admins can add members
CREATE POLICY "Admins can insert workspace_members"
  ON workspace_members FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR auth.uid() = user_id  -- allow self-join during onboarding
  );

-- Workspace admins can remove members (or members can remove themselves)
CREATE POLICY "Admins or self can delete workspace_members"
  ON workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 9. SCOPED RLS for tasks — replace old broad policies
-- ─────────────────────────────────────────────────────────────────

-- Drop the old Phase 0 broad policies
DROP POLICY IF EXISTS "Authenticated users read tasks"    ON tasks;
DROP POLICY IF EXISTS "Authenticated users insert tasks"  ON tasks;
DROP POLICY IF EXISTS "Authenticated users update tasks"  ON tasks;
DROP POLICY IF EXISTS "Authenticated users delete tasks"  ON tasks;

-- READ: any member of the task's workspace can read
CREATE POLICY "Workspace members read tasks"
  ON tasks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
    OR workspace_id IS NULL  -- backward compat for tasks without workspace yet
  );

-- INSERT: only workspace admins can create tasks
CREATE POLICY "Workspace admins create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- UPDATE: workspace admins can update any task;
--         members can only update their own assigned tasks (for status/checklist)
CREATE POLICY "Workspace admins update tasks"
  ON tasks FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Assigned members update task status"
  ON tasks FOR UPDATE
  USING (
    id IN (
      SELECT task_id FROM task_assignments WHERE user_id = auth.uid()
    )
  );

-- DELETE: only workspace admins
CREATE POLICY "Workspace admins delete tasks"
  ON tasks FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 10. HELPER FUNCTION — create_workspace_with_admin
--     Called from the onboarding flow via Supabase RPC.
--     Creates the workspace + adds the creator as admin in one
--     atomic transaction (SECURITY DEFINER bypasses RLS).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_workspace_with_admin(
  p_name      TEXT,
  p_slug      TEXT,
  p_logo_url  TEXT DEFAULT NULL
)
RETURNS workspaces AS $$
DECLARE
  v_workspace workspaces;
BEGIN
  -- Insert the workspace
  INSERT INTO workspaces (name, slug, logo_url, owner_id)
  VALUES (p_name, p_slug, p_logo_url, auth.uid())
  RETURNING * INTO v_workspace;

  -- Add the creator as admin member
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace.id, auth.uid(), 'admin');

  -- Set the creator's current_workspace_id
  UPDATE profiles
  SET current_workspace_id = v_workspace.id
  WHERE id = auth.uid();

  RETURN v_workspace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 11. HELPER FUNCTION — join_workspace_as_member
--     Lets a user join a workspace (used in invite flow).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION join_workspace_as_member(
  p_workspace_id UUID
)
RETURNS void AS $$
BEGIN
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace_id, auth.uid(), 'member')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Set as current workspace if user has none
  UPDATE profiles
  SET current_workspace_id = p_workspace_id
  WHERE id = auth.uid() AND current_workspace_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
