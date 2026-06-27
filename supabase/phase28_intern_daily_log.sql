-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 28 — INTERN DAILY WORK LOG SCHEMA
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Create Daily Logs Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intern_daily_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date        DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Core log content
  tasks_done      JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of objects [{ title, description, hours }]
  learnings       TEXT,
  blockers        TEXT,
  tomorrow_plan   TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}'::text[],

  -- Flow status
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted', 'acknowledged', 'flagged', 'missed')),

  -- Review columns
  manager_note    TEXT,
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: Enforce one log entry per intern per day
  UNIQUE (workspace_id, user_id, log_date)
);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE TRIGGER trg_intern_log_updated_at
  BEFORE UPDATE ON intern_daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ── 2. Enable Row Level Security (RLS) ─────────────────────────────────────
ALTER TABLE intern_daily_logs ENABLE ROW LEVEL SECURITY;


-- ── 3. Define RLS Policies ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Interns can read own logs" ON intern_daily_logs;
CREATE POLICY "Interns can read own logs"
  ON intern_daily_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers and admins read all workspace logs" ON intern_daily_logs;
CREATE POLICY "Managers and admins read all workspace logs"
  ON intern_daily_logs FOR SELECT
  USING (is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Interns can insert own logs" ON intern_daily_logs;
CREATE POLICY "Interns can insert own logs"
  ON intern_daily_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND workspace_id IN (SELECT get_my_workspace_ids())
    -- Restrict log creation to users with intern role in the workspace
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = intern_daily_logs.workspace_id
        AND user_id = auth.uid()
        AND role = 'intern'
    )
  );

DROP POLICY IF EXISTS "Interns can update own draft or submitted logs" ON intern_daily_logs;
CREATE POLICY "Interns can update own draft or submitted logs"
  ON intern_daily_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Interns can only transition their logs to 'draft' or 'submitted'
    AND status IN ('draft', 'submitted')
    -- Prevent interns from altering manager review fields
    AND (manager_note IS NULL OR manager_note = intern_daily_logs.manager_note)
    AND (reviewed_by IS NULL OR reviewed_by = intern_daily_logs.reviewed_by)
    AND (reviewed_at IS NULL OR reviewed_at = intern_daily_logs.reviewed_at)
  );

DROP POLICY IF EXISTS "Managers and admins can review logs" ON intern_daily_logs;
CREATE POLICY "Managers and admins can review logs"
  ON intern_daily_logs FOR UPDATE
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));


-- ── 4. Backfill Helper Function (For Dev and Fallback) ─────────────────────
-- Checks for past dates where interns did not submit a log, and marks them as 'missed'.
-- This guarantees correct compliance numbers even if pg_cron is not running.
CREATE OR REPLACE FUNCTION backfill_missed_intern_logs(p_workspace_id UUID, p_days_limit INT DEFAULT 30)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
BEGIN
  -- Iterate through the last N days (excluding today)
  FOR i IN 1..p_days_limit LOOP
    v_date := CURRENT_DATE - i;

    -- Insert 'missed' entries for interns who do not have a log for that date
    INSERT INTO intern_daily_logs (workspace_id, user_id, log_date, status, tasks_done)
    SELECT wm.workspace_id, wm.user_id, v_date, 'missed', '[]'::jsonb
    FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.role = 'intern'
      AND NOT EXISTS (
        SELECT 1 FROM intern_daily_logs il
        WHERE il.workspace_id = p_workspace_id
          AND il.user_id = wm.user_id
          AND il.log_date = v_date
      )
    ON CONFLICT (workspace_id, user_id, log_date) DO NOTHING;
  END LOOP;
END;
$$;


-- ── 5. Enable Realtime ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'intern_daily_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE intern_daily_logs;
  END IF;
END $$;


-- ── 6. Scheduled Cron Job (pg_cron) ────────────────────────────────────────
-- Executes nightly at 11:59 PM to log 'missed' submissions for the current day.
DO $$
BEGIN
  -- Perform conditionally in case pg_cron extension is not enabled/loaded
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'mark-missed-intern-logs-daily',
      '59 23 * * *',
      $cron$
        INSERT INTO intern_daily_logs (workspace_id, user_id, log_date, status, tasks_done)
        SELECT wm.workspace_id, wm.user_id, CURRENT_DATE, 'missed', '[]'::jsonb
        FROM workspace_members wm
        WHERE wm.role = 'intern'
          AND NOT EXISTS (
            SELECT 1 FROM intern_daily_logs il
            WHERE il.user_id = wm.user_id
              AND il.workspace_id = wm.workspace_id
              AND il.log_date = CURRENT_DATE
          )
        ON CONFLICT (workspace_id, user_id, log_date) DO NOTHING;
      $cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron was not configured, relying on automatic backfill_missed_intern_logs function.';
END $$;
