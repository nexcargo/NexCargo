-- NexCargo Migration 007 — Settlement Requests + Financial Ledger Entries (C4-III)
-- Creates: financial_schema.settlement_requests, financial_schema.financial_ledger_entries
-- Purpose: Required persistence for settlement orchestration (MOD-013 §4.3) and double-entry ledger (MOD-013 §4.4)
-- Authorized by: HAO C4-III Authorization (2026-09-08)
--
-- Authority: C4 Readiness R6 (settlement_requests), R7 (financial_ledger_entries)
--            MOD-013 §4.3 entity spec, §4.4 ledger mirror spec
--            ESS-001F §7 (ledger immutability), §6.3 (settlement idempotence)
--            ESS-006 Golden Rule (RLS mandatory on all tables)
--            ESS-009 (data governance, append-only ledgers)
--
-- Entity mapping (settlement_requests):
--   settlementId        → id (UUID)
--   escrowId            → escrow_id (FK to escrow_records)
--   triggerEvent        → trigger_event (VARCHAR CHECK in milestones)
--   requestedByModule   → requested_by_module (VARCHAR DEFAULT 'MOD-003')
--   approvalStatus      → approval_status (VARCHAR CHECK in lifecycle)
--   settlementType      → settlement_type (VARCHAR CHECK in types)
--   settlementAmount    → settlement_amount (DECIMAL(12,2))
--   bankExecutionRef    → bank_execution_reference (VARCHAR, populated on execution)
--   retryCount          → retry_count (INTEGER DEFAULT 0)
--   failureReason       → failure_reason (TEXT)
--   BaseEntity audit    → standard columns inherited
--
-- Entity mapping (financial_ledger_entries):
--   ledgerEntryId       → id (UUID)
--   transactionReference→ transaction_reference (VARCHAR, links to payment/settlement source)
--   entrySequence       → entry_sequence (SMALLINT 1=debit, 2=credit per pair)
--   debitCreditType     → debit_credit_type (VARCHAR CHECK DEBIT/CREDIT)
--   amount              → amount (DECIMAL(12,2))
--   currency            → currency (VARCHAR(3) MZN/USD/ZAR)
--   source              → source (VARCHAR, account identifier)
--   destination         → destination (VARCHAR, account identifier)
--   entryType           → entry_type (VARCHAR CHECK ESCROW/PAYMENT/SETTLEMENT/FEE/REFUND)
--   reconciliationStatus→ reconciliation_status (VARCHAR DEFAULT PENDING)
--   externalLedgerRef   → external_ledger_reference (VARCHAR)
--   BaseEntity audit    → standard columns inherited
--   ABSOLUTE IMMUTABILITY: append-only, no UPDATE on financial columns
--   UNIQUE INDEX on (transaction_reference, entry_sequence)

-- ============================================================
-- PART 1: settlement_requests TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_schema.settlement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES financial_schema.escrow_records(id),
  trigger_event VARCHAR(30) NOT NULL CHECK (trigger_event IN ('PICKUP_CONFIRMED', 'BORDER_CROSSING', 'DELIVERY_CONFIRMED', 'POD_APPROVED')),
  requested_by_module VARCHAR(10) NOT NULL DEFAULT 'MOD-003',
  approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED')),
  settlement_type VARCHAR(20) NOT NULL DEFAULT 'FULL' CHECK (settlement_type IN ('FULL', 'MILESTONE', 'REFUND')),
  settlement_amount DECIMAL(12,2) NOT NULL CHECK (settlement_amount > 0),
  bank_execution_reference VARCHAR(255),
  retry_count INTEGER NOT NULL DEFAULT 0,
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
-- PART 2: financial_ledger_entries TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_schema.financial_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference VARCHAR(100) NOT NULL,
  entry_sequence SMALLINT NOT NULL CHECK (entry_sequence IN (1, 2)),
  debit_credit_type VARCHAR(7) NOT NULL CHECK (debit_credit_type IN ('DEBIT', 'CREDIT')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('MZN', 'USD', 'ZAR')),
  source VARCHAR(50) NOT NULL,
  destination VARCHAR(50) NOT NULL,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('ESCROW', 'PAYMENT', 'SETTLEMENT', 'FEE', 'REFUND')),
  reconciliation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (reconciliation_status IN ('PENDING', 'ALIGNED', 'MISMATCH_DETECTED')),
  external_ledger_reference VARCHAR(255),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 3: INDEXES
-- ============================================================

-- Lookup by escrow record
CREATE INDEX idx_settlement_requests_escrow
  ON financial_schema.settlement_requests(escrow_id);

-- Status-based queries
CREATE INDEX idx_settlement_requests_approval_status
  ON financial_schema.settlement_requests(approval_status);

-- Composite for active (pending) settlement requests per escrow
CREATE INDEX idx_settlement_requests_pending
  ON financial_schema.settlement_requests(escrow_id, approval_status)
  WHERE approval_status = 'PENDING' AND is_deleted = FALSE;

-- Unique index on ledger entries ensures one debit+credit per transaction
CREATE UNIQUE INDEX uq_financial_ledger_tx_pair
  ON financial_schema.financial_ledger_entries(transaction_reference, entry_sequence);

-- Lookup ledger entries by source transaction
CREATE INDEX idx_financial_ledger_transaction_ref
  ON financial_schema.financial_ledger_entries(transaction_reference);

-- Lookup by reconciliation status (for mismatch detection)
CREATE INDEX idx_financial_ledger_reconciliation_status
  ON financial_schema.financial_ledger_entries(reconciliation_status);

-- Composite for reconciliation queries per transaction
CREATE INDEX idx_financial_ledger_reconciliation_lookup
  ON financial_schema.financial_ledger_entries(transaction_reference, entry_type)
  WHERE is_deleted = FALSE;

-- ============================================================
-- PART 4: RLS POLICIES
-- ============================================================

ALTER TABLE financial_schema.settlement_requests ENABLE ROW LEVEL SECURITY;

-- Counterparty read: shipper or transporter can view their own settlement requests
-- Derived via: settlement_requests.escrow_id → escrow_records.contract_id → contracts.booking_id → bookings.shipper_id/transporter_id
CREATE POLICY settlement_request_counterparty_read
  ON financial_schema.settlement_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM financial_schema.escrow_records e
      JOIN logistics_schema.contracts c ON c.id = e.contract_id
      JOIN logistics_schema.bookings b ON b.id = c.booking_id
      WHERE e.id = settlement_requests.escrow_id
        AND (b.shipper_id = auth.uid() OR b.transporter_id = auth.uid())
        AND b.is_deleted = FALSE
    )
  );

-- Admin policy: full access for moderators/admins
CREATE POLICY settlement_request_admin
  ON financial_schema.settlement_requests
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

ALTER TABLE financial_schema.financial_ledger_entries ENABLE ROW LEVEL SECURITY;

-- Admin only: financial details are sensitive, counterparty does not get direct ledger visibility
CREATE POLICY financial_ledger_admin
  ON financial_schema.financial_ledger_entries
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- ============================================================
-- PART 5: COLUMN GRANTS — IMMUTABLE FINANCIAL FIELDS
-- ============================================================

-- settlement_requests: settlement_amount immutable after creation
REVOKE UPDATE (settlement_amount, escrow_id)
  ON financial_schema.settlement_requests FROM PUBLIC;

GRANT UPDATE (approval_status, bank_execution_reference, retry_count, failure_reason, updated_at, version, updated_by)
  ON financial_schema.settlement_requests TO PUBLIC;

-- financial_ledger_entries: ABSOLUTE IMMUTABILITY on financial columns
REVOKE UPDATE (amount, currency, source, destination, debit_credit_type)
  ON financial_schema.financial_ledger_entries FROM PUBLIC;

GRANT UPDATE (reconciliation_status, external_ledger_reference, updated_at, version, updated_by)
  ON financial_schema.financial_ledger_entries TO PUBLIC;

-- ============================================================
-- PART 6: UPDATED_AT TRIGGERS
-- ============================================================

-- settlement_requests updated-at trigger
DROP TRIGGER IF EXISTS trg_settlement_requests_updated_at ON financial_schema.settlement_requests;

CREATE TRIGGER trg_settlement_requests_updated_at
  BEFORE UPDATE ON financial_schema.settlement_requests
  FOR EACH ROW
  EXECUTE FUNCTION financial_schema._set_updated_at();

-- financial_ledger_entries updated-at trigger (only metadata changes permitted)
DROP TRIGGER IF EXISTS trg_financial_ledger_entries_updated_at ON financial_schema.financial_ledger_entries;

CREATE TRIGGER trg_financial_ledger_entries_updated_at
  BEFORE UPDATE ON financial_schema.financial_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION financial_schema._set_updated_at();
