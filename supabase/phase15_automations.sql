-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 15 — Automation Engine
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. automation_rules ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  enabled      BOOLEAN DEFAULT TRUE,

  -- TRIGGER: what event fires this rule
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'task_status_changed',
    'task_overdue',
    'task_priority_changed',
    'task_assigned',
    'task_created',
    'task_completed'
  )),
  -- Optional condition on the trigger (e.g. "to_status = 'Completed'")
  trigger_condition JSONB DEFAULT '{}',

  -- ACTION: what happens when rule fires
  action_type TEXT NOT NULL CHECK (action_type IN (
    'send_notification',
    'change_status',
    'change_priority',
    'assign_to_member',
    'post_chat_message'
  )),
  action_config JSONB DEFAULT '{}',  -- action-specific params

  run_count    INTEGER DEFAULT 0,
  last_run_at  TIMESTAMPTZ,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_ws ON automation_rules(workspace_id, enabled);

-- ── 2. automation_logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id     UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status      TEXT DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  detail      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_ws   ON automation_logs(workspace_id, created_at DESC);

-- ── 3. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read automation rules" ON automation_rules;
DROP POLICY IF EXISTS "Admins manage automation rules" ON automation_rules;
DROP POLICY IF EXISTS "Members read automation logs"  ON automation_logs;
DROP POLICY IF EXISTS "System insert automation logs" ON automation_logs;

CREATE POLICY "Members read automation rules"
  ON automation_rules FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins manage automation rules"
  ON automation_rules FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND role IN ('company_admin','manager','team_lead')
  ));

CREATE POLICY "Members read automation logs"
  ON automation_logs FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "System insert automation logs"
  ON automation_logs FOR INSERT
  WITH CHECK (TRUE);

-- ── 4. RPC: get_matching_rules ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_matching_rules(
  p_workspace_id UUID,
  p_trigger_type TEXT
)
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  action_type      TEXT,
  action_config    JSONB,
  trigger_condition JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, name, action_type, action_config, trigger_condition
  FROM automation_rules
  WHERE workspace_id = p_workspace_id
    AND trigger_type  = p_trigger_type
    AND enabled       = TRUE;
$$;

-- ── 5. RPC: log_automation_run ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_automation_run(
  p_rule_id      UUID,
  p_workspace_id UUID,
  p_task_id      UUID,
  p_user_id      UUID,
  p_status       TEXT DEFAULT 'success',
  p_detail       TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO automation_logs (rule_id, workspace_id, task_id, triggered_by, status, detail)
  VALUES (p_rule_id, p_workspace_id, p_task_id, p_user_id, p_status, p_detail);

  UPDATE automation_rules
  SET run_count   = run_count + 1,
      last_run_at = NOW()
  WHERE id = p_rule_id;
END;
$$;

-- ── Done ─────────────────────────────────────────────────────────────────
-- Tables: automation_rules, automation_logs ✅
-- RLS: members read, admins manage ✅
-- RPC: get_matching_rules(), log_automation_run() ✅
