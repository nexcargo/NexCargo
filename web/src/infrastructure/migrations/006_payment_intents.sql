-- NexCargo Migration 006 — Payment Intents Table (C4-I)
-- Creates: financial_schema.payment_intents
-- Purpose: Track individual payment attempt per escrow with idempotency guarantees
-- Scope: C4-I Database Foundation ONLY (payment initiation API not implemented here)
-- Authorized by: HAO C4 Authorization (2026-09-08)
--
-- Authority: MOD-005 §4.2 (Payment Intent entity), §7.5 (Idempotency Rule)
-- ESS-001F §4 (Payment Channels), ESS-006 (Security & Compliance)
--
-- Entity mapping:
--   paymentIntentId       → id (UUID)
--   escrowId              → escrow_id (FK to escrow_records)
--   amount                → amount (DECIMAL(12,2))
--   currency              → currency (VARCHAR(3))
--   paymentMethodType     → payment_method (VARCHAR(20))
--   status                → status (VARCHAR(20)), default INITIATED
--   providerReferenceId?  → provider_reference_id (VARCHAR(255))
--   idempotencyKey        → idempotency_key (VARCHAR(100), UNIQUE)
--   BaseEntity audit      → standard columns inherited

-- ============================================================
-- PART 1: payment_intents TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_schema.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES financial_schema.escrow_records(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('MZN', 'USD', 'ZAR')),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('MPESA', 'MKESH', 'EMOLA', 'CARD', 'PAYPAL', 'BANK_TRANSFER')),
  status VARCHAR(20) NOT NULL DEFAULT 'INITIATED'::VARCHAR CHECK (status IN ('INITIATED', 'PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED')),
  idempotency_key VARCHAR(100) NOT NULL UNIQUE,
  provider_reference_id VARCHAR(255),
  external_transaction_ref VARCHAR(255),
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  failure_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 2: INDEXES
-- ============================================================

-- Lookup by escrow record (primary query pattern)
CREATE INDEX idx_payment_intents_escrow
  ON financial_schema.payment_intents(escrow_id);

-- Status-based queries (filtering active vs completed intents)
CREATE INDEX idx_payment_intents_status
  ON financial_schema.payment_intents(status);

-- Composite index for finding active intents per escrow
-- Supports: "what payments exist for this escrow that haven't been resolved?"
CREATE INDEX idx_payment_intents_escrow_status
  ON financial_schema.payment_intents(escrow_id, status)
  WHERE is_deleted = FALSE;

-- ============================================================
-- PART 3: RLS POLICIES
-- ============================================================

ALTER TABLE financial_schema.payment_intents ENABLE ROW LEVEL SECURITY;

-- Counterparty read: shipper or transporter can view their own payment intents
-- Derived via: payment_intent.escrow_id → escrow_records.contract_id → contracts.booking_id → bookings.shipper_id/transporter_id
CREATE POLICY payment_intent_counterparty_read
  ON financial_schema.payment_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM financial_schema.escrow_records e
      JOIN logistics_schema.contracts c ON c.id = e.contract_id
      JOIN logistics_schema.bookings b ON b.id = c.booking_id
      WHERE e.id = payment_intents.escrow_id
        AND (b.shipper_id = auth.uid() OR b.transporter_id = auth.uid())
        AND b.is_deleted = FALSE
    )
  );

-- Admin policy: full access for moderators/admins
CREATE POLICY payment_intent_admin
  ON financial_schema.payment_intents
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- ============================================================
-- PART 4: IMMUTABLE FIELD COLUMN GRANTS
-- ============================================================

-- Financial core fields are immutable after creation
-- Only status and metadata may change (through the state machine)
REVOKE UPDATE (amount, currency, payment_method, escrow_id, idempotency_key, fee_amount)
  ON financial_schema.payment_intents FROM PUBLIC;

GRANT UPDATE (status, provider_reference_id, external_transaction_ref,
              fee_amount, failure_reason, updated_at, version, updated_by)
  ON financial_schema.payment_intents TO PUBLIC;

-- ============================================================
-- PART 5: UPDATED_AT TRIGGER (standard convention)
-- ============================================================

CREATE OR REPLACE FUNCTION financial_schema._set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_intents_updated_at ON financial_schema.payment_intents;

CREATE TRIGGER trg_payment_intents_updated_at
  BEFORE UPDATE ON financial_schema.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION financial_schema._set_updated_at();
