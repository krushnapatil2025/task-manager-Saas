-- ============================================================================
-- Fix: Notifications RLS — allow authenticated users to notify other users
-- who share their workspace, via a SECURITY DEFINER RPC.
-- Direct INSERT on the table is now restricted to self-notifications only.
-- ============================================================================

-- 1. Create a SECURITY DEFINER function to insert notifications for other users.
--    The caller must be authenticated AND share a workspace with the recipient.
--    This bypasses RLS safely while enforcing its own authorization logic.
CREATE OR REPLACE FUNCTION public.create_notification_for_user(
  p_user_id     uuid,
  p_type        text,
  p_title       text,
  p_body        text,
  p_link        text DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_caller_id uuid := auth.uid();
BEGIN
  -- Guard: caller must be authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: caller must share a workspace with the recipient
  -- (either via explicit workspace_id or any shared workspace)
  IF p_workspace_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = p_workspace_id
        AND user_id = v_caller_id
    ) THEN
      RAISE EXCEPTION 'Caller is not a member of the specified workspace';
    END IF;
  ELSE
    -- Fallback: check they share ANY workspace
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = v_caller_id AND wm2.user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Caller does not share a workspace with recipient';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, workspace_id, is_read)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_workspace_id, false)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- 2. Tighten the direct INSERT RLS policy: only allow self-inserts
--    (so users can create notifications for themselves if needed).
--    All cross-user notification creation must go through the RPC above.
DROP POLICY IF EXISTS "Notifications insert policy" ON public.notifications;
DROP POLICY IF EXISTS "Service role inserts notifications"  ON public.notifications;

CREATE POLICY "Notifications insert policy" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );
