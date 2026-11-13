// NexCargo MOD-016 — Notification Event Handler Subscriber (C5 Increment 1)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Purpose: Subscribes to canonical business events and creates QUEUED notifications.
//
// Authority: MOD-016 §8 (Event Model — Tier-1 transitional trigger)
//            C5 FINAL BOUNDARY §F (MOD-016/MOD-017 Ownership), §E (Provider Boundary)
//
// This subscriber subscribes to the EventBus and handles the six Increment 1 canonical events:
//   1. bookingConfirmed
//   2. contractSigned
//   3. escrowLockConfirmed
//   4. paymentConfirmed
//   5. paymentFailed
//   6. settlementCompleted
//
// Each handler:
//   - receives the canonical event;
//   - resolves the already-verified recipient(s);
//   - resolves the appropriate locale;
//   - uses the approved notification template key;
//   - validates notification creation;
//   - creates the notification with status QUEUED;
//   - preserves the event correlation ID;
//   - preserves the canonical event type.
//
// FAILURE BEHAVIOR (I-3 §4B):
// The EventBus appends the event durably before dispatch and records this
// consumer's terminal state in analytics_schema.event_consumer_state. If
// notification creation fails this handler throws, the consumer is recorded
// FAILED, and the bounded replay pass (migration 060) re-runs it. The handler
// never retries inline (ESS-001C §10) and never compensates or rolls back the
// already-completed business operation.

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NexCargoEvent, EventSubscription } from '@/shared/events/event-types';
import { getEventBus } from '@/shared/events/handler-registry';
import { validateNotificationCreation, applyNotificationDefaults } from './notification-validation';
import { PriorityLevel } from '../enums';

// ============================================================
// Environment & Client Setup
// ============================================================

let supabaseInstance: SupabaseClient | null = null;

/**
 * Gets a lazily-initialized Supabase client instance.
 * Returns null if environment variables are not configured (test mode).
 */
function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      return null;
    }
    
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ============================================================
// Template Definitions for Increment 1 Canonical Events
// ============================================================

interface NotificationTemplate {
  templateKey: string;
  subject: string;
  body: string;
  priorityLevel: PriorityLevel;
  channelType: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  locale: string;
  variables: Record<string, string | number | Date>;
}

/**
 * Incremenet 1 canonical events that should trigger notifications.
 */
export const INCREMENT_1_EVENTS = [
  'bookingConfirmed',
  'contractSigned',
  'escrowLockConfirmed',
  'paymentConfirmed',
  'paymentFailed',
  'settlementCompleted',
];

/**
 * Resolves the notification template for a given canonical event name.
 * Uses pre-defined template keys aligned with MOD-016 template registry.
 */
export function resolveTemplate(eventType: string): NotificationTemplate | null {
  switch (eventType) {
    case 'bookingConfirmed':
      return {
        templateKey: 'BOOKING_CONFIRMED',
        subject: 'Booking Confirmed',
        body: 'Your booking has been confirmed.',
        priorityLevel: PriorityLevel.HIGH,
        channelType: 'IN_APP',
        locale: 'pt',
        variables: {},
      };

    case 'contractSigned':
      return {
        templateKey: 'CONTRACT_SIGNED',
        subject: 'Contract Signed',
        body: 'The contract has been signed by all parties.',
        priorityLevel: PriorityLevel.HIGH,
        channelType: 'IN_APP',
        locale: 'pt',
        variables: {},
      };

    case 'escrowLockConfirmed':
      return {
        templateKey: 'ESCROW_LOCK_CONFIRMED',
        subject: 'Escrow Lock Confirmed',
        body: 'Funds have been locked in escrow.',
        priorityLevel: PriorityLevel.CRITICAL,
        channelType: 'IN_APP',
        locale: 'pt',
        variables: {},
      };

    case 'paymentConfirmed':
      return {
        templateKey: 'PAYMENT_CONFIRMED',
        subject: 'Payment Confirmed',
        body: 'Your payment has been confirmed.',
        priorityLevel: PriorityLevel.HIGH,
        channelType: 'IN_APP',
        locale: 'pt',
        variables: {},
      };

    case 'paymentFailed':
      return {
        templateKey: 'PAYMENT_FAILED',
        subject: 'Payment Failed',
        body: 'Your payment has failed. Please try again.',
        priorityLevel: PriorityLevel.CRITICAL,
        channelType: 'IN_APP',
        locale: 'pt',
        variables: {},
      };

    case 'settlementCompleted':
      return {
        templateKey: 'SETTLEMENT_COMPLETED',
        subject: 'Settlement Completed',
        body: 'Your settlement has been completed.',
        priorityLevel: PriorityLevel.HIGH,
        channelType: 'IN_APP',
        locale: 'pt',
        variables: {},
      };

    default:
      return null;
  }
}

// ============================================================
// Recipient Resolution Mappings (Verified by C5 Audit)
// ============================================================

interface RecipientMapping {
  recipientId: string;
  sourceModule: string;
}

/**
 * Resolves every recipient for a given canonical event. Pure: no writes, no side
 * effects. The caller creates one notification per returned mapping.
 */
export function resolveRecipients<T>(event: NexCargoEvent<T>): RecipientMapping[] {
  const eventType = event.event_type;
  const payload = event.payload as Record<string, unknown>;

  const pick = (key: string): string | undefined => {
    const value = payload?.[key];
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  };

  const pair = (sourceModule: string): RecipientMapping[] => {
    const shipperId = pick('shipper_id');
    const transporterId = pick('transporter_id');
    const recipients: RecipientMapping[] = [];
    // A party that is both shipper and transporter must be notified once, not twice.
    if (shipperId) recipients.push({ recipientId: shipperId, sourceModule });
    if (transporterId && transporterId !== shipperId) {
      recipients.push({ recipientId: transporterId, sourceModule });
    }
    if (recipients.length === 0) {
      console.error(`[NotificationEventHandler] ${eventType}: missing shipper_id and transporter_id in payload`);
    }
    return recipients;
  };

  const single = (key: string, sourceModule: string): RecipientMapping[] => {
    const id = pick(key);
    if (!id) {
      console.error(`[NotificationEventHandler] ${eventType}: missing ${key} in payload`);
      return [];
    }
    return [{ recipientId: id, sourceModule }];
  };

  switch (eventType) {
    case 'bookingConfirmed':
      return single('transporter_id', 'MOD-002');
    case 'contractSigned':
      return single('shipper_id', 'MOD-002');
    case 'escrowLockConfirmed':
    case 'paymentConfirmed':
      return pair('MOD-005');
    case 'paymentFailed':
      return single('shipper_id', 'MOD-005');
    case 'settlementCompleted':
      return single('shipper_id', 'MOD-013');
    default:
      return [];
  }
}

/**
 * First recipient for a canonical event, or null. Kept for callers that only
 * need the primary party; notification creation uses resolveRecipients().
 */
export function resolveRecipient<T>(event: NexCargoEvent<T>): RecipientMapping | null {
  return resolveRecipients(event)[0] ?? null;
}

// ============================================================
// Notification Creation
// ============================================================

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable consumer identity recorded in analytics_schema.event_consumer_state. */
export const NOTIFICATION_CONSUMER_NAME = 'MOD-016.notifications';

interface PersistedTemplate {
  id: string;
  channelType: string;
  defaultContent: string;
  localizedContent: Record<string, { title?: string; body?: string }>;
}

/**
 * Loads the ACTIVE persisted template for a canonical event (MOD-016 §4.3).
 * Returns null when unavailable so the caller can fall back to resolveTemplate().
 */
async function loadPersistedTemplate(
  db: SupabaseClient,
  eventType: string,
): Promise<PersistedTemplate | null> {
  const { data, error } = await db
    .schema('communication_schema')
    .from('notification_templates')
    .select('id, channel_type, default_content, localized_content')
    .eq('template_key', eventType)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    channelType: String(row.channel_type),
    defaultContent: String(row.default_content ?? ''),
    localizedContent: (row.localized_content ?? {}) as PersistedTemplate['localizedContent'],
  };
}

/** Resolves the recipient's locale via the narrow SECDEF lookup (MOD-016 §7.9). */
async function resolveRecipientLocale(
  db: SupabaseClient,
  recipientId: string,
): Promise<string> {
  if (!UUID_PATTERN.test(recipientId)) return 'pt';
  const { data, error } = await db
    .schema('communication_schema')
    .rpc('resolve_recipient_locale', { p_recipient_id: recipientId });
  if (error || typeof data !== 'string' || !/^[a-z]{2}$/.test(data)) return 'pt';
  return data;
}

/**
 * Creates one notification record in communication_schema.notifications.
 *
 * Idempotency (I-3 §4B, deviation D1 in migration 059): keyed on
 * (source_event_id, recipient_id), NOT on correlation_id. escrowLockConfirmed and
 * paymentConfirmed are published in one batch sharing a correlation_id and a
 * shipper recipient, so a correlation-keyed index would silently discard the
 * second notification. The partial unique index
 * uq_notifications_source_event_recipient is the authority; the SELECT below is
 * only an optimization and 23505 is treated as an idempotent no-op.
 */
async function createNotificationFromEvent<T>(
  event: NexCargoEvent<T>,
  recipientInfo: RecipientMapping,
): Promise<boolean> {
  const fallback = resolveTemplate(event.event_type);
  if (!fallback) {
    console.log(`[NotificationEventHandler] No template for event type: ${event.event_type}`);
    return false;
  }

  try {
    const db = getSupabase();
    if (!db) {
      console.log('[NotificationEventHandler] Supabase not configured — notification creation skipped (test mode)');
      return true;
    }

    const persisted = await loadPersistedTemplate(db, event.event_type);
    const locale = await resolveRecipientLocale(db, recipientInfo.recipientId);
    const localized = persisted?.localizedContent?.[locale];

    const title = localized?.title || fallback.subject;
    const body = localized?.body || persisted?.defaultContent || fallback.body;
    const channelType = persisted?.channelType || fallback.channelType;
    const sourceEventId = UUID_PATTERN.test(event.event_id) ? event.event_id : null;
    const correlationUuid = UUID_PATTERN.test(event.correlation_id) ? event.correlation_id : null;

    const input = {
      recipientId: recipientInfo.recipientId,
      sourceModule: recipientInfo.sourceModule,
      eventType: event.event_type,
      title,
      body,
      priorityLevel: fallback.priorityLevel,
      channelType,
      locale,
      correlationId: event.correlation_id,
      templateId: persisted?.id,
    };

    validateNotificationCreation(input);
    const validated = applyNotificationDefaults(input);

    if (sourceEventId) {
      const existing = await db
        .schema('communication_schema')
        .from('notifications')
        .select('id')
        .eq('source_event_id', sourceEventId)
        .eq('recipient_id', validated.recipientId)
        .maybeSingle();

      if (existing.data) {
        console.log(
          `[NotificationEventHandler] Idempotent skip: source_event_id=${sourceEventId}, ` +
          `recipient_id=${validated.recipientId}`,
        );
        return true;
      }
    } else {
      console.warn(
        `[NotificationEventHandler] event_id is not a UUID (${event.event_id}); ` +
        'database idempotency index cannot apply to this notification',
      );
    }

    const { data, error } = await db
      .schema('communication_schema')
      .from('notifications')
      .insert({
        recipient_id: validated.recipientId,
        source_module: validated.sourceModule,
        event_type: validated.eventType,
        title: validated.title || '',
        body: validated.body || '',
        priority_level: validated.priorityLevel,
        channel_type: validated.channelType,
        locale: validated.locale,
        event_correlation_id: correlationUuid,
        correlation_ref: event.correlation_id,
        source_event_id: sourceEventId,
        template_id: validated.templateId || null,
        delivery_status: 'QUEUED',
        retry_count: 0,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log(
          `[NotificationEventHandler] Idempotent duplicate: source_event_id=${sourceEventId}, ` +
          `recipient_id=${validated.recipientId}`,
        );
        return true;
      }
      console.error(`[NotificationEventHandler] Database insert error for ${event.event_type}:`, error.message);
      return false;
    }

    if (!data) {
      console.error(`[NotificationEventHandler] No notification ID returned for ${event.event_type}`);
      return false;
    }

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[NotificationEventHandler] Error creating notification for ${event.event_type}:`, message);
    return false;
  }
}

/**
 * Consumer entry point. Creates one notification per resolved recipient and
 * throws when any creation failed, so the EventBus records a FAILED consumer
 * state that the bounded replay pass (migration 060) can recover.
 */
export async function handleCanonicalEvent<T>(event: NexCargoEvent<T>): Promise<void> {
  const recipients = resolveRecipients(event);

  if (recipients.length === 0) {
    console.log(`[NotificationEventHandler] Skipping event (no recipient mapping): ${event.event_type}`);
    return;
  }

  const failures: string[] = [];
  for (const recipient of recipients) {
    const created = await createNotificationFromEvent(event, recipient);
    if (!created) failures.push(recipient.recipientId);
  }

  if (failures.length > 0) {
    throw new Error(
      `Notification creation failed for ${event.event_type} ${event.event_id}; recipients: ${failures.join(', ')}`,
    );
  }
}

// ============================================================
// Event Subscription Registration
// ============================================================

/**
 * Subscribes MOD-016 to the canonical events on the shared EventBus.
 * Idempotent: the registry rejects a duplicate (handler, consumerName) pair, so
 * repeated bootstrap calls cannot produce duplicate notifications.
 */
export function registerNotificationEventHandlers(): void {
  const bus = getEventBus();
  for (const eventType of INCREMENT_1_EVENTS) {
    const subscription = createEventSubscription(eventType);
    if (subscription) bus.subscribe(subscription);
  }
}

/**
 * Creates an event subscription for a specific canonical event.
 * Returns the subscription object ready to be passed to EventBus.subscribe().
 */
export function createEventSubscription(eventType: string): EventSubscription | null {
  if (!INCREMENT_1_EVENTS.includes(eventType)) {
    return null;
  }

  return {
    eventTypes: [eventType],
    handler: handleCanonicalEvent,
    priority: 0,
    maxRetries: 0, // No inline retry (ESS-001C §10); recovery is the bounded replay pass.
    consumerName: NOTIFICATION_CONSUMER_NAME,
  };
}
