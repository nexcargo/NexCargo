// NexCargo I-3 §4C/§4E — Notification consumer connectivity tests.
// These are UNIT tests against a fake Supabase client: they prove the consumer's
// recipient resolution, idempotency keys, localization and failure signalling.
// Live database behaviour is verified separately against the real project.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventClassification, EventCriticality } from '@/shared/types/enums';
import type { NexCargoEvent } from '@/shared/events/event-types';

interface BuilderRecord {
  table: string;
  selects: string[];
  filters: Array<[string, unknown]>;
  inserted: Record<string, unknown> | null;
}

const h = vi.hoisted(() => ({
  schemaCalls: [] as string[],
  builders: [] as Array<{
    table: string;
    selects: string[];
    filters: Array<[string, unknown]>;
    inserted: Record<string, unknown> | null;
  }>,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  subscriptions: [] as Array<Record<string, unknown>>,
  templateRow: null as Record<string, unknown> | null,
  templateError: null as { message: string } | null,
  locale: 'pt' as unknown,
  localeError: null as { message: string } | null,
  existingRow: null as Record<string, unknown> | null,
  insertResult: { data: { id: 'notif-new' }, error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
  insertQueue: [] as Array<{ data: unknown; error: { code?: string; message: string } | null }>,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    schema: (name: string) => {
      h.schemaCalls.push(name);
      return {
        from: (table: string) => {
          const record: BuilderRecord = { table, selects: [], filters: [], inserted: null };
          h.builders.push(record);
          const builder = {
            select: (cols: string) => { record.selects.push(cols); return builder; },
            eq: (col: string, val: unknown) => { record.filters.push([col, val]); return builder; },
            insert: (row: Record<string, unknown>) => { record.inserted = row; return builder; },
            maybeSingle: async () => table === 'notification_templates'
              ? { data: h.templateRow, error: h.templateError }
              : { data: h.existingRow, error: null },
            single: async () => h.insertQueue.length > 0 ? h.insertQueue.shift()! : h.insertResult,
          };
          return builder;
        },
        rpc: async (fn: string, args: Record<string, unknown>) => {
          h.rpcCalls.push({ fn, args });
          return { data: h.locale, error: h.localeError };
        },
      };
    },
  }),
}));

vi.mock('@/shared/events/handler-registry', () => ({
  getEventBus: () => ({
    subscribe: (subscription: Record<string, unknown>) => { h.subscriptions.push(subscription); },
  }),
}));

import {
  resolveRecipients,
  handleCanonicalEvent,
  registerNotificationEventHandlers,
  createEventSubscription,
  NOTIFICATION_CONSUMER_NAME,
  INCREMENT_1_EVENTS,
} from '../domain/services/notification-event-handler';

const SHIPPER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TRANSPORTER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EVENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CORRELATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TEMPLATE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function makeEvent(eventType: string, payload: Record<string, unknown> = {}): NexCargoEvent {
  return {
    event_id: EVENT_ID,
    event_type: eventType,
    timestamp: '2026-11-10T10:00:00.000Z',
    source_module: 'MOD-005',
    aggregate_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    aggregate_type: 'Escrow',
    payload: { shipper_id: SHIPPER, transporter_id: TRANSPORTER, ...payload },
    correlation_id: CORRELATION_ID,
    version: 1,
    classification: EventClassification.BUSINESS,
    criticality: EventCriticality.HIGH,
  };
}

function inserts() {
  return h.builders.filter((b) => b.table === 'notifications' && b.inserted).map((b) => b.inserted!);
}

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
let savedEnv: Record<string, string | undefined> = {};
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  // Fake values only: the client is mocked, so no network call is possible.
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-placeholder';

  h.schemaCalls.length = 0;
  h.builders.length = 0;
  h.rpcCalls.length = 0;
  h.subscriptions.length = 0;
  h.templateRow = null;
  h.templateError = null;
  h.locale = 'pt';
  h.localeError = null;
  h.existingRow = null;
  h.insertResult = { data: { id: 'notif-new' }, error: null };
  h.insertQueue.length = 0;

  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

// ============================================================
// Recipient determination and isolation
// ============================================================

describe('I-3 §4C — recipient determination', () => {
  it('notifies only the transporter for bookingConfirmed', () => {
    expect(resolveRecipients(makeEvent('bookingConfirmed'))).toEqual([
      { recipientId: TRANSPORTER, sourceModule: 'MOD-002' },
    ]);
  });

  it('notifies only the shipper for contractSigned', () => {
    expect(resolveRecipients(makeEvent('contractSigned'))).toEqual([
      { recipientId: SHIPPER, sourceModule: 'MOD-002' },
    ]);
  });

  it('notifies both parties for escrowLockConfirmed and paymentConfirmed', () => {
    for (const eventType of ['escrowLockConfirmed', 'paymentConfirmed']) {
      expect(resolveRecipients(makeEvent(eventType))).toEqual([
        { recipientId: SHIPPER, sourceModule: 'MOD-005' },
        { recipientId: TRANSPORTER, sourceModule: 'MOD-005' },
      ]);
    }
  });

  it('notifies a party that is both shipper and transporter exactly once', () => {
    const recipients = resolveRecipients(makeEvent('paymentConfirmed', { transporter_id: SHIPPER }));
    expect(recipients).toEqual([{ recipientId: SHIPPER, sourceModule: 'MOD-005' }]);
  });

  it('notifies only the shipper for paymentFailed', () => {
    expect(resolveRecipients(makeEvent('paymentFailed'))).toEqual([
      { recipientId: SHIPPER, sourceModule: 'MOD-005' },
    ]);
  });

  it('attributes settlementCompleted to MOD-013 and the shipper only', () => {
    expect(resolveRecipients(makeEvent('settlementCompleted'))).toEqual([
      { recipientId: SHIPPER, sourceModule: 'MOD-013' },
    ]);
  });

  it('ignores non-string and blank payload identifiers', () => {
    expect(resolveRecipients(makeEvent('bookingConfirmed', { transporter_id: 42 }))).toEqual([]);
    expect(resolveRecipients(makeEvent('bookingConfirmed', { transporter_id: '   ' }))).toEqual([]);
    expect(resolveRecipients(makeEvent('paymentConfirmed', { shipper_id: null }))).toEqual([
      { recipientId: TRANSPORTER, sourceModule: 'MOD-005' },
    ]);
  });

  it('returns no recipients for events outside the approved increment', () => {
    for (const eventType of [
      'paymentInitiated', 'disputeHoldPlaced', 'trackingStatusChanged',
      'supportTicketCreated', 'documentUploaded', 'escrowReleaseConfirmed', 'settlementExecuted',
    ]) {
      expect(resolveRecipients(makeEvent(eventType))).toEqual([]);
    }
  });

  it('performs no database access while resolving recipients', () => {
    resolveRecipients(makeEvent('paymentConfirmed'));
    expect(h.schemaCalls).toHaveLength(0);
    expect(h.builders).toHaveLength(0);
    expect(h.rpcCalls).toHaveLength(0);
  });
});

// ============================================================
// Consumer registration — the connectivity that was previously missing
// ============================================================

describe('I-3 §4A — consumer registration', () => {
  it('subscribes every approved canonical event with a stable consumer identity', () => {
    registerNotificationEventHandlers();

    expect(h.subscriptions).toHaveLength(INCREMENT_1_EVENTS.length);
    expect(h.subscriptions.map((s) => (s.eventTypes as string[])[0])).toEqual(INCREMENT_1_EVENTS);
    for (const subscription of h.subscriptions) {
      expect(subscription.consumerName).toBe(NOTIFICATION_CONSUMER_NAME);
      expect(subscription.maxRetries).toBe(0);
      expect(typeof subscription.handler).toBe('function');
    }
  });

  it('registers the same handler for every event so replay can find it', () => {
    registerNotificationEventHandlers();
    const handlers = new Set(h.subscriptions.map((s) => s.handler));
    expect(handlers.size).toBe(1);
    expect(handlers.has(handleCanonicalEvent)).toBe(true);
  });

  it('does not subscribe deferred or excluded event types', () => {
    registerNotificationEventHandlers();
    const subscribed = h.subscriptions.flatMap((s) => s.eventTypes as string[]);
    expect(subscribed).not.toContain('paymentInitiated');
    expect(subscribed).not.toContain('settlementExecuted');
    expect(createEventSubscription('paymentInitiated')).toBeNull();
  });
});

// ============================================================
// Notification persistence
// ============================================================

describe('I-3 §4C — notification persistence', () => {
  it('creates exactly one notification per recipient, with no duplicate for the first', async () => {
    await handleCanonicalEvent(makeEvent('paymentConfirmed'));

    const rows = inserts();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.recipient_id)).toEqual([SHIPPER, TRANSPORTER]);
    expect(new Set(rows.map((r) => r.recipient_id)).size).toBe(2);
  });

  it('writes the idempotency key, correlation ref and QUEUED delivery state', async () => {
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));

    expect(inserts()[0]).toEqual({
      recipient_id: TRANSPORTER,
      source_module: 'MOD-002',
      event_type: 'bookingConfirmed',
      title: 'Booking Confirmed',
      body: 'Your booking has been confirmed.',
      priority_level: 'HIGH',
      channel_type: 'IN_APP',
      locale: 'pt',
      event_correlation_id: CORRELATION_ID,
      correlation_ref: CORRELATION_ID,
      source_event_id: EVENT_ID,
      template_id: null,
      delivery_status: 'QUEUED',
      retry_count: 0,
    });
  });

  it('queries idempotency on (source_event_id, recipient_id), not correlation_id', async () => {
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));

    const lookup = h.builders.find((b) => b.table === 'notifications' && !b.inserted)!;
    expect(lookup.filters).toEqual([
      ['source_event_id', EVENT_ID],
      ['recipient_id', TRANSPORTER],
    ]);
  });

  it('targets communication_schema for every read and write', async () => {
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));
    expect(h.schemaCalls.length).toBeGreaterThan(0);
    expect(new Set(h.schemaCalls)).toEqual(new Set(['communication_schema']));
  });

  it('skips the insert when the notification already exists', async () => {
    h.existingRow = { id: 'already-created' };
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));
    expect(inserts()).toHaveLength(0);
  });

  it('treats a 23505 unique violation as an idempotent success', async () => {
    h.insertResult = { data: null, error: { code: '23505', message: 'duplicate key value' } };
    await expect(handleCanonicalEvent(makeEvent('bookingConfirmed'))).resolves.toBeUndefined();
  });

  it('stores a non-UUID correlation id in correlation_ref only', async () => {
    await handleCanonicalEvent({ ...makeEvent('bookingConfirmed'), correlation_id: 'legacy-corr-001' });

    const row = inserts()[0];
    expect(row.event_correlation_id).toBeNull();
    expect(row.correlation_ref).toBe('legacy-corr-001');
  });

  it('writes a null source_event_id and warns when event_id is not a UUID', async () => {
    await handleCanonicalEvent({ ...makeEvent('bookingConfirmed'), event_id: 'legacy-event-001' });

    expect(inserts()[0].source_event_id).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    // No idempotency SELECT is possible without a UUID key.
    expect(h.builders.filter((b) => b.table === 'notifications' && !b.inserted)).toHaveLength(0);
  });

  it('creates nothing and does not throw when no recipient can be resolved', async () => {
    await expect(handleCanonicalEvent(makeEvent('paymentInitiated'))).resolves.toBeUndefined();
    expect(inserts()).toHaveLength(0);
    expect(h.schemaCalls).toHaveLength(0);
  });
});

// ============================================================
// Templates and localization
// ============================================================

describe('I-3 §4C — content and localization', () => {
  it('resolves the recipient locale through the narrow SECDEF lookup', async () => {
    h.locale = 'en';
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));

    expect(h.rpcCalls).toEqual([
      { fn: 'resolve_recipient_locale', args: { p_recipient_id: TRANSPORTER } },
    ]);
    expect(inserts()[0].locale).toBe('en');
  });

  it('uses the persisted ACTIVE template id, channel and localized content', async () => {
    h.locale = 'en';
    h.templateRow = {
      id: TEMPLATE_ID,
      channel_type: 'IN_APP',
      default_content: 'Default body',
      localized_content: { en: { title: 'Booking confirmed', body: 'Your booking is confirmed.' } },
    };

    await handleCanonicalEvent(makeEvent('bookingConfirmed'));

    const templateLookup = h.builders.find((b) => b.table === 'notification_templates')!;
    expect(templateLookup.filters).toEqual([
      ['template_key', 'bookingConfirmed'],
      ['status', 'ACTIVE'],
    ]);
    expect(inserts()[0]).toMatchObject({
      template_id: TEMPLATE_ID,
      title: 'Booking confirmed',
      body: 'Your booking is confirmed.',
      channel_type: 'IN_APP',
      locale: 'en',
    });
  });

  it('falls back to default_content when the locale has no translation', async () => {
    h.locale = 'fr';
    h.templateRow = {
      id: TEMPLATE_ID,
      channel_type: 'IN_APP',
      default_content: 'Conteúdo padrão',
      localized_content: { en: { title: 'English only' } },
    };

    await handleCanonicalEvent(makeEvent('bookingConfirmed'));

    expect(inserts()[0]).toMatchObject({
      title: 'Booking Confirmed',
      body: 'Conteúdo padrão',
      locale: 'fr',
    });
  });

  it('falls back to the inline template when no persisted template is ACTIVE', async () => {
    h.templateRow = null;
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));
    expect(inserts()[0]).toMatchObject({
      template_id: null,
      title: 'Booking Confirmed',
      body: 'Your booking has been confirmed.',
    });
  });

  it('falls back to the inline template when the template read errors', async () => {
    h.templateError = { message: 'relation unavailable' };
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));
    expect(inserts()[0].title).toBe('Booking Confirmed');
  });

  it('defaults to pt when the locale lookup fails', async () => {
    h.localeError = { message: 'permission denied' };
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));
    expect(inserts()[0].locale).toBe('pt');
  });

  it('defaults to pt when the lookup returns a malformed locale', async () => {
    h.locale = 'pt-PT';
    await handleCanonicalEvent(makeEvent('bookingConfirmed'));
    expect(inserts()[0].locale).toBe('pt');
  });

  it('does not call the locale RPC for a non-UUID recipient', async () => {
    await handleCanonicalEvent(makeEvent('bookingConfirmed', { transporter_id: 'legacy-user' }));
    expect(h.rpcCalls).toHaveLength(0);
    expect(inserts()[0].locale).toBe('pt');
  });
});

// ============================================================
// Failure signalling — the bus must be able to record FAILED
// ============================================================

describe('I-3 §4B — consumer failure signalling', () => {
  it('throws when a notification insert fails, so the bus records FAILED', async () => {
    h.insertResult = { data: null, error: { code: '42501', message: 'permission denied' } };

    await expect(handleCanonicalEvent(makeEvent('bookingConfirmed'))).rejects.toThrow(
      /Notification creation failed for bookingConfirmed/,
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('names only the failed recipient and still attempts the others', async () => {
    h.insertQueue = [
      { data: { id: 'first' }, error: null },
      { data: null, error: { code: '23503', message: 'recipient fk violation' } },
    ];

    await expect(handleCanonicalEvent(makeEvent('paymentConfirmed'))).rejects.toThrow(
      new RegExp(`recipients: ${TRANSPORTER}$`),
    );
    expect(inserts()).toHaveLength(2);
    expect(inserts().map((r) => r.recipient_id)).toEqual([SHIPPER, TRANSPORTER]);
  });

  it('names every failed recipient when all inserts fail', async () => {
    h.insertResult = { data: null, error: { code: '23503', message: 'recipient fk violation' } };
    await expect(handleCanonicalEvent(makeEvent('paymentConfirmed'))).rejects.toThrow(
      new RegExp(`${SHIPPER}, ${TRANSPORTER}`),
    );
    expect(inserts()).toHaveLength(2);
  });

  it('does not throw when the failure is an idempotent duplicate', async () => {
    h.insertResult = { data: null, error: { code: '23505', message: 'duplicate' } };
    await expect(handleCanonicalEvent(makeEvent('paymentConfirmed'))).resolves.toBeUndefined();
  });

  it('propagates a validation failure as a consumer failure', async () => {
    // An unknown channel from a persisted template must not be silently written.
    h.templateRow = {
      id: TEMPLATE_ID,
      channel_type: 'CARRIER_PIGEON',
      default_content: 'body',
      localized_content: {},
    };
    await expect(handleCanonicalEvent(makeEvent('bookingConfirmed'))).rejects.toThrow(
      /Notification creation failed/,
    );
    expect(inserts()).toHaveLength(0);
  });
});