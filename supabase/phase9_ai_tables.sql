-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 9 — AI Smart Assistant
-- Run this once in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ai_interactions — stores every AI call for context / analytics ────────
CREATE TABLE IF NOT EXISTS ai_interactions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES profiles(id)   ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('suggestion', 'summary', 'nlp_create')),
  input        TEXT,
  output       JSONB,
  accepted     BOOLEAN DEFAULT NULL,   -- NULL = not yet acted on
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast workspace / user lookups
CREATE INDEX IF NOT EXISTS idx_ai_interactions_workspace
  ON ai_interactions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user
  ON ai_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_type
  ON ai_interactions(type, created_at DESC);

-- ── 2. Row Level Security ────────────────────────────────────────────────────
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

-- Workspace members can read interactions for their workspace
CREATE POLICY "Members read AI interactions"
  ON ai_interactions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own interactions
CREATE POLICY "Users insert own AI interactions"
  ON ai_interactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own interactions (e.g. mark accepted = true/false)
CREATE POLICY "Users update own AI interactions"
  ON ai_interactions FOR UPDATE
  USING (user_id = auth.uid());

-- ── 3. Helper RPC — fetch AI usage stats per workspace ──────────────────────
CREATE OR REPLACE FUNCTION get_ai_usage_stats(p_workspace_id UUID)
RETURNS TABLE (
  type        TEXT,
  total       BIGINT,
  accepted    BIGINT,
  last_used   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    type,
    COUNT(*)                                      AS total,
    COUNT(*) FILTER (WHERE accepted = true)       AS accepted,
    MAX(created_at)                               AS last_used
  FROM ai_interactions
  WHERE workspace_id = p_workspace_id
  GROUP BY type
  ORDER BY total DESC;
$$;

-- ── 4. Optional: 30-day auto-cleanup via pg_cron (uncomment if pg_cron enabled)
-- SELECT cron.schedule(
--   'cleanup-ai-interactions',
--   '0 3 * * 0',   -- every Sunday at 3 AM
--   $$
--     DELETE FROM ai_interactions
--     WHERE created_at < NOW() - INTERVAL '30 days';
--   $$
-- );

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Table: ai_interactions ✅
-- RLS policies: Members read, users insert/update ✅  
-- RPC: get_ai_usage_stats() ✅
