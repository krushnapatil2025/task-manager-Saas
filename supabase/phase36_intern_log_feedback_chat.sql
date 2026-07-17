-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 36 — INTERN DAILY LOG FEEDBACK CHAT
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Create Intern Log Messages Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS intern_log_messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id          UUID REFERENCES intern_daily_logs(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Sender (NULL for system messages)
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast log message queries
CREATE INDEX IF NOT EXISTS idx_intern_log_messages_log_created
  ON intern_log_messages(log_id, created_at ASC);

-- ── 2. Enable Row Level Security (RLS) ─────────────────────────────────────
ALTER TABLE intern_log_messages ENABLE ROW LEVEL SECURITY;

-- ── 3. Define RLS Policies ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can read log messages" ON intern_log_messages;
CREATE POLICY "Workspace members can read log messages"
  ON intern_log_messages FOR SELECT
  USING (
    log_id IN (
      SELECT id FROM intern_daily_logs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert log messages" ON intern_log_messages;
CREATE POLICY "Members can insert log messages"
  ON intern_log_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND log_id IN (
      SELECT id FROM intern_daily_logs WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage own log messages" ON intern_log_messages;
CREATE POLICY "Workspace members can manage own log messages"
  ON intern_log_messages FOR DELETE
  USING (user_id = auth.uid());

-- ── 4. Enable Supabase Realtime ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'intern_log_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE intern_log_messages;
  END IF;
END $$;

-- ── 5. Trigger Function to Notify Users on New Comments ─────────────────────
CREATE OR REPLACE FUNCTION notify_intern_log_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_name       TEXT;
  v_intern_id         UUID;
  v_workspace_id      UUID;
  v_log_date          DATE;
  v_manager           RECORD;
  v_reviewed_by       UUID;
BEGIN
  -- If it's a system message (user_id is NULL), don't send notification
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.user_id;

  -- Get log details
  SELECT user_id, workspace_id, log_date, reviewed_by 
  INTO v_intern_id, v_workspace_id, v_log_date, v_reviewed_by
  FROM intern_daily_logs 
  WHERE id = NEW.log_id;

  -- If the sender is the intern, notify the reviewer or managers/admins
  IF NEW.user_id = v_intern_id THEN
    -- If a specific reviewer reviewed the log, notify them first
    IF v_reviewed_by IS NOT NULL AND v_reviewed_by <> NEW.user_id THEN
      INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
      VALUES (
        v_reviewed_by,
        v_workspace_id,
        'intern_log_comment',
        '💬 New comment on intern log',
        CONCAT(v_sender_name, ' commented on their log for ', v_log_date, ': "', LEFT(NEW.content, 60), '"'),
        '/admin/intern-logs'
      );
    ELSE
      -- Otherwise, notify all workspace managers and admins
      FOR v_manager IN 
        SELECT user_id 
        FROM workspace_members 
        WHERE workspace_id = v_workspace_id 
          AND role IN ('company_admin', 'manager')
          AND user_id <> NEW.user_id
      LOOP
        INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
        VALUES (
          v_manager.user_id,
          v_workspace_id,
          'intern_log_comment',
          '💬 New comment on intern log',
          CONCAT(v_sender_name, ' commented on their log for ', v_log_date, ': "', LEFT(NEW.content, 60), '"'),
          '/admin/intern-logs'
        );
      END LOOP;
    END IF;
  
  -- If the sender is a manager/admin, notify the intern
  ELSE
    INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
    VALUES (
      v_intern_id,
      v_workspace_id,
      'intern_log_comment',
      '💬 New comment from manager',
      CONCAT(v_sender_name, ' commented on your log for ', v_log_date, ': "', LEFT(NEW.content, 60), '"'),
      '/user/daily-log'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create comments trigger
DROP TRIGGER IF EXISTS trg_notify_intern_log_message ON intern_log_messages;
CREATE TRIGGER trg_notify_intern_log_message
  AFTER INSERT ON intern_log_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_intern_log_message();


-- ── 6. Enhance Log Flow Trigger to Insert System Messages ───────────────────
-- Modify notify_intern_log_flow to write audit trails in comments
CREATE OR REPLACE FUNCTION notify_intern_log_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intern_name       TEXT;
  v_reviewer_name     TEXT;
  v_manager           RECORD;
BEGIN
  -- Get Intern name
  SELECT name INTO v_intern_name FROM profiles WHERE id = NEW.user_id;

  -- Get Reviewer name (if available)
  IF NEW.reviewed_by IS NOT NULL THEN
    SELECT name INTO v_reviewer_name FROM profiles WHERE id = NEW.reviewed_by;
  END IF;

  -- Case A: Log submitted by intern -> Notify all workspace managers and admins
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status <> 'submitted') THEN
    
    -- SYSTEM CHAT LOG: If it was flagged previously, write a system message
    IF TG_OP = 'UPDATE' AND OLD.status = 'flagged' THEN
      INSERT INTO intern_log_messages (log_id, user_id, content)
      VALUES (NEW.id, NULL, '🔄 Intern resubmitted the log with updates.');
    END IF;

    FOR v_manager IN 
      SELECT user_id 
      FROM workspace_members 
      WHERE workspace_id = NEW.workspace_id 
        AND role IN ('company_admin', 'manager')
    LOOP
      INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
      VALUES (
        v_manager.user_id,
        NEW.workspace_id,
        'intern_log_submitted',
        '📋 New daily log submitted',
        CONCAT(COALESCE(v_intern_name, 'An intern'), ' submitted their daily work log for review.'),
        '/admin/intern-logs'
      );
    END LOOP;
  
  -- Case B: Log acknowledged by manager -> Notify intern
  ELSIF NEW.status = 'acknowledged' AND (OLD.status IS NULL OR OLD.status <> 'acknowledged') THEN
    
    -- SYSTEM CHAT LOG
    INSERT INTO intern_log_messages (log_id, user_id, content)
    VALUES (NEW.id, NULL, CONCAT('✅ Log reviewed and acknowledged by ', COALESCE(v_reviewer_name, 'manager'), '.'));

    INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      NEW.workspace_id,
      'intern_log_acknowledged',
      '✅ Work log acknowledged',
      CONCAT('Your work log for ', NEW.log_date, ' was reviewed and acknowledged by ', COALESCE(v_reviewer_name, 'a manager'), '.'),
      '/user/daily-log'
    );

  -- Case C: Log flagged by manager -> Notify intern with feedback
  ELSIF NEW.status = 'flagged' AND (OLD.status IS NULL OR OLD.status <> 'flagged') THEN
    
    -- SYSTEM CHAT LOG
    INSERT INTO intern_log_messages (log_id, user_id, content)
    VALUES (NEW.id, NULL, CONCAT('⚠️ Log flagged for follow-up by ', COALESCE(v_reviewer_name, 'manager'), '. Feedback: "', COALESCE(NEW.manager_note, 'No feedback provided'), '"'));

    INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      NEW.workspace_id,
      'intern_log_flagged',
      '⚠️ Work log flagged for attention',
      CONCAT('Feedback from ', COALESCE(v_reviewer_name, 'manager'), ': ', COALESCE(NEW.manager_note, 'Please review log details.')),
      '/user/daily-log'
    );

  -- Case D: Log marked missed -> Notify intern and workspace managers
  ELSIF NEW.status = 'missed' AND (OLD.status IS NULL OR OLD.status <> 'missed') THEN
    
    -- SYSTEM CHAT LOG
    INSERT INTO intern_log_messages (log_id, user_id, content)
    VALUES (NEW.id, NULL, '🔴 Daily log marked as missed.');

    -- Notify Intern
    INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      NEW.workspace_id,
      'intern_log_missed',
      '🔴 Missed log submission',
      CONCAT('You did not submit your daily work log for ', NEW.log_date, '.'),
      '/user/daily-log'
    );

    -- Notify Managers
    FOR v_manager IN 
      SELECT user_id 
      FROM workspace_members 
      WHERE workspace_id = NEW.workspace_id 
        AND role IN ('company_admin', 'manager')
    LOOP
      INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
      VALUES (
        v_manager.user_id,
        NEW.workspace_id,
        'intern_log_missed_manager',
        CONCAT('🔴 ', COALESCE(v_intern_name, 'Intern'), ' missed daily log'),
        CONCAT(COALESCE(v_intern_name, 'Intern'), ' did not submit their daily log for ', NEW.log_date, '.'),
        '/admin/intern-logs'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
