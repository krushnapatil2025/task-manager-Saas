-- ============================================================================
-- Phase 26 — Chat Improvements Phase 1
-- Run this in: Supabase Dashboard → SQL Editor
-- URL: https://supabase.com/dashboard/project/gxfnmpqbuamzilgeogfh/sql/new
-- ============================================================================

-- 1. Add reply_to_id to support reply / quote message feature
ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;

-- 2. Update the type CHECK constraint to support 'audio' and 'poll' types directly
ALTER TABLE chat_messages 
  DROP CONSTRAINT IF EXISTS chat_messages_type_check;

ALTER TABLE chat_messages 
  ADD CONSTRAINT chat_messages_type_check 
  CHECK (type IN ('text', 'file', 'system', 'audio', 'poll', 'call'));
