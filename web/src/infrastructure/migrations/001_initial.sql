-- NexCargo Initial Migration — Schema foundation per PROMPT 2
-- Generates all 9 domain schemas with standard entity fields
-- Run: supabase migration up

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core audit fields template (apply to all tables)
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- updated_at TIMESTAMPTZ DEFAULT NOW()
-- created_by UUID REFERENCES auth.users(id)
-- updated_by UUID REFERENCES auth.users(id)
-- correlation_id UUID
-- is_deleted BOOLEAN DEFAULT FALSE
-- version INTEGER DEFAULT 1

-- ============================================================
-- marketplace_schema (MOD-001)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS marketplace_schema;

CREATE TABLE marketplace_schema.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  shipper_id UUID REFERENCES auth.users(id) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  origin_geo JSONB NOT NULL,
  destination_geo JSONB NOT NULL,
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  cargo_type VARCHAR(50) NOT NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  volume_m3 DECIMAL(10,2),
  time_window JSONB NOT NULL,
  pricing_model VARCHAR(20) NOT NULL DEFAULT 'FIXED'::VARCHAR,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'::VARCHAR,
  published_at TIMESTAMPTZ,
  associated_quote_id UUID,
  accepted_vehicle_types TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for marketplace listings per MOD-001 query patterns
CREATE INDEX idx_listings_status ON marketplace_schema.listings(status);
CREATE INDEX idx_listings_shipper ON marketplace_schema.listings(shipper_id);
CREATE INDEX idx_listings_published ON marketplace_schema.listings(published_at) WHERE status = 'PUBLISHED';

-- ============================================================
-- Offers table — TransportOffer per MOD-001 §5.2
-- ============================================================
CREATE TABLE marketplace_schema.offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  transporter_id UUID REFERENCES auth.users(id) NOT NULL,
  listing_id UUID NOT NULL REFERENCES marketplace_schema.listings(id),
  price_proposal DECIMAL(12,2) NOT NULL,
  availability_window JSONB NOT NULL,
  vehicle_type VARCHAR(30) NOT NULL,
  declared_capacity JSONB NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'::VARCHAR,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for offers per MOD-001 query patterns
CREATE INDEX idx_offers_listing ON marketplace_schema.offers(listing_id);
CREATE INDEX idx_offers_transporter ON marketplace_schema.offers(transporter_id);
CREATE INDEX idx_offers_status ON marketplace_schema.offers(status);
CREATE INDEX idx_offers_listing_status ON marketplace_schema.offers(listing_id, status);

-- ============================================================
-- Matches table — MatchProposal per MOD-001 §5.3
-- ============================================================
CREATE TABLE marketplace_schema.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES marketplace_schema.listings(id),
  offer_id UUID NOT NULL REFERENCES marketplace_schema.offers(id),
  match_score DECIMAL(5,2) NOT NULL,
  ranking_position INTEGER NOT NULL,
  reasoning_trace TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'::VARCHAR,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for matches per MOD-001 query patterns
CREATE INDEX idx_matches_listing ON marketplace_schema.matches(listing_id);
CREATE INDEX idx_matches_offer ON marketplace_schema.matches(offer_id);
CREATE INDEX idx_matches_status ON marketplace_schema.matches(status);
CREATE INDEX idx_matches_ranking ON marketplace_schema.matches(listing_id, ranking_position);

-- ============================================================
-- Quotes table — AdvisoryQuote per MOD-001 §5.4
-- ============================================================
CREATE TABLE marketplace_schema.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES marketplace_schema.listings(id),
  suggested_price_min DECIMAL(12,2) NOT NULL,
  suggested_price_max DECIMAL(12,2) NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,
  basis TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quotes per MOD-001 query patterns
CREATE INDEX idx_quotes_listing ON marketplace_schema.quotes(listing_id);
CREATE INDEX idx_quotes_confidence ON marketplace_schema.quotes(confidence_score);

-- ============================================================
-- logistics_schema (MOD-002, MOD-003, MOD-009, MOD-014)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS logistics_schema;

CREATE TABLE logistics_schema.shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID,
  listing_id UUID,
  status VARCHAR(50) DEFAULT 'CREATED'::VARCHAR,
  pickup_location VARCHAR(255),
  delivery_location VARCHAR(255),
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  driver_id UUID,
  vehicle_id UUID,
  border_crossing BOOLEAN DEFAULT FALSE,
  corridor_id UUID,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE logistics_schema.gps_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES logistics_schema.shipments(id),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  speed_kmh DECIMAL(6,2),
  heading INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- financial_schema (MOD-005, MOD-013)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS financial_schema;

CREATE TABLE financial_schema.escrow_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MZN'::VARCHAR,
  state VARCHAR(50) DEFAULT 'PENDING_CREATION'::VARCHAR,
  payment_method VARCHAR(50),
  external_transaction_ref VARCHAR(255),
  bank_confirmation_status VARCHAR(50),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial tables are append-only (no UPDATE/DELETE)
-- Balance is derived, not stored

-- ============================================================
-- ai_schema (MOD-006)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS ai_schema;

CREATE TABLE ai_schema.recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_module VARCHAR(50),
  aggregate_id UUID,
  recommendation_type VARCHAR(100),
  payload JSONB,
  confidence_score DECIMAL(3,2),
  reasoning_trace TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- compliance_schema (MOD-010, MOD-004, MOD-009)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS compliance_schema;

CREATE TABLE compliance_schema.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  result VARCHAR(50),
  correlation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- communication_schema (MOD-016)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS communication_schema;

CREATE TABLE communication_schema.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  channel VARCHAR(50),
  subject VARCHAR(255),
  body TEXT,
  event_correlation_id UUID,
  status VARCHAR(50) DEFAULT 'PENDING'::VARCHAR,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- analytics_schema (MOD-012)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS analytics_schema;

CREATE TABLE analytics_schema.event_store (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  source_module VARCHAR(50) NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  correlation_id UUID,
  causation_id UUID,
  version INTEGER,
  classification VARCHAR(50),
  criticality VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- platform_infrastructure_schema (MOD-011, MOD-017)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS platform_infrastructure_schema;

CREATE TABLE platform_infrastructure_schema.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  key_hash VARCHAR(255) NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  permissions JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ============================================================
-- localization_schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS localization_schema;

CREATE TABLE localization_schema.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  language_preference VARCHAR(2) DEFAULT 'pt'::VARCHAR,
  region VARCHAR(2) DEFAULT 'MZ'::VARCHAR,
  timezone VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
