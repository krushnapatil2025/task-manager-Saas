-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 29 — Message Scheduling
-- Adds scheduled_at and is_draft columns to chat_messages
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add scheduling columns to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_draft     BOOLEAN DEFAULT false;

-- 2. Index for efficient polling of due messages per sender
CREATE INDEX IF NOT EXISTS idx_cm_scheduled
  ON chat_messages(sender_id, scheduled_at)
  WHERE is_draft = true AND scheduled_at IS NOT NULL;

-- 3. Index to filter messages from feed (exclude drafts)
CREATE INDEX IF NOT EXISTS idx_cm_is_draft
  ON chat_messages(room_id, is_draft)
  WHERE is_draft = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: Messages with is_draft = true are NOT returned by getRoomMessages
--       (the query filters .eq('is_draft', false) or uses .is('thread_id', null))
--       They are published client-side via a polling interval every 60 seconds
--       or instantly by the user cancelling or editing from the Scheduled panel.
-- ─────────────────────────────────────────────────────────────────────────────
