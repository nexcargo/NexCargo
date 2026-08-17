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
  title VARCHAR(255) NOT NULL,
  description TEXT,
  origin_location VARCHAR(255) NOT NULL,
  destination_location VARCHAR(255) NOT NULL,
  cargo_type VARCHAR(100),
  weight_kg DECIMAL(10,2),
  volume_m3 DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'CREATED'::VARCHAR,
  price DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'MZN'::VARCHAR,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
