-- ============================================================================
-- FIX: bootstrap_company_admin RPC
-- Run this in: Supabase Dashboard → SQL Editor
-- Resolves column "created_by" does not exist error on the workspaces table.
-- ============================================================================

CREATE OR REPLACE FUNCTION bootstrap_company_admin(
  p_user_id          UUID,
  p_name             TEXT,
  p_phone            TEXT     DEFAULT NULL,
  p_company_name     TEXT     DEFAULT '',
  p_company_industry TEXT     DEFAULT '',
  p_company_size     TEXT     DEFAULT '',
  p_workspace_name   TEXT     DEFAULT '',
  p_workspace_slug   TEXT     DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_slug         TEXT;
BEGIN
  -- 1. Upsert profile — set account_approval_status = 'pending' so the
  --    new company admin is held in the review queue until a Super Admin approves.
  INSERT INTO profiles (
    id, name, phone,
    job_profile, company_name, company_industry, company_size,
    setup_completed, status, role,
    account_approval_status   -- <-- profile-level approval gate
  )
  VALUES (
    p_user_id, p_name, p_phone,
    'company_admin', p_company_name, p_company_industry, p_company_size,
    true, 'active', 'admin',
    'pending'                 -- awaiting Super Admin review
  )
  ON CONFLICT (id) DO UPDATE SET
    name                    = EXCLUDED.name,
    phone                   = EXCLUDED.phone,
    job_profile             = 'company_admin',
    company_name            = EXCLUDED.company_name,
    company_industry        = EXCLUDED.company_industry,
    company_size            = EXCLUDED.company_size,
    setup_completed         = true,
    status                  = 'active',
    role                    = 'admin',
    account_approval_status = 'pending';

  -- 2. Build a unique slug
  v_slug := LOWER(REGEXP_REPLACE(p_workspace_slug, '[^a-z0-9\-]', '-', 'g'));
  IF EXISTS (SELECT 1 FROM workspaces WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
  END IF;

  -- 3. Create workspace — always 'approved' (workspaces are never gated).
  --    Only the company admin's PROFILE requires Super Admin approval.
  --    FIX: Insert owner_id instead of non-existent created_by column.
  INSERT INTO workspaces (name, slug, owner_id, approval_status)
  VALUES (p_workspace_name, v_slug, p_user_id, 'approved')
  RETURNING id INTO v_workspace_id;

  -- 4. Add user as company_admin workspace member
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_user_id, 'company_admin')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'company_admin';

  RETURN jsonb_build_object(
    'success',      true,
    'workspace_id', v_workspace_id,
    'user_id',      p_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM
  );
END;
$$;

-- Grant execute to the anon/authenticated roles so client can call it
GRANT EXECUTE ON FUNCTION bootstrap_company_admin(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)
  TO anon, authenticated;
