-- NexCargo Migration 010 — Role-Resolution Security Remediation
-- Authorized by HAO: Role-Resolution Security Remediation (independent of C6-III)
-- Purpose: Implement authoritative role resolution for SUPER_ADMIN RLS coverage
--          while preventing privilege escalation through user_metadata manipulation.
--
-- Changes:
--   1. CREATE SCHEMA app + platform_roles table with RLS
--   2. CREATE public.effective_user_role() resolver (SECURITY DEFINER)
--      NOTE: Created in PUBLIC schema because PostgreSQL service-role lacks
--      CREATE privilege on the auth schema in Supabase-hosted deployments.
--   3. Replace 19 admin-tier RLS policies across migrations 002–009
--      using effective_user_role() and canonical UPPER_SNAKE_CASE roles
--   4. Remove stale JWT-based admin policies from marketplace tables
--      (old "Admin full access to ..." policies that co-existed with new ones)
--
-- Preserved:
--   - All immutable financial column REVOKE constraints
--   - All append-only audit/ledger controls
--   - All counterparty privacy rules
--   - No-Custody Principle
--   - Bank/payment execution authority boundaries
--   - Existing state-machine/RPC authorization boundaries
--
-- No role-mutation trigger created. No session bypass config created.

-- ============================================================
-- SECTION 1: CREATE app SCHEMA
-- ============================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ============================================================
-- SECTION 2: CREATE app.platform_roles TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS app.platform_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick role lookup by user_id (PK covers this, but explicit index on assigned_by for admin queries)
CREATE INDEX IF NOT EXISTS idx_platform_roles_assigned_by
  ON app.platform_roles(assigned_by);

-- Composite index for "who did this user assign?" queries
CREATE INDEX IF NOT EXISTS idx_platform_roles_user_assigned
  ON app.platform_roles(user_id, assigned_by);

-- ============================================================
-- SECTION 3: AUTH.EFFECTIVE_USER_ROLE() RESOLVER
-- NOTE: Created in PUBLIC schema (not auth) because the PostgreSQL
-- service-role user lacks CREATE privilege on the auth schema in
-- Supabase-hosted deployments. Function is secured via REVOKE + GRANT.
-- Must be created BEFORE Section 4's RLS policy since the policy references it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.effective_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
  SELECT COALESCE(
    (SELECT pr.role FROM app.platform_roles pr WHERE pr.user_id = auth.uid() LIMIT 1),
    (SELECT u.raw_user_meta_data->>'role'
     FROM auth.users u
     WHERE u.id = auth.uid()
       AND u.raw_user_meta_data->>'role' IN ('SHIPPER', 'TRANSPORTER', 'DRIVER')
     LIMIT 1)
  );
$$;

-- Deny public/anon access; grant only to authenticated users and service-role
REVOKE EXECUTE ON FUNCTION public.effective_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.effective_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.effective_user_role() TO authenticated;

-- ============================================================
-- SECTION 4: RLS FOR app.platform_roles
-- ============================================================

ALTER TABLE app.platform_roles ENABLE ROW LEVEL SECURITY;

-- Admin/Super Admin full access to manage platform roles
CREATE POLICY platform_roles_admin
  ON app.platform_roles FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- ============================================================
-- SECTION 5: CLEAN STALE MARKETPLACE JWT POLICIES
-- Remove old "Admin full access to ..." policies from migration 002
-- These co-existed with new effective_user_role policies after the fix,
-- creating duplicate and inconsistent authorization paths.
-- ============================================================

DROP POLICY IF EXISTS "Admin full access to listings" ON marketplace_schema.listings;
DROP POLICY IF EXISTS "Admin full access to offers" ON marketplace_schema.offers;
DROP POLICY IF EXISTS "Admin full access to matches" ON marketplace_schema.matches;
DROP POLICY IF EXISTS "Admin full access to quotes" ON marketplace_schema.quotes;

-- ============================================================
-- SECTION 6: REMEDIATE MIGRATION 003 — BOOKINGS
-- Adds SUPER_ADMIN (previously excluded) + fixes JWT claim issue
-- ============================================================

DROP POLICY IF EXISTS "Admin full access to bookings" ON logistics_schema.bookings;
CREATE POLICY "Admin super-admin moderator full access to bookings"
  ON logistics_schema.bookings FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- ============================================================
-- SECTION 7: REMEDIATE MIGRATION 005 — CONTRACTS + ESCROW
-- Adds SUPER_ADMIN (previously excluded) + fixes JWT claim issue
-- ============================================================

-- contracts
DROP POLICY IF EXISTS contracts_admin ON logistics_schema.contracts;
CREATE POLICY contracts_admin
  ON logistics_schema.contracts FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- escrow_records
DROP POLICY IF EXISTS escrow_admin ON financial_schema.escrow_records;
CREATE POLICY escrow_admin
  ON financial_schema.escrow_records FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- ============================================================
-- SECTION 8: REMEDIATE MIGRATION 006 — PAYMENT INTENTS
-- Adds SUPER_ADMIN (previously excluded) + fixes JWT claim issue
-- ============================================================

DROP POLICY IF EXISTS payment_intent_admin ON financial_schema.payment_intents;
CREATE POLICY payment_intent_admin
  ON financial_schema.payment_intents FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- ============================================================
-- SECTION 9: REMEDIATE MIGRATION 007 — SETTLEMENT + LEDGER
-- Adds SUPER_ADMIN (previously excluded) + fixes JWT claim issue
-- ============================================================

-- settlement_requests
DROP POLICY IF EXISTS settlement_request_admin ON financial_schema.settlement_requests;
CREATE POLICY settlement_request_admin
  ON financial_schema.settlement_requests FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- financial_ledger_entries
DROP POLICY IF EXISTS financial_ledger_admin ON financial_schema.financial_ledger_entries;
CREATE POLICY financial_ledger_admin
  ON financial_schema.financial_ledger_entries FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- ============================================================
-- SECTION 10: REMEDIATE MIGRATION 008 — NOTIFICATIONS
-- Adds SUPER_ADMIN (previously excluded) + fixes JWT claim issue
-- ============================================================

-- notifications
DROP POLICY IF EXISTS notification_admin ON communication_schema.notifications;
CREATE POLICY notification_admin
  ON communication_schema.notifications FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- notification_templates
DROP POLICY IF EXISTS template_admin ON communication_schema.notification_templates;
CREATE POLICY template_admin
  ON communication_schema.notification_templates FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- delivery_events
DROP POLICY IF EXISTS delivery_event_admin ON communication_schema.delivery_events;
CREATE POLICY delivery_event_admin
  ON communication_schema.delivery_events FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- ============================================================
-- SECTION 11: CLEAN STALE MARKETPLACE JWT POLICIES
-- Remove old "Admin full access to ..." policies from migration 002
-- These co-existed with new effective_user_role policies after the fix,
-- creating duplicate and inconsistent authorization paths.
-- ============================================================

DROP POLICY IF EXISTS "Admin full access to listings" ON marketplace_schema.listings;
DROP POLICY IF EXISTS "Admin full access to offers" ON marketplace_schema.offers;
DROP POLICY IF EXISTS "Admin full access to matches" ON marketplace_schema.matches;
DROP POLICY IF EXISTS "Admin full access to quotes" ON marketplace_schema.quotes;

-- ============================================================
-- SECTION 12: REMEDIATE MIGRATION 009 — MONITORING TABLES
-- Adds SUPER_ADMIN (previously excluded) + fixes JWT claim issue
-- 6 tables total
-- ============================================================

-- alerts
DROP POLICY IF EXISTS alerts_admin ON monitoring_schema.alerts;
CREATE POLICY alerts_admin
  ON monitoring_schema.alerts FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- incidents
DROP POLICY IF EXISTS incidents_admin ON monitoring_schema.incidents;
CREATE POLICY incidents_admin
  ON monitoring_schema.incidents FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- log_entries
DROP POLICY IF EXISTS log_entries_admin ON monitoring_schema.log_entries;
CREATE POLICY log_entries_admin
  ON monitoring_schema.log_entries FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- metrics
DROP POLICY IF EXISTS metrics_admin ON monitoring_schema.metrics;
CREATE POLICY metrics_admin
  ON monitoring_schema.metrics FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- traces
DROP POLICY IF EXISTS traces_admin ON monitoring_schema.traces;
CREATE POLICY traces_admin
  ON monitoring_schema.traces FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));

-- health_checks
DROP POLICY IF EXISTS health_checks_admin ON monitoring_schema.health_checks;
CREATE POLICY health_checks_admin
  ON monitoring_schema.health_checks FOR ALL
  USING (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'))
  WITH CHECK (public.effective_user_role() IN ('ADMIN', 'MODERATOR', 'SUPER_ADMIN'));
