-- ============================================================================
-- Phase 21: Recurring Tasks Schema and Spawning Logic
-- Run this in the Supabase SQL editor
-- ============================================================================

-- 1. Add recurrence columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_rule text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_end_date date;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS next_occurrence_at timestamptz;

-- 2. Add performance index for spawning query
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON public.tasks(next_occurrence_at) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON public.tasks(parent_task_id);

-- 3. Set check constraint on recurrence rule
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS chk_tasks_recurrence_rule;
ALTER TABLE public.tasks ADD CONSTRAINT chk_tasks_recurrence_rule CHECK (
  recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly')
);

-- 4. Spawn Recurring Tasks Function
CREATE OR REPLACE FUNCTION public.spawn_recurring_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_new_task_id uuid;
  v_next_occurrence timestamptz;
BEGIN
  -- Find all tasks that are recurring templates and have next_occurrence_at <= NOW()
  FOR r IN 
    SELECT * 
    FROM public.tasks 
    WHERE recurrence_rule IS NOT NULL 
      AND next_occurrence_at IS NOT NULL 
      AND next_occurrence_at <= NOW()
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= next_occurrence_at::date)
  LOOP
    -- 1. Insert the new spawned occurrence
    INSERT INTO public.tasks (
      workspace_id,
      title,
      description,
      priority,
      status,
      due_date,
      created_by,
      attachments,
      progress,
      parent_task_id
    ) VALUES (
      r.workspace_id,
      r.title,
      r.description,
      r.priority,
      'Pending',
      r.next_occurrence_at, -- Occurrence date becomes the due date
      r.created_by,
      r.attachments,
      0,
      r.id
    ) RETURNING id INTO v_new_task_id;

    -- 2. Copy assignees
    INSERT INTO public.task_assignments (task_id, user_id)
    SELECT v_new_task_id, user_id
    FROM public.task_assignments
    WHERE task_id = r.id;

    -- 3. Copy checklist items
    INSERT INTO public.todo_checklist (task_id, title, completed, sort_order)
    SELECT v_new_task_id, title, false, sort_order
    FROM public.todo_checklist
    WHERE task_id = r.id;

    -- 4. Copy OKR Key Result alignments
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'task_key_results') THEN
      INSERT INTO public.task_key_results (task_id, key_result_id)
      SELECT v_new_task_id, key_result_id
      FROM public.task_key_results
      WHERE task_id = r.id;
    END IF;

    -- 5. Calculate the next occurrence date based on the recurrence rule and interval
    IF r.recurrence_rule = 'daily' THEN
      v_next_occurrence := r.next_occurrence_at + (r.recurrence_interval || ' days')::interval;
    ELSIF r.recurrence_rule = 'weekly' THEN
      v_next_occurrence := r.next_occurrence_at + (r.recurrence_interval || ' weeks')::interval;
    ELSIF r.recurrence_rule = 'monthly' THEN
      v_next_occurrence := r.next_occurrence_at + (r.recurrence_interval || ' months')::interval;
    ELSE
      v_next_occurrence := r.next_occurrence_at + (r.recurrence_interval || ' days')::interval;
    END IF;

    -- 6. Update the parent task's next_occurrence_at
    -- If next occurrence exceeds recurrence_end_date, clear next_occurrence_at so it stops spawning
    IF r.recurrence_end_date IS NOT NULL AND v_next_occurrence::date > r.recurrence_end_date THEN
      UPDATE public.tasks
      SET next_occurrence_at = NULL
      WHERE id = r.id;
    ELSE
      UPDATE public.tasks
      SET next_occurrence_at = v_next_occurrence
      WHERE id = r.id;
    END IF;

  END LOOP;
END;
$$;

-- 5. Auto-initialize next_occurrence_at before insert or update on recurring tasks
CREATE OR REPLACE FUNCTION public.trg_tasks_initialize_recurrence()
RETURNS trigger AS $$
BEGIN
  -- If recurrence rule is set and next_occurrence_at is NULL, initial occurrence is due_date
  IF NEW.recurrence_rule IS NOT NULL AND NEW.next_occurrence_at IS NULL THEN
    NEW.next_occurrence_at := NEW.due_date;
  -- If recurrence rule is cleared, next_occurrence_at should be NULL
  ELSIF NEW.recurrence_rule IS NULL THEN
    NEW.next_occurrence_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_tasks_recurrence_init
  BEFORE INSERT OR UPDATE OF recurrence_rule, due_date ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_initialize_recurrence();

-- 6. Schedule pg_cron execution if the cron extension is active
-- SELECT cron.schedule('spawn-recurring-tasks', '0 * * * *', 'SELECT public.spawn_recurring_tasks();');
