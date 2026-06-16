-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 17 — Premium Chat & Private Channels SQL Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Extend chat_rooms Table
ALTER TABLE chat_rooms 
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Populate owner/creator for existing rooms if null
UPDATE chat_rooms 
SET created_by = (
  SELECT user_id 
  FROM chat_room_members 
  WHERE room_id = chat_rooms.id 
  LIMIT 1
)
WHERE created_by IS NULL;

-- 2. Extend chat_room_members Table
ALTER TABLE chat_room_members
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member'));

-- Set first member of existing rooms as owner
UPDATE chat_room_members
SET role = 'owner'
WHERE (room_id, user_id) IN (
  SELECT DISTINCT ON (room_id) room_id, user_id
  FROM chat_room_members
  ORDER BY room_id, last_read_at ASC
);

-- 3. Ensure Helper Function Exists
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

-- 4. Recreate chat_rooms policies
DROP POLICY IF EXISTS "Members see their own rooms" ON chat_rooms;
CREATE POLICY "Members see their own rooms"
  ON chat_rooms FOR SELECT
  USING (
    is_room_member(id, auth.uid())
    OR (is_private = FALSE AND workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Workspace members create rooms" ON chat_rooms;
CREATE POLICY "Workspace members create rooms"
  ON chat_rooms FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

DROP POLICY IF EXISTS "Workspace members update rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Owners or admins update rooms" ON chat_rooms;
CREATE POLICY "Owners or admins update rooms"
  ON chat_rooms FOR UPDATE
  USING (
    created_by = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'company_admin'
    )
  );

DROP POLICY IF EXISTS "Owners or admins delete rooms" ON chat_rooms;
CREATE POLICY "Owners or admins delete rooms"
  ON chat_rooms FOR DELETE
  USING (
    created_by = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'company_admin'
    )
  );

-- 5. Recreate chat_room_members policies
DROP POLICY IF EXISTS "Members read room memberships" ON chat_room_members;
CREATE POLICY "Members read room memberships"
  ON chat_room_members FOR SELECT
  USING (
    is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "System can insert memberships" ON chat_room_members;
DROP POLICY IF EXISTS "Members insert own or owner adds" ON chat_room_members;
CREATE POLICY "Members insert own or owner adds"
  ON chat_room_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
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

DROP POLICY IF EXISTS "Members update own last_read" ON chat_room_members;
CREATE POLICY "Members update own last_read"
  ON chat_room_members FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own membership" ON chat_room_members;
DROP POLICY IF EXISTS "Members delete own or owner removes" ON chat_room_members;
CREATE POLICY "Members delete own or owner removes"
  ON chat_room_members FOR DELETE
  USING (
    user_id = auth.uid()
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

-- 6. Create channel creator function (SECURITY DEFINER to run atomically)
CREATE OR REPLACE FUNCTION create_custom_channel(
  p_workspace_id UUID,
  p_name TEXT,
  p_is_private BOOLEAN,
  p_member_ids UUID[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id UUID;
  v_member_id UUID;
BEGIN
  -- Insert the room
  INSERT INTO chat_rooms (workspace_id, type, name, is_private, created_by)
  VALUES (p_workspace_id, 'team', p_name, p_is_private, auth.uid())
  RETURNING id INTO v_room_id;

  -- Add the creator as owner
  INSERT INTO chat_room_members (room_id, user_id, role)
  VALUES (v_room_id, auth.uid(), 'owner');

  -- Add all selected members
  FOREACH v_member_id IN ARRAY p_member_ids LOOP
    IF v_member_id <> auth.uid() THEN
      INSERT INTO chat_room_members (room_id, user_id, role)
      VALUES (v_room_id, v_member_id, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_custom_channel(UUID, TEXT, BOOLEAN, UUID[]) TO authenticated;
