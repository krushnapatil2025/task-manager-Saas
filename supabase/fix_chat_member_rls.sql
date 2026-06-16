-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Chat Room Members Infinite Recursion in RLS Policies
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop all potentially recursive policies on chat_room_members
DROP POLICY IF EXISTS "Members read room memberships"           ON chat_room_members;
DROP POLICY IF EXISTS "System can insert memberships"           ON chat_room_members;
DROP POLICY IF EXISTS "Workspace members can insert memberships" ON chat_room_members;
DROP POLICY IF EXISTS "Allow authenticated inserts"             ON chat_room_members;
DROP POLICY IF EXISTS "Authenticated users can insert room members" ON chat_room_members;

-- 2. Create recursion-free SELECT policy
-- A user can read room memberships if they belong to the same workspace as the room.
-- This does not query chat_room_members itself, so recursion is mathematically impossible.
CREATE POLICY "Members read room memberships"
  ON chat_room_members FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT cr.id FROM chat_rooms cr
      WHERE cr.workspace_id IN (
        SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
      )
    )
  );

-- 3. Create recursion-free INSERT policy
-- A user can add a member if the room belongs to their active workspace.
CREATE POLICY "Members insert room memberships"
  ON chat_room_members FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT cr.id FROM chat_rooms cr
      WHERE cr.workspace_id IN (
        SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
      )
    )
  );

-- 4. Create recursion-free DELETE policy
-- Users can delete their own membership (leave room) or if they belong to the workspace
CREATE POLICY "Members delete room memberships"
  ON chat_room_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    room_id IN (
      SELECT cr.id FROM chat_rooms cr
      WHERE cr.workspace_id IN (
        SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
      )
    )
  );

-- Confirm
SELECT 'chat_room_members RLS recursion fixed ✅' AS status;
