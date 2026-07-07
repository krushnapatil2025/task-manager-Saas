-- ============================================================================
-- platform_settings table + RLS fix
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Fixes: 403 Forbidden on GET /rest/v1/platform_settings
-- Cause: Table either doesn't exist or has no RLS policy for super admins.
-- ============================================================================

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '""',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed with default values (safe to re-run — ON CONFLICT DO NOTHING)
INSERT INTO platform_settings (key, value) VALUES
  ('maintenance_mode',      'false'),
  ('allow_new_signups',     'true'),
  ('max_workspaces_per_org', '5'),
  ('platform_name',         '"Strideo"'),
  ('support_email',         '"support@strideo.app"')
ON CONFLICT (key) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies to avoid conflicts (idempotent)
DROP POLICY IF EXISTS "Super admins can read platform_settings"   ON platform_settings;
DROP POLICY IF EXISTS "Super admins can write platform_settings"  ON platform_settings;
DROP POLICY IF EXISTS "platform_settings_sa_read"                 ON platform_settings;
DROP POLICY IF EXISTS "platform_settings_sa_write"                ON platform_settings;

-- 5. Allow super admins to SELECT
CREATE POLICY "platform_settings_sa_read"
  ON platform_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
  );

-- 6. Allow super admins to INSERT/UPDATE/DELETE
CREATE POLICY "platform_settings_sa_write"
  ON platform_settings
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
  )
  WITH CHECK (
    public.is_super_admin()
  );

-- 7. Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_settings TO authenticated;

-- Done. The 403 should be resolved after running this.
