-- ============================================================================
-- F-I2-27 REMEDIATION (housekeeping) - removal of Step-4 verification residue
-- Applied live as supabase_migrations row 20261109122239
-- = f_i2_27_verification_residue_cleanup. Migration slug matches that name.
-- ----------------------------------------------------------------------------
-- WHY THIS FILE EXISTS. The Step-4 functional tests had to exercise the real
-- INSERT/UPDATE verbs that migrations 055 and 057 restored, so they wrote rows.
-- Every row they created is tagged 'F27V261109' (or one of the synthetic
-- 00000000-0000-4000-8000-0000000f27NN uuids) and every predicate below names
-- that tag, so no pre-existing production row can be matched. service_role
-- deliberately holds NO DELETE privilege anywhere in the four domain schemas -
-- that is the least-privilege boundary the seven DELETE-refusal legs prove -
-- therefore removing the test rows is an owner-class operation that the
-- application itself cannot and must not be able to perform.
-- Three diagnostic rows also remained in supabase_migrations.schema_migrations
-- from rolled-back apply_migration probes whose subject was PostgREST schema
-- exposure, not schema change. They are history noise and are removed by
-- version, not by name pattern, so that the legitimate 055/056/057 rows and
-- this row cannot be caught by the same filter.
--
-- BEFORE STATE, measured 2026-11-09 by the rolled-back probe
-- f_i2_27_probe_residue_before (each number is the row count matching the
-- stated tag predicate):
--   logistics_schema.documents.document_id=1
--   logistics_schema.document_versions.version_id=1
--   logistics_schema.document_linkages.linkage_id=1
--   logistics_schema.document_approvals.approval_id=1
--   logistics_schema.document_expiry_records.expiry_record_id=1
--   logistics_schema.ocr_results.extraction_id=1
--   logistics_schema.digital_signatures.signature_id=1 (user_agent=1, same row)
--   logistics_schema.dispute_cases.case_number=1
--   logistics_schema.escalations.escalation_id=2 (reason=1 of those)
--   logistics_schema.support_tickets.ticket_id=1
--   communication_schema.notifications.title=2 (body=2, same rows)
--   financial_schema.settlement_requests.bank_execution_reference=3
--   monitoring_schema.alerts.trigger_condition=2
--   monitoring_schema.incidents.resolution_summary=2
--   monitoring_schema.log_entries.message=3 (service_id=3, same rows)
--   monitoring_schema.metrics.metric_name=2
--   monitoring_schema.health_checks.service_id=3 (details=3, same rows)
--   monitoring_schema.traces.trace_id=2
--   supabase_migrations probe rows=3
--
-- AFTER STATE, measured by the rolled-back probe f_i2_27_probe_residue_after:
--   RESIDUE_REMAINING=0, probe migration rows=0, and the collateral check shows
--   the mutated production fixtures are intact and were not deleted:
--   contracts(id=3b8ff821-e17d-4c6b-a8f5-002d1d7fd4f5 AND version=1) present,
--   payment_intents with status='FAILED' = 0 (the accidental mutation was
--   restored to 'CONFIRMED' during Step 4 and disclosed in the F-I2-27 report),
--   financial_schema.settlement_requests total = 2 (the two pre-existing rows).
--
-- DELETE ORDER is child-before-parent: the document child tables reference the
-- tagged document, escalations.source_case_id references dispute_cases, and the
-- dispute references the contract and shipment fixtures that stay in place.
--
-- WHAT THIS FILE DOES NOT DO. It changes no privilege, no policy, no function,
-- no table definition and no role. It deletes nothing outside the tag
-- predicates above - no truncation, no date-range filter, no cascade clause.
--
-- ROLLBACK: not reversible by design, and that is the correct posture for test
-- residue. The rows are reproducible by re-running the Step-4 write matrix
-- (f27-writes.js), which is the only reason they existed.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. document children - each references the tagged document
-- ---------------------------------------------------------------------------
DELETE FROM logistics_schema.document_versions       WHERE version_id        LIKE 'F27V261109%';
DELETE FROM logistics_schema.document_linkages       WHERE linkage_id        LIKE 'F27V261109%';
DELETE FROM logistics_schema.document_approvals      WHERE approval_id       LIKE 'F27V261109%';
DELETE FROM logistics_schema.document_expiry_records WHERE expiry_record_id  LIKE 'F27V261109%';
DELETE FROM logistics_schema.ocr_results             WHERE extraction_id     LIKE 'F27V261109%';
DELETE FROM logistics_schema.digital_signatures      WHERE signature_id      LIKE 'F27V261109%'
                                                          OR user_agent      = 'F27V261109';

-- ---------------------------------------------------------------------------
-- 2. dispute / escalation / support (escalations.source_case_id -> dispute_cases)
-- ---------------------------------------------------------------------------
DELETE FROM logistics_schema.escalations             WHERE escalation_id     LIKE 'F27V261109%'
                                                          OR reason          = 'F27V261109';
DELETE FROM logistics_schema.support_tickets         WHERE ticket_id         LIKE 'F27V261109%';
DELETE FROM logistics_schema.dispute_cases           WHERE case_number       LIKE 'F27V261109%';

-- ---------------------------------------------------------------------------
-- 3. the tagged documents themselves
-- ---------------------------------------------------------------------------
DELETE FROM logistics_schema.documents               WHERE document_id       LIKE 'F27V261109%'
                                                          OR file_reference  LIKE 'f27v/%';

-- ---------------------------------------------------------------------------
-- 4. communication / financial / monitoring
-- ---------------------------------------------------------------------------
DELETE FROM communication_schema.notifications       WHERE title = 'F27V261109'
                                                          OR body  = 'F27V261109';
DELETE FROM financial_schema.settlement_requests     WHERE bank_execution_reference LIKE 'F27V261109%';
DELETE FROM monitoring_schema.alerts                 WHERE trigger_condition = 'F27V261109';
DELETE FROM monitoring_schema.incidents              WHERE resolution_summary = 'F27V261109';
DELETE FROM monitoring_schema.log_entries            WHERE message = 'F27V261109'
                                                          OR service_id LIKE 'F27V261109%';
DELETE FROM monitoring_schema.metrics                WHERE metric_name = 'F27V261109';
DELETE FROM monitoring_schema.traces                 WHERE trace_id::text LIKE '00000000-0000-4000-8000-0000000f27%';
DELETE FROM monitoring_schema.health_checks          WHERE service_id = 'F27V261109'
                                                          OR details   = 'F27V261109';

-- ---------------------------------------------------------------------------
-- 5. migration-history rows left by the PostgREST-exposure diagnostic probes
-- ---------------------------------------------------------------------------
DELETE FROM supabase_migrations.schema_migrations
 WHERE version IN ('20261109103757', '20261109103843', '20261109103908');

COMMIT;
