-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 33 — Sequential Task Numbers (TASK-001 format)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gxfnmpqbuamzilgeogfh/sql/new
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add auto-incrementing task_serial column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_serial SERIAL;

-- 2. Add task_number text column computed automatically from task_serial
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_number TEXT 
  GENERATED ALWAYS AS ('TASK-' || lpad(task_serial::text, 3, '0')) STORED;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_task_number ON tasks(task_number);

-- 4. Update the get_sprint_tasks function to return task_number
DROP FUNCTION IF EXISTS get_sprint_tasks(uuid);

CREATE OR REPLACE FUNCTION get_sprint_tasks(p_sprint_id UUID)
RETURNS TABLE (
  task_id      UUID,
  task_number  TEXT,
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
    t.task_number,
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
