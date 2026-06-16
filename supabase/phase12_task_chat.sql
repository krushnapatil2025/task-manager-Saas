-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 12 — Real-Time Task Chat (Upgrade: task_comments → task_messages)
-- IMPORTANT: Run this ONCE in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ensure task_messages exists (rename from task_comments if needed) ─
DO $$
BEGIN
  -- Case A: task_comments exists, task_messages does not → rename
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_comments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_messages'
  ) THEN
    ALTER TABLE task_comments RENAME TO task_messages;
  END IF;

  -- Case B: neither exists → create fresh
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_messages'
  ) THEN
    EXECUTE '
      CREATE TABLE task_messages (
        id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
        user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
        content    TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    ';
  END IF;
END $$;

-- ── 2. Add new columns to task_messages ──────────────────────────────────
ALTER TABLE task_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'
    CHECK (message_type IN ('text', 'system', 'file')),
  ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Ensure user_id column exists (some older schemas used author_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_messages' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE task_messages RENAME COLUMN author_id TO user_id;
  END IF;
END $$;

-- Index for fast task chat queries
CREATE INDEX IF NOT EXISTS idx_task_messages_task_created
  ON task_messages(task_id, created_at ASC);

-- ── 3. task_message_reactions — emoji reactions ───────────────────────────
CREATE TABLE IF NOT EXISTS task_message_reactions (
  message_id UUID REFERENCES task_messages(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id)       ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE task_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage reactions"
  ON task_message_reactions
  USING (
    message_id IN (
      SELECT tm.id FROM task_messages tm
      JOIN tasks t ON t.id = tm.task_id
      WHERE t.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ── 4. RLS on task_messages ───────────────────────────────────────────────
ALTER TABLE task_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can read task messages" ON task_messages;
CREATE POLICY "Workspace members can read task messages"
  ON task_messages FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert task messages" ON task_messages;
CREATE POLICY "Members can insert task messages"
  ON task_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authors can delete own messages" ON task_messages;
CREATE POLICY "Authors can delete own messages"
  ON task_messages FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authors can update own messages" ON task_messages;
CREATE POLICY "Authors can update own messages"
  ON task_messages FOR UPDATE
  USING (user_id = auth.uid());

-- ── 5. Enable Supabase Realtime (safe for re-runs) ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'task_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'task_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_message_reactions;
  END IF;
END $$;

-- ── Done ─────────────────────────────────────────────────────────────────
-- Table:  task_messages (renamed + upgraded) ✅
-- Table:  task_message_reactions ✅
-- RLS:    full policies on both tables ✅
-- Realtime: enabled on both tables ✅
