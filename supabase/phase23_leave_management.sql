-- ============================================================
-- PHASE 23 — Leave Management Module
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. LEAVE TYPES table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  description   TEXT,
  max_days_per_year INT NOT NULL DEFAULT 0,     -- 0 = unlimited
  carry_forward BOOLEAN NOT NULL DEFAULT false,
  requires_document BOOLEAN NOT NULL DEFAULT false,
  color         TEXT NOT NULL DEFAULT '#6366F1', -- UI badge color
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code)
);

-- ─────────────────────────────────────────────────────────────────
-- 2. LEAVE BALANCES table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_balances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type_id  UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year           INT NOT NULL,
  total_days     NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days      NUMERIC(5,1) NOT NULL DEFAULT 0,
  pending_days   NUMERIC(5,1) NOT NULL DEFAULT 0,
  carry_over_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, leave_type_id, year)
);

-- ─────────────────────────────────────────────────────────────────
-- 3. LEAVE REQUESTS table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  applicant_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type_id     UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  total_days        NUMERIC(5,1) NOT NULL,
  reason            TEXT,
  document_url      TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','cancelled','withdrawn')),
  reviewed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_comment    TEXT,
  is_half_day       BOOLEAN NOT NULL DEFAULT false,
  half_day_session  TEXT CHECK (half_day_session IN ('morning','afternoon')),
  emergency_contact TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 4. LEAVE HOLIDAYS table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_holidays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  date         DATE NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'IN',
  is_optional  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, date)
);

-- ─────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_holidays ENABLE ROW LEVEL SECURITY;

-- == RLS: leave_types ==
DROP POLICY IF EXISTS "workspace members can read active leave types" ON leave_types;
CREATE POLICY "workspace members can read active leave types"
  ON leave_types FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    AND is_active = true
  );

DROP POLICY IF EXISTS "admins can manage leave types" ON leave_types;
CREATE POLICY "admins can manage leave types"
  ON leave_types FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
    )
  );

-- == RLS: leave_balances ==
DROP POLICY IF EXISTS "members can view own balances" ON leave_balances;
CREATE POLICY "members can view own balances"
  ON leave_balances FOR SELECT TO authenticated
  USING ( user_id = auth.uid() );

DROP POLICY IF EXISTS "admins can view all balances in workspace" ON leave_balances;
CREATE POLICY "admins can view all balances in workspace"
  ON leave_balances FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr', 'manager')
    )
  );

DROP POLICY IF EXISTS "admins can update balances" ON leave_balances;
CREATE POLICY "admins can update balances"
  ON leave_balances FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "members can insert own balances" ON leave_balances;
CREATE POLICY "members can insert own balances"
  ON leave_balances FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() );

-- == RLS: leave_requests ==
DROP POLICY IF EXISTS "members can view own requests" ON leave_requests;
CREATE POLICY "members can view own requests"
  ON leave_requests FOR SELECT TO authenticated
  USING ( applicant_id = auth.uid() );

DROP POLICY IF EXISTS "members can submit requests" ON leave_requests;
CREATE POLICY "members can submit requests"
  ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members can withdraw own pending requests" ON leave_requests;
CREATE POLICY "members can withdraw own pending requests"
  ON leave_requests FOR UPDATE TO authenticated
  USING ( applicant_id = auth.uid() AND status = 'pending' )
  WITH CHECK ( applicant_id = auth.uid() AND status IN ('withdrawn', 'pending') );

DROP POLICY IF EXISTS "admins can view all workspace requests" ON leave_requests;
CREATE POLICY "admins can view all workspace requests"
  ON leave_requests FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr', 'manager')
    )
  );

DROP POLICY IF EXISTS "admins can review requests" ON leave_requests;
CREATE POLICY "admins can review requests"
  ON leave_requests FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr', 'manager')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr', 'manager')
    )
  );

-- == RLS: leave_holidays ==
DROP POLICY IF EXISTS "members can read holidays" ON leave_holidays;
CREATE POLICY "members can read holidays"
  ON leave_holidays FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admins can manage holidays" ON leave_holidays;
CREATE POLICY "admins can manage holidays"
  ON leave_holidays FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'hr')
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 6. TRIGGERS AND FUNCTIONS
-- ─────────────────────────────────────────────────────────────────

-- Auto-update updated_at on leave_requests
CREATE OR REPLACE FUNCTION update_leave_request_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_leave_request_timestamp();

-- When a request is approved / rejected / cancelled / withdrawn → adjust leave balance
CREATE OR REPLACE FUNCTION handle_leave_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- APPROVED: move pending_days to used_days
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE leave_balances
    SET
      used_days    = used_days + NEW.total_days,
      pending_days = GREATEST(pending_days - NEW.total_days, 0)
    WHERE user_id = NEW.applicant_id
      AND leave_type_id = NEW.leave_type_id
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;

  -- REJECTED / WITHDRAWN / CANCELLED: release pending_days
  IF NEW.status IN ('rejected','withdrawn','cancelled') AND OLD.status = 'pending' THEN
    UPDATE leave_balances
    SET pending_days = GREATEST(pending_days - NEW.total_days, 0)
    WHERE user_id = NEW.applicant_id
      AND leave_type_id = NEW.leave_type_id
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_status_change ON leave_requests;
CREATE TRIGGER trg_leave_status_change
  AFTER UPDATE OF status ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION handle_leave_status_change();

-- When a new request is inserted → add pending_days
CREATE OR REPLACE FUNCTION handle_leave_request_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO leave_balances (workspace_id, user_id, leave_type_id, year, total_days, pending_days, used_days, carry_over_days)
  VALUES (NEW.workspace_id, NEW.applicant_id, NEW.leave_type_id, EXTRACT(YEAR FROM NEW.start_date)::INT, 0, NEW.total_days, 0, 0)
  ON CONFLICT (user_id, leave_type_id, year)
  DO UPDATE SET pending_days = leave_balances.pending_days + EXCLUDED.pending_days;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_request_insert ON leave_requests;
CREATE TRIGGER trg_leave_request_insert
  AFTER INSERT ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION handle_leave_request_insert();

-- Helper to seed default leave types for a workspace if none exist
CREATE OR REPLACE FUNCTION seed_workspace_leave_types(p_workspace_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO leave_types (workspace_id, name, code, description, max_days_per_year, color) VALUES
    (p_workspace_id, 'Annual Leave', 'AL', 'Paid vacation days', 18, '#10B981'),
    (p_workspace_id, 'Sick Leave', 'SL', 'Leave for medical recovery', 12, '#EF4444'),
    (p_workspace_id, 'Casual Leave', 'CL', 'Unplanned personal events', 6, '#F59E0B'),
    (p_workspace_id, 'Compensatory Off', 'CO', 'Time off earned for overtime work', 0, '#3B82F6'),
    (p_workspace_id, 'Maternity Leave', 'ML', 'Paid maternity leave', 130, '#EC4899'),
    (p_workspace_id, 'Paternity Leave', 'PL', 'Paid paternity leave', 15, '#8B5CF6'),
    (p_workspace_id, 'Unpaid Leave', 'UL', 'Loss of pay leave', 0, '#6B7280')
  ON CONFLICT (workspace_id, code) DO NOTHING;
END;
$$;

-- ── Trigger Function: Notify Webhooks on Public Holiday Mutation ──
CREATE OR REPLACE FUNCTION notify_webhooks_on_holiday_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_event     TEXT;
  v_payload   JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'holiday.created';
    v_payload := jsonb_build_object(
      'event',        v_event,
      'workspace_id', NEW.workspace_id,
      'holiday',      row_to_json(NEW)
    );
    
    INSERT INTO webhook_deliveries (webhook_id, workspace_id, event, payload, success)
    SELECT w.id, w.workspace_id, v_event, v_payload, false
    FROM webhooks w
    WHERE w.workspace_id = NEW.workspace_id
      AND w.is_active    = true
      AND v_event = ANY(w.events);

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_event := 'holiday.deleted';
    v_payload := jsonb_build_object(
      'event',        v_event,
      'workspace_id', OLD.workspace_id,
      'holiday',      row_to_json(OLD)
    );

    INSERT INTO webhook_deliveries (webhook_id, workspace_id, event, payload, success)
    SELECT w.id, w.workspace_id, v_event, v_payload, false
    FROM webhooks w
    WHERE w.workspace_id = OLD.workspace_id
      AND w.is_active    = true
      AND v_event = ANY(w.events);

    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_webhooks_holiday ON leave_holidays;
CREATE TRIGGER trg_notify_webhooks_holiday
  AFTER INSERT OR DELETE ON leave_holidays
  FOR EACH ROW EXECUTE FUNCTION notify_webhooks_on_holiday_mutation();


-- ── Trigger Function: Notify Webhooks on Leave Application Mutation ──
CREATE OR REPLACE FUNCTION notify_webhooks_on_leave_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_event          TEXT;
  v_payload        JSONB;
  v_applicant_name TEXT;
  v_leave_type     TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'leave.created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_event := 'leave.status_changed';
  ELSE
    RETURN NEW;
  END IF;

  -- Fetch applicant name
  SELECT name INTO v_applicant_name
  FROM profiles
  WHERE id = NEW.applicant_id;

  -- Fetch leave type name
  SELECT name INTO v_leave_type
  FROM leave_types
  WHERE id = NEW.leave_type_id;

  v_payload := jsonb_build_object(
    'event',          v_event,
    'workspace_id',   NEW.workspace_id,
    'applicant_name', COALESCE(v_applicant_name, 'Unknown Employee'),
    'leave_type',     COALESCE(v_leave_type, 'Leave'),
    'leave',          row_to_json(NEW)
  );

  INSERT INTO webhook_deliveries (webhook_id, workspace_id, event, payload, success)
  SELECT w.id, w.workspace_id, v_event, v_payload, false
  FROM webhooks w
  WHERE w.workspace_id = NEW.workspace_id
    AND w.is_active    = true
    AND v_event = ANY(w.events);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_webhooks_leave ON leave_requests;
CREATE TRIGGER trg_notify_webhooks_leave
  AFTER INSERT OR UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION notify_webhooks_on_leave_mutation();


