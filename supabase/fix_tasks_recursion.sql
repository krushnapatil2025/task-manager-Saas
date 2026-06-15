-- =============================================================================
-- FIX: Task Update Infinite Recursion
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   task_assignments
    WHERE  task_id = p_task_id
      AND  user_id = auth.uid()
  );
$$;

-- 2. Recreate Tasks Update Policy
DROP POLICY IF EXISTS "Tasks update policy" ON tasks;

CREATE POLICY "Tasks update policy" ON tasks FOR UPDATE
  USING (
    has_write_access(workspace_id) 
    OR is_task_assignee(id)
  );

-- 3. Recreate Checklist Update Policy
DROP POLICY IF EXISTS "Checklist update policy" ON todo_checklist;

CREATE POLICY "Checklist update policy" ON todo_checklist FOR UPDATE
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE has_write_access(workspace_id) 
         OR is_task_assignee(id)
    )
  );
