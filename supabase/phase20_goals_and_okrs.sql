-- ============================================================================
-- Phase 20: Goals & OKR (Objectives and Key Results) Tracker
-- Run this in the Supabase SQL editor
-- ============================================================================

-- 1. Main Goals (Objectives) Table
CREATE TABLE IF NOT EXISTS public.goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  owner_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  progress     integer DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date   date,
  due_date     date,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 2. Key Results (Metrics) Table
CREATE TABLE IF NOT EXISTS public.key_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title         text NOT NULL,
  target_value  numeric DEFAULT 100,
  current_value numeric DEFAULT 0,
  unit          text DEFAULT '%',  -- %, $, count, etc.
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 3. Task - Key Result Links (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.task_key_results (
  task_id       uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  key_result_id uuid NOT NULL REFERENCES public.key_results(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, key_result_id)
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_goals_workspace    ON public.goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner        ON public.goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_key_results_goal   ON public.key_results(goal_id);
CREATE INDEX IF NOT EXISTS idx_tkr_task           ON public.task_key_results(task_id);
CREATE INDEX IF NOT EXISTS idx_tkr_kr             ON public.task_key_results(key_result_id);

-- 5. Auto-update updated_at triggers
DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_key_results_updated_at ON public.key_results;
CREATE TRIGGER trg_key_results_updated_at
  BEFORE UPDATE ON public.key_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Enable Row-Level Security (RLS)
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_key_results ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Goals SELECT: Workspace members can view their own goals, admins/managers can view all
DROP POLICY IF EXISTS "view_workspace_goals" ON public.goals;
CREATE POLICY "view_workspace_goals" ON public.goals
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ) AND (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm 
        WHERE wm.workspace_id = goals.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
      ) OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
      ) OR owner_id = auth.uid()
    )
  );

-- Goals INSERT: Workspace admins, company admins, or managers can create
DROP POLICY IF EXISTS "insert_workspace_goals" ON public.goals;
CREATE POLICY "insert_workspace_goals" ON public.goals
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ) AND (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm 
        WHERE wm.workspace_id = goals.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
      ) OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
      )
    )
  );

-- Goals UPDATE: Workspace admins, company admins, managers can update, or goal owners
DROP POLICY IF EXISTS "update_workspace_goals" ON public.goals;
CREATE POLICY "update_workspace_goals" ON public.goals
  FOR UPDATE USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ) AND (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm 
        WHERE wm.workspace_id = goals.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
      ) OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
      ) OR owner_id = auth.uid()
    )
  );

-- Goals DELETE: Workspace admins, company admins, managers can delete
DROP POLICY IF EXISTS "delete_workspace_goals" ON public.goals;
CREATE POLICY "delete_workspace_goals" ON public.goals
  FOR DELETE USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ) AND (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm 
        WHERE wm.workspace_id = goals.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
      ) OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
      )
    )
  );

-- Key Results SELECT: Workspace members can view their own, admins/managers can view all
DROP POLICY IF EXISTS "view_key_results" ON public.key_results;
CREATE POLICY "view_key_results" ON public.key_results
  FOR SELECT USING (
    goal_id IN (
      SELECT g.id FROM public.goals g
      WHERE g.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
      ) AND (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm 
          WHERE wm.workspace_id = g.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
        ) OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
        ) OR g.owner_id = auth.uid()
      )
    )
  );

-- Key Results WRITE: Admins, company admins, managers, or goal owners can manage
DROP POLICY IF EXISTS "manage_key_results" ON public.key_results;
CREATE POLICY "manage_key_results" ON public.key_results
  FOR ALL USING (
    goal_id IN (
      SELECT g.id FROM public.goals g
      WHERE g.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
      ) AND (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm 
          WHERE wm.workspace_id = g.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
        ) OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
        ) OR g.owner_id = auth.uid()
      )
    )
  );

-- Task links SELECT: Workspace members can view their own, admins/managers can view all
DROP POLICY IF EXISTS "view_task_key_results" ON public.task_key_results;
CREATE POLICY "view_task_key_results" ON public.task_key_results
  FOR SELECT USING (
    key_result_id IN (
      SELECT kr.id FROM public.key_results kr
      JOIN public.goals g ON g.id = kr.goal_id
      WHERE g.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
      ) AND (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm 
          WHERE wm.workspace_id = g.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
        ) OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
        ) OR g.owner_id = auth.uid()
      )
    )
  );

-- Task links WRITE: Any member of the workspace can link/unlink tasks
DROP POLICY IF EXISTS "manage_task_key_results" ON public.task_key_results;
CREATE POLICY "manage_task_key_results" ON public.task_key_results
  FOR ALL USING (
    key_result_id IN (
      SELECT kr.id FROM public.key_results kr
      JOIN public.goals g ON g.id = kr.goal_id
      WHERE g.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
      )
    )
  );

-- 8. Progress Calculation Logic

-- Helper function to recalculate goal & KR progress
CREATE OR REPLACE FUNCTION public.update_goal_progress_from_kr(p_goal_id uuid)
RETURNS void AS $$
DECLARE
  v_goal_progress numeric;
  v_kr_id uuid;
BEGIN
  -- Prevent trigger recursion
  IF current_setting('public.in_progress_calculation', true) = 'true' THEN
    RETURN;
  END IF;
  
  -- Set transaction-scoped setting
  PERFORM set_config('public.in_progress_calculation', 'true', true);

  -- 1. Update key results that are linked to tasks
  FOR v_kr_id IN SELECT id FROM public.key_results WHERE goal_id = p_goal_id LOOP
    IF EXISTS (SELECT 1 FROM public.task_key_results WHERE key_result_id = v_kr_id) THEN
      UPDATE public.key_results kr
      SET current_value = COALESCE(
        (
          SELECT ROUND((COUNT(CASE WHEN t.status = 'Completed' THEN 1 END)::numeric / NULLIF(COUNT(t.id), 0)::numeric) * 100, 2)
          FROM public.task_key_results tkr
          JOIN public.tasks t ON t.id = tkr.task_id
          WHERE tkr.key_result_id = v_kr_id
        ), 0
      )
      WHERE kr.id = v_kr_id;
    END IF;
  END LOOP;

  -- 2. Calculate the average progress of all key results for this goal
  SELECT COALESCE(AVG(
    CASE 
      WHEN kr.target_value = 0 THEN 0
      ELSE LEAST(GREATEST((kr.current_value / kr.target_value) * 100, 0), 100)
    END
  ), 0)
  INTO v_goal_progress
  FROM public.key_results kr
  WHERE kr.goal_id = p_goal_id;

  -- 3. Update the goal's progress
  UPDATE public.goals
  SET progress = ROUND(v_goal_progress)::integer
  WHERE id = p_goal_id;

  -- Reset config setting
  PERFORM set_config('public.in_progress_calculation', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Key result values update
CREATE OR REPLACE FUNCTION public.trg_key_results_progress()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.update_goal_progress_from_kr(NEW.goal_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_kr_progress_update
  AFTER INSERT OR UPDATE OF current_value, target_value ON public.key_results
  FOR EACH ROW EXECUTE FUNCTION public.trg_key_results_progress();

-- Trigger: Task status update
CREATE OR REPLACE FUNCTION public.trg_tasks_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_goal_id uuid;
BEGIN
  FOR v_goal_id IN 
    SELECT DISTINCT kr.goal_id 
    FROM public.task_key_results tkr
    JOIN public.key_results kr ON kr.id = tkr.key_result_id
    WHERE tkr.task_id = NEW.id
  LOOP
    PERFORM public.update_goal_progress_from_kr(v_goal_id);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_tasks_status_goal_progress
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_goal_progress();

-- Trigger: Task-KR link changes
CREATE OR REPLACE FUNCTION public.trg_tkr_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_goal_id uuid;
  v_kr_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_kr_id := OLD.key_result_id;
  ELSE
    v_kr_id := NEW.key_result_id;
  END IF;

  SELECT goal_id INTO v_goal_id FROM public.key_results WHERE id = v_kr_id;
  IF v_goal_id IS NOT NULL THEN
    PERFORM public.update_goal_progress_from_kr(v_goal_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_tkr_changes_goal_progress
  AFTER INSERT OR DELETE ON public.task_key_results
  FOR EACH ROW EXECUTE FUNCTION public.trg_tkr_goal_progress();

-- 9. RPCs for Goal/OKR Operations

-- RPC to retrieve all goals for a workspace with owner names and Key Result count
-- Note: Restricts results so regular members only see their assigned goals, while admins/managers see all.
CREATE OR REPLACE FUNCTION public.get_workspace_goals(p_workspace_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  status text,
  progress integer,
  start_date date,
  due_date date,
  owner_id uuid,
  owner_name text,
  owner_avatar text,
  kr_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if calling user is workspace admin or system admin/manager
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.job_profile IN ('company_admin', 'admin', 'manager'))
  ) INTO v_is_admin;

  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.description,
    g.status,
    g.progress,
    g.start_date,
    g.due_date,
    g.owner_id,
    p.name AS owner_name,
    p.profile_image_url AS owner_avatar,
    COUNT(kr.id) AS kr_count
  FROM public.goals g
  LEFT JOIN public.profiles p ON p.id = g.owner_id
  LEFT JOIN public.key_results kr ON kr.goal_id = g.id
  WHERE g.workspace_id = p_workspace_id
    AND (v_is_admin OR g.owner_id = auth.uid())
  GROUP BY g.id, p.name, p.profile_image_url
  ORDER BY g.due_date ASC, g.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_goals(uuid) TO authenticated;

-- Real-time publication setup
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE goals, key_results, task_key_results;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
