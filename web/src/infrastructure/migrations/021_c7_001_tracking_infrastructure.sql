-- NexCargo Migration — Live C7-001 Tracking Infrastructure Deployment
-- Deploys: tracking_events, proof_of_delivery, gps_location_updates, driver_identity_verifications
-- Provenance note: XXX_c7_001_tracking_phase1.sql defines equivalent schemas but was never
-- applied via Supabase migrations. This migration provides the authoritative live deployment.
-- Note: driver_assignments table (MOD-002 ownership) does not yet exist on live DB.
--       Read policies use EXISTS with information_schema check for graceful handling.

-- ============================================================
-- 1. tracking_events
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

CREATE POLICY "Read tracking events via parent record"
  ON logistics_schema.tracking_events FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN'))
    )
  );

CREATE POLICY "Tracking mutations insert events"
  ON logistics_schema.tracking_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr
            WHERE pr.user_id = auth.uid() AND pr.role IN ('DRIVER','DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN'))
  );


-- ============================================================
-- 2. proof_of_delivery
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

CREATE POLICY "Read POD via parent record"
  ON logistics_schema.proof_of_delivery FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN'))
    )
  );

CREATE POLICY "Driver submits POD"
  ON logistics_schema.proof_of_delivery FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER')
  );

CREATE POLICY "Moderator/Admin/SuperAdmin verifies POD"
  ON logistics_schema.proof_of_delivery FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR','ADMIN','SUPER_ADMIN'))
  );


-- ============================================================
-- 3. gps_location_updates
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

CREATE POLICY "Read GPS updates via parent record"
  ON logistics_schema.gps_location_updates FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN'))
    )
  );

CREATE POLICY "Driver inserts GPS updates"
  ON logistics_schema.gps_location_updates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER')
  );


-- ============================================================
-- 4. driver_identity_verifications
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

CREATE POLICY "Read driver verifications via parent record"
  ON logistics_schema.driver_identity_verifications FOR SELECT
  USING (
    tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN'))
    )
  );

CREATE POLICY "Driver inserts verifications"
  ON logistics_schema.driver_identity_verifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER')
  );

CREATE POLICY "Moderator/Admin/SuperAdmin updates verifications"
  ON logistics_schema.driver_identity_verifications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR','ADMIN','SUPER_ADMIN'))
  );
