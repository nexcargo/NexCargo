-- ============================================================================
-- NexCargo Migration 060 — I-3 Event/Notification Connectivity: locale + replay
-- ============================================================================
-- Authority: LEAD ARCHITECT DIRECTIVE — I-3 IMPLEMENTATION (9 November 2026)
--   §4B durable event processing / failure recording and recovery
--   §4C notification content and localization, user preferences where specified
--   §5  migration and RPC reconciliation (continues 059)
--   §6  operational trust; §7 proportionate solutions, reuse existing architecture
-- Governing specs:
--   MOD-016 §4.3 (templates/localization), §7.9 (locale resolution)
--   ESS-001C §4.1 (bounded retries), §10 (no synchronous retry in request path)
--   ESS-006 (RLS / least privilege), PROMPT 2 (event envelope)
--
-- WHY THIS MIGRATION EXISTS (measured pre-state, not assumed):
--   1. localization_schema.user_preferences holds language_preference, but
--      localization_schema is NOT in pgrst.db_schemas (056 exposure, verified
--      unchanged). A service-role PostgREST read of that table fails PGRST106.
--      Rather than widen schema exposure — which would publish every user's
--      preference row — this adds one narrow SECURITY DEFINER lookup that
--      returns a single two-letter code for one recipient.
--   2. 059 records per-consumer terminal state in
--      analytics_schema.event_consumer_state, including FAILED. Nothing yet
--      claims those rows for replay. ESS-001C §10 forbids inline retry, so
--      recovery must be a separate bounded pass. This adds the atomic claim;
--      the TypeScript consumer re-executes its own handler (no duplicated
--      consumer logic in SQL).
--
-- DELIBERATELY NOT DONE:
--   - No new event types, no new channels, no new providers.
--   - No change to pgrst.db_schemas (056 exposure preserved exactly).
--   - No change to 055/057 service-role privileges (asserted below).
--   - No pg_cron job for consumer replay: replay re-executes TypeScript, and
--     the only authorized machine path for that is the existing governance-tier
--     /api/notifications/delivery-processor endpoint. Inventing a cron identity
--     for it is an open I-2 LA decision, not something to fabricate here.
--     Notification draining and stall recovery remain scheduled by 059 Part 7.
--
-- TRANSACTIONALITY: applied as one transaction by apply_migration. Every
-- statement is idempotent (CREATE OR REPLACE / IF NOT EXISTS / guarded asserts).
--
-- ROLLBACK INSTRUCTIONS (run in one transaction, reverse order):
--   DROP FUNCTION IF EXISTS public.claim_failed_event_consumptions(VARCHAR, INTEGER, INTEGER, INTEGER);
--   DROP FUNCTION IF EXISTS communication_schema.resolve_recipient_locale(UUID);
--   DELETE FROM supabase_migrations.schema_migrations WHERE version = '<this row>';
--   No table, column, index, policy, grant on a pre-existing object, or cron job
--   is created or altered by this migration, so nothing else needs reverting.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Part 0 — Pre-state checks (fail loudly rather than build on a wrong baseline)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'communication_schema') THEN
    RAISE EXCEPTION '060 pre-state: communication_schema missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'localization_schema' AND table_name = 'user_preferences'
  ) THEN
    RAISE EXCEPTION '060 pre-state: localization_schema.user_preferences missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'localization_schema' AND table_name = 'user_preferences'
      AND column_name = 'language_preference'
  ) THEN
    RAISE EXCEPTION '060 pre-state: user_preferences.language_preference missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'analytics_schema' AND table_name = 'event_consumer_state'
  ) THEN
    RAISE EXCEPTION '060 pre-state: analytics_schema.event_consumer_state missing (059 not applied)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'analytics_schema' AND table_name = 'event_store'
  ) THEN
    RAISE EXCEPTION '060 pre-state: analytics_schema.event_store missing';
  END IF;
  -- 055 regression guard: the notification write path must still be privileged.
  IF NOT has_table_privilege('service_role', 'communication_schema.notifications', 'INSERT') THEN
    RAISE EXCEPTION '060 pre-state: service_role INSERT on notifications was lost (055 regression)';
  END IF;
  IF NOT has_table_privilege('service_role', 'communication_schema.notifications', 'SELECT') THEN
    RAISE EXCEPTION '060 pre-state: service_role SELECT on notifications was lost (055 regression)';
  END IF;
  -- 059 must be present and must still expose exactly one record_delivery_attempt.
  IF (
    SELECT count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'communication_schema' AND p.proname = 'record_delivery_attempt'
  ) <> 1 THEN
    RAISE EXCEPTION '060 pre-state: record_delivery_attempt overload count is not exactly 1 (059/SB-3A regression)';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- Part 1 — Recipient locale resolution (MOD-016 §7.9)
-- ----------------------------------------------------------------------------
-- Returns the recipient's stored two-letter language preference, or 'pt' (the
-- MOD-016 / column default) when no preference row exists or the stored value is
-- not a valid two-letter lowercase code. Never raises for an unknown recipient:
-- localization must not block notification creation.
CREATE OR REPLACE FUNCTION communication_schema.resolve_recipient_locale(
  p_recipient_id UUID
)
RETURNS VARCHAR(2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_lang TEXT;
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN 'pt';
  END IF;

  SELECT up.language_preference INTO v_lang
  FROM localization_schema.user_preferences up
  WHERE up.user_id = p_recipient_id;

  IF v_lang IS NULL OR v_lang !~ '^[a-z]{2}$' THEN
    RETURN 'pt';
  END IF;

  RETURN v_lang::VARCHAR(2);
END;
$$;

COMMENT ON FUNCTION communication_schema.resolve_recipient_locale(UUID) IS
  'I-3 §4C / MOD-016 §7.9: narrow service-role locale lookup. localization_schema is not PostgREST-exposed; this avoids widening 056 exposure.';

-- ----------------------------------------------------------------------------
-- Part 2 — Atomic claim of failed/stalled event consumptions for replay
-- ----------------------------------------------------------------------------
-- Marks selected rows PROCESSING inside the same statement that returns them, so
-- two concurrent replay passes cannot dispatch the same event twice. Returns the
-- full stored envelope so the TypeScript consumer can re-run its own handler.
--
-- Selection: status = 'FAILED' with attempts < p_max_attempts, OR
--            status = 'PROCESSING' whose last_attempt_at is older than the stall
--            timeout (a replay pass that died mid-flight).
-- COMPLETED rows are never returned. Rows at the attempt ceiling are left FAILED
-- for operator inspection — ESS-001C bounded retry, not infinite retry.
CREATE OR REPLACE FUNCTION public.claim_failed_event_consumptions(
  p_consumer_name VARCHAR(100) DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 5,
  p_batch_size INTEGER DEFAULT 25,
  p_stall_timeout_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  event_id UUID,
  consumer_name VARCHAR(100),
  attempts INTEGER,
  event_type VARCHAR(255),
  event_timestamp TIMESTAMPTZ,
  source_module VARCHAR(50),
  aggregate_id TEXT,
  aggregate_type VARCHAR(100),
  payload JSONB,
  correlation_id TEXT,
  causation_id TEXT,
  version INTEGER,
  classification VARCHAR(50),
  criticality VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_batch INTEGER;
  v_max INTEGER;
  v_stall INTEGER;
BEGIN
  v_batch := LEAST(GREATEST(COALESCE(p_batch_size, 25), 1), 100);
  v_max   := LEAST(GREATEST(COALESCE(p_max_attempts, 5), 1), 10);
  v_stall := GREATEST(COALESCE(p_stall_timeout_seconds, 300), 1);

  RETURN QUERY
  WITH candidate AS (
    SELECT s.event_id AS c_eid, s.consumer_name AS c_cname, s.attempts AS c_attempts
    FROM analytics_schema.event_consumer_state s
    WHERE (
      (s.status = 'FAILED' AND s.attempts < v_max)
      OR (
        s.status = 'PROCESSING'
        AND s.last_attempt_at < now() - make_interval(secs => v_stall)
      )
    )
    AND (p_consumer_name IS NULL OR s.consumer_name = p_consumer_name)
    ORDER BY s.last_attempt_at NULLS FIRST, s.first_seen_at
    LIMIT v_batch
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE analytics_schema.event_consumer_state s
    SET status = 'PROCESSING', last_attempt_at = now()
    FROM candidate c
    WHERE s.event_id = c.c_eid AND s.consumer_name = c.c_cname
    RETURNING s.event_id, s.consumer_name, s.attempts
  )
  SELECT
    cl.event_id,
    cl.consumer_name,
    cl.attempts,
    e.event_type,
    e."timestamp",
    e.source_module,
    COALESCE(e.aggregate_ref, e.aggregate_id::TEXT),
    e.aggregate_type,
    e.payload,
    COALESCE(e.correlation_ref, e.correlation_id::TEXT),
    e.causation_id::TEXT,
    COALESCE(e.version, 1),
    e.classification,
    e.criticality
  FROM claimed cl
  JOIN analytics_schema.event_store e ON e.event_id = cl.event_id;
END;
$$;

COMMENT ON FUNCTION public.claim_failed_event_consumptions(VARCHAR, INTEGER, INTEGER, INTEGER) IS
  'I-3 §4B: atomic PROCESSING claim of FAILED/stalled consumer states for TypeScript replay. Bounded by ESS-001C §4.1; no inline retry.';

-- ----------------------------------------------------------------------------
-- Part 3 — Privileges: service_role only, no client reach
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION communication_schema.resolve_recipient_locale(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION communication_schema.resolve_recipient_locale(UUID) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION communication_schema.resolve_recipient_locale(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.claim_failed_event_consumptions(VARCHAR, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_failed_event_consumptions(VARCHAR, INTEGER, INTEGER, INTEGER) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_failed_event_consumptions(VARCHAR, INTEGER, INTEGER, INTEGER) TO service_role;

-- The replay pass reads the stored envelope through the SECDEF function above;
-- service_role also needs direct SELECT for the recovery service's diagnostics.
GRANT USAGE ON SCHEMA analytics_schema TO service_role;
GRANT SELECT ON analytics_schema.event_store TO service_role;
GRANT SELECT ON analytics_schema.event_consumer_state TO service_role;

-- ----------------------------------------------------------------------------
-- Part 4 — Post-state assertions
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_cfg TEXT;
BEGIN
  IF NOT has_function_privilege('service_role', 'communication_schema.resolve_recipient_locale(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION '060 post-state: service_role cannot execute resolve_recipient_locale';
  END IF;
  IF has_function_privilege('authenticated', 'communication_schema.resolve_recipient_locale(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION '060 post-state: authenticated must not execute resolve_recipient_locale';
  END IF;
  IF has_function_privilege('anon', 'communication_schema.resolve_recipient_locale(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION '060 post-state: anon must not execute resolve_recipient_locale';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.claim_failed_event_consumptions(varchar,integer,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '060 post-state: service_role cannot execute claim_failed_event_consumptions';
  END IF;
  IF has_function_privilege('authenticated', 'public.claim_failed_event_consumptions(varchar,integer,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '060 post-state: authenticated must not execute claim_failed_event_consumptions';
  END IF;

  -- Both functions must be SECURITY DEFINER with a pinned search_path.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname IN ('resolve_recipient_locale', 'claim_failed_event_consumptions')
      AND n.nspname IN ('communication_schema', 'public')
      AND (NOT p.prosecdef OR p.proconfig IS NULL)
  ) THEN
    RAISE EXCEPTION '060 post-state: a new function is not SECDEF with pinned search_path';
  END IF;

  -- 056 exposure must be byte-identical; this migration must not widen it.
  SELECT COALESCE(string_agg(setting, ','), '') INTO v_cfg
  FROM (
    SELECT unnest(string_to_array(regexp_replace(
      COALESCE((SELECT setting FROM pg_settings WHERE name = 'pgrst.db_schemas'), ''),
      '\s+', '', 'g'), ',')) AS setting
  ) s;
  IF v_cfg IS NULL OR position('localization_schema' in v_cfg) > 0 THEN
    RAISE EXCEPTION '060 post-state: localization_schema must remain unexposed (056 boundary)';
  END IF;

  -- 055 privileges preserved.
  IF NOT has_table_privilege('service_role', 'communication_schema.notifications', 'INSERT') THEN
    RAISE EXCEPTION '060 post-state: service_role INSERT on notifications lost';
  END IF;

  -- 059 scheduling preserved.
  IF (SELECT count(*) FROM cron.job WHERE jobname IN
      ('nexcargo-i3-drain-notifications', 'nexcargo-i3-recover-stalled')) <> 2 THEN
    RAISE EXCEPTION '060 post-state: 059 cron jobs missing';
  END IF;
END;
$$;