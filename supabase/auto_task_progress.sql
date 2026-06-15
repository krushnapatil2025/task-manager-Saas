-- =============================================================================
-- Auto-sync task progress + status from todo_checklist completions.
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Logic:
--   0 completed of N   → Pending,     progress = 0%
--   1…N-1 completed    → In Progress, progress = X%
--   all N completed    → Completed,   progress = 100%
--   0 subtasks         → progress = 0, status unchanged (manual control)
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_task_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id  UUID;
  v_total    INT;
  v_done     INT;
  v_progress INT;
  v_status   TEXT;
BEGIN
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true)
  INTO v_total, v_done
  FROM todo_checklist
  WHERE task_id = v_task_id;

  IF v_total = 0 THEN
    -- No subtasks left: reset progress, leave status for manual control
    UPDATE tasks SET progress = 0 WHERE id = v_task_id;
  ELSE
    v_progress := ROUND((v_done::NUMERIC / v_total) * 100);
    v_status   := CASE
      WHEN v_done = 0       THEN 'Pending'
      WHEN v_done = v_total THEN 'Completed'
      ELSE                       'In Progress'
    END;
    UPDATE tasks
    SET progress = v_progress,
        status   = v_status
    WHERE id = v_task_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_task_progress ON todo_checklist;

CREATE TRIGGER trg_sync_task_progress
  AFTER INSERT OR UPDATE OF completed OR DELETE ON todo_checklist
  FOR EACH ROW EXECUTE FUNCTION sync_task_progress();
