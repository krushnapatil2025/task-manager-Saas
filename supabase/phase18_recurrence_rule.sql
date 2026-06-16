-- ============================================================================
-- Phase 18E: Add Recurrence Rule Column and Update Related Functions
-- ============================================================================

-- 1. Add recurrence_rule column to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS recurrence_rule text;

-- 2. Update get_calendar_events function to return recurrence_rule
DROP FUNCTION IF EXISTS public.get_calendar_events(uuid, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.get_calendar_events(
  p_workspace_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  created_by uuid,
  title text,
  description text,
  location text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean,
  color text,
  event_type text,
  is_private boolean,
  team_id uuid,
  meeting_url text,
  recurrence_rule text,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text,
  creator_avatar text,
  attendees jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.workspace_id,
    e.created_by,
    e.title,
    e.description,
    e.location,
    e.start_at,
    e.end_at,
    e.all_day,
    e.color,
    e.event_type,
    e.is_private,
    e.team_id,
    e.meeting_url,
    e.recurrence_rule,
    e.created_at,
    e.updated_at,
    p.name AS creator_name,
    p.profile_image_url AS creator_avatar,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', att.user_id,
            'status', att.status,
            'name', ap.name,
            'profile_image_url', ap.profile_image_url
          )
        )
        FROM public.event_attendees att
        JOIN public.profiles ap ON ap.id = att.user_id
        WHERE att.event_id = e.id
      ),
      '[]'::jsonb
    ) AS attendees
  FROM public.calendar_events e
  LEFT JOIN public.profiles p ON p.id = e.created_by
  WHERE e.workspace_id = p_workspace_id
    AND e.start_at <= p_end_at
    AND e.end_at >= p_start_at;
END;
$$;

-- 3. Update create_event_with_attendees to accept and insert recurrence_rule
DROP FUNCTION IF EXISTS public.create_event_with_attendees(jsonb, uuid[]);
CREATE OR REPLACE FUNCTION public.create_event_with_attendees(
  p_event_data jsonb,
  p_attendee_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_attendee_id uuid;
BEGIN
  -- Insert the calendar event
  INSERT INTO public.calendar_events (
    workspace_id,
    created_by,
    title,
    description,
    location,
    start_at,
    end_at,
    all_day,
    color,
    event_type,
    is_private,
    team_id,
    meeting_url,
    recurrence_rule
  ) VALUES (
    (p_event_data->>'workspace_id')::uuid,
    (p_event_data->>'created_by')::uuid,
    (p_event_data->>'title')::text,
    (p_event_data->>'description')::text,
    (p_event_data->>'location')::text,
    (p_event_data->>'start_at')::timestamptz,
    (p_event_data->>'end_at')::timestamptz,
    COALESCE((p_event_data->>'all_day')::boolean, false),
    COALESCE((p_event_data->>'color')::text, '#6366f1'),
    COALESCE((p_event_data->>'event_type')::text, 'meeting'),
    COALESCE((p_event_data->>'is_private')::boolean, false),
    (p_event_data->>'team_id')::uuid,
    (p_event_data->>'meeting_url')::text,
    (p_event_data->>'recurrence_rule')::text
  ) RETURNING id INTO v_event_id;

  -- Insert the creator as an accepted attendee
  INSERT INTO public.event_attendees (event_id, user_id, status)
  VALUES (v_event_id, (p_event_data->>'created_by')::uuid, 'accepted')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Insert other attendees
  IF p_attendee_ids IS NOT NULL THEN
    FOREACH v_attendee_id IN ARRAY p_attendee_ids LOOP
      -- Avoid double inserting creator
      IF v_attendee_id != (p_event_data->>'created_by')::uuid THEN
        INSERT INTO public.event_attendees (event_id, user_id, status)
        VALUES (v_event_id, v_attendee_id, 'pending')
        ON CONFLICT (event_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_event_id;
END;
$$;

-- 4. Helper Security Definer functions to prevent RLS recursion
CREATE OR REPLACE FUNCTION public.check_user_in_event_workspace(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_events e
    JOIN public.workspace_members wm ON wm.workspace_id = e.workspace_id
    WHERE e.id = p_event_id AND wm.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_user_is_event_attendee(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE event_id = p_event_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_user_is_event_creator(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_events
    WHERE id = p_event_id AND created_by = p_user_id
  );
$$;

-- 5. Re-apply Calendar RLS policies without recursive queries
-- For calendar_events
DROP POLICY IF EXISTS "view_workspace_events" ON public.calendar_events;
CREATE POLICY "view_workspace_events" ON public.calendar_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ) AND (
      is_private = false 
      OR created_by = auth.uid() 
      OR check_user_is_event_attendee(id, auth.uid())
    )
  );

-- For event_attendees
DROP POLICY IF EXISTS "view_event_attendees" ON public.event_attendees;
CREATE POLICY "view_event_attendees" ON public.event_attendees
  FOR SELECT USING (
    check_user_in_event_workspace(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "manage_event_attendees" ON public.event_attendees;
CREATE POLICY "manage_event_attendees" ON public.event_attendees
  FOR ALL USING (
    user_id = auth.uid() 
    OR check_user_is_event_creator(event_id, auth.uid())
  );

-- For event_task_links
DROP POLICY IF EXISTS "view_event_task_links" ON public.event_task_links;
CREATE POLICY "view_event_task_links" ON public.event_task_links
  FOR SELECT USING (
    check_user_in_event_workspace(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "manage_event_task_links" ON public.event_task_links;
CREATE POLICY "manage_event_task_links" ON public.event_task_links
  FOR ALL USING (
    check_user_is_event_creator(event_id, auth.uid())
  );

-- 6. Fix Notifications Insert RLS policy to allow workspace notifications
DROP POLICY IF EXISTS "Notifications insert policy" ON public.notifications;
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.notifications;

CREATE POLICY "Notifications insert policy" ON public.notifications FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      user_id = auth.uid()
      OR
      workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
      )
    )
  );
