-- =============================================================================
-- Enrich Webhook Payload: include assignees + subtasks in every event.
-- Run this in: Supabase Dashboard → SQL Editor
--
-- WHY TWO TRIGGERS:
--   task.created / task.status_changed → AFTER trigger (row is committed)
--   task.deleted                       → BEFORE trigger (cascade hasn't run yet,
--                                        so task_assignments + todo_checklist
--                                        still exist when we query them)
-- =============================================================================

-- ── Shared helper: build the enriched payload for INSERT / UPDATE ─────────────

CREATE OR REPLACE FUNCTION notify_webhooks_on_task_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_event     TEXT;
  v_payload   JSONB;
  v_assignees JSONB;
  v_subtasks  JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'task.created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_event := 'task.status_changed';
  ELSE
    RETURN NEW;
  END IF;

  -- Assignees (task may have just been created; assignments inserted right after,
  -- so this might be empty for task.created — Edge Function re-fetches them)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('name', p.name, 'job_profile', p.job_profile)),
    '[]'::jsonb
  ) INTO v_assignees
  FROM task_assignments ta
  JOIN profiles p ON p.id = ta.user_id
  WHERE ta.task_id = NEW.id;

  -- Subtasks
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('title', tc.title, 'completed', tc.completed)
      ORDER BY tc.sort_order
    ),
    '[]'::jsonb
  ) INTO v_subtasks
  FROM todo_checklist tc
  WHERE tc.task_id = NEW.id;

  v_payload := jsonb_build_object(
    'event',        v_event,
    'workspace_id', NEW.workspace_id,
    'task',         row_to_json(NEW),
    'assignees',    v_assignees,
    'subtasks',     v_subtasks
  );

  INSERT INTO webhook_deliveries (webhook_id, workspace_id, event, payload, success)
  SELECT w.id, w.workspace_id, v_event, v_payload, false
  FROM webhooks w
  WHERE w.workspace_id = NEW.workspace_id
    AND w.is_active    = true
    AND v_event = ANY(w.events);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Helper: build enriched payload for DELETE (BEFORE trigger) ────────────────

CREATE OR REPLACE FUNCTION notify_webhooks_on_task_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_payload   JSONB;
  v_assignees JSONB;
  v_subtasks  JSONB;
BEGIN
  -- Capture related rows BEFORE the cascade wipes them
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('name', p.name, 'job_profile', p.job_profile)),
    '[]'::jsonb
  ) INTO v_assignees
  FROM task_assignments ta
  JOIN profiles p ON p.id = ta.user_id
  WHERE ta.task_id = OLD.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('title', tc.title, 'completed', tc.completed)
      ORDER BY tc.sort_order
    ),
    '[]'::jsonb
  ) INTO v_subtasks
  FROM todo_checklist tc
  WHERE tc.task_id = OLD.id;

  v_payload := jsonb_build_object(
    'event',        'task.deleted',
    'workspace_id', OLD.workspace_id,
    'task',         row_to_json(OLD),
    'assignees',    v_assignees,
    'subtasks',     v_subtasks
  );

  INSERT INTO webhook_deliveries (webhook_id, workspace_id, event, payload, success)
  SELECT w.id, w.workspace_id, 'task.deleted', v_payload, false
  FROM webhooks w
  WHERE w.workspace_id = OLD.workspace_id
    AND w.is_active    = true
    AND 'task.deleted' = ANY(w.events);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Drop the old combined trigger and replace with two precise ones ───────────

DROP TRIGGER IF EXISTS trg_notify_webhooks          ON tasks;
DROP TRIGGER IF EXISTS trg_notify_webhooks_mutation  ON tasks;
DROP TRIGGER IF EXISTS trg_notify_webhooks_deletion  ON tasks;

-- AFTER: row committed, safe to read NEW values
CREATE TRIGGER trg_notify_webhooks_mutation
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_webhooks_on_task_mutation();

-- BEFORE: cascade hasn't run yet, related rows still exist
CREATE TRIGGER trg_notify_webhooks_deletion
  BEFORE DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_webhooks_on_task_deletion();
