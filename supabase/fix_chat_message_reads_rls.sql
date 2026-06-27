-- ============================================================================
-- Fix RLS Policies for chat_message_reads to allow UPDATE / UPSERT operations
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================================

-- Drop existing update policy if any
DROP POLICY IF EXISTS "Allow members to update message reads" ON chat_message_reads;

-- Create update policy for chat_message_reads
CREATE POLICY "Allow members to update message reads"
  ON chat_message_reads FOR UPDATE
  TO authenticated
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );
