-- NexCargo Migration — C7 Tracking Mutation Security Closure (RLS Remediation)
-- Ensures database RLS boundaries are consistent with application-layer RBAC
-- for all existing Tracking mutation endpoints.
--
-- Closes the following gaps identified in C7 analysis:
-- 1. shipment_tracking_records: No UPDATE policy for TRANSPORTER/DISPATCHER/MODERATOR
--    despite API permitting status_update for these roles.
-- 2. tracking_events: INSERT restricted to DRIVER/DISPATCHER only, but MODERATOR/ADMIN/
--    SUPER_ADMIN also trigger event creation via TrackingOrchestratorService.
--
-- Does NOT change:
-- - GPS endpoint authorization (remains driver-only via RLS role = 'DRIVER')
-- - POD endpoint authorization (remains driver-only via RLS role = 'DRIVER')
-- - POD verification authorization (remains MODERATOR+/ADMIN/SUPER_ADMIN via RLS)
-- - Business logic, state machine, or RBAC permission matrix

-- ============================================================
-- 1. shipment_tracking_records — Add UPDATE policies
-- ============================================================

-- TRANSPORTER can update their own booking's tracking record (via bookings.transporter_id)
CREATE POLICY "Transporter updates own booking tracking"
  ON logistics_schema.shipment_tracking_records FOR UPDATE
  USING (
    id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.transporter_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'TRANSPORTER'
    )
  )
  WITH CHECK (
    id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.transporter_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'TRANSPORTER'
    )
  );

-- DISPATCHER can update any tracking record (platform operational authority)
CREATE POLICY "Dispatcher updates tracking records"
  ON logistics_schema.shipment_tracking_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER'
    )
  );

-- MODERATOR can update any tracking record (governance authority)
CREATE POLICY "Moderator updates tracking records"
  ON logistics_schema.shipment_tracking_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'MODERATOR'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'MODERATOR'
    )
  );

-- Admin/SuperAdmin already have FOR ALL policy covering UPDATE — no change needed

-- ============================================================
-- 2. tracking_events — Expand INSERT policy for orchestrator access
-- ============================================================

DROP POLICY "Authorized roles insert tracking events"
  ON logistics_schema.tracking_events;

-- All API-permitted status updaters need to create tracking events via orchestrator
CREATE POLICY "Tracking mutations insert events"
  ON logistics_schema.tracking_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DRIVER', 'DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

