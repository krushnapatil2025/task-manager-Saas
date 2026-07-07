-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Chat Room Isolation, DM Privacy, and chat_room_members INSERT RLS Policies
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Correct "Members see their own rooms" policy on chat_rooms
-- A user must be a member of the room to see it, UNLESS the room is a public team channel.
DROP POLICY IF EXISTS "Members see their own rooms" ON chat_rooms;

CREATE POLICY "Members see their own rooms"
  ON chat_rooms FOR SELECT
  USING (
    is_room_member(id, auth.uid())
    OR (
      type = 'team'
      AND is_private = FALSE
      AND workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- 2. Correct INSERT policy on chat_room_members
-- A user can only insert themselves if the room is a public team channel.
-- Otherwise, only the room creator/owner or a company admin of the workspace can add members.
DROP POLICY IF EXISTS "System can insert memberships" ON chat_room_members;
DROP POLICY IF EXISTS "Members insert own or owner adds" ON chat_room_members;
DROP POLICY IF EXISTS "Members insert room memberships" ON chat_room_members;

CREATE POLICY "Members insert room memberships"
  ON chat_room_members FOR INSERT
  WITH CHECK (
    (
      user_id = auth.uid()
      AND room_id IN (
        SELECT id FROM chat_rooms 
        WHERE type = 'team' AND is_private = FALSE
      )
    )
    OR EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE id = room_id 
      AND (
        created_by = auth.uid()
        OR workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'company_admin'
        )
      )
    )
  );

-- 3. Update get_or_create_dm_room RPC to ensure direct rooms have EXACTLY 2 members
-- This prevents any room pollution where more than 2 users join a direct room.
CREATE OR REPLACE FUNCTION get_or_create_dm_room(
  p_workspace_id UUID,
  p_user_a       UUID,
  p_user_b       UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Find existing DM room between these two users in this workspace with exactly 2 members
  SELECT cr.id INTO v_room_id
  FROM chat_rooms cr
  JOIN chat_room_members m1 ON m1.room_id = cr.id AND m1.user_id = p_user_a
  JOIN chat_room_members m2 ON m2.room_id = cr.id AND m2.user_id = p_user_b
  WHERE cr.type = 'direct' 
    AND cr.workspace_id = p_workspace_id
    AND (
      SELECT COUNT(*) 
      FROM chat_room_members 
      WHERE room_id = cr.id
    ) = 2
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO chat_rooms (workspace_id, type)
    VALUES (p_workspace_id, 'direct')
    RETURNING id INTO v_room_id;

    INSERT INTO chat_room_members (room_id, user_id)
    VALUES (v_room_id, p_user_a), (v_room_id, p_user_b);
  END IF;

  RETURN v_room_id;
END;
$$;
