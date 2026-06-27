-- Rollback for Phase 19: Decommissioning calling integration

-- 1. Remove calls table from supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE calls;
  END IF;
END $$;

-- 2. Drop RPC function for call history
DROP FUNCTION IF EXISTS get_call_history(UUID, INT);

-- 3. Drop calls table
DROP TABLE IF EXISTS calls CASCADE;

-- 4. Restore chat_messages type check constraint (remove 'call')
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check 
  CHECK (type IN ('text', 'file', 'system'));
