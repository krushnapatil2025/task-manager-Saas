-- ============================================================================
-- Phase 18A: Microsoft Teams-Style Calendar Database Schema
-- Run this in the Supabase SQL editor
-- ============================================================================

-- 1. Main Calendar Events Table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  location        text,             -- physical location or default meeting notes
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  all_day         boolean DEFAULT false,
  color           text DEFAULT '#6366f1',   -- per-event color coding
  event_type      text DEFAULT 'meeting',  -- meeting | reminder | deadline | sprint
  is_private      boolean DEFAULT false,
  team_id         uuid REFERENCES public.teams(id) ON DELETE SET NULL,  -- optional: team-scoped event
  recurrence_id   uuid,             -- for recurring rules grouping
  parent_event_id uuid,             -- for recurring instances
  meeting_url     text,             -- Zoom / Google Meet / Teams / Jitsi link
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. Event Attendees (RSVP tracking)
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'maybe')),
  notified   boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- 3. Calendar Reminders
CREATE TABLE IF NOT EXISTS public.calendar_reminders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  remind_at   timestamptz NOT NULL,
  method      text DEFAULT 'in_app' CHECK (method IN ('in_app', 'email')),
  sent        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- 4. Event-Task Links
CREATE TABLE IF NOT EXISTS public.event_task_links (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  task_id  uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, task_id)
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_workspace  ON public.calendar_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates      ON public.calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON public.calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user       ON public.event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_task_links_task      ON public.event_task_links(task_id);

-- 6. Enable Row-Level Security (RLS)
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_task_links ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "view_workspace_events" ON public.calendar_events;
CREATE POLICY "view_workspace_events" ON public.calendar_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ) AND (
      is_private = false 
      OR created_by = auth.uid() 
      OR id IN (SELECT ea.event_id FROM public.event_attendees ea WHERE ea.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "insert_workspace_events" ON public.calendar_events;
CREATE POLICY "insert_workspace_events" ON public.calendar_events
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ) AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "update_workspace_events" ON public.calendar_events;
CREATE POLICY "update_workspace_events" ON public.calendar_events
  FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "delete_workspace_events" ON public.calendar_events;
CREATE POLICY "delete_workspace_events" ON public.calendar_events
  FOR DELETE USING (created_by = auth.uid());

-- Attendees policies
DROP POLICY IF EXISTS "view_event_attendees" ON public.event_attendees;
CREATE POLICY "view_event_attendees" ON public.event_attendees
  FOR SELECT USING (
    event_id IN (
      SELECT e.id FROM public.calendar_events e
      WHERE e.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "manage_event_attendees" ON public.event_attendees;
CREATE POLICY "manage_event_attendees" ON public.event_attendees
  FOR ALL USING (
    user_id = auth.uid() 
    OR event_id IN (
      SELECT e.id FROM public.calendar_events e WHERE e.created_by = auth.uid()
    )
  );

-- Reminders policies
DROP POLICY IF EXISTS "manage_own_reminders" ON public.calendar_reminders;
CREATE POLICY "manage_own_reminders" ON public.calendar_reminders
  FOR ALL USING (user_id = auth.uid());

-- Task links policies
DROP POLICY IF EXISTS "view_event_task_links" ON public.event_task_links;
CREATE POLICY "view_event_task_links" ON public.event_task_links
  FOR SELECT USING (
    event_id IN (
      SELECT e.id FROM public.calendar_events e
      WHERE e.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "manage_event_task_links" ON public.event_task_links;
CREATE POLICY "manage_event_task_links" ON public.event_task_links
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM public.calendar_events e WHERE e.created_by = auth.uid()
    )
  );

-- 8. Stored Procedures (RPCs)
-- Drop existing versions first to avoid return type signature errors
DROP FUNCTION IF EXISTS public.get_calendar_events(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.create_event_with_attendees(JSONB, UUID[]);
DROP FUNCTION IF EXISTS public.upsert_rsvp(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_upcoming_events(UUID, INTEGER);

-- RPC 1: Fetch calendar events in range with creator details and attendees JSON list
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

-- RPC 2: Atomic event creation with attendees (creator is auto-accepted)
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
    meeting_url
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
    (p_event_data->>'meeting_url')::text
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

-- RPC 3: RSVP handler mapping to event attendees table
CREATE OR REPLACE FUNCTION public.upsert_rsvp(
  p_event_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_attendees (event_id, user_id, status)
  VALUES (p_event_id, auth.uid(), p_status)
  ON CONFLICT (event_id, user_id) DO UPDATE
  SET status = EXCLUDED.status;
END;
$$;

-- RPC 4: Fetch upcoming events list for widget integration
CREATE OR REPLACE FUNCTION public.get_upcoming_events(
  p_user_id uuid,
  p_limit integer DEFAULT 5
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
  created_at timestamptz,
  updated_at timestamptz,
  rsvp_status text
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
    e.created_at,
    e.updated_at,
    att.status AS rsvp_status
  FROM public.calendar_events e
  JOIN public.event_attendees att ON att.event_id = e.id
  WHERE att.user_id = p_user_id
    AND e.end_at >= now()
  ORDER BY e.start_at ASC
  LIMIT p_limit;
END;
$$;

-- Grant permissions for authenticated users to run these RPCs
GRANT EXECUTE ON FUNCTION public.get_calendar_events(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_with_attendees(JSONB, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_rsvp(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_events(UUID, INTEGER) TO authenticated;

-- 9. Real-time Publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events, event_attendees;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
