// NexCargo MOD-016 — Notification Validation Services (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Reference: MOD-016 §4.x (Core Domain Entities), §7.x (Rules of Operation)
//
// Validates notification creation, template structure, and channel types
// per authoritative specification requirements.

import { ValidationError } from '@/shared/errors/app-errors';
import { PriorityLevel, DeliveryEventStatus, TemplateStatus } from '../enums';
import type { TemplateObject } from '../types/entities';

// ============================================================
// Valid source modules (MOD-001 through MOD-018)
// ============================================================

const VALID_SOURCE_MODULES = Array.from({ length: 18 }, (_, i) => `MOD-${String(i + 1).padStart(3, '0')}`);

// ============================================================
// Request Input Interface (string-based for API consumption)
// ============================================================

/**
 * Internal interface for validation inputs. Uses string types because
 * API routes pass raw JSON before type coercion.
 */
interface NotificationCreationInput {
  recipientId?: string;
  sourceModule?: string;
  eventType?: string;
  title?: string;
  body?: string;
  priorityLevel?: string;
  channelType?: string;
  locale?: string;
  correlationId?: string;
  templateId?: string;
  retryCount?: number;
}

/**
 * Normalizes a string-priority to PriorityLevel enum value.
 * Returns undefined if invalid or not provided.
 */
export function normalizePriorityLevel(value?: string): PriorityLevel | undefined {
  const upper = value?.toUpperCase();
  if (!upper || typeof upper !== 'string') return undefined;
  
  const priorities: readonly string[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (priorities.includes(upper)) {
    return upper as PriorityLevel;
  }
  return undefined;
}

/**
 * Normalizes a string-channel to channel type value.
 * Returns undefined if invalid or not provided.
 */
export function normalizeChannelType(value?: string): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const upper = value.toUpperCase();
  const channels: readonly string[] = ['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
  if (channels.includes(upper)) {
    return upper;
  }
  return undefined;
}

// ============================================================
// Notification Creation Validation
// ============================================================

/**
 * Validates a notification creation request against MOD-016 §4.1 business rules.
 * All required attributes must be present and valid.
 * Accepts string-typed input (as received from API routes).
 */
export function validateNotificationCreation(data: NotificationCreationInput): void {
  // recipientId is mandatory — no standalone messages without destination (MOD-016 §7.2)
  if (!data.recipientId || data.recipientId.trim() === '') {
    throw new ValidationError('recipientId is required for all notifications');
  }

  // sourceModule must identify originating module (MOD-016 §4.1)
  if (!data.sourceModule || !VALID_SOURCE_MODULES.includes(data.sourceModule)) {
    throw new ValidationError(`sourceModule must be one of: ${VALID_SOURCE_MODULES.join(', ')}`);
  }

  // eventType is mandatory — every notification must trace to an event (MOD-016 §4.1, §7.2)
  if (!data.eventType || data.eventType.trim() === '') {
    throw new ValidationError('eventType is required — every notification must originate from a system event');
  }

  // priorityLevel defaults are applied by database layer; client may provide
  // but if provided, must be valid
  if (data.priorityLevel && !isPriorityLevelValid(data.priorityLevel)) {
    throw new ValidationError(`priorityLevel must be one of: ${Object.values(PriorityLevel).join(', ')}`);
  }

  // channelType must be valid (MOD-016 §4.2)
  if (!data.channelType || !isValidChannelType(data.channelType)) {
    throw new ValidationError('channelType must be one of: IN_APP, EMAIL, SMS, PUSH, WHATSAPP');
  }

  // title or body must exist
  if (!data.title && !data.body) {
    throw new ValidationError('At least one of title or body is required');
  }

  // correlationId is mandatory — ensures traceability (MOD-016 §4.1, §7.5)
  if (!data.correlationId || data.correlationId.trim() === '') {
    throw new ValidationError('correlationId is required — links notification to original system event');
  }

  // locale format check
  if (data.locale && !/^([a-z]{2})$/.test(data.locale)) {
    throw new ValidationError('locale must be a two-letter language code (e.g., pt, en)');
  }
}

/**
 * Applies defaults to a notification creation input where the spec defines them.
 * Database layer also has defaults; this provides application-layer safety.
 */
export function applyNotificationDefaults(data: NotificationCreationInput): NotificationCreationInput & { priorityLevel: PriorityLevel | undefined } {
  return {
    ...data,
    priorityLevel: normalizePriorityLevel(data.priorityLevel) ?? PriorityLevel.MEDIUM,
    retryCount: data.retryCount ?? 0,
    locale: data.locale ?? 'pt',
  };
}

// ============================================================
// Template Validation
// ============================================================

/**
 * Validates a template against MOD-016 §4.3 business rules.
 * Templates must be version-controlled, support localization, and have variables defined.
 */
export function validateTemplateStructure(data: Partial<TemplateObject>): void {
  // templateKey is mandatory and unique
  if (!data.templateKey || data.templateKey.trim() === '') {
    throw new ValidationError('templateKey is required and must be unique');
  }

  // templateKey pattern: alphanumeric with underscores only
  if (!/^[a-zA-Z0-9_]+$/.test(data.templateKey)) {
    throw new ValidationError('templateKey must contain only alphanumeric characters and underscores');
  }

  // channelType must be valid
  if (!data.channelType || !isValidChannelType(data.channelType)) {
    throw new ValidationError('channelType must be one of: IN_APP, EMAIL, SMS, PUSH, WHATSAPP');
  }

  // defaultContent is mandatory
  if (!data.defaultContent || data.defaultContent.trim() === '') {
    throw new ValidationError('defaultContent is required for all templates');
  }

  // localizedContent structure validation
  if (data.localizedContent) {
    const localeKeys = Object.keys(data.localizedContent);
    for (const locale of localeKeys) {
      if (!locale || !Object.hasOwn(data.localizedContent, locale) || !data.localizedContent[locale]) {
        throw new ValidationError(`localizedContent entry for '${locale}' must have a truthy string value`);
      }
    }
  }

  // variables structure validation (if provided)
  if (data.variables && Array.isArray(data.variables)) {
    for (const variable of data.variables) {
      if (!variable.name || variable.name.trim() === '') {
        throw new ValidationError('Each template variable must have a non-empty name');
      }
    }
  }

  // version must be positive
  if (data.version !== undefined && data.version < 1) {
    throw new ValidationError('version must be at least 1');
  }

  // status validation
  if (data.status && !isValidTemplateStatus(data.status)) {
    throw new ValidationError(`status must be one of: ${Object.values(TemplateStatus).join(', ')}`);
  }
}

/** Checks if a channel type string matches any valid channel */
export function isValidChannelType(channel: string): boolean {
  const validChannels: readonly string[] = ['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
  return validChannels.includes(channel.toUpperCase());
}

// ============================================================
// Priority Level Validation
// ============================================================

/** Checks if a priority level is in the allowed set */
export function isPriorityLevelValid(level: string): boolean {
  return Object.values(PriorityLevel).includes(level as PriorityLevel);
}

// ============================================================
// Template Status Validation
// ============================================================

/** Checks if a template status is valid */
export function isValidTemplateStatus(status: string): boolean {
  return status === 'ACTIVE' || status === 'DEPRECATED';
}

// ============================================================
// Delivery Event Validation
// ============================================================

/**
 * Validates delivery event input before persistence.
 * Per MOD-016 §4.4: every message must have a delivery state.
 */
export function validateDeliveryEventInput(data: {
  notificationId: string;
  status?: string;
  retryCount?: number;
  failureReason?: string;
  channelUsed?: string;
}): void {
  if (!data.notificationId || data.notificationId.trim() === '') {
    throw new ValidationError('notificationId is required for delivery events');
  }

  if (data.status && !isValidDeliveryEventStatus(data.status)) {
    throw new ValidationError(`delivery event status must be one of: ${Object.values(DeliveryEventStatus).join(', ')}`);
  }

  if (data.retryCount !== undefined && data.retryCount < 0) {
    throw new ValidationError('retryCount must be non-negative');
  }
}

/** Checks if a delivery event status is valid */
export function isValidDeliveryEventStatus(status: string): boolean {
  const valid: string[] = ['ATTEMPTED', 'SUCCEEDED', 'FAILED', 'RETRY_SCHEDULED'];
  return valid.includes(status);
}
