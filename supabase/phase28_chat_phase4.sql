-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 28 — Chat Phase 4 Migration
-- Adds User Status fields to profiles and Per-Channel Notification Preferences
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add Status and DND fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_emoji      TEXT DEFAULT '🟢';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_text       TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dnd_until         TIMESTAMPTZ;

-- 2. Create chat_notification_prefs table for per-channel preference settings
CREATE TABLE IF NOT EXISTS chat_notification_prefs (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  level   TEXT DEFAULT 'all' CHECK (level IN ('all', 'mentions', 'none')),
  PRIMARY KEY (user_id, room_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cnp_user ON chat_notification_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_cnp_room ON chat_notification_prefs(room_id);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_notification_prefs ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_notification_prefs
DROP POLICY IF EXISTS "Users can read own notification preferences" ON chat_notification_prefs;
CREATE POLICY "Users can read own notification preferences"
  ON chat_notification_prefs FOR SELECT
  USING (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON chat_notification_prefs;
CREATE POLICY "Users can insert own notification preferences"
  ON chat_notification_prefs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own notification preferences" ON chat_notification_prefs;
CREATE POLICY "Users can update own notification preferences"
  ON chat_notification_prefs FOR UPDATE
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete own notification preferences" ON chat_notification_prefs;
CREATE POLICY "Users can delete own notification preferences"
  ON chat_notification_prefs FOR DELETE
  USING (
    user_id = auth.uid()
  );
