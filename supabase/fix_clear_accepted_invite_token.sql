-- ============================================================================
-- FIX: Prevent duplicate key violation on employee_invitations (token)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Safely update any existing '**USED**' tokens to be unique by appending the UUID
UPDATE employee_invitations
SET    token = '**USED**-' || id::TEXT
WHERE  token = '**USED**';

-- 2. Update the trigger function to use the unique format
CREATE OR REPLACE FUNCTION clear_accepted_invite_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    NEW.token         := '**USED**-' || NEW.id::TEXT;
    NEW.temp_password := '**CLEARED**';
    NEW.accepted_at   := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
