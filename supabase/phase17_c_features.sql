-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE C — SAVED MESSAGES, CHANNEL TOPIC & DESCRIPTION MIGRATION
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Channel description & topic columns ─────────────────────────────────
ALTER TABLE chat_rooms 
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT '';

-- ── 2. Saved Messages Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_saved_messages (
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message_id  UUID REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);

-- Enable RLS
ALTER TABLE chat_saved_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_saved_messages
DROP POLICY IF EXISTS "Users can manage their own saved messages" ON chat_saved_messages;
CREATE POLICY "Users can manage their own saved messages" ON chat_saved_messages
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Expose chat_saved_messages in realtime publication if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_saved_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
