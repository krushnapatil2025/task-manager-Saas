-- ═══════════════════════════════════════════════════════════════════════════
-- CHAT FIX — Run this in Supabase SQL Editor (safe to re-run)
-- Fixes: RLS, author_id ambiguous FK, workspace_id, all policies, realtime
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Enable RLS on all chat tables ─────────────────────────────────────
ALTER TABLE IF EXISTS chat_rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_room_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS task_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS task_message_reactions ENABLE ROW LEVEL SECURITY;

-- ── 2. Recreate notify_task_comment trigger function & drop leftover author_id ──
-- task_messages has TWO FKs to profiles: user_id AND old author_id.
-- First, recreate the trigger function to use the user_id column instead of author_id.
CREATE OR REPLACE FUNCTION notify_task_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_assignee   RECORD;
  v_author     profiles%ROWTYPE;
BEGIN
  -- Select author profile using user_id instead of deprecated author_id
  SELECT * INTO v_author FROM profiles WHERE id = NEW.user_id;

  FOR v_assignee IN
    SELECT user_id FROM task_assignments WHERE task_id = NEW.task_id
  LOOP
    IF v_assignee.user_id <> NEW.user_id THEN
      INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
      VALUES (
        v_assignee.user_id,
        NEW.workspace_id,
        'task_comment',
        CONCAT(COALESCE(v_author.name, 'Someone'), ' commented on a task'),
        LEFT(NEW.content, 100),
        CONCAT('/user/task-details/', NEW.task_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on task_messages table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'task_comments'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_task_comment ON task_comments';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_notify_task_comment ON task_messages;

CREATE TRIGGER trg_notify_task_comment
  AFTER INSERT ON task_messages
  FOR EACH ROW EXECUTE FUNCTION notify_task_comment();

-- Drop leftover author_id column (root cause of PGRST201 error)
-- We permanently remove author_id — user_id is the canonical column.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- Find and drop the FK constraint on author_id
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'task_messages'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'author_id'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE task_messages DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;

  -- Drop the author_id column itself
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_messages' AND column_name = 'author_id'
  ) THEN
    ALTER TABLE task_messages DROP COLUMN author_id;
  END IF;
END $$;

-- ── 3. Add workspace_id to task_messages if missing ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_messages' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE task_messages
      ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL;
  END IF;
END $$;

-- ── 4. task_messages policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can insert task messages"          ON task_messages;
DROP POLICY IF EXISTS "Workspace members can read task messages"  ON task_messages;
DROP POLICY IF EXISTS "Authors can delete own messages"           ON task_messages;
DROP POLICY IF EXISTS "Authors can update own messages"           ON task_messages;

CREATE POLICY "Workspace members can read task messages"
  ON task_messages FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can insert task messages"
  ON task_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authors can delete own messages"
  ON task_messages FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Authors can update own messages"
  ON task_messages FOR UPDATE
  USING (user_id = auth.uid());

-- ── 5. chat_rooms policies ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members see their own rooms"       ON chat_rooms;
DROP POLICY IF EXISTS "Workspace members create rooms"    ON chat_rooms;
DROP POLICY IF EXISTS "Workspace members update rooms"    ON chat_rooms;

CREATE POLICY "Members see their own rooms"
  ON chat_rooms FOR SELECT
  USING (
    id IN (SELECT room_id FROM chat_room_members WHERE user_id = auth.uid())
    OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Workspace members create rooms"
  ON chat_rooms FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members update rooms"
  ON chat_rooms FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── 6. chat_room_members policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "Members read room memberships"  ON chat_room_members;
DROP POLICY IF EXISTS "System can insert memberships"  ON chat_room_members;
DROP POLICY IF EXISTS "Members update own last_read"   ON chat_room_members;
DROP POLICY IF EXISTS "Members delete own membership"  ON chat_room_members;

CREATE POLICY "Members read room memberships"
  ON chat_room_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR room_id IN (SELECT room_id FROM chat_room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert memberships"
  ON chat_room_members FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Members update own last_read"
  ON chat_room_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Members delete own membership"
  ON chat_room_members FOR DELETE
  USING (user_id = auth.uid());

-- ── 7. chat_messages policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Room members read messages"  ON chat_messages;
DROP POLICY IF EXISTS "Room members send messages"  ON chat_messages;
DROP POLICY IF EXISTS "Senders delete own messages" ON chat_messages;

CREATE POLICY "Room members read messages"
  ON chat_messages FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM chat_room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Room members send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND room_id IN (SELECT room_id FROM chat_room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Senders delete own messages"
  ON chat_messages FOR DELETE
  USING (sender_id = auth.uid());

-- ── 8. chat_message_reactions policies ───────────────────────────────────
DROP POLICY IF EXISTS "Room members manage reactions"      ON chat_message_reactions;
DROP POLICY IF EXISTS "Room members read reactions"        ON chat_message_reactions;
DROP POLICY IF EXISTS "Room members add reactions"         ON chat_message_reactions;
DROP POLICY IF EXISTS "Room members remove own reactions"  ON chat_message_reactions;

CREATE POLICY "Room members read reactions"
  ON chat_message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT id FROM chat_messages WHERE room_id IN (
        SELECT room_id FROM chat_room_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Room members add reactions"
  ON chat_message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND message_id IN (
      SELECT id FROM chat_messages WHERE room_id IN (
        SELECT room_id FROM chat_room_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Room members remove own reactions"
  ON chat_message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ── 9. task_message_reactions policies ───────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can manage reactions" ON task_message_reactions;
DROP POLICY IF EXISTS "Workspace members read reactions"       ON task_message_reactions;
DROP POLICY IF EXISTS "Workspace members add reactions"        ON task_message_reactions;
DROP POLICY IF EXISTS "Users remove own reactions"             ON task_message_reactions;

CREATE POLICY "Workspace members read reactions"
  ON task_message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT tm.id FROM task_messages tm
      JOIN tasks t ON t.id = tm.task_id
      WHERE t.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Workspace members add reactions"
  ON task_message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND message_id IN (
      SELECT tm.id FROM task_messages tm
      JOIN tasks t ON t.id = tm.task_id
      WHERE t.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users remove own reactions"
  ON task_message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ── 10. Enable Realtime on all chat tables ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_room_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_room_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'task_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;
  END IF;
END $$;

-- ── 11. Reactions Auto-Aggregation Triggers ───────────────────────────────
-- Ensure chat_messages has reactions column (similar to task_messages)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';

-- Trigger function to aggregate task message reactions into task_messages.reactions
CREATE OR REPLACE FUNCTION update_task_message_reactions()
RETURNS TRIGGER AS $$
DECLARE
  v_message_id UUID;
  v_reactions JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_message_id := OLD.message_id;
  ELSE
    v_message_id := NEW.message_id;
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(emoji, count_val),
    '{}'::jsonb
  ) INTO v_reactions
  FROM (
    SELECT emoji, count(*) as count_val
    FROM task_message_reactions
    WHERE message_id = v_message_id
    GROUP BY emoji
  ) t;

  UPDATE task_messages
  SET reactions = v_reactions
  WHERE id = v_message_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on task_message_reactions
DROP TRIGGER IF EXISTS trg_update_task_message_reactions ON task_message_reactions;
CREATE TRIGGER trg_update_task_message_reactions
AFTER INSERT OR DELETE ON task_message_reactions
FOR EACH ROW EXECUTE FUNCTION update_task_message_reactions();

-- Trigger function to aggregate chat message reactions into chat_messages.reactions
CREATE OR REPLACE FUNCTION update_chat_message_reactions()
RETURNS TRIGGER AS $$
DECLARE
  v_message_id UUID;
  v_reactions JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_message_id := OLD.message_id;
  ELSE
    v_message_id := NEW.message_id;
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(emoji, count_val),
    '{}'::jsonb
  ) INTO v_reactions
  FROM (
    SELECT emoji, count(*) as count_val
    FROM chat_message_reactions
    WHERE message_id = v_message_id
    GROUP BY emoji
  ) t;

  UPDATE chat_messages
  SET reactions = v_reactions
  WHERE id = v_message_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on chat_message_reactions
DROP TRIGGER IF EXISTS trg_update_chat_message_reactions ON chat_message_reactions;
CREATE TRIGGER trg_update_chat_message_reactions
AFTER INSERT OR DELETE ON chat_message_reactions
FOR EACH ROW EXECUTE FUNCTION update_chat_message_reactions();

-- ── Done ─────────────────────────────────────────────────────────────────
-- author_id column dropped (fixes PGRST201 ambiguous FK) ✅
-- workspace_id added to task_messages if missing ✅
-- RLS enabled on all 6 chat tables ✅
-- All policies: DROP IF EXISTS + recreate (no duplicate errors) ✅
-- Realtime enabled on all tables ✅
-- Auto-aggregating reactions triggers deployed ✅
