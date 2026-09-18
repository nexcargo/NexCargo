-- NexCargo Migration 027 — Custom Schema Exposure + Least-Privilege Grants
-- HAO Custom-Schema Data API Remediation (DB-SRC-001 / DB-CONFIG-001 / DB-GRANTS-002)
-- Exposes logistics_schema, marketplace_schema, financial_schema, communication_schema
-- to PostgREST Data API.
-- Applies least-privilege INSERT/SELECT/UPDATE permissions for authenticated role.
-- NO anon access. NO DELETE grants unless actually performed by application code.
-- NO blanket GRANT ALL.
-- NO RLS modifications.

-- ============================================================
-- Schema USAGE privileges
-- ============================================================

GRANT USAGE ON SCHEMA logistics_schema TO authenticated;
GRANT USAGE ON SCHEMA marketplace_schema TO authenticated;
GRANT USAGE ON SCHEMA financial_schema TO authenticated;
GRANT USAGE ON SCHEMA communication_schema TO authenticated;

-- ============================================================
-- logistics_schema — Direct-table operations used by repositories
-- ============================================================

-- bookings (BookingsRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.bookings TO authenticated;

-- shipment_tracking_records (TrackingRecordRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.shipment_tracking_records TO authenticated;

-- tracking_events (TrackingEventRepository: insert-only append, select)
GRANT INSERT, SELECT ON TABLE logistics_schema.tracking_events TO authenticated;

-- proof_of_delivery (PodRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.proof_of_delivery TO authenticated;

-- gps_location_updates (GpsUpdateRepository: insert-only append, select)
GRANT INSERT, SELECT ON TABLE logistics_schema.gps_location_updates TO authenticated;

-- driver_assignments (DriverAssignmentRepository: select-only)
-- NOTE: driver_assignments table is referenced by code but does not exist in current database.
-- GRANT SELECT ON TABLE logistics_schema.driver_assignments TO authenticated;

-- driver_identity_verifications (DriverIdentityVerificationRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.driver_identity_verifications TO authenticated;

-- documents (DocumentRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.documents TO authenticated;

-- document_linkages (DocumentRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.document_linkages TO authenticated;

-- document_expiry_records (DocumentRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.document_expiry_records TO authenticated;

-- document_versions (DocumentRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.document_versions TO authenticated;

-- document_approvals (DocumentRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.document_approvals TO authenticated;

-- ocr_results (DocumentRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.ocr_results TO authenticated;

-- digital_signatures (DocumentRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.digital_signatures TO authenticated;

-- fleets (FleetRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.fleets TO authenticated;

-- vehicles (FleetRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.vehicles TO authenticated;

-- drivers (FleetRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.drivers TO authenticated;

-- asset_assignments (FleetRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.asset_assignments TO authenticated;

-- cross_border_compliance_records (FleetRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.cross_border_compliance_records TO authenticated;

-- backhaul_opportunities (FleetRepository: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE logistics_schema.backhaul_opportunities TO authenticated;

-- contracts (referenced in route handlers indirectly via RPC)
GRANT SELECT ON TABLE logistics_schema.contracts TO authenticated;

-- ============================================================
-- marketplace_schema — Listings + Offers repositories + orchestration
-- ============================================================

-- listings (ListingsRepository + booking-orchestration.ts: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE marketplace_schema.listings TO authenticated;

-- offers (OffersRepository + booking-orchestration.ts: insert, select, update)
GRANT INSERT, SELECT, UPDATE ON TABLE marketplace_schema.offers TO authenticated;

-- matches (used by marketplace_book_handoff RPC, also direct reads in testing)
GRANT SELECT ON TABLE marketplace_schema.matches TO authenticated;

-- quotes
GRANT SELECT ON TABLE marketplace_schema.quotes TO authenticated;

-- ============================================================
-- financial_schema — Dispute hold/resolution, reconciliation, settlements routes
-- ============================================================

-- escrow_records (disputes/[id]/resolution, disputes/[id]/hold, settlements: select, update)
GRANT SELECT, UPDATE ON TABLE financial_schema.escrow_records TO authenticated;

-- payment_intents (reconciliation: select)
GRANT SELECT ON TABLE financial_schema.payment_intents TO authenticated;

-- settlement_requests (reconciliation: select; settlements: insert)
GRANT INSERT, SELECT ON TABLE financial_schema.settlement_requests TO authenticated;

-- financial_ledger_entries (reconciliation: select)
GRANT SELECT ON TABLE financial_schema.financial_ledger_entries TO authenticated;

-- ============================================================
-- communication_schema — MOD-016 notification routes
-- ============================================================

-- notifications (notifications/route.ts + [notificationId]/route.ts: insert, select)
GRANT INSERT, SELECT ON TABLE communication_schema.notifications TO authenticated;

-- notification_templates (referenced by RLS policies in migration 008)
GRANT SELECT ON TABLE communication_schema.notification_templates TO authenticated;

-- delivery_events (referenced by RLS policies in migration 008)
GRANT SELECT ON TABLE communication_schema.delivery_events TO authenticated;
