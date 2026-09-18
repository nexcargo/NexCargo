-- NexCargo Migration 025 — Bookings Shipper INSERT RLS Correction
-- Remediation of missing SHIPPER INSERT policy on logistics_schema.bookings
-- HAO Booking Authorization Remediation — no scope expansion

-- Shipper can insert their own bookings
CREATE POLICY "Shipper inserts own bookings"
  ON logistics_schema.bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = shipper_id);
