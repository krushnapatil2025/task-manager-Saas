-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 13 — Task Dependencies & Sprints
-- Run once in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sprints ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprints (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  goal         TEXT,
  status       TEXT DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  start_date   DATE,
  end_date     DATE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sprints_workspace ON sprints(workspace_id, status);

-- ── 2. Sprint ↔ Task mapping ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprint_tasks (
  sprint_id UUID REFERENCES sprints(id) ON DELETE CASCADE,
  task_id   UUID REFERENCES tasks(id)   ON DELETE CASCADE,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sprint_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_sprint_tasks_sprint ON sprint_tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tasks_task   ON sprint_tasks(task_id);

-- ── 3. Task dependencies ──────────────────────────────────────────────────
-- blocked_task_id is BLOCKED BY blocking_task_id
CREATE TABLE IF NOT EXISTS task_dependencies (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  blocking_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  blocked_task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (blocking_task_id, blocked_task_id),
  CHECK (blocking_task_id <> blocked_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_blocking ON task_dependencies(blocking_task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_blocked  ON task_dependencies(blocked_task_id);

-- ── 4. RLS — Sprints ──────────────────────────────────────────────────────
ALTER TABLE sprints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read sprints"     ON sprints;
DROP POLICY IF EXISTS "Admins manage sprints"    ON sprints;
DROP POLICY IF EXISTS "Members read sprint tasks" ON sprint_tasks;
DROP POLICY IF EXISTS "Admins manage sprint tasks" ON sprint_tasks;
DROP POLICY IF EXISTS "Members read task deps"   ON task_dependencies;
DROP POLICY IF EXISTS "Admins manage task deps"  ON task_dependencies;

CREATE POLICY "Members read sprints"
  ON sprints FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins manage sprints"
  ON sprints FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND role IN ('company_admin','manager','team_lead')
  ));

CREATE POLICY "Members read sprint tasks"
  ON sprint_tasks FOR SELECT
  USING (sprint_id IN (
    SELECT id FROM sprints WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins manage sprint tasks"
  ON sprint_tasks FOR ALL
  USING (sprint_id IN (
    SELECT s.id FROM sprints s
    WHERE s.workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('company_admin','manager','team_lead')
    )
  ));

CREATE POLICY "Members read task deps"
  ON task_dependencies FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins manage task deps"
  ON task_dependencies FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND role IN ('company_admin','manager','team_lead')
  ));

-- ── 5. RPC: get_sprint_with_tasks ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_sprint_tasks(p_sprint_id UUID)
RETURNS TABLE (
  task_id      UUID,
  title        TEXT,
  status       TEXT,
  priority     TEXT,
  progress     INTEGER,
  due_date     DATE,
  assigned_to  JSONB
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    t.id,
    t.title,
    t.status,
    t.priority,
    t.progress,
    t.due_date::DATE,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'avatar', p.profile_image_url
      ))
      FROM task_assignments ta
      JOIN profiles p ON p.id = ta.user_id
      WHERE ta.task_id = t.id
      ), '[]'::jsonb
    ) AS assigned_to
  FROM sprint_tasks st
  JOIN tasks t ON t.id = st.task_id
  WHERE st.sprint_id = p_sprint_id
  ORDER BY t.priority DESC, t.created_at ASC;
$$;

-- ── Done ─────────────────────────────────────────────────────────────────
-- Tables: sprints, sprint_tasks, task_dependencies ✅
-- RLS: members read, admins manage ✅
-- RPC: get_sprint_tasks() ✅
