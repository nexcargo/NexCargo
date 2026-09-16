-- NexCargo Migration 008 — Notification Persistence Foundation (C5-I)
-- Creates/enhances: communication_schema.notifications (enhanced), communication_schema.notification_templates, communication_schema.delivery_events
-- Purpose: Required persistence for MOD-016 notification orchestration (§4.x entities) and provider-ready adapter boundary
-- Authorized by: HAO-C5-001 (C5 Milestone / Increment 1 Authorization, 2026-09-09)
--
-- Authority: MOD-016 §4.1 (Notification Object), §4.3 (Template Object), §4.4 (Delivery Event Object)
--            MOD-016 §4.8 (Communication Audit Record)
--            MOD-016 §7.3 (Delivery Integrity Rule), §7.9 (Localization Rule)
--            ESS-001E (Error Code Standardization)
--            ESS-006 Golden Rule (RLS mandatory on all tables)
--
-- NOTE: This migration enhances the existing communication_schema.notifications table
--       from migration 001_initial.sql by adding C5-required columns, indexes, and RLS policies.

-- ============================================================
-- PART 1: ENHANCE communication_schema.notifications TABLE
-- ============================================================

-- Create _set_updated_at trigger function if not exists in communication_schema
CREATE OR REPLACE FUNCTION communication_schema._set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add C5-required columns (safe IF NOT EXISTS pattern)
DO $$ BEGIN
  -- source_module: identifies originating module (MOD-001 through MOD-018)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'source_module') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN source_module VARCHAR(10);
  END IF;

  -- event_type: canonical event name that triggered this notification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'event_type') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN event_type VARCHAR(100);
  END IF;

  -- priority_level: LOW/MEDIUM/HIGH/CRITICAL classification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'priority_level') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN priority_level VARCHAR(10) DEFAULT 'MEDIUM';
  END IF;

  -- channel_type: primary channel for delivery
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'channel_type') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN channel_type VARCHAR(20);
  END IF;

  -- title: notification title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'title') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN title TEXT;
  END IF;

  -- recipient_id: target user/resource identifier
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'recipient_id') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN recipient_id UUID REFERENCES auth.users(id);
  END IF;

  -- template_id: reference to template used (nullable if inline content)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'template_id') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN template_id UUID;
  END IF;

  -- locale: recipient's locale for template selection
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'locale') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN locale VARCHAR(5) DEFAULT 'pt';
  END IF;

  -- retry_count: number of delivery attempts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'retry_count') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- delivery_status: QUEUED → SENT → DELIVERED → FAILED
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'delivery_status') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN delivery_status VARCHAR(20) DEFAULT 'QUEUED';
  END IF;

  -- provider_channel: logical channel name matching provider adapter
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'provider_channel') THEN
    ALTER TABLE communication_schema.notifications ADD COLUMN provider_channel VARCHAR(20);
  END IF;

  -- subject column rename to title already done above; drop old subject if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'communication_schema' AND table_name = 'notifications' AND column_name = 'subject') THEN
    ALTER TABLE communication_schema.notifications DROP COLUMN subject;
  END IF;

  -- body column is already present from migration 001; keep it as is
END $$;

-- Add constraints after column creation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_notifications_priority_level') THEN
    ALTER TABLE communication_schema.notifications ADD CONSTRAINT chk_notifications_priority_level
      CHECK (priority_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_notifications_channel_type') THEN
    ALTER TABLE communication_schema.notifications ADD CONSTRAINT chk_notifications_channel_type
      CHECK (channel_type IN ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_notifications_delivery_status') THEN
    ALTER TABLE communication_schema.notifications ADD CONSTRAINT chk_notifications_delivery_status
      CHECK (delivery_status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED'));
  END IF;
END $$;

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON communication_schema.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON communication_schema.notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON communication_schema.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_source_module ON communication_schema.notifications(source_module);

-- ============================================================
-- PART 2: notification_templates TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS communication_schema.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100) NOT NULL UNIQUE,
  channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP')),
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_content TEXT NOT NULL,
  localized_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPRECATED'))
);

-- ============================================================
-- PART 3: delivery_events TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS communication_schema.delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES communication_schema.notifications(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ATTEMPTED', 'SUCCEEDED', 'FAILED', 'RETRY_SCHEDULED')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  channel_used VARCHAR(20),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 4: RLS POLICIES
-- ============================================================

-- Notifications RLS
ALTER TABLE communication_schema.notifications ENABLE ROW LEVEL SECURITY;

-- Counterparty read: users can view their own notifications
CREATE POLICY notification_counterparty_read
  ON communication_schema.notifications
  FOR SELECT
  USING (recipient_id = auth.uid());

-- Admin policy: full access for moderators/admins
CREATE POLICY notification_admin
  ON communication_schema.notifications
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Template RLS
ALTER TABLE communication_schema.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY template_admin
  ON communication_schema.notification_templates
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Delivery events RLS
ALTER TABLE communication_schema.delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY delivery_event_admin
  ON communication_schema.delivery_events
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- ============================================================
-- PART 5: INDEXES
-- ============================================================

-- Templates lookup by key
CREATE INDEX IF NOT EXISTS idx_notification_templates_key
  ON communication_schema.notification_templates(template_key);

-- Templates by status
CREATE INDEX IF NOT EXISTS idx_notification_templates_status
  ON communication_schema.notification_templates(status);

-- Delivery events by notification
CREATE INDEX IF NOT EXISTS idx_delivery_events_notification
  ON communication_schema.delivery_events(notification_id);

-- Delivery events by status
CREATE INDEX IF NOT EXISTS idx_delivery_events_status
  ON communication_schema.delivery_events(status);

-- ============================================================
-- PART 6: UPDATED_AT TRIGGER for templates
-- ============================================================

DROP TRIGGER IF EXISTS trg_notification_templates_updated_at ON communication_schema.notification_templates;

CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON communication_schema.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION communication_schema._set_updated_at();
