-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE B — THREADS, PINS, AND SEARCH MIGRATION
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Message Threading Columns & Triggers ──────────────────────────────
ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE;

ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS reply_count INT DEFAULT 0;

-- Trigger to automatically maintain parent message reply_count
CREATE OR REPLACE FUNCTION update_chat_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.thread_id IS NOT NULL THEN
      UPDATE chat_messages
      SET reply_count = reply_count + 1
      WHERE id = NEW.thread_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.thread_id IS NOT NULL THEN
      UPDATE chat_messages
      SET reply_count = GREATEST(0, reply_count - 1)
      WHERE id = OLD.thread_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_chat_reply_count ON chat_messages;
CREATE TRIGGER trg_update_chat_reply_count
AFTER INSERT OR DELETE ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_chat_reply_count();


-- ── 2. Message Pinning Table & Policies ──────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (room_id, message_id)
);

ALTER TABLE chat_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room members can read pins" ON chat_pins;
CREATE POLICY "Room members can read pins"
  ON chat_pins FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM chat_room_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Room members can pin/unpin messages" ON chat_pins;
CREATE POLICY "Room members can pin/unpin messages"
  ON chat_pins FOR ALL
  USING (
    room_id IN (SELECT room_id FROM chat_room_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    room_id IN (SELECT room_id FROM chat_room_members WHERE user_id = auth.uid())
  );


-- ── 3. Enable Realtime on Chat Pins ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_pins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_pins;
  END IF;
END $$;


-- ── 4. Chat Search Helper Function ───────────────────────────────────────
CREATE OR REPLACE FUNCTION search_chat_messages(p_room_id UUID, p_query TEXT)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  sender_id UUID,
  content TEXT,
  type TEXT,
  file_url TEXT,
  mentions JSONB,
  thread_id UUID,
  reply_count INT,
  reactions JSONB,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  sender_name TEXT,
  sender_avatar TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.room_id,
    m.sender_id,
    m.content,
    m.type,
    m.file_url,
    m.mentions,
    m.thread_id,
    m.reply_count,
    m.reactions,
    m.edited_at,
    m.created_at,
    p.name AS sender_name,
    p.profile_image_url AS sender_avatar
  FROM chat_messages m
  JOIN profiles p ON p.id = m.sender_id
  WHERE m.room_id = p_room_id
    AND m.content ILIKE CONCAT('%', p_query, '%')
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
