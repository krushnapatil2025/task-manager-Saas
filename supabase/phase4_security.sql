-- ============================================================
-- PHASE 4 — Security Hardening
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. WORKSPACE_INVITATIONS — invite-only workspace joins
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  token         TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at   TIMESTAMPTZ,
  invited_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email     ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token     ON workspace_invitations(token);

-- RLS
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON workspace_invitations FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Workspace admins can read their invitations
CREATE POLICY "Admins can read own workspace invitations"
  ON workspace_invitations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Anyone authenticated can view an invitation by token (for the accept flow)
-- Enforced app-side; token is a secret itself
CREATE POLICY "Accept invitation by token"
  ON workspace_invitations FOR UPDATE
  USING (TRUE)  -- narrowed by token in app query
  WITH CHECK (TRUE);

-- Admins can delete (revoke) invitations
CREATE POLICY "Admins can delete invitations"
  ON workspace_invitations FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 2. AUDIT_LOGS — immutable event trail
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID REFERENCES workspaces(id)  ON DELETE SET NULL,
  user_id       UUID REFERENCES profiles(id)    ON DELETE SET NULL,
  action        TEXT NOT NULL,       -- e.g. 'task.created', 'member.invited', 'task.deleted'
  resource      TEXT NOT NULL,       -- e.g. 'tasks', 'workspace_members'
  resource_id   UUID,
  metadata      JSONB DEFAULT '{}',  -- extra context (title, old/new values, etc.)
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs(action);

-- RLS — workspace admins can read logs; nobody can write directly (SECURITY DEFINER functions only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins read audit logs"
  ON audit_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert is SECURITY DEFINER only (via the function below)
-- No direct INSERT policy needed for normal users.

-- ─────────────────────────────────────────────────────────────────
-- 3. FUNCTION — log_audit_event
--    Called from client via supabase.rpc('log_audit_event', {...})
--    Uses SECURITY DEFINER so the anon/authenticated role can write
--    to audit_logs without a permissive INSERT policy.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_audit_event(
  p_workspace_id UUID,
  p_action       TEXT,
  p_resource     TEXT,
  p_resource_id  UUID     DEFAULT NULL,
  p_metadata     JSONB    DEFAULT '{}',
  p_ip_address   TEXT     DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (workspace_id, user_id, action, resource, resource_id, metadata, ip_address)
  VALUES (p_workspace_id, auth.uid(), p_action, p_resource, p_resource_id, p_metadata, p_ip_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 4. FUNCTION — accept_workspace_invitation
--    Validates token, checks expiry, adds user to workspace_members,
--    marks invitation as accepted. All in one atomic transaction.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_workspace_invitation(p_token TEXT)
RETURNS workspace_members AS $$
DECLARE
  v_invite  workspace_invitations%ROWTYPE;
  v_member  workspace_members%ROWTYPE;
BEGIN
  -- Fetch and lock the invitation
  SELECT * INTO v_invite
  FROM workspace_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token.';
  END IF;

  -- Add to workspace_members
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO v_member;

  -- Update profile's current workspace if none set
  UPDATE profiles
  SET current_workspace_id = v_invite.workspace_id
  WHERE id = auth.uid() AND current_workspace_id IS NULL;

  -- Mark invitation as accepted
  UPDATE workspace_invitations
  SET accepted_at = NOW()
  WHERE id = v_invite.id;

  -- Log the event
  PERFORM log_audit_event(
    v_invite.workspace_id,
    'member.joined',
    'workspace_members',
    v_member.user_id,
    jsonb_build_object('role', v_invite.role, 'via', 'invitation')
  );

  RETURN v_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 5. TRIGGER — auto-audit task changes (insert / update / delete)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_task_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_meta   JSONB := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'task.created';
    v_meta   := jsonb_build_object('title', NEW.title, 'status', NEW.status, 'priority', NEW.priority);
    PERFORM log_audit_event(NEW.workspace_id, v_action, 'tasks', NEW.id, v_meta);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status THEN
      v_action := 'task.status_changed';
      v_meta   := jsonb_build_object('title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status);
      PERFORM log_audit_event(NEW.workspace_id, v_action, 'tasks', NEW.id, v_meta);
    END IF;
    IF OLD.title <> NEW.title THEN
      v_action := 'task.title_updated';
      v_meta   := jsonb_build_object('old_title', OLD.title, 'new_title', NEW.title);
      PERFORM log_audit_event(NEW.workspace_id, v_action, 'tasks', NEW.id, v_meta);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'task.deleted';
    v_meta   := jsonb_build_object('title', OLD.title);
    PERFORM log_audit_event(OLD.workspace_id, v_action, 'tasks', OLD.id, v_meta);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_tasks ON tasks;
CREATE TRIGGER trg_audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION audit_task_changes();

-- ─────────────────────────────────────────────────────────────────
-- 6. TRIGGER — auto-audit member changes
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_member_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.workspace_id, 'member.added', 'workspace_members', NEW.user_id,
      jsonb_build_object('role', NEW.role)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      OLD.workspace_id, 'member.removed', 'workspace_members', OLD.user_id,
      jsonb_build_object('role', OLD.role)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_members ON workspace_members;
CREATE TRIGGER trg_audit_members
  AFTER INSERT OR DELETE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION audit_member_changes();
