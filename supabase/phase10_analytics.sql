-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 10 — Advanced Analytics & Reports
-- Run once in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. workspace_analytics_snapshots — historical daily snapshots ────────────
CREATE TABLE IF NOT EXISTS workspace_analytics_snapshots (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_tasks   INTEGER DEFAULT 0,
  completed     INTEGER DEFAULT 0,
  in_progress   INTEGER DEFAULT 0,
  pending       INTEGER DEFAULT 0,
  overdue       INTEGER DEFAULT 0,
  health_score  NUMERIC(5,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_workspace_date
  ON workspace_analytics_snapshots(workspace_id, snapshot_date DESC);

ALTER TABLE workspace_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read workspace analytics"
  ON workspace_analytics_snapshots FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── 2. calculate_workspace_health RPC ────────────────────────────────────────
-- Called by analyticsService.js — calculates a 0-100 health score.
CREATE OR REPLACE FUNCTION calculate_workspace_health(p_workspace_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total     INTEGER;
  v_completed INTEGER;
  v_overdue   INTEGER;
  v_score     NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'Completed')
  INTO v_total, v_completed, v_overdue
  FROM tasks
  WHERE workspace_id = p_workspace_id;

  IF v_total = 0 THEN RETURN 100; END IF;

  v_score := (
    (v_completed::NUMERIC / v_total * 40) +
    ((1 - v_overdue::NUMERIC / NULLIF(v_total, 0)) * 60)
  );
  RETURN ROUND(GREATEST(0, LEAST(100, v_score)), 2);
END;
$$;

-- ── 3. take_analytics_snapshot — call this daily via pg_cron ─────────────────
CREATE OR REPLACE FUNCTION take_analytics_snapshot(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total     INTEGER;
  v_completed INTEGER;
  v_in_prog   INTEGER;
  v_pending   INTEGER;
  v_overdue   INTEGER;
  v_health    NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Completed'),
    COUNT(*) FILTER (WHERE status = 'In Progress'),
    COUNT(*) FILTER (WHERE status = 'Pending'),
    COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'Completed')
  INTO v_total, v_completed, v_in_prog, v_pending, v_overdue
  FROM tasks
  WHERE workspace_id = p_workspace_id;

  v_health := calculate_workspace_health(p_workspace_id);

  INSERT INTO workspace_analytics_snapshots
    (workspace_id, snapshot_date, total_tasks, completed, in_progress, pending, overdue, health_score)
  VALUES
    (p_workspace_id, CURRENT_DATE, v_total, v_completed, v_in_prog, v_pending, v_overdue, v_health)
  ON CONFLICT (workspace_id, snapshot_date) DO UPDATE SET
    total_tasks  = EXCLUDED.total_tasks,
    completed    = EXCLUDED.completed,
    in_progress  = EXCLUDED.in_progress,
    pending      = EXCLUDED.pending,
    overdue      = EXCLUDED.overdue,
    health_score = EXCLUDED.health_score;
END;
$$;

-- ── 4. Optional: daily snapshot via pg_cron (uncomment to enable) ─────────────
-- SELECT cron.schedule(
--   'daily-analytics-snapshot',
--   '0 1 * * *',   -- every day at 1 AM
--   $$
--     SELECT take_analytics_snapshot(id) FROM workspaces;
--   $$
-- );

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Table:  workspace_analytics_snapshots ✅
-- RLS:    Members read ✅
-- RPC:    calculate_workspace_health() ✅
-- RPC:    take_analytics_snapshot() ✅
