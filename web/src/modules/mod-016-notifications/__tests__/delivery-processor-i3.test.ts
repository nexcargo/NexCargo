// NexCargo I-3 §4B/§4C/§4D — Delivery processor tests.
// UNIT tests against a fake Supabase client. They prove the processor persists every
// outcome (including SUCCESS), reports unconfigured providers honestly, releases
// stranded claims, and bounds its batch. Live behaviour is verified separately.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationChannel } from '@/shared/types/enums';
import { DeliveryEventStatus, DeliveryStatus } from '../domain/enums';
import { MAX_RETRY_COUNT, RETRY_BASE_DELAY_MS, ChannelExecutionStatus } from '../domain/types/delivery-pipeline';
import type { ChannelExecutor } from '../domain/types/delivery-pipeline';
import { ChannelExecutorRegistry } from '../infrastructure/adapters/channel-executor-registry';
import { UNCONFIGURED_CHANNELS } from '../infrastructure/adapters/channel-executors/stub-channel-executor';
import { NotificationDeliveryProcessor } from '../infrastructure/services/notification-delivery-processor';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';
const RECIPIENT_ID = '22222222-2222-4222-8222-222222222222';

const h = vi.hoisted(() => ({
  schemaCalls: [] as string[],
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  claimQueue: [] as Array<Record<string, unknown>>,
  claimAlways: false,
  recordErrors: [] as Array<{ message: string } | null>,
  recoverResult: 0 as unknown,
  recoverError: null as { message: string } | null,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    schema: (name: string) => {
      h.schemaCalls.push(name);
      return {
        rpc: async (fn: string, args: Record<string, unknown>) => {
          h.rpcCalls.push({ fn, args });
          if (fn === 'claim_one_queued_notification') {
            const row = h.claimAlways ? claimedRow() : h.claimQueue.shift();
            return { data: row ? [row] : [], error: null };
          }
          if (fn === 'record_delivery_attempt') {
            const error = h.recordErrors.length > 0 ? h.recordErrors.shift()! : null;
            return { data: error ? null : true, error };
          }
          if (fn === 'recover_stalled_processing') {
            return { data: h.recoverResult, error: h.recoverError };
          }
          return { data: null, error: { message: `unexpected rpc ${fn}` } };
        },
      };
    },
  }),
}));

function claimedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    recipient_id: RECIPIENT_ID,
    source_module: 'MOD-002',
    event_type: 'bookingConfirmed',
    title: 'Booking Confirmed',
    body: 'Your booking has been confirmed.',
    priority_level: 'HIGH',
    channel_type: NotificationChannel.IN_APP,
    locale: 'pt',
    template_id: null,
    event_correlation_id: '33333333-3333-4333-8333-333333333333',
    correlation_ref: 'corr-ref-001',
    source_event_id: '44444444-4444-4444-8444-444444444444',
    delivery_status: 'PROCESSING',
    retry_count: 0,
    provider_channel: null,
    next_retry_at: null,
    created_at: '2026-11-10T10:00:00.000Z',
    updated_at: '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}

function calls(fn: string) {
  return h.rpcCalls.filter((c) => c.fn === fn).map((c) => c.args);
}

/** A real provider would return this on a transient outage; the IN_APP stub cannot. */
function retryableExecutor(): ChannelExecutor {
  return {
    channelType: NotificationChannel.IN_APP,
    execute: async () => ({
      status: ChannelExecutionStatus.FAILED,
      errorMessage: 'provider timeout',
      isRetryable: true,
      timestamp: new Date(),
    }),
    verifyDelivery: async () => ({
      status: ChannelExecutionStatus.FAILED,
      isRetryable: false,
      timestamp: new Date(),
    }),
  };
}

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
let savedEnv: Record<string, string | undefined> = {};
let errorSpy: ReturnType<typeof vi.spyOn>;
let processor: NotificationDeliveryProcessor;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-placeholder';

  h.schemaCalls.length = 0;
  h.rpcCalls.length = 0;
  h.claimQueue.length = 0;
  h.claimAlways = false;
  h.recordErrors.length = 0;
  h.recoverResult = 0;
  h.recoverError = null;

  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  ChannelExecutorRegistry.getInstance().clear();
  processor = NotificationDeliveryProcessor.getInstance();
  // The singleton caches its initialization flag; reset it so each test re-registers
  // executors into the cleared registry.
  (processor as unknown as { initialized: boolean }).initialized = false;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  errorSpy.mockRestore();
});

// ============================================================
// Channel registration
// ============================================================

describe('I-3 §4C — channel executor registration', () => {
  it('registers IN_APP, which no production path registered before I-3', async () => {
    await processor.initialize();
    const registry = ChannelExecutorRegistry.getInstance();
    expect(registry.hasExecutor(NotificationChannel.IN_APP)).toBe(true);
  });

  it('registers an honest executor for every unconfigured channel', async () => {
    await processor.initialize();
    const registry = ChannelExecutorRegistry.getInstance();
    for (const channel of UNCONFIGURED_CHANNELS) {
      expect(registry.hasExecutor(channel)).toBe(true);
    }
    expect(registry.getRegisteredChannels()).toHaveLength(5);
  });

  it('is idempotent across repeated initialization', async () => {
    await processor.initialize();
    await processor.initialize();
    expect(ChannelExecutorRegistry.getInstance().getRegisteredChannels()).toHaveLength(5);
  });
});

// ============================================================
// Claiming
// ============================================================

describe('I-3 §4B — atomic claim', () => {
  it('claims through the communication_schema profile with the bounded retry ceiling', async () => {
    h.claimQueue.push(claimedRow());
    await processor.processOne();

    expect(new Set(h.schemaCalls)).toEqual(new Set(['communication_schema']));
    expect(calls('claim_one_queued_notification')[0]).toEqual({
      p_channel_type: null,
      p_max_retry_count: MAX_RETRY_COUNT,
    });
  });

  it('returns null when the claim yields an empty array', async () => {
    expect(await processor.processOne()).toBeNull();
    expect(calls('record_delivery_attempt')).toHaveLength(0);
  });

  it('unwraps the single-row array produced by RETURNS TABLE', async () => {
    h.claimQueue.push(claimedRow());
    const result = await processor.processOne();
    expect(result?.notificationId).toBe(NOTIFICATION_ID);
  });

  it('prefers correlation_ref over the UUID correlation column for tracing', async () => {
    h.claimQueue.push(claimedRow());
    const result = await processor.processOne();
    expect(result?.correlationId).toBe('corr-ref-001');
  });
});

// ============================================================
// Outcome persistence — every branch must record an attempt
// ============================================================

describe('I-3 §4B — delivery attempt recording', () => {
  it('persists the IN_APP SUCCESS outcome instead of stranding the row in PROCESSING', async () => {
    h.claimQueue.push(claimedRow());
    const result = await processor.processOne();

    expect(result).toMatchObject({
      success: true,
      deliveryEventStatus: DeliveryEventStatus.SUCCEEDED,
      finalDeliveryStatus: DeliveryStatus.DELIVERED,
      retryCount: 0,
    });
    expect(calls('record_delivery_attempt')).toEqual([
      {
        p_notification_id: NOTIFICATION_ID,
        p_status: DeliveryEventStatus.SUCCEEDED,
        p_channel_used: NotificationChannel.IN_APP,
        p_retry_count: 0,
        p_failure_reason: null,
        p_new_delivery_status: DeliveryStatus.DELIVERED,
        p_is_retryable: false,
        p_base_delay_ms: RETRY_BASE_DELAY_MS,
        p_auto_reset_to_queued: false,
      },
    ]);
  });

  it('fails an unconfigured channel terminally and never fabricates a recipient target', async () => {
    h.claimQueue.push(claimedRow({ channel_type: NotificationChannel.EMAIL }));
    const result = await processor.processOne();

    expect(result).toMatchObject({
      success: false,
      deliveryEventStatus: DeliveryEventStatus.FAILED,
      finalDeliveryStatus: DeliveryStatus.FAILED,
      retryCount: 1,
    });
    expect(result?.failureReason).toContain('PROVIDER_NOT_CONFIGURED');
    expect(calls('record_delivery_attempt')[0]).toMatchObject({
      p_status: DeliveryEventStatus.FAILED,
      p_new_delivery_status: DeliveryStatus.FAILED,
      p_is_retryable: false,
      p_channel_used: NotificationChannel.EMAIL,
    });
    expect(String(calls('record_delivery_attempt')[0].p_failure_reason)).not.toContain('@nexcargo.stub');
  });

  it('reports the same failure reason for all four unconfigured channels', async () => {
    for (const channel of UNCONFIGURED_CHANNELS) {
      h.rpcCalls.length = 0;
      h.claimQueue.push(claimedRow({ channel_type: channel }));
      const result = await processor.processOne();
      expect(result?.finalDeliveryStatus).toBe(DeliveryStatus.FAILED);
      expect(result?.failureReason).toContain(`no authorized ${channel} provider`);
    }
  });

  it('requeues a retryable failure below the ceiling with backoff', async () => {
    await processor.initialize();
    ChannelExecutorRegistry.getInstance().register(retryableExecutor());

    h.claimQueue.push(claimedRow({ retry_count: 1 }));
    const result = await processor.processOne();

    expect(result).toMatchObject({
      success: false,
      deliveryEventStatus: DeliveryEventStatus.RETRY_SCHEDULED,
      finalDeliveryStatus: DeliveryStatus.QUEUED,
      retryCount: 2,
    });
    expect(calls('record_delivery_attempt')[0]).toMatchObject({
      p_status: DeliveryEventStatus.RETRY_SCHEDULED,
      p_new_delivery_status: DeliveryStatus.QUEUED,
      p_is_retryable: true,
      p_retry_count: 2,
      p_base_delay_ms: RETRY_BASE_DELAY_MS,
    });
  });

  it('marks a retryable failure terminal once the ceiling is reached', async () => {
    await processor.initialize();
    ChannelExecutorRegistry.getInstance().register(retryableExecutor());

    h.claimQueue.push(claimedRow({ retry_count: MAX_RETRY_COUNT - 1 }));
    const result = await processor.processOne();

    expect(result?.retryCount).toBe(MAX_RETRY_COUNT);
    expect(result?.finalDeliveryStatus).toBe(DeliveryStatus.FAILED);
    expect(calls('record_delivery_attempt')[0].p_is_retryable).toBe(false);
  });
});

// ============================================================
// Failure recovery
// ============================================================

describe('I-3 §4B — processing error recovery', () => {
  it('releases the claim atomically when validation fails', async () => {
    h.claimQueue.push(claimedRow({ recipient_id: null }));
    const result = await processor.processOne();

    expect(result).toMatchObject({
      success: false,
      deliveryEventStatus: DeliveryEventStatus.RETRY_SCHEDULED,
      finalDeliveryStatus: DeliveryStatus.QUEUED,
      retryCount: 1,
    });
    expect(calls('record_delivery_attempt')[0]).toMatchObject({
      p_auto_reset_to_queued: true,
      p_is_retryable: true,
      p_new_delivery_status: null,
    });
    expect(calls('record_delivery_attempt')).toHaveLength(1);
  });

  it('marks a processing error terminal at the attempt ceiling', async () => {
    h.claimQueue.push(claimedRow({ recipient_id: null, retry_count: MAX_RETRY_COUNT - 1 }));
    const result = await processor.processOne();

    expect(result).toMatchObject({
      deliveryEventStatus: DeliveryEventStatus.FAILED,
      finalDeliveryStatus: DeliveryStatus.FAILED,
      retryCount: MAX_RETRY_COUNT,
    });
    expect(calls('record_delivery_attempt')[0]).toMatchObject({
      p_auto_reset_to_queued: false,
      p_is_retryable: false,
      p_new_delivery_status: DeliveryStatus.FAILED,
    });
  });

  it('never calls the removed two-step requeue_notification RPC', async () => {
    h.claimQueue.push(claimedRow({ recipient_id: null }));
    await processor.processOne();
    expect(calls('requeue_notification')).toHaveLength(0);
  });

  it('surfaces a record_delivery_attempt failure rather than reporting success', async () => {
    h.claimQueue.push(claimedRow());
    h.recordErrors.push({ message: 'deadlock detected' }, null);

    const result = await processor.processOne();

    expect(result?.success).toBe(false);
    expect(result?.failureReason).toContain('record_delivery_attempt failed');
    // First call failed in the persist step; the second is the atomic requeue.
    expect(calls('record_delivery_attempt')).toHaveLength(2);
    expect(calls('record_delivery_attempt')[1].p_auto_reset_to_queued).toBe(true);
  });

  it('recovers stalled PROCESSING claims with an explicit timeout', async () => {
    h.recoverResult = 4;
    expect(await processor.recoverStalledProcessing(120)).toBe(4);
    expect(calls('recover_stalled_processing')).toEqual([{ p_stall_timeout_seconds: 120 }]);
  });

  it('defaults the stall timeout to 300 seconds', async () => {
    await processor.recoverStalledProcessing();
    expect(calls('recover_stalled_processing')[0]).toEqual({ p_stall_timeout_seconds: 300 });
  });

  it('throws when stall recovery fails, so the caller cannot report a clean pass', async () => {
    h.recoverError = { message: 'permission denied' };
    await expect(processor.recoverStalledProcessing()).rejects.toThrow(
      'recover_stalled_processing failed: permission denied',
    );
  });
});

// ============================================================
// Bounded batch processing
// ============================================================

describe('I-3 §4D — bounded batch', () => {
  it('stops as soon as the queue is drained', async () => {
    h.claimQueue.push(claimedRow(), claimedRow({ id: 'second-row' }));
    const batch = await processor.processBatch(10);

    expect(batch.processedCount).toBe(2);
    expect(batch.successCount).toBe(2);
    expect(batch.failedCount).toBe(0);
    expect(batch.requeuedCount).toBe(0);
    expect(calls('claim_one_queued_notification')).toHaveLength(3);
  });

  it('clamps a non-positive batch size to one claim', async () => {
    h.claimAlways = true;
    const batch = await processor.processBatch(0);
    expect(batch.processedCount).toBe(1);
    expect(calls('claim_one_queued_notification')).toHaveLength(1);
  });

  it('clamps an oversized batch to 100 claims', async () => {
    h.claimAlways = true;
    const batch = await processor.processBatch(5000);
    expect(batch.processedCount).toBe(100);
    expect(calls('claim_one_queued_notification')).toHaveLength(100);
  });

  it('separates failed and requeued counts', async () => {
    h.claimQueue.push(
      claimedRow(),
      claimedRow({ id: 'email-row', channel_type: NotificationChannel.EMAIL }),
      claimedRow({ id: 'invalid-row', recipient_id: null }),
    );
    const batch = await processor.processBatch(10);

    expect(batch.processedCount).toBe(3);
    expect(batch.successCount).toBe(1);
    expect(batch.failedCount).toBe(1);
    expect(batch.requeuedCount).toBe(1);
  });

  it('reports an elapsed duration, not an epoch timestamp', async () => {
    const before = Date.now();
    const batch = await processor.processBatch(1);
    expect(batch.durationMs).toBeGreaterThanOrEqual(0);
    expect(batch.durationMs).toBeLessThan(Date.now() - before + 1000);
  });
});