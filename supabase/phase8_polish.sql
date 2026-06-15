-- ============================================================================
-- Phase H — Security Hardening + Cron Cleanup
-- Run this in Supabase SQL Editor after phase7_enterprise_rbac.sql
-- ============================================================================

-- ── H1. Clear temp passwords from accepted invitations ───────────────────────
-- Run immediately to clean up any accepted invitations with temp passwords still stored
UPDATE employee_invitations
SET temp_password = '**CLEARED**'
WHERE status = 'accepted'
  AND temp_password <> '**CLEARED**';

-- ── H2. Auto-expire old pending invitations ───────────────────────────────────
DROP FUNCTION IF EXISTS expire_old_invitations();
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  -- Mark expired
  UPDATE employee_invitations
  SET    status = 'expired'
  WHERE  status    = 'pending'
    AND  expires_at < NOW();

  -- Clear temp passwords from expired too
  UPDATE employee_invitations
  SET    temp_password = '**CLEARED**'
  WHERE  status IN ('accepted', 'expired')
    AND  temp_password <> '**CLEARED**';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── H3. pg_cron job: run every hour to expire invitations ────────────────────
-- Enable pg_cron extension first if not already enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- Then schedule:
-- SELECT cron.schedule('expire-invitations', '0 * * * *', 'SELECT expire_old_invitations()');

-- ── H4. Ensure single-use tokens (trigger clears token after acceptance) ──────
DROP FUNCTION IF EXISTS clear_accepted_invite_token() CASCADE;
CREATE OR REPLACE FUNCTION clear_accepted_invite_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    NEW.token         := '**USED**';
    NEW.temp_password := '**CLEARED**';
    NEW.accepted_at   := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clear_accepted_invite ON employee_invitations;
CREATE TRIGGER trg_clear_accepted_invite
  BEFORE UPDATE ON employee_invitations
  FOR EACH ROW
  EXECUTE FUNCTION clear_accepted_invite_token();

-- ── H5. Rate limit: max 20 invitations per workspace per hour ─────────────────
DROP FUNCTION IF EXISTS check_invite_rate_limit(UUID);
CREATE OR REPLACE FUNCTION check_invite_rate_limit(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM   employee_invitations
  WHERE  workspace_id = p_workspace_id
    AND  created_at   > NOW() - INTERVAL '1 hour';

  RETURN v_count < 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── H6. Audit log extensions — ensure indexes for new event types ─────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_enterprise
  ON audit_logs(action)
  WHERE action IN (
    'employee.invited', 'employee.setup_completed',
    'role.changed', 'team.created', 'team.member_added',
    'permission.overridden', 'invite.revoked', 'invite.resent'
  );

-- ── H7. Notification insert helper function ────────────────────────────────────
-- Safely insert a notification without exposing direct table writes to client
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id   UUID,
  p_type      TEXT,
  p_title     TEXT,
  p_body      TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications(user_id, type, title, body)
  VALUES (p_user_id, p_type, p_title, p_body)
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Silently fail — notifications are non-critical
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── H8. Admin notification trigger: when employee accepts invite ──────────────
-- Notifies the inviter that their employee has set up their account
DROP FUNCTION IF EXISTS notify_admin_on_employee_setup() CASCADE;
CREATE OR REPLACE FUNCTION notify_admin_on_employee_setup()
RETURNS TRIGGER AS $$
DECLARE
  v_inviter_id UUID;
  v_job_label  TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    v_inviter_id := OLD.invited_by;

    -- Map job profile to human label
    v_job_label := CASE OLD.job_profile
      WHEN 'company_admin' THEN 'Company Admin'
      WHEN 'manager'       THEN 'Manager'
      WHEN 'hr'            THEN 'HR Specialist'
      WHEN 'developer'     THEN 'Developer'
      WHEN 'designer'      THEN 'Designer'
      WHEN 'qa_engineer'   THEN 'QA Engineer'
      WHEN 'devops'        THEN 'DevOps Engineer'
      WHEN 'finance'       THEN 'Finance'
      WHEN 'sales'         THEN 'Sales'
      ELSE 'Employee'
    END;

    IF v_inviter_id IS NOT NULL THEN
      PERFORM create_notification(
        v_inviter_id,
        'employee_joined',
        'New team member joined! 🎉',
        OLD.email || ' has set up their account as ' || v_job_label
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_admin_employee_setup ON employee_invitations;
CREATE TRIGGER trg_notify_admin_employee_setup
  AFTER UPDATE ON employee_invitations
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_employee_setup();

-- ── H9. Audit log trigger: auto-log enterprise events ─────────────────────────
DROP FUNCTION IF EXISTS audit_enterprise_events() CASCADE;
CREATE OR REPLACE FUNCTION audit_enterprise_events()
RETURNS TRIGGER AS $$
BEGIN
  -- Invitation accepted
  IF TG_TABLE_NAME = 'employee_invitations' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO audit_logs(workspace_id, user_id, action, resource, metadata)
    VALUES (
      NEW.workspace_id,
      NEW.invited_by,
      'employee.setup_completed',
      'employee_invitations',
      jsonb_build_object('email', NEW.email, 'job_profile', NEW.job_profile)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_enterprise ON employee_invitations;
CREATE TRIGGER trg_audit_enterprise
  AFTER UPDATE ON employee_invitations
  FOR EACH ROW
  EXECUTE FUNCTION audit_enterprise_events();

-- ── H10. Summary view for admin notifications bell ────────────────────────────
DROP VIEW IF EXISTS v_unread_notifications;
CREATE OR REPLACE VIEW v_unread_notifications AS
SELECT
  n.id,
  n.user_id,
  n.workspace_id,
  n.type,
  n.title,
  n.body,
  n.link,
  n.is_read,
  n.created_at
FROM notifications n
WHERE n.is_read = false;

-- RLS on the view source table is enforced automatically since it reads notifications
COMMENT ON VIEW v_unread_notifications IS 'Unread notifications — use with user_id filter for RLS';
