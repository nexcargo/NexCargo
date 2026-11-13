-- NexCargo Migration 034 — Restore financial_schema updated_at triggers declared by migration 007 PART 6
-- Status: DRAFT — AWAITING LEAD ARCHITECT APPROVAL (SB-3 Stage A). NOT APPLIED to the live project.
-- Authorised to be authored by the Lead Architect directive "NexCargo — SB-3 Stage A: Design & Implementation Preparation", instruction 6.
-- No live database object was created, altered or executed while authoring this file.
--
-- GAP EVIDENCE (live catalog, measured 2026-11-05, read-only):
--   financial_schema.settlement_requests    — user triggers: 0
--   financial_schema.financial_ledger_entries — user triggers: 0
--   financial_schema.payment_intents        — trg_payment_intents_updated_at present (installed by migration 006)
--   financial_schema._set_updated_at()      — present and callable
-- Migration 007 PART 5 is live (column-level ACLs "{=w/postgres}" on the metadata columns of both tables; the
-- financial columns carry no column ACL, which is what makes them immutable). Migration 007 PART 6 is NOT live.
-- 007 is therefore PARTIALLY applied, and the partial-application boundary is exactly the trigger block.
--
-- REQUIREMENT SATISFIED:
--   docs/governance/c4-readiness-report-corrected.md:187-188 (requirements R6/R7)
--   web/src/infrastructure/migrations/007_settlement_ledger_c4iii.sql:6, :23, :37 (declared intent)
--   007_settlement_ledger_c4iii.sql:181-199 (the exact statements this file restores, reproduced verbatim)
--   ESS-009 append-only ledger standard: financial_ledger_entries may change metadata only, and the audit
--   timestamp must be maintained by the database rather than by the caller.
--
-- DESIGN NOTES:
--   Statements are reproduced verbatim from 007 PART 6 rather than re-authored, so the restored triggers are
--   identical to the originally specified objects.
--   DROP TRIGGER IF EXISTS is retained, making the file idempotent and safe to re-run.
--   Nothing in this file touches privileges, RLS, policies, RPCs or data. It restores two BEFORE UPDATE
--   triggers only.

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
