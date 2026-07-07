-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 18 — WhatsApp-style soft-delete for chat messages
-- Adds is_deleted column; updates RLS; no data loss
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add is_deleted column (default false = not deleted)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Drop the policy first if it already exists (CREATE POLICY has no IF NOT EXISTS)
DROP POLICY IF EXISTS "Owner or admin can soft-delete message" ON chat_messages;

-- 3. Allow the sender OR a workspace admin to soft-delete (update) any message
CREATE POLICY "Owner or admin can soft-delete message"
  ON chat_messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
        JOIN chat_rooms cr ON cr.workspace_id = wm.workspace_id
      WHERE cr.id = chat_messages.room_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  )
  WITH CHECK (true);
