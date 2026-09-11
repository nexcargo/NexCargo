-- NexCargo Migration — Tracking & Visibility Foundation (C7-001 Phase 1)
-- Creates 5 tables in logistics_schema for MOD-003 tracking operations.
--
-- Owner: MOD-003 Tracking & Visibility Module
-- Scope: DB/API tracking foundation only (Phase 1)
-- Does NOT create driver_assignments (MOD-002 ownership per HAO decision D-7).
-- Does NOT modify legacy migration-001 skeleton tables (logistics_schema.shipments,
--   logistics_schema.gps_telemetry) — these are deprecated scaffolding.
--
-- Tables:
--   1. shipment_tracking_records      — Core visibility object per MOD-003 §4.1
--   2. tracking_events                — Immutable append-only event log per MOD-003 §4.3/§7.2
--   3. proof_of_delivery              — POD evidence per MOD-003 §4.6/§7.5
--   4. gps_location_updates           — GPS telemetry per MOD-003 §4.5/§7.4
--   5. driver_identity_verifications  — Pre-handover verification per MOD-003 §4.7/§7.6
--
-- Notes:
--   - contracts_id is nullable; populated when MOD-002 contract pipeline becomes operational.
--   - RLS policies enforce per-role row-level access (ESS-006 §4.4 Golden Rule).
--   - tracking_events has no UPDATE/DELETE triggers enforced at application layer.

-- ============================================================
-- 1. shipment_tracking_records
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.shipment_tracking_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_ref VARCHAR(50) NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES logistics_schema.bookings(id),
  contract_id UUID REFERENCES logistics_schema.contracts(id),
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED'::VARCHAR,
  visibility_level VARCHAR(20) NOT NULL DEFAULT 'RESTRICTED'::VARCHAR,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_records_booking ON logistics_schema.shipment_tracking_records(booking_id);
CREATE INDEX idx_tracking_records_status ON logistics_schema.shipment_tracking_records(status);
CREATE INDEX idx_tracking_records_contract ON logistics_schema.shipment_tracking_records(contract_id);

ALTER TABLE logistics_schema.shipment_tracking_records ENABLE ROW LEVEL SECURITY;

-- Shipper reads own tracking records (via bookings.shipper_id)
CREATE POLICY "Shipper reads own tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
    )
  );

-- Transporter reads own tracking records (via bookings.transporter_id)
CREATE POLICY "Transporter reads own tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.transporter_id = auth.uid()
    )
  );

-- Driver reads assigned tracking records — checked via driver_assignments table
-- (driver_assignments created by MOD-002; C7-001 read-only access)
CREATE POLICY "Driver reads assigned tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.driver_assignments da ON da.booking_id = tr.booking_id
      WHERE da.driver_id = auth.uid()
    )
  );

-- Dispatcher reads all tracking records
CREATE POLICY "Dispatcher reads all tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin full access
CREATE POLICY "Admin/SuperAdmin reads all tracking records"
  ON logistics_schema.shipment_tracking_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );


-- ============================================================
-- 2. tracking_events (append-only immutable, no UPDATE/DELETE)
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(20) NOT NULL,
  state_from VARCHAR(20),
  state_to VARCHAR(20),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_events_tracking ON logistics_schema.tracking_events(tracking_id);
CREATE INDEX idx_tracking_events_type ON logistics_schema.tracking_events(event_type);
CREATE INDEX idx_tracking_events_timestamp ON logistics_schema.tracking_events(event_timestamp DESC);

ALTER TABLE logistics_schema.tracking_events ENABLE ROW LEVEL SECURITY;

-- All readable by same roles as tracking records (joined through tracking_id)
CREATE POLICY "Read tracking events via parent record"
  ON logistics_schema.tracking_events FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM logistics_schema.driver_assignments da
           WHERE da.booking_id = tr.booking_id AND da.driver_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM app.platform_roles pr
           WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN')
         )
    )
  );

-- Only authorized roles can INSERT events
CREATE POLICY "Authorized roles insert tracking events"
  ON logistics_schema.tracking_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('DRIVER','DISPATCHER')
    )
  );


-- ============================================================
-- 3. proof_of_delivery
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.proof_of_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES logistics_schema.bookings(id),
  recipient_name TEXT NOT NULL,
  signature_ref TEXT NOT NULL,
  photo_refs TEXT[] NOT NULL DEFAULT '{}',
  gps_lat DECIMAL(9,6) NOT NULL,
  gps_lon DECIMAL(9,6) NOT NULL,
  submission_method VARCHAR(10) NOT NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'::VARCHAR,
  admin_override BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pod_tracking ON logistics_schema.proof_of_delivery(tracking_id);
CREATE INDEX idx_pod_booking ON logistics_schema.proof_of_delivery(booking_id);
CREATE INDEX idx_pod_verification ON logistics_schema.proof_of_delivery(verification_status);

ALTER TABLE logistics_schema.proof_of_delivery ENABLE ROW LEVEL SECURITY;

-- Same read pattern as tracking records
CREATE POLICY "Read POD via parent record"
  ON logistics_schema.proof_of_delivery FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM logistics_schema.driver_assignments da
           WHERE da.booking_id = tr.booking_id AND da.driver_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM app.platform_roles pr
           WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN')
         )
    )
  );

-- Drivers submit POD
CREATE POLICY "Driver submits POD"
  ON logistics_schema.proof_of_delivery FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER'
    )
  );

-- MODERATOR/ADMIN/SUPER_ADMIN verify POD
CREATE POLICY "Moderator/Admin/SuperAdmin verifies POD"
  ON logistics_schema.proof_of_delivery FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR','ADMIN','SUPER_ADMIN')
    )
  );


-- ============================================================
-- 4. gps_location_updates
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.gps_location_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id) ON DELETE CASCADE,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  speed_kmh DECIMAL(6,2),
  heading_degrees INTEGER,
  accuracy_meters INTEGER,
  source VARCHAR(20) NOT NULL,
  is_offline BOOLEAN DEFAULT FALSE,
  battery_level SMALLINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gps_tracking ON logistics_schema.gps_location_updates(tracking_id);
CREATE INDEX idx_gps_timestamp ON logistics_schema.gps_location_updates(tracking_id, timestamp DESC);

ALTER TABLE logistics_schema.gps_location_updates ENABLE ROW LEVEL SECURITY;

-- Readable by same roles as tracking records
CREATE POLICY "Read GPS updates via parent record"
  ON logistics_schema.gps_location_updates FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM logistics_schema.driver_assignments da
           WHERE da.booking_id = tr.booking_id AND da.driver_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM app.platform_roles pr
           WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN')
         )
    )
  );

-- Only authenticated drivers can insert GPS updates
CREATE POLICY "Driver inserts GPS updates"
  ON logistics_schema.gps_location_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER'
    )
  );


-- ============================================================
-- 5. driver_identity_verifications
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.driver_identity_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES logistics_schema.bookings(id),
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'::VARCHAR,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  failure_reason TEXT,
  risk_score DECIMAL(3,2),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_div_tracking ON logistics_schema.driver_identity_verifications(tracking_id);
CREATE INDEX idx_div_booking ON logistics_schema.driver_identity_verifications(booking_id);
CREATE INDEX idx_div_driver ON logistics_schema.driver_identity_verifications(driver_id);

ALTER TABLE logistics_schema.driver_identity_verifications ENABLE ROW LEVEL SECURITY;

-- Readable by same roles
CREATE POLICY "Read driver verifications via parent record"
  ON logistics_schema.driver_identity_verifications FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM logistics_schema.driver_assignments da
           WHERE da.booking_id = tr.booking_id AND da.driver_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM app.platform_roles pr
           WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN')
         )
    )
  );

-- Drivers can insert their own verification records
CREATE POLICY "Driver inserts verifications"
  ON logistics_schema.driver_identity_verifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER'
    )
  );

-- MODERATOR+ can update verification status
CREATE POLICY "Moderator/Admin/SuperAdmin updates verifications"
  ON logistics_schema.driver_identity_verifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR','ADMIN','SUPER_ADMIN')
    )
  );


-- ============================================================
-- NOTE: Legacy migration-001 skeleton tables
-- ============================================================
-- logistics_schema.shipments.id and logistics_schema.gps_telemetry.id
-- exist but do not conform to the MOD-003 entity model defined in this migration.
-- They are treated as deprecated scaffolding and left untouched.
-- Future sessions may deprecate them formally if zero live data exists.
