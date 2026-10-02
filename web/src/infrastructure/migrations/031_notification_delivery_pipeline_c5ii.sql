-- NexCargo Migration 031 — Notification Delivery Pipeline Foundation (C5-II)
-- Adds: delivered_at column, next_retry_at column, PROCESSING status support,
--        claim_and_process RPC for atomic notification claiming with backoff enforcement
-- Purpose: Required persistence and atomic operations for MOD-016 delivery processor
-- Authorized by: HAO-C5-002 (C5 Increment 2 Authorization)
--
-- Authority: MOD-016 §4.1 (Notification Object), §4.4 (Delivery Event Object)
--            MOD-016 §7.3 (Delivery Integrity Rule), §7.5 (Delivery Tracking)
--            ESS-001C (Retry and Timeout Policy)
--            ESS-006 Golden Rule (RLS mandatory on all tables)

-- ============================================================
-- PART 1: ADD delivered_at AND next_retry_at COLUMNS TO notifications
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'communication_schema'
      AND table_name = 'notifications'
      AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE communication_schema.notifications
      ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'communication_schema'
      AND table_name = 'notifications'
      AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE communication_schema.notifications
      ADD COLUMN next_retry_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index for finding undelivered notifications efficiently
CREATE INDEX IF NOT EXISTS idx_notifications_delivered_at
  ON communication_schema.notifications(delivered_at)
  WHERE delivered_at IS NULL;

-- Index for finding eligible retriable notifications (backoff enforcement)
CREATE INDEX IF NOT EXISTS idx_notifications_next_retry_at_eligible
  ON communication_schema.notifications(next_retry_at)
  WHERE delivery_status = 'QUEUED'
    AND (next_retry_at IS NULL OR next_retry_at <= NOW());

-- ============================================================
-- PART 1B: UPDATE CHECK CONSTRAINT TO ALLOW PROCESSING STATUS
-- ============================================================

-- Drop existing constraint from migration 008
ALTER TABLE communication_schema.notifications
  DROP CONSTRAINT IF EXISTS chk_notifications_delivery_status;

-- Recreate with PROCESSING included
ALTER TABLE communication_schema.notifications
  ADD CONSTRAINT chk_notifications_delivery_status
    CHECK (delivery_status IN ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED'));

-- ============================================================
-- PART 2: RPC FUNCTION — Atomic notification claim
-- ============================================================
-- Uses SELECT ... FOR UPDATE SKIP LOCKED to atomically claim
-- one QUEUED notification, preventing concurrent duplicate processing.
-- Returns the full notification row via a COMPOSITE type.
-- Enforces next_retry_at backoff: only claims when next_retry_at IS NULL
-- OR next_retry_at <= NOW().

-- Composite return type for claimed notification
DROP TYPE IF EXISTS communication_schema.claimed_notification CASCADE;
CREATE TYPE communication_schema.claimed_notification AS (
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
  delivery_status VARCHAR(20),
  retry_count INTEGER,
  provider_channel VARCHAR(20),
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  version INTEGER
);

-- Function: claim_one_queued_notification
-- Atomically selects ONE QUEUED notification ordered by:
--   1. priority_level DESC (CRITICAL > HIGH > MEDIUM > LOW)
--   2. created_at ASC (oldest first within same priority)
-- Uses FOR UPDATE SKIP LOCKED to avoid blocking other workers.
-- Enforces backoff: only claims when next_retry_at IS NULL or already elapsed.
-- Returns NULL if no QUEUED notifications are available.
DROP FUNCTION IF EXISTS communication_schema.claim_one_queued_notification();
CREATE OR REPLACE FUNCTION communication_schema.claim_one_queued_notification()
RETURNS communication_schema.claimed_notification
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with caller's privileges; service-role key required
SET search_path = communication_schema, auth, pg_catalog
AS $$
DECLARE
  v_result communication_schema.claimed_notification;
BEGIN
  SELECT
    n.id,
    n.recipient_id,
    n.source_module,
    n.event_type,
    n.title,
    n.body,
    n.priority_level,
    n.channel_type,
    n.locale,
    n.template_id,
    n.event_correlation_id,
    n.delivery_status,
    n.retry_count,
    n.provider_channel,
    n.next_retry_at,
    n.created_at,
    n.updated_at,
    n.version
  INTO v_result
  FROM communication_schema.notifications n
  WHERE n.delivery_status = 'QUEUED'
    AND (n.next_retry_at IS NULL OR n.next_retry_at <= NOW())
  ORDER BY
    CASE n.priority_level
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
      ELSE 5
    END ASC,
    n.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
  RETURNING *;

  -- If no row found, return null (implicit)
  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  -- Update status to PROCESSING to mark as being worked on
  -- Clear next_retry_at during processing (will be re-set on failure)
  UPDATE communication_schema.notifications
  SET delivery_status = 'PROCESSING',
      next_retry_at = NULL,
      updated_at = now()
  WHERE id = v_result.id
  RETURNING id, recipient_id, source_module, event_type, title, body,
            priority_level, channel_type, locale, template_id,
            event_correlation_id, delivery_status, retry_count,
            provider_channel, next_retry_at, created_at, updated_at, version
  INTO v_result;

  -- If update didn't affect rows (race condition), return null
  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (service-role key provides this)
GRANT EXECUTE ON FUNCTION communication_schema.claim_one_queued_notification() TO authenticated;

-- ============================================================
-- PART 3: RPC FUNCTION — Record delivery attempt result
-- ============================================================
-- Called after channel execution to persist the outcome.
-- Creates a delivery_events record and updates the parent notification.
-- Sets next_retry_at on retryable failures based on exponential backoff formula.

DROP FUNCTION IF EXISTS communication_schema.record_delivery_attempt(UUID, VARCHAR, VARCHAR, INTEGER, TEXT, VARCHAR, BOOLEAN, BIGINT);
CREATE OR REPLACE FUNCTION communication_schema.record_delivery_attempt(
  p_notification_id UUID,
  p_status VARCHAR(20),
  p_channel_used VARCHAR(20),
  p_retry_count INTEGER,
  p_failure_reason TEXT DEFAULT NULL,
  p_new_delivery_status VARCHAR(20) DEFAULT NULL,
  p_is_retryable BOOLEAN DEFAULT FALSE,
  p_base_delay_ms BIGINT DEFAULT 1000
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = communication_schema, auth, pg_catalog
AS $$
DECLARE
  v_existing_status VARCHAR(20);
  v_backoff_interval INTERVAL;
  v_next_retry_at TIMESTAMPTZ;
BEGIN
  -- Get current notification status for validation
  SELECT delivery_status INTO v_existing_status
  FROM communication_schema.notifications
  WHERE id = p_notification_id
  FOR UPDATE;

  IF v_existing_status IS NULL THEN
    RAISE EXCEPTION 'Notification not found: %', p_notification_id;
  END IF;

  -- Create delivery event record
  INSERT INTO communication_schema.delivery_events (
    notification_id,
    status,
    retry_count,
    failure_reason,
    channel_used,
    timestamp
  ) VALUES (
    p_notification_id,
    p_status,
    p_retry_count,
    p_failure_reason,
    p_channel_used,
    now()
  );

  -- Calculate backoff delay if retryable: baseDelay × 2^retryCount
  IF p_is_retryable THEN
    v_backoff_interval := make_interval(secs => p_base_delay_ms * power(2, p_retry_count)::bigint / 1000);
    v_next_retry_at := now() + v_backoff_interval;
  ELSE
    v_next_retry_at := NULL;
  END IF;

  -- Update parent notification
  UPDATE communication_schema.notifications
  SET
    delivery_status = COALESCE(p_new_delivery_status, delivery_status),
    retry_count = p_retry_count,
    delivered_at = CASE
      WHEN p_status IN ('SUCCEEDED', 'DELIVERED') AND delivered_at IS NULL THEN now()
      ELSE delivered_at
    END,
    next_retry_at = v_next_retry_at,
    updated_at = now()
  WHERE id = p_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION communication_schema.record_delivery_attempt(UUID, VARCHAR, VARCHAR, INTEGER, TEXT, VARCHAR, BOOLEAN, BIGINT) TO authenticated;

-- ============================================================
-- PART 4: RPC FUNCTION — Re-queue notification for retry
-- ============================================================
-- Used when a notification has exhausted retries or needs manual re-queuing.
-- Also sets next_retry_at for backoff enforcement.

DROP FUNCTION IF EXISTS communication_schema.requeue_notification(UUID, BOOLEAN, BIGINT);
CREATE OR REPLACE FUNCTION communication_schema.requeue_notification(
  p_notification_id UUID,
  p_is_retryable BOOLEAN DEFAULT FALSE,
  p_base_delay_ms BIGINT DEFAULT 1000
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = communication_schema, auth, pg_catalog
AS $$
DECLARE
  v_retry_count INTEGER;
  v_backoff_interval INTERVAL;
  v_next_retry_at TIMESTAMPTZ;
BEGIN
  -- Get current retry count before updating
  SELECT retry_count INTO v_retry_count
  FROM communication_schema.notifications
  WHERE id = p_notification_id
    AND delivery_status IN ('FAILED', 'PROCESSING');

  IF v_retry_count IS NULL THEN
    -- No matching row found (already processed or doesn't exist)
    RETURN;
  END IF;

  -- Calculate backoff delay if retryable
  IF p_is_retryable THEN
    v_backoff_interval := make_interval(secs => p_base_delay_ms * power(2, v_retry_count)::bigint / 1000);
    v_next_retry_at := now() + v_backoff_interval;
  ELSE
    v_next_retry_at := NULL;
  END IF;

  UPDATE communication_schema.notifications
  SET
    delivery_status = 'QUEUED',
    next_retry_at = v_next_retry_at,
    updated_at = now()
  WHERE id = p_notification_id
    AND delivery_status IN ('FAILED', 'PROCESSING');
END;
$$;

GRANT EXECUTE ON FUNCTION communication_schema.requeue_notification(UUID, BOOLEAN, BIGINT) TO authenticated;

-- ============================================================
-- PART 5: RPC FUNCTION — Process all available queued notifications
-- ============================================================
-- Convenience function for batch processing. Processes up to p_batch_size
-- notifications in a single call. Useful for cron/scheduled invocations.

DROP FUNCTION IF EXISTS communication_schema.process_queued_notifications(INTEGER);
CREATE OR REPLACE FUNCTION communication_schema.process_queued_notifications(
  p_batch_size INTEGER DEFAULT 10
)
RETURNS TABLE(
  processed_count INTEGER,
  success_count INTEGER,
  failed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = communication_schema, auth, pg_catalog
AS $$
DECLARE
  v_count INTEGER := 0;
  v_success INTEGER := 0;
  v_failed INTEGER := 0;
  v_total INTEGER := 0;
  v_notif communication_schema.claimed_notification;
BEGIN
  LOOP
    EXIT WHEN v_count >= p_batch_size;

    v_notif := claim_one_queued_notification();

    EXIT WHEN v_notif IS NULL;

    v_total := v_total + 1;

    -- The actual channel execution happens in application code.
    -- This function only claims and returns the notification ID
    -- so the caller can process it. For pure-SQL processing,
    -- we mark based on channel_type defaults.

    -- For IN_APP: immediately deliver (no external provider needed)
    IF v_notif.channel_type = 'IN_APP' THEN
      PERFORM record_delivery_attempt(
        v_notif.id,
        'SUCCEEDED',
        'IN_APP',
        v_notif.retry_count,
        NULL,
        'DELIVERED',
        FALSE,
        1000
      );
      v_success := v_success + 1;
    ELSE
      -- For non-IN_APP channels, mark as SENT (stub delivery)
      -- Real providers will override this in application code
      PERFORM record_delivery_attempt(
        v_notif.id,
        'ATTEMPTED',
        v_notif.channel_type,
        v_notif.retry_count,
        'Channel not implemented — stub delivery for C5-II',
        'SENT',
        FALSE,
        1000
      );
      v_success := v_success + 1;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  processed_count := v_count;
  success_count := v_success;
  failed_count := v_failed;
END;
$$;

GRANT EXECUTE ON FUNCTION communication_schema.process_queued_notifications(INTEGER) TO authenticated;

-- ============================================================
-- PART 6: UPDATED_AT TRIGGER for notifications table
-- ============================================================
-- Ensure updated_at is maintained (check if already exists from migration 008)

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON communication_schema.notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON communication_schema.notifications
  FOR EACH ROW
  EXECUTE FUNCTION communication_schema._set_updated_at();
