-- NexCargo Migration 032 — Notification Idempotency & Retry Atomicity (C5-III)
-- H1: Extends record_delivery_attempt() for atomic retry/terminal transitions
--     Eliminates two-RPC dependency that could leave notifications stuck in PROCESSING.
-- H2: Adds partial unique index to prevent duplicate notifications for the same
--     logical event/recipient combination (event_correlation_id + recipient_id).
--
-- Authority: C5-003 Authorization (HAO-C5-003)
-- Dependencies: Migration 031 (delivery pipeline foundation)
--               Migration 008 (notifications base schema)

-- ============================================================
-- PART 1: EXTEND record_delivery_attempt() FOR ATOMIC TRANSITIONS
-- ============================================================
-- Replaces the original two-step process:
--   Step A: record_delivery_attempt() — records attempt, does NOT change delivery_status
--   Step B: requeue_notification()    — changes PROCESSING → QUEUED
-- Into a single atomic operation within one RPC call.
--
-- New parameter: p_auto_reset_to_queued BOOLEAN DEFAULT FALSE
-- When TRUE (retryable failure): atomically transitions PROCESSING → QUEUED
--                                and sets next_retry_at with backoff.
-- When FALSE (success or terminal): uses caller-provided p_new_delivery_status.

DROP FUNCTION IF EXISTS communication_schema.record_delivery_attempt(UUID, VARCHAR, VARCHAR, INTEGER, TEXT, VARCHAR, BOOLEAN, BIGINT, BOOLEAN);

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

  -- Calculate backoff delay if retryable
  IF p_is_retryable THEN
    v_backoff_interval := make_interval(secs => p_base_delay_ms * power(2, p_retry_count)::bigint / 1000);
    v_next_retry_at := now() + v_backoff_interval;
  ELSE
    v_next_retry_at := NULL;
  END IF;

  -- Update parent notification
  -- If p_auto_reset_to_queued is TRUE, atomically transition to QUEUED (H1 fix).
  -- Otherwise, use caller-provided status (success/terminal paths).
  UPDATE communication_schema.notifications
  SET
    delivery_status = CASE
      WHEN p_auto_reset_to_queued = TRUE THEN 'QUEUED'
      ELSE COALESCE(p_new_delivery_status, delivery_status)
    END,
    retry_count = p_retry_count,
    delivered_at = CASE
      WHEN p_status IN ('SUCCEEDED', 'DELIVERED') AND delivered_at IS NULL THEN now()
      ELSE delivered_at
    END,
    next_retry_at = CASE
      WHEN p_auto_reset_to_queued = TRUE THEN v_next_retry_at  -- Backoff for retry
      WHEN p_is_retryable = TRUE THEN v_next_retry_at           -- Backoff for terminal retry
      ELSE NULL                                                  -- Success or terminal non-retryable
    END,
    updated_at = now()
  WHERE id = p_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION communication_schema.record_delivery_attempt(UUID, VARCHAR, VARCHAR, INTEGER, TEXT, VARCHAR, BOOLEAN, BIGINT, BOOLEAN) TO authenticated;

-- ============================================================
-- PART 2: PARTIAL UNIQUE INDEX — Duplicate Notification Prevention
-- ============================================================
-- Prevents duplicate notifications for the same logical event/recipient.
-- Logical idempotency key: event_correlation_id + recipient_id
--
-- Uses a PARTIAL index because event_correlation_id is nullable.
-- Only enforces uniqueness for rows that HAVE a correlation ID.
-- Correlation-less notifications remain unaffected.
--
-- Safe to apply even if duplicates exist: the index creation will fail
-- gracefully if duplicates are found, allowing operator review.

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_event_correlation_recipient
  ON communication_schema.notifications(event_correlation_id, recipient_id)
  WHERE event_correlation_id IS NOT NULL
    AND recipient_id IS NOT NULL;

-- ============================================================
-- PART 3: DEPRECATION NOTICE — requeue_notification() RPC
-- ============================================================
-- The requeue_notification() RPC is no longer required by the
-- application layer since record_delivery_attempt() now handles
-- the atomic PROCESSING → QUEUED transition for retryable failures.
--
-- Kept for backward compatibility with any external callers.
-- Will be removed in a future migration once external usage is confirmed absent.

-- ============================================================
-- END OF MIGRATION 032
-- ============================================================
