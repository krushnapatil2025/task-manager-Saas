-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 27 — Chat Phase 3 Migration
-- Adds read receipts table and Whitelists the 'poll' type in chat_messages
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Update the chat messages type check constraint to include 'poll'
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check CHECK (
  type IN ('text', 'image', 'file', 'voice', 'audio', 'gif', 'call', 'poll', 'system')
);

-- 2. Create the chat_message_reads table
CREATE TABLE IF NOT EXISTS chat_message_reads (
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cmr_message ON chat_message_reads(message_id);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;

-- Create policies for read receipts
CREATE POLICY "Allow members to view message reads"
  ON chat_message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN chat_room_members crm ON crm.room_id = m.room_id
      WHERE m.id = chat_message_reads.message_id
      AND crm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow members to insert message reads"
  ON chat_message_reads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN chat_room_members crm ON crm.room_id = m.room_id
      WHERE m.id = chat_message_reads.message_id
      AND crm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow members to update message reads"
  ON chat_message_reads FOR UPDATE
  TO authenticated
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

-- 3. Add UPDATE policy for chat_messages (to allow editing own messages + voting on polls)
DROP POLICY IF EXISTS "Room members update messages" ON chat_messages;
CREATE POLICY "Room members update messages"
  ON chat_messages FOR UPDATE
  USING (
    is_room_member(room_id, auth.uid())
    AND (
      type = 'poll'
      OR sender_id = auth.uid()
    )
  );

