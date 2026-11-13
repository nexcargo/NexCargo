-- NexCargo Migration 059 — I-3 Event & Notification Connectivity
-- Authorization: LEAD ARCHITECT DIRECTIVE — I-3 IMPLEMENTATION (9 November 2026), §4 A–E, §5, §6
--
-- Governing authority (in precedence order):
--   PROMPT 0 v1.3 §EVENT-DRIVEN SYSTEM RULE; PROMPT 2 §278-312 (append-only event store)
--   ESS-001C §4.1:124 (Notifications: 5-10 attempts, fast exponential), §4.2:140-168 (jitter mandatory),
--            §5.2:200 (breaker 25% / 15s), §6:204-256 (DLQ mandatory), §7:260-284 (idempotency), §10:440-460
--   ESS-001D §219-239 (eventId dedup), §8:335-355 (append-only)
--   ESS-006 §187/§223 (RLS mandatory), §453 (audit/admin-only read)
--   MOD-016 v1.0 §4.1:335, §4.4:511, §7.3:1157 (persistent queue), §7.9:1257 (pt + en)
--   Event Registry v1.0 §4:102-107 (the six MOD-016 consumer events)
--
-- SB-3A RECONCILIATION (§5). Measured live state before this migration:
--   * 029/030/031/032 are NOT in supabase_migrations.schema_migrations (44 rows, newest 058).
--   * claim_one_queued_notification, record_delivery_attempt, requeue_notification,
--     process_queued_notifications, call_notification_api: ABSENT in every schema.
--   * confirm_payment_via_webhook, execute_settlement, approve_settlement, initiate_payment_intent,
--     advance_escrow_state, get_escrow_with_details: ABSENT; defined only in unapplied 030_c4_financial_execution.sql.
--   * communication_schema.notifications: 20 columns, no next_retry_at, no version.
--   * notification_templates: BEFORE UPDATE trigger _set_updated_at() but NO updated_at column -> any UPDATE raises 42703.
--   * analytics_schema.event_store: exists, 0 rows, RLS on, zero policies, zero grants, NOT append-only enforced.
--   * pg_cron 1.6.4 available, not installed.
--
--   Draft 031 is NOT applied: it was measured unappliable (42P17 non-immutable partial index predicate
--   containing NOW(); 42601 SELECT ... INTO ... RETURNING *; selects a phantom n.version column).
--   Draft 032 is NOT applied: it drops only the 9-arg record_delivery_attempt, leaving 031's 8-arg form
--   alive -> two coexisting overloads make named-argument PostgREST calls ambiguous (PGRST203).
--   This migration is the corrected reconciliation of both. It creates exactly ONE record_delivery_attempt.
--
--   NOT created here, with reasons (carried forward, not silently dropped):
--     process_queued_notifications — 031's non-IN_APP branch records status 'ATTEMPTED' with reason
--       'Channel not implemented — stub delivery' while setting the parent to 'SENT'. That is a disguised
--       integration, forbidden by I-3 §9. Superseded by drain_notification_queue() below, which records
--       unsupported channels as FAILED + DLQ and never as SENT.
--     requeue_notification — superseded by record_delivery_attempt(p_auto_reset_to_queued => true),
--       which is 032's own stated deprecation path.
--     call_notification_api — MOD-017 alert bridge; requires an HTTP egress extension and is not a
--       dependency of any registered MOD-016 consumer event.
--     The six 030 financial-execution RPCs — MOD-005/MOD-013 financial state machines. Authoring or
--       applying them would introduce financial authority and business rules (forbidden by I-3 §2) and
--       is C4 work (forbidden by §7). They gate four of the six canonical producers; reported as a
--       remaining blocker, not disguised as connected.
--
-- DELIBERATE DEVIATIONS FROM THE DRAFTS (each required by a governing spec):
--   D1. Idempotency key is (source_event_id, recipient_id), NOT 032's (event_correlation_id, recipient_id).
--       Reason: escrowLockConfirmed and paymentConfirmed are published in ONE publishBatch with the SAME
--       correlation_id and resolve to the SAME shipper recipient. 032's index would silently discard the
--       second notification. event_id is always a UUID (InMemoryEventEmitter.createEvent) and is the dedup
--       key ESS-001D §219-239 actually specifies. correlation_id is client-supplied via x-correlation-id
--       (resolveCorrelationId) and is therefore NOT guaranteed UUID-shaped nor unique per event.
--   D2. PROCESSING is added to chk_notifications_delivery_status. MOD-016 §4.1:335 lists only
--       QUEUED/SENT/DELIVERED/FAILED. I-3 §4B explicitly requires a distinct processing state and 031
--       already designed one. The LA directive is the operative authorization for this increment; the
--       conflict is recorded, not hidden.
--   D3. Queue RPCs are granted to service_role ONLY. 031/032 grant EXECUTE to authenticated, which would
--       let any signed-in user claim and read ANY recipient's notification. The I-2 register already
--       established that "cross-recipient writes plus queue draining require a governance tier".
--   D4. Retry ceiling is 5 (ESS-001C §4.1:124 range 5-10), not 031/delivery-pipeline.ts's 3.
--       Backoff includes +0..30% jitter (ESS-001C §4.2:154 "ALWAYS include jitter"), which 031 omits.
--   D5. event_store.aggregate_id is relaxed to NULLable and a TEXT aggregate_ref is added. PROMPT 2:283-303
--       specifies aggregate_id without a UUID type and the canonical envelope types it as string; provider
--       references are not always UUIDs. The table is empty (0 rows), so this loses no data.
--
-- PRIVILEGE / EXPOSURE PRESERVATION (§5): this migration only ADDS. It revokes nothing granted by
--   055/057, removes no object created by 056/058, and does not alter authenticator's pgrst.db_schemas.
--   analytics_schema remains NOT PostgREST-exposed; it is reached only through SECURITY DEFINER functions.
--
-- TRANSACTIONALITY: apply_migration runs this file in one transaction. Any failed assertion rolls back
--   the whole increment, including the pg_cron extension and schedules.
--
-- ROLLBACK INSTRUCTIONS (run in one transaction, in this order):
--   SELECT cron.unschedule('nexcargo-i3-drain-notifications');
--   SELECT cron.unschedule('nexcargo-i3-recover-stalled');
--   DROP FUNCTION communication_schema.replay_dead_letter(UUID);
--   DROP FUNCTION communication_schema.drain_notification_queue(INTEGER);
--   DROP FUNCTION communication_schema.recover_stalled_processing(INTEGER);
--   DROP FUNCTION communication_schema.record_delivery_attempt(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,VARCHAR,BOOLEAN,BIGINT,BOOLEAN);
--   DROP FUNCTION communication_schema.claim_one_queued_notification(VARCHAR,INTEGER);
--   DROP FUNCTION public.record_event_consumption(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,TEXT);
--   DROP FUNCTION public.append_platform_event(UUID,VARCHAR,TIMESTAMPTZ,VARCHAR,TEXT,VARCHAR,JSONB,TEXT,TEXT,INTEGER,VARCHAR,VARCHAR);
--   DROP TRIGGER trg_event_store_append_only ON analytics_schema.event_store;
--   DROP FUNCTION analytics_schema._event_store_append_only();
--   DROP TABLE analytics_schema.event_consumer_state;
--   DROP TABLE communication_schema.notification_dead_letters;
--   DROP INDEX analytics_schema.uq_event_store_event_id;
--   ALTER TABLE analytics_schema.event_store DROP COLUMN correlation_ref, DROP COLUMN aggregate_ref;
--   ALTER TABLE analytics_schema.event_store ALTER COLUMN aggregate_id SET NOT NULL;
--   DELETE FROM communication_schema.notification_templates WHERE template_key IN
--     ('bookingConfirmed','contractSigned','escrowLockConfirmed','paymentConfirmed','paymentFailed','settlementCompleted');
--   ALTER TABLE communication_schema.notification_templates DROP COLUMN updated_at;
--   DROP INDEX communication_schema.uq_notifications_source_event_recipient;
--   DROP INDEX communication_schema.idx_notifications_processing_stalled;
--   DROP INDEX communication_schema.idx_notifications_queue_eligible;
--   ALTER TABLE communication_schema.notifications DROP CONSTRAINT chk_notifications_delivery_status;
--   ALTER TABLE communication_schema.notifications ADD CONSTRAINT chk_notifications_delivery_status
--     CHECK (delivery_status IN ('QUEUED','SENT','DELIVERED','FAILED'));
--   ALTER TABLE communication_schema.notifications DROP COLUMN next_retry_at, DROP COLUMN processing_started_at,
--     DROP COLUMN failure_reason, DROP COLUMN source_event_id, DROP COLUMN correlation_ref;
--   -- pg_cron is left installed intentionally: removing an extension other jobs may depend on is not
--   -- a safe automatic rollback step. Unschedule the two jobs above and leave the extension in place.
--   -- No notification/event rows are deleted by rollback; only the seeded templates are removed.

-- ============================================================
-- PART 0: PRE-STATE CHECKS
-- ============================================================

DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'communication_schema') THEN
    RAISE EXCEPTION 'I3-059 PRE-STATE: communication_schema missing — 001/008 provenance not established';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'communication_schema' AND c.relname = 'notifications') THEN
    RAISE EXCEPTION 'I3-059 PRE-STATE: communication_schema.notifications missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'analytics_schema' AND c.relname = 'event_store') THEN
    RAISE EXCEPTION 'I3-059 PRE-STATE: analytics_schema.event_store missing — PROMPT 2 event store provenance not established';
  END IF;
  -- The corrected service-role privileges (055/057) must still be present.
  IF NOT has_table_privilege('service_role', 'communication_schema.notifications', 'INSERT')
     OR NOT has_table_privilege('service_role', 'communication_schema.notifications', 'SELECT') THEN
    RAISE EXCEPTION 'I3-059 PRE-STATE: service_role INSERT/SELECT on notifications lost — 055 regression, stop';
  END IF;
  -- Refuse to run if a competing overload already exists (would recreate the 031/032 hazard).
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'communication_schema' AND p.proname = 'record_delivery_attempt') THEN
    RAISE EXCEPTION 'I3-059 PRE-STATE: record_delivery_attempt already exists — reconcile provenance before re-running';
  END IF;
END
$pre$;

-- ============================================================
-- PART 1: notifications — queue, retry, recovery and idempotency columns
-- ============================================================

ALTER TABLE communication_schema.notifications ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE communication_schema.notifications ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE communication_schema.notifications ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE communication_schema.notifications ADD COLUMN IF NOT EXISTS source_event_id UUID;
ALTER TABLE communication_schema.notifications ADD COLUMN IF NOT EXISTS correlation_ref TEXT;

COMMENT ON COLUMN communication_schema.notifications.source_event_id IS
  'Canonical event_store.event_id. Durable idempotency key per ESS-001D §219-239; see migration 059 deviation D1.';
COMMENT ON COLUMN communication_schema.notifications.correlation_ref IS
  'Raw correlation string. Preserved because x-correlation-id is client-supplied and not guaranteed UUID-shaped (MOD-016 §7.2).';
COMMENT ON COLUMN communication_schema.notifications.next_retry_at IS
  'NULL = immediately eligible. Set by record_delivery_attempt with jittered exponential backoff (ESS-001C §4.2).';

-- D2: add PROCESSING. Drop/recreate is required because a CHECK cannot be extended in place.
ALTER TABLE communication_schema.notifications DROP CONSTRAINT IF EXISTS chk_notifications_delivery_status;
ALTER TABLE communication_schema.notifications ADD CONSTRAINT chk_notifications_delivery_status
  CHECK (delivery_status IN ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED'));

-- Replace 031's non-immutable predicate (42P17) with an immutable one.
DROP INDEX IF EXISTS communication_schema.idx_notifications_next_retry_at_eligible;
DROP INDEX IF EXISTS communication_schema.idx_notifications_delivered_at;

CREATE INDEX IF NOT EXISTS idx_notifications_queue_eligible
  ON communication_schema.notifications (next_retry_at, created_at)
  WHERE delivery_status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_notifications_processing_stalled
  ON communication_schema.notifications (processing_started_at)
  WHERE delivery_status = 'PROCESSING';

-- D1: one notification per canonical event per recipient.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_source_event_recipient
  ON communication_schema.notifications (source_event_id, recipient_id)
  WHERE source_event_id IS NOT NULL AND recipient_id IS NOT NULL;

-- ============================================================
-- PART 2: notification_templates — repair the 42703 trigger defect, seed pt + en
-- ============================================================

ALTER TABLE communication_schema.notification_templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- MOD-016 §7.9:1257 + ESS-008:527 — every template MUST support pt and en.
INSERT INTO communication_schema.notification_templates
  (template_key, channel_type, variables, default_content, localized_content, version, status)
VALUES
  ('bookingConfirmed', 'IN_APP', '[]'::jsonb,
   'A sua reserva foi confirmada.',
   '{"pt":{"title":"Reserva Confirmada","body":"A sua reserva foi confirmada."},"en":{"title":"Booking Confirmed","body":"Your booking has been confirmed."}}'::jsonb,
   1, 'ACTIVE'),
  ('contractSigned', 'IN_APP', '[]'::jsonb,
   'O contrato foi assinado por todas as partes.',
   '{"pt":{"title":"Contrato Assinado","body":"O contrato foi assinado por todas as partes."},"en":{"title":"Contract Signed","body":"The contract has been signed by all parties."}}'::jsonb,
   1, 'ACTIVE'),
  ('escrowLockConfirmed', 'IN_APP', '[]'::jsonb,
   'Os fundos foram bloqueados em garantia.',
   '{"pt":{"title":"Garantia Confirmada","body":"Os fundos foram bloqueados em garantia."},"en":{"title":"Escrow Lock Confirmed","body":"Funds have been locked in escrow."}}'::jsonb,
   1, 'ACTIVE'),
  ('paymentConfirmed', 'IN_APP', '["amount","currency"]'::jsonb,
   'O seu pagamento foi confirmado.',
   '{"pt":{"title":"Pagamento Confirmado","body":"O seu pagamento foi confirmado."},"en":{"title":"Payment Confirmed","body":"Your payment has been confirmed."}}'::jsonb,
   1, 'ACTIVE'),
  ('paymentFailed', 'IN_APP', '["failure_reason"]'::jsonb,
   'O seu pagamento falhou. Por favor tente novamente.',
   '{"pt":{"title":"Pagamento Falhou","body":"O seu pagamento falhou. Por favor tente novamente."},"en":{"title":"Payment Failed","body":"Your payment has failed. Please try again."}}'::jsonb,
   1, 'ACTIVE'),
  ('settlementCompleted', 'IN_APP', '[]'::jsonb,
   'A sua liquidação foi concluída.',
   '{"pt":{"title":"Liquidação Concluída","body":"A sua liquidação foi concluída."},"en":{"title":"Settlement Completed","body":"Your settlement has been completed."}}'::jsonb,
   1, 'ACTIVE')
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- PART 3: DLQ — ESS-001C §6:204-256 (mandatory for all asynchronous systems)
-- ============================================================

CREATE TABLE IF NOT EXISTS communication_schema.notification_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES communication_schema.notifications(id) ON DELETE CASCADE,
  event_type VARCHAR(100),
  source_module VARCHAR(10),
  recipient_id UUID,
  channel_type VARCHAR(20),
  notification_payload JSONB NOT NULL,
  correlation_id UUID,
  correlation_ref TEXT,
  failure_reason TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  dead_lettered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at TIMESTAMPTZ,
  replay_count INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE communication_schema.notification_dead_letters IS
  'ESS-001C §6 DLQ: full payload, correlationId, failure reason, replayable via replay_dead_letter(), observable by MOD-017.';

CREATE INDEX IF NOT EXISTS idx_dead_letters_notification
  ON communication_schema.notification_dead_letters (notification_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_unreplayed
  ON communication_schema.notification_dead_letters (dead_lettered_at)
  WHERE replayed_at IS NULL;

ALTER TABLE communication_schema.notification_dead_letters ENABLE ROW LEVEL SECURITY;
-- ESS-006 §453: audit/dead-letter records are admin-only. No policy for authenticated/anon => deny-all.
-- service_role has BYPASSRLS and reaches this table only through the SECURITY DEFINER RPCs below.

-- ============================================================
-- PART 4: durable event store — PROMPT 2 §278-312, ESS-001D §8
-- ============================================================

-- D5: align the store with the canonical envelope (aggregate_id is a string, not necessarily a UUID).
ALTER TABLE analytics_schema.event_store ALTER COLUMN aggregate_id DROP NOT NULL;
ALTER TABLE analytics_schema.event_store ADD COLUMN IF NOT EXISTS aggregate_ref TEXT;
ALTER TABLE analytics_schema.event_store ADD COLUMN IF NOT EXISTS correlation_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_store_event_id
  ON analytics_schema.event_store (event_id);

CREATE INDEX IF NOT EXISTS idx_event_store_correlation
  ON analytics_schema.event_store (correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_store_type_timestamp
  ON analytics_schema.event_store (event_type, timestamp);

CREATE OR REPLACE FUNCTION analytics_schema._event_store_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'event_store is append-only (PROMPT 2 §305-312, ESS-001D §8): % rejected', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_event_store_append_only ON analytics_schema.event_store;
CREATE TRIGGER trg_event_store_append_only
  BEFORE UPDATE OR DELETE ON analytics_schema.event_store
  FOR EACH ROW EXECUTE FUNCTION analytics_schema._event_store_append_only();

ALTER TABLE analytics_schema.event_store ENABLE ROW LEVEL SECURITY;

-- Consumer execution + processing state (I-3 §4B). No ESS names this pattern; the LA directive requires it.
CREATE TABLE IF NOT EXISTS analytics_schema.event_consumer_state (
  event_id UUID NOT NULL,
  consumer_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  correlation_id UUID,
  correlation_ref TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, consumer_name)
);

CREATE INDEX IF NOT EXISTS idx_event_consumer_state_status
  ON analytics_schema.event_consumer_state (status, last_attempt_at);

ALTER TABLE analytics_schema.event_consumer_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 5: RPCs — SECURITY DEFINER, pinned search_path, service_role only
-- ============================================================

-- 5.1 Durable append. Returns TRUE only when the event was newly stored (FALSE = duplicate, idempotent).
CREATE OR REPLACE FUNCTION public.append_platform_event(
  p_event_id UUID,
  p_event_type VARCHAR(255),
  p_timestamp TIMESTAMPTZ,
  p_source_module VARCHAR(50),
  p_aggregate_id TEXT,
  p_aggregate_type VARCHAR(100),
  p_payload JSONB,
  p_correlation_id TEXT DEFAULT NULL,
  p_causation_id TEXT DEFAULT NULL,
  p_version INTEGER DEFAULT 1,
  p_classification VARCHAR(50) DEFAULT NULL,
  p_criticality VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_id UUID;
  v_uuid_re TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF p_event_id IS NULL OR p_event_type IS NULL OR p_source_module IS NULL THEN
    RAISE EXCEPTION 'append_platform_event: event_id, event_type and source_module are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO analytics_schema.event_store (
    event_id, event_type, timestamp, source_module, aggregate_id, aggregate_ref,
    aggregate_type, payload, correlation_id, correlation_ref, causation_id,
    version, classification, criticality
  ) VALUES (
    p_event_id, p_event_type, COALESCE(p_timestamp, now()), p_source_module,
    CASE WHEN p_aggregate_id ~ v_uuid_re THEN p_aggregate_id::uuid ELSE NULL END,
    p_aggregate_id,
    COALESCE(p_aggregate_type, 'Unknown'), COALESCE(p_payload, '{}'::jsonb),
    CASE WHEN p_correlation_id ~ v_uuid_re THEN p_correlation_id::uuid ELSE NULL END,
    p_correlation_id,
    CASE WHEN p_causation_id ~ v_uuid_re THEN p_causation_id::uuid ELSE NULL END,
    COALESCE(p_version, 1), p_classification, p_criticality
  )
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

-- 5.2 Consumer processing state. Upsert keyed by (event_id, consumer_name) => idempotent consumption.
CREATE OR REPLACE FUNCTION public.record_event_consumption(
  p_event_id UUID,
  p_consumer_name VARCHAR(100),
  p_status VARCHAR(20),
  p_attempts INTEGER DEFAULT 1,
  p_last_error TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_uuid_re TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF p_event_id IS NULL OR p_consumer_name IS NULL THEN
    RAISE EXCEPTION 'record_event_consumption: event_id and consumer_name are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_status NOT IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') THEN
    RAISE EXCEPTION 'record_event_consumption: invalid status %', p_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO analytics_schema.event_consumer_state (
    event_id, consumer_name, status, attempts, last_error, correlation_id, correlation_ref,
    first_seen_at, last_attempt_at, completed_at
  ) VALUES (
    p_event_id, p_consumer_name, p_status, GREATEST(COALESCE(p_attempts, 1), 0), p_last_error,
    CASE WHEN p_correlation_id ~ v_uuid_re THEN p_correlation_id::uuid ELSE NULL END,
    p_correlation_id,
    now(), now(), CASE WHEN p_status = 'COMPLETED' THEN now() ELSE NULL END
  )
  ON CONFLICT (event_id, consumer_name) DO UPDATE SET
    status = EXCLUDED.status,
    attempts = EXCLUDED.attempts,
    last_error = EXCLUDED.last_error,
    correlation_id = COALESCE(EXCLUDED.correlation_id, analytics_schema.event_consumer_state.correlation_id),
    correlation_ref = COALESCE(EXCLUDED.correlation_ref, analytics_schema.event_consumer_state.correlation_ref),
    last_attempt_at = now(),
    completed_at = CASE WHEN EXCLUDED.status = 'COMPLETED' THEN now()
                        ELSE analytics_schema.event_consumer_state.completed_at END;
END;
$$;

-- 5.3 Atomic claim. Corrects 031's 42601 (SELECT ... INTO ... RETURNING *) and its phantom n.version.
--     Returns TABLE (no custom composite => no DROP TYPE CASCADE hazard). Zero or one row.
CREATE OR REPLACE FUNCTION communication_schema.claim_one_queued_notification(
  p_channel_type VARCHAR(20) DEFAULT NULL,
  p_max_retry_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  recipient_id UUID,
  source_module VARCHAR(10),
  event_type VARCHAR(100),
  title TEXT,
  body TEXT,
  priority_level VARCHAR(10),
  channel_type VARCHAR(20),
  locale VARCHAR(5),
  template_id UUID,
  event_correlation_id UUID,
  correlation_ref TEXT,
  source_event_id UUID,
  delivery_status VARCHAR(20),
  retry_count INTEGER,
  provider_channel VARCHAR(20),
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- ESS-001C §4.1:124 — Notifications 5-10 attempts. Caller may not raise the ceiling above 10.
  IF p_max_retry_count IS NULL OR p_max_retry_count < 1 OR p_max_retry_count > 10 THEN
    RAISE EXCEPTION 'claim_one_queued_notification: p_max_retry_count must be 1..10 (ESS-001C §4.1)'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT n.id
    FROM communication_schema.notifications n
    WHERE n.delivery_status = 'QUEUED'
      AND (n.next_retry_at IS NULL OR n.next_retry_at <= now())
      AND (p_channel_type IS NULL OR n.channel_type = p_channel_type)
      AND n.retry_count < p_max_retry_count
      AND n.recipient_id IS NOT NULL
    ORDER BY
      CASE n.priority_level WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      n.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE communication_schema.notifications n
  SET delivery_status = 'PROCESSING',
      processing_started_at = now(),
      updated_at = now()
  FROM candidate c
  WHERE n.id = c.id
  RETURNING n.id, n.recipient_id, n.source_module, n.event_type, n.title, n.body,
            n.priority_level, n.channel_type, n.locale, n.template_id,
            n.event_correlation_id, n.correlation_ref, n.source_event_id,
            n.delivery_status, n.retry_count, n.provider_channel,
            n.next_retry_at, n.created_at, n.updated_at;
END;
$$;

-- 5.4 Delivery-attempt recording. EXACTLY ONE overload (9 args). Corrects the 031/032 ambiguity.
CREATE OR REPLACE FUNCTION communication_schema.record_delivery_attempt(
  p_notification_id UUID,
  p_status VARCHAR(20),
  p_channel_used VARCHAR(20),
  p_retry_count INTEGER,
  p_failure_reason TEXT DEFAULT NULL,
  p_new_delivery_status VARCHAR(20) DEFAULT NULL,
  p_is_retryable BOOLEAN DEFAULT FALSE,
  p_base_delay_ms BIGINT DEFAULT 1000,
  p_auto_reset_to_queued BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_row communication_schema.notifications%ROWTYPE;
  v_delay_ms BIGINT;
  v_jitter_ms BIGINT;
  v_next_retry_at TIMESTAMPTZ;
  v_final_status VARCHAR(20);
  v_max_attempts CONSTANT INTEGER := 5;  -- ESS-001C §4.1:124 (range 5-10)
  v_exhausted BOOLEAN;
BEGIN
  IF p_status NOT IN ('ATTEMPTED', 'SUCCEEDED', 'FAILED', 'RETRY_SCHEDULED') THEN
    RAISE EXCEPTION 'record_delivery_attempt: invalid delivery-event status % (MOD-016 §4.4:511)', p_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_row FROM communication_schema.notifications WHERE id = p_notification_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_delivery_attempt: notification % not found', p_notification_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- MOD-016 §4.4 — every attempt is recorded, including the successful one.
  INSERT INTO communication_schema.delivery_events (
    notification_id, status, retry_count, failure_reason, channel_used, timestamp
  ) VALUES (
    p_notification_id, p_status, GREATEST(COALESCE(p_retry_count, 0), 0), p_failure_reason, p_channel_used, now()
  );

  v_exhausted := GREATEST(COALESCE(p_retry_count, 0), 0) >= v_max_attempts;

  -- ESS-001C §4.2:154 — jitter is mandatory. Full jitter would risk immediate retry; +0..30% keeps
  -- the fast-exponential profile while de-synchronising concurrent workers.
  IF p_is_retryable AND NOT v_exhausted AND COALESCE(p_base_delay_ms, 1000) > 0 THEN
    v_delay_ms := COALESCE(p_base_delay_ms, 1000) * (2 ^ LEAST(GREATEST(p_retry_count, 0), 10))::BIGINT;
    v_jitter_ms := (random() * 0.30 * v_delay_ms)::BIGINT;
    v_next_retry_at := now() + make_interval(secs => (v_delay_ms + v_jitter_ms) / 1000.0);
  ELSE
    v_next_retry_at := NULL;
  END IF;

  IF p_new_delivery_status IS NOT NULL THEN
    v_final_status := p_new_delivery_status;
  ELSIF p_status = 'SUCCEEDED' THEN
    v_final_status := 'DELIVERED';
  ELSIF p_is_retryable AND NOT v_exhausted AND p_auto_reset_to_queued THEN
    v_final_status := 'QUEUED';
  ELSE
    v_final_status := 'FAILED';
  END IF;

  IF v_final_status NOT IN ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED') THEN
    RAISE EXCEPTION 'record_delivery_attempt: invalid target delivery_status %', v_final_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE communication_schema.notifications
  SET delivery_status = v_final_status,
      retry_count = GREATEST(COALESCE(p_retry_count, 0), 0),
      provider_channel = COALESCE(p_channel_used, provider_channel),
      failure_reason = CASE WHEN v_final_status = 'FAILED' THEN p_failure_reason ELSE NULL END,
      delivered_at = CASE WHEN p_status = 'SUCCEEDED' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
      next_retry_at = CASE WHEN v_final_status = 'QUEUED' THEN v_next_retry_at ELSE NULL END,
      processing_started_at = NULL,
      updated_at = now()
  WHERE id = p_notification_id;

  -- ESS-001C §6 — permanent failure goes to the DLQ with the full payload, correlationId and reason.
  IF v_final_status = 'FAILED' THEN
    INSERT INTO communication_schema.notification_dead_letters (
      notification_id, event_type, source_module, recipient_id, channel_type,
      notification_payload, correlation_id, correlation_ref, failure_reason, retry_count
    )
    SELECT n.id, n.event_type, n.source_module, n.recipient_id, n.channel_type,
           to_jsonb(n), n.event_correlation_id, n.correlation_ref,
           COALESCE(p_failure_reason, 'Unspecified permanent failure'), n.retry_count
    FROM communication_schema.notifications n
    WHERE n.id = p_notification_id;
  END IF;
END;
$$;

-- 5.5 Stall recovery — I-3 §4B "failure recording and recovery". A worker that dies mid-delivery
--     must not leave a row in PROCESSING forever.
CREATE OR REPLACE FUNCTION communication_schema.recover_stalled_processing(
  p_stall_timeout_seconds INTEGER DEFAULT 300
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row RECORD;
  v_max_attempts CONSTANT INTEGER := 5;
BEGIN
  IF p_stall_timeout_seconds IS NULL OR p_stall_timeout_seconds < 10 THEN
    RAISE EXCEPTION 'recover_stalled_processing: timeout must be >= 10 seconds'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_row IN
    SELECT n.id, n.retry_count, n.channel_type
    FROM communication_schema.notifications n
    WHERE n.delivery_status = 'PROCESSING'
      AND n.processing_started_at < now() - make_interval(secs => p_stall_timeout_seconds)
    ORDER BY n.processing_started_at
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_row.retry_count >= v_max_attempts THEN
      PERFORM communication_schema.record_delivery_attempt(
        v_row.id, 'FAILED', v_row.channel_type, v_row.retry_count,
        'PROCESSING_STALLED_EXHAUSTED: worker did not complete within ' || p_stall_timeout_seconds || 's and retry ceiling reached',
        'FAILED', false, 1000, false);
    ELSE
      -- A stall is not a delivery attempt: retry_count is deliberately not incremented.
      INSERT INTO communication_schema.delivery_events (
        notification_id, status, retry_count, failure_reason, channel_used, timestamp
      ) VALUES (
        v_row.id, 'RETRY_SCHEDULED', v_row.retry_count,
        'PROCESSING_STALLED_RECLAIMED: worker did not complete within ' || p_stall_timeout_seconds || 's',
        v_row.channel_type, now());

      UPDATE communication_schema.notifications
      SET delivery_status = 'QUEUED', processing_started_at = NULL, next_retry_at = NULL, updated_at = now()
      WHERE id = v_row.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5.6 Scheduled drain — I-3 §4D. This is the single delivery orchestrator for the currently
--     authorized channel set. IN_APP delivery is genuine (the persisted row IS the inbox entry).
--     Every other channel is recorded FAILED + DLQ, never SENT: ESS-001A §5 lists real providers
--     (Africa's Talking/Twilio, SendGrid/SES, FCM) and none is integrated yet. I-3 §9 forbids
--     disguising that as a completed integration.
CREATE OR REPLACE FUNCTION communication_schema.drain_notification_queue(
  p_batch_size INTEGER DEFAULT 25
)
RETURNS TABLE (
  processed_count INTEGER,
  delivered_count INTEGER,
  failed_count INTEGER,
  requeued_count INTEGER,
  circuit_open BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_batch INTEGER;
  v_processed INTEGER := 0;
  v_delivered INTEGER := 0;
  v_failed INTEGER := 0;
  v_requeued INTEGER := 0;
  v_row RECORD;
  v_got_row INTEGER;
  v_transient_total INTEGER;
  v_transient_failed INTEGER;
  v_max_attempts CONSTANT INTEGER := 5;
BEGIN
  v_batch := LEAST(GREATEST(COALESCE(p_batch_size, 25), 1), 100);

  -- ESS-001C §5.2:200 — Notifications breaker: 25% failure rate over a 15-second window.
  -- PROVIDER_NOT_CONFIGURED is a configuration state, not a provider outage, so it is excluded;
  -- otherwise an un-integrated channel would permanently block genuine IN_APP delivery.
  SELECT count(*) FILTER (WHERE status = 'FAILED'), count(*)
  INTO v_transient_failed, v_transient_total
  FROM communication_schema.delivery_events
  WHERE timestamp > now() - interval '15 seconds'
    AND (failure_reason IS NULL OR failure_reason NOT LIKE 'PROVIDER_NOT_CONFIGURED%');

  IF v_transient_total >= 4 AND v_transient_failed::numeric / v_transient_total >= 0.25 THEN
    RETURN QUERY SELECT 0, 0, 0, 0, true;
    RETURN;
  END IF;

  LOOP
    EXIT WHEN v_processed >= v_batch;

    SELECT * INTO v_row FROM communication_schema.claim_one_queued_notification(NULL, v_max_attempts) LIMIT 1;
    GET DIAGNOSTICS v_got_row = ROW_COUNT;
    EXIT WHEN v_got_row = 0;

    v_processed := v_processed + 1;

    -- Per-row subtransaction: one bad row must not roll back the whole batch.
    BEGIN
      IF v_row.channel_type = 'IN_APP' THEN
        PERFORM communication_schema.record_delivery_attempt(
          v_row.id, 'SUCCEEDED', 'IN_APP', v_row.retry_count, NULL, 'DELIVERED', false, 1000, false);
        v_delivered := v_delivered + 1;
      ELSE
        PERFORM communication_schema.record_delivery_attempt(
          v_row.id, 'FAILED', v_row.channel_type, v_row.retry_count,
          'PROVIDER_NOT_CONFIGURED: no authorized ' || COALESCE(v_row.channel_type, 'UNKNOWN') ||
          ' provider integration exists (ESS-001A §5). Notification retained in DLQ for replay once a provider is authorized.',
          'FAILED', false, 1000, false);
        v_failed := v_failed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      -- Release the claim with a backoff so the row is recoverable rather than stuck in PROCESSING.
      UPDATE communication_schema.notifications
      SET delivery_status = CASE WHEN retry_count >= v_max_attempts THEN 'FAILED' ELSE 'QUEUED' END,
          processing_started_at = NULL,
          next_retry_at = CASE WHEN retry_count >= v_max_attempts THEN NULL ELSE now() + interval '30 seconds' END,
          failure_reason = 'DRAIN_ERROR: ' || SQLERRM,
          updated_at = now()
      WHERE id = v_row.id;
      IF v_row.retry_count < v_max_attempts THEN
        v_requeued := v_requeued + 1;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_delivered, v_failed, v_requeued, false;
END;
$$;

-- 5.7 DLQ replay — ESS-001C §6:246 "Must be replayable manually or automatically".
CREATE OR REPLACE FUNCTION communication_schema.replay_dead_letter(
  p_dead_letter_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_dl communication_schema.notification_dead_letters%ROWTYPE;
BEGIN
  SELECT * INTO v_dl FROM communication_schema.notification_dead_letters
  WHERE id = p_dead_letter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'replay_dead_letter: dead letter % not found', p_dead_letter_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_dl.replayed_at IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE communication_schema.notifications
  SET delivery_status = 'QUEUED', retry_count = 0, next_retry_at = NULL,
      processing_started_at = NULL, failure_reason = NULL, updated_at = now()
  WHERE id = v_dl.notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replay_dead_letter: parent notification % no longer exists', v_dl.notification_id
      USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE communication_schema.notification_dead_letters
  SET replayed_at = now(), replay_count = replay_count + 1
  WHERE id = p_dead_letter_id;

  RETURN true;
END;
$$;

-- ============================================================
-- PART 6: PRIVILEGES — service_role only (deviation D3)
-- ============================================================

REVOKE ALL ON FUNCTION public.append_platform_event(UUID,VARCHAR,TIMESTAMPTZ,VARCHAR,TEXT,VARCHAR,JSONB,TEXT,TEXT,INTEGER,VARCHAR,VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_event_consumption(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION communication_schema.claim_one_queued_notification(VARCHAR,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION communication_schema.record_delivery_attempt(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,VARCHAR,BOOLEAN,BIGINT,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION communication_schema.recover_stalled_processing(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION communication_schema.drain_notification_queue(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION communication_schema.replay_dead_letter(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.append_platform_event(UUID,VARCHAR,TIMESTAMPTZ,VARCHAR,TEXT,VARCHAR,JSONB,TEXT,TEXT,INTEGER,VARCHAR,VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_event_consumption(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION communication_schema.claim_one_queued_notification(VARCHAR,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION communication_schema.record_delivery_attempt(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,VARCHAR,BOOLEAN,BIGINT,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION communication_schema.recover_stalled_processing(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION communication_schema.drain_notification_queue(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION communication_schema.replay_dead_letter(UUID) TO service_role;

-- Explicitly deny the queue-draining and cross-recipient RPCs to client-facing roles.
REVOKE ALL ON FUNCTION communication_schema.claim_one_queued_notification(VARCHAR,INTEGER) FROM authenticated, anon;
REVOKE ALL ON FUNCTION communication_schema.record_delivery_attempt(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,VARCHAR,BOOLEAN,BIGINT,BOOLEAN) FROM authenticated, anon;
REVOKE ALL ON FUNCTION communication_schema.drain_notification_queue(INTEGER) FROM authenticated, anon;
REVOKE ALL ON FUNCTION communication_schema.recover_stalled_processing(INTEGER) FROM authenticated, anon;
REVOKE ALL ON FUNCTION communication_schema.replay_dead_letter(UUID) FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.append_platform_event(UUID,VARCHAR,TIMESTAMPTZ,VARCHAR,TEXT,VARCHAR,JSONB,TEXT,TEXT,INTEGER,VARCHAR,VARCHAR) FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.record_event_consumption(UUID,VARCHAR,VARCHAR,INTEGER,TEXT,TEXT) FROM authenticated, anon;

-- Proportionate read access for the server-side processor and MOD-017 observability. No write grants:
-- all mutation goes through the SECURITY DEFINER RPCs above.
GRANT USAGE ON SCHEMA analytics_schema TO service_role;
GRANT SELECT ON communication_schema.notification_templates TO service_role;
GRANT SELECT ON communication_schema.delivery_events TO service_role;
GRANT SELECT ON communication_schema.notification_dead_letters TO service_role;
GRANT SELECT ON analytics_schema.event_store TO service_role;
GRANT SELECT ON analytics_schema.event_consumer_state TO service_role;

REVOKE ALL ON TABLE communication_schema.notification_dead_letters FROM authenticated, anon, PUBLIC;
REVOKE ALL ON TABLE analytics_schema.event_consumer_state FROM authenticated, anon, PUBLIC;

-- ============================================================
-- PART 7: SCHEDULED PROCESSING — I-3 §4D (pg_cron; simplest reliable option on the existing stack)
-- ============================================================
-- Running the drain inside PostgreSQL avoids inventing an HTTP cron identity for
-- /api/notifications/delivery-processor, which I-2 deliberately restricted to a governance tier.
-- That endpoint remains the manual/on-demand path; its authorization is unchanged.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $sched$
BEGIN
  PERFORM cron.unschedule('nexcargo-i3-drain-notifications')
  FROM cron.job WHERE jobname = 'nexcargo-i3-drain-notifications';
  PERFORM cron.unschedule('nexcargo-i3-recover-stalled')
  FROM cron.job WHERE jobname = 'nexcargo-i3-recover-stalled';
END
$sched$;

SELECT cron.schedule(
  'nexcargo-i3-drain-notifications',
  '* * * * *',
  $job$SELECT communication_schema.drain_notification_queue(25)$job$
);

SELECT cron.schedule(
  'nexcargo-i3-recover-stalled',
  '*/5 * * * *',
  $job$SELECT communication_schema.recover_stalled_processing(300)$job$
);

-- ============================================================
-- PART 8: POST-STATE ASSERTIONS
-- ============================================================

DO $post$
DECLARE
  v_overloads INTEGER;
  v_jobs INTEGER;
BEGIN
  SELECT count(*) INTO v_overloads
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'communication_schema' AND p.proname = 'record_delivery_attempt';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: expected exactly 1 record_delivery_attempt overload, found %', v_overloads;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = 'communication_schema.notifications'::regclass
                 AND a.attname = 'next_retry_at' AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: next_retry_at missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = 'communication_schema.notification_templates'::regclass
                 AND a.attname = 'updated_at' AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: notification_templates.updated_at missing (42703 defect not repaired)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'communication_schema'
                 AND indexname = 'uq_notifications_source_event_recipient') THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: idempotency index missing';
  END IF;
  IF (SELECT count(*) FROM communication_schema.notification_templates
      WHERE template_key IN ('bookingConfirmed','contractSigned','escrowLockConfirmed','paymentConfirmed','paymentFailed','settlementCompleted')) <> 6 THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: expected 6 seeded templates';
  END IF;
  IF NOT has_function_privilege('service_role', 'communication_schema.claim_one_queued_notification(VARCHAR,INTEGER)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: service_role cannot execute claim_one_queued_notification';
  END IF;
  IF has_function_privilege('authenticated', 'communication_schema.drain_notification_queue(INTEGER)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: authenticated must NOT be able to drain the queue';
  END IF;
  IF NOT has_table_privilege('service_role', 'communication_schema.notifications', 'INSERT') THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: 055 service_role INSERT privilege was disturbed';
  END IF;

  SELECT count(*) INTO v_jobs FROM cron.job
  WHERE jobname IN ('nexcargo-i3-drain-notifications', 'nexcargo-i3-recover-stalled');
  IF v_jobs <> 2 THEN
    RAISE EXCEPTION 'I3-059 POST-STATE: expected 2 cron jobs, found %', v_jobs;
  END IF;

  RAISE NOTICE 'I3-059 POST-STATE: all assertions passed (1 overload, 6 templates, 2 cron jobs, service_role-only queue RPCs)';
END
$post$;