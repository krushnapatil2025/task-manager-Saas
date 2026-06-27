-- ============================================================================
-- Phase 22: Public Shareable Task Board Schema
-- Run this in the Supabase SQL editor
-- ============================================================================

-- 1. Create public_board_links table
CREATE TABLE IF NOT EXISTS public.public_board_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sprint_id    uuid REFERENCES public.sprints(id) ON DELETE CASCADE,
  token        text UNIQUE DEFAULT gen_random_uuid()::text,
  password_hash text,          -- Plain text password for easy verification in RPC
  expires_at   timestamptz,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.public_board_links ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS select_public_board_links ON public.public_board_links;
CREATE POLICY select_public_board_links ON public.public_board_links
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS insert_public_board_links ON public.public_board_links;
CREATE POLICY insert_public_board_links ON public.public_board_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public_board_links.workspace_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS modify_public_board_links ON public.public_board_links;
CREATE POLICY modify_public_board_links ON public.public_board_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public_board_links.workspace_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public_board_links.workspace_id
        AND user_id = auth.uid()
    )
  );

-- 4. Create the get_public_board RPC function
CREATE OR REPLACE FUNCTION public.get_public_board(
  p_token text,
  p_password text DEFAULT NULL
)
RETURNS TABLE (
  workspace_name text,
  sprint_title text,
  tasks jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_tasks_json jsonb;
BEGIN
  -- 1. Fetch link details
  SELECT l.*, w.name as ws_name, s.name as sp_title
  INTO v_link
  FROM public.public_board_links l
  JOIN public.workspaces w ON w.id = l.workspace_id
  LEFT JOIN public.sprints s ON s.id = l.sprint_id
  WHERE l.token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found';
  END IF;

  -- 2. Check Expiry
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'Board link has expired';
  END IF;

  -- 3. Check Password
  IF v_link.password_hash IS NOT NULL AND (p_password IS NULL OR v_link.password_hash <> p_password) THEN
    RAISE EXCEPTION 'Incorrect password';
  END IF;

  -- 4. Fetch Tasks and format as JSON
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'description', t.description,
      'status', t.status,
      'priority', t.priority,
      'progress', t.progress,
      'due_date', t.due_date,
      'recurrence_rule', t.recurrence_rule,
      'assignees', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name', p.name,
            'profile_image_url', p.profile_image_url
          )
        ), '[]'::jsonb)
        FROM public.task_assignments ta
        JOIN public.profiles p ON p.id = ta.user_id
        WHERE ta.task_id = t.id
      )
    )
  ), '[]'::jsonb)
  INTO v_tasks_json
  FROM public.tasks t
  WHERE t.workspace_id = v_link.workspace_id
    AND (
      v_link.sprint_id IS NULL 
      OR EXISTS (
        SELECT 1 FROM public.sprint_tasks st 
        WHERE st.task_id = t.id 
          AND st.sprint_id = v_link.sprint_id
      )
    );

  RETURN QUERY SELECT v_link.ws_name, v_link.sp_title, v_tasks_json;
END;
$$;
