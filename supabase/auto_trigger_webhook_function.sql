-- =============================================================================
-- FIX: Automate Webhook Delivery on Database Level (No CORS / No Browser Errors)
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Create the trigger function that calls the deliver-webhook Edge Function
--
-- PREREQUISITES (run once in Supabase Dashboard → Database → Extensions):
--   • Enable "pg_net"
--
-- DEPLOY the Edge Function (run once in your terminal):
--   supabase functions deploy deliver-webhook --no-verify-jwt
--
CREATE OR REPLACE FUNCTION trigger_deliver_webhook_function()
RETURNS TRIGGER AS $$
BEGIN
  -- Fire an async HTTP POST via pg_net to invoke the Edge Function.
  -- Wrapped in EXCEPTION so a missing/failed call never rolls back the
  -- parent transaction (e.g. task create / update / delete).
  BEGIN
    PERFORM net.http_post(
      url     := 'https://gxfnmpqbuamzilgeogfh.supabase.co/functions/v1/deliver-webhook',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || 'sb_publishable_mUcwdWBggqJjIFycyrQxJA_OJECxUZl'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net not available or HTTP call failed — delivery stays queued in
    -- webhook_deliveries and will be retried on the next trigger fire.
    NULL;
  END;
  RETURN NULL; -- AFTER STATEMENT triggers return NULL
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the trigger if it already exists
DROP TRIGGER IF EXISTS trg_trigger_deliver_webhook ON webhook_deliveries;

-- 3. Bind the trigger to run once after each batch of insertions to webhook_deliveries
CREATE TRIGGER trg_trigger_deliver_webhook
  AFTER INSERT ON webhook_deliveries
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_deliver_webhook_function();
