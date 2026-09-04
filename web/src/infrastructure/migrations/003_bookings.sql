-- NexCargo Migration 003 — Bookings Table (C2-Increment 001)
-- logistics_schema.bookings per MOD-002 §4.1 / C2-ready spec v1.1 Section 8
-- Booking lifecycle: REQUESTED → ALIGNMENT_CHECKED → CONFIRMED | FAILED | CANCELLED

-- ============================================================
-- bookings table
-- ============================================================

CREATE TABLE logistics_schema.bookings (
  -- Canonical identifier
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Domain-level business ID
  booking_id VARCHAR(50) NOT NULL UNIQUE,

  -- Foreign keys
  listing_id UUID NOT NULL REFERENCES marketplace_schema.listings(id),
  selected_offer_id UUID NOT NULL REFERENCES marketplace_schema.offers(id),
  shipper_id UUID NOT NULL REFERENCES auth.users(id),
  transporter_id UUID NOT NULL REFERENCES auth.users(id),

  -- Booking status per MOD-002 §5.1 state machine
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'::VARCHAR,

  -- Confirmation timestamp set when status → CONFIRMED
  confirmation_timestamp TIMESTAMPTZ,

  -- Origin snapshot from listing (flattened GeoLocation)
  origin_address TEXT NOT NULL,
  origin_latitude DECIMAL(9,6),
  origin_longitude DECIMAL(9,6),

  -- Destination snapshot from listing (flattened GeoLocation)
  destination_address TEXT NOT NULL,
  destination_latitude DECIMAL(9,6),
  destination_longitude DECIMAL(9,6),

  -- Cargo summary captured at booking time
  cargo_description TEXT NOT NULL,
  cargo_type VARCHAR(50) NOT NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  volume_m3 DECIMAL(10,2),
  special_handling TEXT[],

  -- Aligned offer snapshot
  offer_price DECIMAL(12,2) NOT NULL,
  vehicle_type VARCHAR(30) NOT NULL,
  declared_weight_kg DECIMAL(10,2),
  declared_volume_m3 DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'MZN'::VARCHAR,
  availability_window_start TEXT,
  availability_window_end TEXT,

  -- Optional linked contract (populated after C3 contract formation)
  contract_id UUID,

  -- Standard lifecycle fields (matching 001_initial.sql convention)
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes per MOD-002 query patterns
CREATE INDEX idx_bookings_listing ON logistics_schema.bookings(listing_id);
CREATE INDEX idx_bookings_transporter ON logistics_schema.bookings(transporter_id);
CREATE INDEX idx_bookings_shipper ON logistics_schema.bookings(shipper_id);
CREATE INDEX idx_bookings_status ON logistics_schema.bookings(status);
CREATE INDEX idx_bookings_contract ON logistics_schema.bookings(contract_id);

-- ============================================================
-- Row Level Security per ESS-006 §4.4 Golden Rule
-- ============================================================

ALTER TABLE logistics_schema.bookings ENABLE ROW LEVEL SECURITY;

-- Shipper reads own bookings
CREATE POLICY "Shipper reads own bookings"
  ON logistics_schema.bookings FOR SELECT
  USING (auth.uid() = shipper_id);

-- Transporter reads own bookings
CREATE POLICY "Transporter reads own bookings"
  ON logistics_schema.bookings FOR SELECT
  USING (auth.uid() = transporter_id);

-- Shipper updates own bookings (transition requests)
CREATE POLICY "Shipper updates own bookings"
  ON logistics_schema.bookings FOR UPDATE
  USING (auth.uid() = shipper_id)
  WITH CHECK (auth.uid() = shipper_id);

-- Admin/moderator full access
CREATE POLICY "Admin full access to bookings"
  ON logistics_schema.bookings FOR ALL
  USING (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'moderator');
