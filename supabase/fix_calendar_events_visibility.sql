-- ============================================================================
-- Fix: get_calendar_events should only return events where the current user
-- is the creator OR is an attendee. SECURITY DEFINER bypasses RLS so we must
-- enforce the attendance filter inside the function itself.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_calendar_events(
  p_workspace_id uuid,
  p_start_at     timestamptz,
  p_end_at       timestamptz
)
RETURNS TABLE (
  id             uuid,
  workspace_id   uuid,
  created_by     uuid,
  title          text,
  description    text,
  location       text,
  start_at       timestamptz,
  end_at         timestamptz,
  all_day        boolean,
  color          text,
  event_type     text,
  is_private     boolean,
  team_id        uuid,
  meeting_url    text,
  recurrence_rule text,
  created_at     timestamptz,
  updated_at     timestamptz,
  creator_name   text,
  creator_avatar text,
  attendees      jsonb
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
    p.name            AS creator_name,
    p.profile_image_url AS creator_avatar,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id',           att.user_id,
            'status',            att.status,
            'name',              ap.name,
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
  WHERE
    e.workspace_id = p_workspace_id
    AND e.start_at <= p_end_at
    AND e.end_at   >= p_start_at
    -- ── KEY FIX: only return events the current user created or was invited to ──
    AND (
      e.created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.event_attendees ea
        WHERE ea.event_id = e.id
          AND ea.user_id  = auth.uid()
      )
    );
END;
$$;
