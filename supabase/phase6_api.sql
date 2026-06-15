-- ============================================================
-- PHASE 6 — Public API, Webhooks & Integrations
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. API_KEYS — per-workspace API keys for Enterprise plan access
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,                      -- human label e.g. "CI/CD Bot"
  key_hash     TEXT NOT NULL UNIQUE,               -- SHA-256 hash of the actual key
  key_prefix   TEXT NOT NULL,                      -- first 8 chars shown in UI e.g. "tf_live_"
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,                        -- NULL = never
  is_active    BOOLEAN DEFAULT true,
  scopes       TEXT[] DEFAULT ARRAY['tasks:read'], -- e.g. ['tasks:read','tasks:write']
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash      ON api_keys(key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins manage api_keys"
  ON api_keys FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 2. WEBHOOKS — configurable event endpoints per workspace
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  events       TEXT[] DEFAULT ARRAY['task.created'],  -- subscribed event types
  secret       TEXT DEFAULT gen_random_uuid()::TEXT,  -- HMAC signing secret
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins manage webhooks"
  ON webhooks FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Workspace members read webhooks"
  ON webhooks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 3. WEBHOOK_DELIVERIES — delivery log for each webhook call
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id   UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  payload      JSONB DEFAULT '{}',
  status_code  INTEGER,                 -- HTTP response code from the endpoint
  response     TEXT,                   -- truncated response body
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  success      BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook   ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered ON webhook_deliveries(delivered_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins read deliveries"
  ON webhook_deliveries FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. TRIGGER — fire webhook events on task changes
--    Inserts a row into webhook_deliveries (actual HTTP call is done
--    by the deliver-webhook Edge Function via pg_net or cron).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_webhooks_on_task_change()
RETURNS TRIGGER AS $$
DECLARE
  v_event   TEXT;
  v_payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'task.created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    v_event := 'task.status_changed';
  ELSIF TG_OP = 'DELETE' THEN
    v_event := 'task.deleted';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_payload := jsonb_build_object(
    'event',        v_event,
    'workspace_id', COALESCE(NEW.workspace_id, OLD.workspace_id),
    'task',         row_to_json(COALESCE(NEW, OLD))
  );

  -- Record delivery job for each active, matching webhook
  INSERT INTO webhook_deliveries (webhook_id, workspace_id, event, payload, success)
  SELECT
    w.id,
    w.workspace_id,
    v_event,
    v_payload,
    false   -- will be set true by the Edge Function after delivery
  FROM webhooks w
  WHERE w.workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id)
    AND w.is_active = true
    AND v_event = ANY(w.events);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_webhooks ON tasks;
CREATE TRIGGER trg_notify_webhooks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_webhooks_on_task_change();

-- ─────────────────────────────────────────────────────────────────
-- 5. FUNCTION — validate_api_key
--    Called by Edge Functions to authenticate API requests.
--    Returns the workspace_id if valid, NULL otherwise.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS TABLE(workspace_id UUID, scopes TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT ak.workspace_id, ak.scopes
  FROM api_keys ak
  WHERE ak.key_hash    = p_key_hash
    AND ak.is_active   = true
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW());

  -- Update last_used_at
  UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
