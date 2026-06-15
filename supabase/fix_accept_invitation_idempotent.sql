-- =============================================================================
-- FIX: Make accept_employee_invitation fully idempotent & fallback legacy roles
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ── 1. Ensure workspace_members has the required unique index ─────────────────
CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_unique
  ON workspace_members (workspace_id, user_id);

-- ── 2. Ensure team_members unique index exists ────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_unique
  ON team_members (team_id, user_id);

-- ── 3. Update handle_new_user trigger function to fallback legacy job profiles ──
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_job_profile TEXT;
BEGIN
  -- Extract job profile and fallback if not one of the 4 valid roles
  v_job_profile := COALESCE(NEW.raw_user_meta_data->>'job_profile', 'employee');
  IF v_job_profile NOT IN ('company_admin', 'manager', 'employee', 'intern') THEN
    v_job_profile := 'employee';
  END IF;

  INSERT INTO public.profiles (
    id, name, role, job_profile,
    profile_image_url, status, setup_completed
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    v_job_profile,
    NEW.raw_user_meta_data->>'profile_image_url',
    -- Employees invited via token start as pending_setup; direct signups are active
    CASE WHEN NEW.raw_user_meta_data->>'invited' = 'true'
         THEN 'pending_setup'
         ELSE 'active'
    END,
    -- Invited employees have not completed setup yet
    CASE WHEN NEW.raw_user_meta_data->>'invited' = 'true'
         THEN false
         ELSE true
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 4. Replace accept_employee_invitation with idempotent & fallback version ──
DROP FUNCTION IF EXISTS accept_employee_invitation(TEXT);

CREATE OR REPLACE FUNCTION accept_employee_invitation(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_uid    UUID;
  v_role   TEXT;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invitation.';
  END IF;

  -- Fetch invitation by token
  SELECT * INTO v_invite
  FROM employee_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation link is invalid. Please contact your admin.';
  END IF;

  -- Map invite's job profile to one of the 4 whitelisted roles (fallback to employee)
  v_role := CASE WHEN v_invite.job_profile IN ('company_admin', 'manager', 'employee', 'intern')
                 THEN v_invite.job_profile
                 ELSE 'employee'
            END;

  -- Already accepted → idempotent success (retry-safe)
  IF v_invite.status = 'accepted' THEN
    -- Ensure workspace membership still exists (handles partial failures)
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_invite.workspace_id, v_uid, v_role)
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;

    IF v_invite.team_id IS NOT NULL THEN
      INSERT INTO team_members (team_id, user_id)
      VALUES (v_invite.team_id, v_uid)
      ON CONFLICT (team_id, user_id) DO NOTHING;
    END IF;

    RETURN TRUE;
  END IF;

  -- Expired
  IF v_invite.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired. Ask your admin to resend it.';
  END IF;

  -- Revoked or unknown status
  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer valid (status: %). Contact your admin.', v_invite.status;
  END IF;

  -- ── Pending path ─────────────────────────────────────────────────────────

  -- Upsert workspace membership
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, v_uid, v_role)
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Upsert team membership
  IF v_invite.team_id IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id)
    VALUES (v_invite.team_id, v_uid)
    ON CONFLICT (team_id, user_id) DO NOTHING;
  END IF;

  -- Mark accepted
  UPDATE employee_invitations
  SET status     = 'accepted',
      accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_employee_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_invite_by_token(TEXT) TO anon, authenticated;
