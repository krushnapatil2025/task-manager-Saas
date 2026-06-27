-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 29 — AUTOMATED NOTIFICATIONS FOR INTERN WORK LOG FLOWS
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Create Automated Notification Trigger Function ──────────────────────
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

-- Create trigger
DROP TRIGGER IF EXISTS trg_notify_intern_log_flow ON intern_daily_logs;
CREATE TRIGGER trg_notify_intern_log_flow
  AFTER INSERT OR UPDATE ON intern_daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_intern_log_flow();


-- ── 2. Create 5:00 PM Daily Reminder Function ──────────────────────────────
-- Looks for interns who haven't started or submitted a log for the current day,
-- and inserts a reminder notification for them.
CREATE OR REPLACE FUNCTION send_daily_intern_reminders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intern RECORD;
BEGIN
  FOR v_intern IN
    SELECT wm.user_id, wm.workspace_id
    FROM workspace_members wm
    WHERE wm.role = 'intern'
      -- Check if they do not have a log or if it is still in 'draft' format
      AND NOT EXISTS (
        SELECT 1 FROM intern_daily_logs il
        WHERE il.workspace_id = wm.workspace_id
          AND il.user_id = wm.user_id
          AND il.log_date = CURRENT_DATE
          AND il.status IN ('submitted', 'acknowledged', 'flagged')
      )
  LOOP
    INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
    VALUES (
      v_intern.user_id,
      v_intern.workspace_id,
      'intern_log_reminder',
      '⏰ Reminder: Submit work log',
      'Please remember to submit your daily work log before the end of the day.',
      '/user/daily-log'
    );
  END LOOP;
END;
$$;


-- ── 3. Schedule 5:00 PM Cron Job (pg_cron) ──────────────────────────────────
DO $$
BEGIN
  -- Perform conditionally in case pg_cron extension is not enabled/loaded
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'send-daily-intern-reminders',
      '0 17 * * *',   -- 5:00 PM daily
      'SELECT send_daily_intern_reminders();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron was not configured, daily reminder function send_daily_intern_reminders() ready to be executed via API or runner.';
END $$;
