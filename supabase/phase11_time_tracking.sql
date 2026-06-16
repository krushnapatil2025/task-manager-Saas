-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 11 — Time Tracking & Timesheets
-- Run once in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. time_logs — stores start/stop sessions per task per user ───────────
CREATE TABLE IF NOT EXISTS time_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id      UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at   TIMESTAMPTZ,                         -- NULL = timer still running
  duration_sec INTEGER GENERATED ALWAYS AS (
    CASE WHEN stopped_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (stopped_at - started_at))::INTEGER
      ELSE NULL
    END
  ) STORED,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_logs_task    ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user    ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_ws      ON time_logs(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_logs_running ON time_logs(user_id) WHERE stopped_at IS NULL;

-- ── 2. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own logs + admins can see all workspace logs
CREATE POLICY "Users read own time logs"
  ON time_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('company_admin', 'manager', 'team_lead')
    )
  );

CREATE POLICY "Users insert own time logs"
  ON time_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own time logs"
  ON time_logs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own time logs"
  ON time_logs FOR DELETE
  USING (user_id = auth.uid());

-- ── 3. RPC: get_active_timer — finds the running session for a user/task ──
CREATE OR REPLACE FUNCTION get_active_timer(p_user_id UUID, p_task_id UUID)
RETURNS TABLE (id UUID, started_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, started_at
  FROM time_logs
  WHERE user_id = p_user_id
    AND task_id = p_task_id
    AND stopped_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
$$;

-- ── 4. RPC: get_task_total_time — total logged seconds for a task ──────────
CREATE OR REPLACE FUNCTION get_task_total_time(p_task_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(SUM(duration_sec), 0)::INTEGER
  FROM time_logs
  WHERE task_id = p_task_id
    AND stopped_at IS NOT NULL;
$$;

-- ── 5. RPC: get_workspace_timesheet — aggregate for admin view ─────────────
CREATE OR REPLACE FUNCTION get_workspace_timesheet(
  p_workspace_id UUID,
  p_from         DATE DEFAULT CURRENT_DATE - 6,
  p_to           DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id       UUID,
  user_name     TEXT,
  avatar_url    TEXT,
  total_seconds BIGINT,
  session_count BIGINT,
  task_count    BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    tl.user_id,
    p.name                             AS user_name,
    p.profile_image_url                AS avatar_url,
    COALESCE(SUM(tl.duration_sec), 0)  AS total_seconds,
    COUNT(tl.id)                       AS session_count,
    COUNT(DISTINCT tl.task_id)         AS task_count
  FROM time_logs tl
  JOIN profiles p ON p.id = tl.user_id
  WHERE tl.workspace_id = p_workspace_id
    AND tl.stopped_at IS NOT NULL
    AND tl.started_at::DATE BETWEEN p_from AND p_to
  GROUP BY tl.user_id, p.name, p.profile_image_url
  ORDER BY total_seconds DESC;
$$;

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Table: time_logs ✅  (with generated duration_sec column)
-- RLS policies: users manage own, admins read all ✅
-- RPC: get_active_timer()      ✅
-- RPC: get_task_total_time()   ✅
-- RPC: get_workspace_timesheet() ✅
