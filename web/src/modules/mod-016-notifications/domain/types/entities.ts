// NexCargo MOD-016 — Core Domain Entities for Notification Persistence (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Reference: MOD-016 §4.x (Core Domain Entities)
//
// Entity interfaces for database/persistence layer. These are PLAIN INTERFACES
// (not extending BaseEntity class) because database operations work with
// plain objects, not class instances.
//
// For runtime business logic, use the BaseEntity class from @/shared/base-classes/base-entity.
// Note: ProviderSendResult and ProviderErrorMapping are defined in 
//       infrastructure/adapters/notification-provider-adapter.ts to avoid duplicate exports.

import type { NotificationChannel } from '@/shared/types/enums';
import type { PriorityLevel, DeliveryStatus, DeliveryEventStatus, TemplateStatus } from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no base class extension)
// ============================================================

/** Localization dictionary for template content */
export interface LocalizationDictionary {
  [locale: string]: string;
}

/** Variable definition for template dynamic injection */
export interface TemplateVariable {
  name: string;
  type?: 'string' | 'number' | 'date' | 'currency';
  description?: string;
}

// ============================================================
// Entity types (extend BaseEntity)
// ============================================================

/**
 * Notification Object (Database Record)
 * Per MOD-016 §4.1
 * Represents a system-generated notification with delivery tracking.
 * Status lifecycle: QUEUED → SENT → DELIVERED (success path)
 *                  QUEUED → FAILED (error path)
 */
export interface NotificationObject {
  id: string;
  notificationId: string;
  recipientId: string;
  sourceModule: string; // MOD-001 through MOD-018
  eventType: string;    // Canonical event name
  title: string;
  body: string;
  priorityLevel: PriorityLevel;
  channelType: NotificationChannel;
  status: DeliveryStatus;
  locale: string;       // Recipient's preferred locale (pt/en)
  templateId?: string;   // Optional reference to template used
  correlationId: string; // Link to original system event
  retryCount: number;
  providerChannel?: string; // Logical channel matching provider adapter
  deliveredAt?: Date;
  created_at: Date;
  updated_at: Date;
  version: number;
}

/**
 * Template Object (Database Record)
 * Per MOD-016 §4.3
 * Version-controlled reusable communication structure supporting localization.
 */
export interface TemplateObject {
  id: string;
  templateId: string;
  templateKey: string;
  channelType: NotificationChannel;
  variables: TemplateVariable[];
  defaultContent: string;
  localizedContent: LocalizationDictionary;
  version: number;
  status: TemplateStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Delivery Event Object (Database Record)
 * Per MOD-016 §4.4
 * Represents lifecycle of message delivery attempt.
 */
export interface DeliveryEventObject {
  id: string;
  deliveryEventId: string;
  notificationId: string;
  status: DeliveryEventStatus;
  retryCount: number;
  failureReason?: string;
  channelUsed?: string;
  timestamp: Date;
}

/**
 * Communication Audit Record (Database Record)
 * Per MOD-016 §4.8
 * Immutable auditable communication event for full traceability.
 */
export interface CommunicationAuditRecord {
  id: string;
  auditId: string;
  messageId: string;      // Links to notificationId
  userId: string;         // Recipient user ID
  channelType: NotificationChannel;
  contentHash: string;    // Integrity checksum
  deliveryStatus: DeliveryStatus;
  timestamp: Date;
  sourceEventCorrelationId: string;
}
