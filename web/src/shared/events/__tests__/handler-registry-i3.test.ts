// NexCargo I-3 §4A/§4B — Durable event bus tests.
// Covers: durable append contract, duplicate-event suppression, priority-ordered
// consumer dispatch, per-consumer state recording, failure isolation and bounded replay.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventClassification, EventCriticality } from '@/shared/types/enums';
import type { NexCargoEvent } from '../event-types';
import {
  EventHandlerRegistry,
  getEventBus,
  resetEventBus,
  replayFailedEventConsumptions,
} from '../handler-registry';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  failCreate: { value: false },
}));

vi.mock('@/infrastructure/database/supabase', () => ({
  createAdminClient: () => {
    if (mocks.failCreate.value) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }
    return { rpc: mocks.rpc };
  },
}));

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const AGGREGATE_ID = '22222222-2222-4222-8222-222222222222';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';

function makeEvent(overrides: Partial<NexCargoEvent> = {}): NexCargoEvent {
  return {
    event_id: EVENT_ID,
    event_type: 'bookingConfirmed',
    timestamp: '2026-11-10T10:00:00.000Z',
    source_module: 'MOD-002',
    aggregate_id: AGGREGATE_ID,
    aggregate_type: 'Booking',
    payload: { transporter_id: '44444444-4444-4444-8444-444444444444' },
    correlation_id: CORRELATION_ID,
    version: 1,
    classification: EventClassification.BUSINESS,
    criticality: EventCriticality.HIGH,
    ...overrides,
  };
}

function rpcCalls(fn: string) {
  return mocks.rpc.mock.calls.filter((c) => c[0] === fn).map((c) => c[1] as Record<string, unknown>);
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetEventBus();
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.failCreate.value = false;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  resetEventBus();
});

// ============================================================
// Durable append — the event contract sent to append_platform_event
// ============================================================

describe('I-3 §4B — durable append contract', () => {
  it('appends the full envelope before dispatching any consumer', async () => {
    const order: string[] = [];
    mocks.rpc.mockImplementation(async (fn: string) => {
      order.push(fn);
      return { data: true, error: null };
    });

    const bus = new EventHandlerRegistry();
    bus.subscribe({
      eventTypes: ['bookingConfirmed'],
      consumerName: 'test.consumer',
      handler: async () => { order.push('handler'); },
    });

    await bus.publish(makeEvent());

    expect(order).toEqual(['append_platform_event', 'handler', 'record_event_consumption']);
    expect(rpcCalls('append_platform_event')).toEqual([
      {
        p_event_id: EVENT_ID,
        p_event_type: 'bookingConfirmed',
        p_timestamp: '2026-11-10T10:00:00.000Z',
        p_source_module: 'MOD-002',
        p_aggregate_id: AGGREGATE_ID,
        p_aggregate_type: 'Booking',
        p_payload: { transporter_id: '44444444-4444-4444-8444-444444444444' },
        p_correlation_id: CORRELATION_ID,
        p_causation_id: null,
        p_version: 1,
        p_classification: EventClassification.BUSINESS,
        p_criticality: EventCriticality.HIGH,
      },
    ]);
  });

  it('propagates causation_id when the event was caused by another event', async () => {
    const bus = new EventHandlerRegistry();
    await bus.publish(makeEvent({ causation_id: CORRELATION_ID }));
    expect(rpcCalls('append_platform_event')[0].p_causation_id).toBe(CORRELATION_ID);
  });

  it('dispatches but does not append when durable storage is unavailable', async () => {
    mocks.failCreate.value = true;
    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler, consumerName: 'test.consumer' });

    await bus.publish(makeEvent());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('dispatches when the append RPC errors, and logs the durable loss', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler });

    await bus.publish(makeEvent());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not attempt a durable append for a non-UUID event_id', async () => {
    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler });

    await bus.publish(makeEvent({ event_id: 'legacy-non-uuid-id' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(rpcCalls('append_platform_event')).toHaveLength(0);
    expect(rpcCalls('record_event_consumption')).toHaveLength(0);
  });
});

// ============================================================
// Duplicate-event protection
// ============================================================

describe('I-3 §4B — duplicate-event suppression', () => {
  it('does not re-run consumers when the append reports an existing event_id', async () => {
    // append_platform_event returns false on the ON CONFLICT (event_id) path.
    mocks.rpc.mockImplementation(async (fn: string) => ({
      data: fn === 'append_platform_event' ? false : true,
      error: null,
    }));

    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler, consumerName: 'test.consumer' });

    await bus.publish(makeEvent());
    await bus.publish(makeEvent());

    expect(handler).not.toHaveBeenCalled();
    expect(rpcCalls('append_platform_event')).toHaveLength(2);
    expect(rpcCalls('record_event_consumption')).toHaveLength(0);
  });

  it('runs consumers exactly once when only the first append succeeds', async () => {
    let appended = false;
    mocks.rpc.mockImplementation(async (fn: string) => {
      if (fn !== 'append_platform_event') return { data: true, error: null };
      if (appended) return { data: false, error: null };
      appended = true;
      return { data: true, error: null };
    });

    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler });

    await bus.publish(makeEvent());
    await bus.publish(makeEvent());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not double-subscribe the same consumer identity', async () => {
    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    const subscription = { eventTypes: ['bookingConfirmed'], handler, consumerName: 'test.consumer' };

    bus.subscribe(subscription);
    bus.subscribe({ ...subscription });
    await bus.publish(makeEvent());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(rpcCalls('record_event_consumption')).toHaveLength(1);
  });
});

// ============================================================
// Consumer execution, ordering and failure isolation
// ============================================================

describe('I-3 §4A/§4B — consumer dispatch', () => {
  it('runs consumers in ascending priority order regardless of subscription order', async () => {
    const order: string[] = [];
    const bus = new EventHandlerRegistry();
    bus.subscribe({
      eventTypes: ['bookingConfirmed'], priority: 10, consumerName: 'late',
      handler: async () => { order.push('late'); },
    });
    bus.subscribe({
      eventTypes: ['bookingConfirmed'], priority: -5, consumerName: 'early',
      handler: async () => { order.push('early'); },
    });
    bus.subscribe({
      eventTypes: ['bookingConfirmed'], consumerName: 'default',
      handler: async () => { order.push('default'); },
    });

    await bus.publish(makeEvent());

    expect(order).toEqual(['early', 'default', 'late']);
  });

  it('records COMPLETED with the consumer identity and attempts=1', async () => {
    const bus = new EventHandlerRegistry();
    bus.subscribe({
      eventTypes: ['bookingConfirmed'],
      consumerName: 'MOD-016.notifications',
      handler: async () => {},
    });

    await bus.publish(makeEvent());

    expect(rpcCalls('record_event_consumption')).toEqual([
      {
        p_event_id: EVENT_ID,
        p_consumer_name: 'MOD-016.notifications',
        p_status: 'COMPLETED',
        p_attempts: 1,
        p_last_error: null,
        p_correlation_id: CORRELATION_ID,
      },
    ]);
  });

  it('records FAILED and still runs the remaining consumers when one throws', async () => {
    const second = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({
      eventTypes: ['bookingConfirmed'], priority: 0, consumerName: 'broken',
      handler: async () => { throw new Error('recipient insert rejected'); },
    });
    bus.subscribe({
      eventTypes: ['bookingConfirmed'], priority: 1, consumerName: 'healthy',
      handler: second,
    });

    await expect(bus.publish(makeEvent())).resolves.toBeUndefined();

    expect(second).toHaveBeenCalledTimes(1);
    const states = rpcCalls('record_event_consumption');
    expect(states).toHaveLength(2);
    expect(states[0]).toMatchObject({
      p_consumer_name: 'broken',
      p_status: 'FAILED',
      p_attempts: 1,
      p_last_error: 'recipient insert rejected',
    });
    expect(states[1]).toMatchObject({ p_consumer_name: 'healthy', p_status: 'COMPLETED' });
  });

  it('never retries a failing consumer inline', async () => {
    const handler = vi.fn(async () => { throw new Error('boom'); });
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler, maxRetries: 5 });

    await bus.publish(makeEvent());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('labels an unnamed consumer "anonymous" rather than dropping its state', async () => {
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler: async () => {} });
    await bus.publish(makeEvent());
    expect(rpcCalls('record_event_consumption')[0].p_consumer_name).toBe('anonymous');
  });

  it('does not dispatch to consumers of a different event type', async () => {
    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['contractSigned'], handler });
    await bus.publish(makeEvent({ event_type: 'bookingConfirmed' }));
    expect(handler).not.toHaveBeenCalled();
    expect(rpcCalls('record_event_consumption')).toHaveLength(0);
  });

  it('stops dispatching after unsubscribe', async () => {
    const handler = vi.fn(async () => {});
    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler });
    bus.unsubscribe('bookingConfirmed', handler);
    await bus.publish(makeEvent());
    expect(handler).not.toHaveBeenCalled();
  });

  it('publishBatch preserves event order and appends each event once', async () => {
    const seen: string[] = [];
    const bus = new EventHandlerRegistry();
    bus.subscribe({
      eventTypes: ['bookingConfirmed', 'contractSigned'],
      handler: async (e) => { seen.push(e.event_type); },
    });

    await bus.publishBatch([
      makeEvent({ event_id: EVENT_ID, event_type: 'bookingConfirmed' }),
      makeEvent({ event_id: '55555555-5555-4555-8555-555555555555', event_type: 'contractSigned' }),
    ]);

    expect(seen).toEqual(['bookingConfirmed', 'contractSigned']);
    expect(rpcCalls('append_platform_event')).toHaveLength(2);
  });
});

// ============================================================
// Bounded consumer replay (migration 060)
// ============================================================

function replayRow(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    consumer_name: 'MOD-016.notifications',
    attempts: 1,
    event_type: 'bookingConfirmed',
    event_timestamp: '2026-11-10T10:00:00.000Z',
    source_module: 'MOD-002',
    aggregate_id: AGGREGATE_ID,
    aggregate_type: 'Booking',
    payload: { transporter_id: '44444444-4444-4444-8444-444444444444' },
    correlation_id: CORRELATION_ID,
    causation_id: null,
    version: 1,
    classification: EventClassification.BUSINESS,
    criticality: EventCriticality.HIGH,
    ...overrides,
  };
}

describe('I-3 §4B — bounded consumer replay', () => {
  it('claims with the bounded defaults and re-runs the registered consumer', async () => {
    const handler = vi.fn(async () => {});
    mocks.rpc.mockImplementation(async (fn: string) => ({
      data: fn === 'claim_failed_event_consumptions' ? [replayRow()] : true,
      error: null,
    }));

    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler, consumerName: 'MOD-016.notifications' });

    const result = await bus.replayFailedConsumptions();

    expect(rpcCalls('claim_failed_event_consumptions')).toEqual([
      {
        p_consumer_name: null,
        p_max_attempts: 5,
        p_batch_size: 25,
        p_stall_timeout_seconds: 300,
      },
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ claimed: 1, completed: 1, failed: 0, skipped: 0 });
    expect(rpcCalls('record_event_consumption')[0]).toMatchObject({
      p_status: 'COMPLETED',
      p_attempts: 2,
      p_last_error: null,
    });
  });

  it('reconstructs the original envelope for the replayed consumer', async () => {
    let received: NexCargoEvent | null = null;
    mocks.rpc.mockImplementation(async (fn: string) => ({
      data: fn === 'claim_failed_event_consumptions'
        ? [replayRow({ causation_id: CORRELATION_ID, attempts: 3 })]
        : true,
      error: null,
    }));

    const bus = new EventHandlerRegistry();
    bus.subscribe({
      eventTypes: ['bookingConfirmed'],
      consumerName: 'MOD-016.notifications',
      handler: async (e) => { received = e; },
    });

    const result = await bus.replayFailedConsumptions();

    expect(received).toEqual(makeEvent({ causation_id: CORRELATION_ID }));
    expect(result.completed).toBe(1);
    expect(rpcCalls('record_event_consumption')[0].p_attempts).toBe(4);
  });

  it('records FAILED with attempts+1 when the replayed consumer throws again', async () => {
    mocks.rpc.mockImplementation(async (fn: string) => ({
      data: fn === 'claim_failed_event_consumptions' ? [replayRow({ attempts: 4 })] : true,
      error: null,
    }));

    const bus = new EventHandlerRegistry();
    bus.subscribe({
      eventTypes: ['bookingConfirmed'],
      consumerName: 'MOD-016.notifications',
      handler: async () => { throw new Error('still failing'); },
    });

    const result = await bus.replayFailedConsumptions();

    expect(result).toEqual({ claimed: 1, completed: 0, failed: 1, skipped: 0 });
    expect(rpcCalls('record_event_consumption')[0]).toMatchObject({
      p_status: 'FAILED',
      p_attempts: 5,
      p_last_error: 'still failing',
    });
  });

  it('releases a claim for a consumer this process does not host', async () => {
    const handler = vi.fn(async () => {});
    mocks.rpc.mockImplementation(async (fn: string) => ({
      data: fn === 'claim_failed_event_consumptions'
        ? [replayRow({ consumer_name: 'MOD-999.other', attempts: 2 })]
        : true,
      error: null,
    }));

    const bus = new EventHandlerRegistry();
    bus.subscribe({ eventTypes: ['bookingConfirmed'], handler, consumerName: 'MOD-016.notifications' });

    const result = await bus.replayFailedConsumptions();

    expect(handler).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 1, completed: 0, failed: 0, skipped: 1 });
    // attempts is NOT incremented: no execution happened, so the retry budget is intact.
    expect(rpcCalls('record_event_consumption')[0]).toMatchObject({
      p_consumer_name: 'MOD-999.other',
      p_status: 'FAILED',
      p_attempts: 2,
    });
  });

  it('honours an explicit consumer filter and batch size', async () => {
    mocks.rpc.mockImplementation(async (fn: string) => ({
      data: fn === 'claim_failed_event_consumptions' ? [] : true,
      error: null,
    }));

    const bus = new EventHandlerRegistry();
    const result = await bus.replayFailedConsumptions({
      consumerName: 'MOD-016.notifications',
      maxAttempts: 7,
      batchSize: 3,
    });

    expect(rpcCalls('claim_failed_event_consumptions')[0]).toMatchObject({
      p_consumer_name: 'MOD-016.notifications',
      p_max_attempts: 7,
      p_batch_size: 3,
    });
    expect(result).toEqual({ claimed: 0, completed: 0, failed: 0, skipped: 0 });
  });

  it('returns an empty result when the claim RPC fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    const bus = new EventHandlerRegistry();
    expect(await bus.replayFailedConsumptions()).toEqual({
      claimed: 0, completed: 0, failed: 0, skipped: 0,
    });
  });

  it('returns an empty result when no admin client can be built', async () => {
    mocks.failCreate.value = true;
    const bus = new EventHandlerRegistry();
    expect(await bus.replayFailedConsumptions()).toEqual({
      claimed: 0, completed: 0, failed: 0, skipped: 0,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('the module-level helper replays against the shared singleton bus', async () => {
    const handler = vi.fn(async () => {});
    mocks.rpc.mockImplementation(async (fn: string) => ({
      data: fn === 'claim_failed_event_consumptions' ? [replayRow()] : true,
      error: null,
    }));

    getEventBus().subscribe({
      eventTypes: ['bookingConfirmed'],
      handler,
      consumerName: 'MOD-016.notifications',
    });

    const result = await replayFailedEventConsumptions();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.completed).toBe(1);
  });
});