-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Chat Room Members Infinite Recursion in RLS Policies
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create helper function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

-- 2. chat_rooms policies
DROP POLICY IF EXISTS "Members see their own rooms" ON chat_rooms;
CREATE POLICY "Members see their own rooms"
  ON chat_rooms FOR SELECT
  USING (
    is_room_member(id, auth.uid())
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 3. chat_room_members policies
DROP POLICY IF EXISTS "Members read room memberships" ON chat_room_members;
CREATE POLICY "Members read room memberships"
  ON chat_room_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_room_member(room_id, auth.uid())
  );

-- 4. chat_messages policies
DROP POLICY IF EXISTS "Room members read messages" ON chat_messages;
CREATE POLICY "Room members read messages"
  ON chat_messages FOR SELECT
  USING (
    is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "Room members send messages" ON chat_messages;
CREATE POLICY "Room members send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_room_member(room_id, auth.uid())
  );

-- 5. chat_message_reactions policies
DROP POLICY IF EXISTS "Room members read reactions" ON chat_message_reactions;
CREATE POLICY "Room members read reactions"
  ON chat_message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT id FROM chat_messages WHERE is_room_member(room_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Room members add reactions" ON chat_message_reactions;
CREATE POLICY "Room members add reactions"
  ON chat_message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND message_id IN (
      SELECT id FROM chat_messages WHERE is_room_member(room_id, auth.uid())
    )
  );
