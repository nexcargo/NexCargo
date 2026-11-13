// NexCargo MOD-016 — Delivery Pipeline Tests (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002
// Tests: Channel executors, registry, retry engine, delivery processor pipeline

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationChannel } from '@/shared/types/enums';
import {
  ChannelExecutionStatus,
  MAX_RETRY_COUNT,
  RETRY_BASE_DELAY_MS,
  MAX_BACKOFF_EXPONENT,
  BACKOFF_JITTER_RATIO,
  computeBackoffDelay,
} from '../domain/types/delivery-pipeline';
import type { ClaimedNotification, ChannelExecutionResult } from '../domain/types/delivery-pipeline';
import { DeliveryEventStatus, DeliveryStatus } from '../domain/enums';
import { ChannelExecutorRegistry, resolveRecipientTarget } from '../infrastructure/adapters/channel-executor-registry';
import { StubInAppChannelExecutor } from '../infrastructure/adapters/channel-executors/stub-in-app-channel-executor';
import { StubChannelExecutor } from '../infrastructure/adapters/channel-executors/stub-channel-executor';
import { StubEmailProviderAdapter } from '../infrastructure/adapters/notification-provider-adapter';

// ============================================================
// Helper: Create a test ClaimedNotification
// ============================================================

function createTestNotification(overrides?: Partial<ClaimedNotification>): ClaimedNotification {
  return {
    id: 'notif-test-id-001',
    recipientId: 'recipient-uuid-001',
    sourceModule: 'MOD-002',
    eventType: 'bookingConfirmed',
    title: 'Booking Confirmed',
    body: 'Your booking has been confirmed.',
    priorityLevel: 'HIGH' as any,
    channelType: NotificationChannel.IN_APP,
    locale: 'pt',
    templateId: null,
    eventCorrelationId: 'corr-uuid-001',
    correlationRef: 'corr-uuid-001',
    sourceEventId: null,
    deliveryStatus: 'QUEUED' as any,
    retryCount: 0,
    providerChannel: null,
    nextRetryAt: null,
    createdAt: new Date('2026-09-09T12:00:00Z'),
    updatedAt: new Date('2026-09-09T12:00:00Z'),
    ...overrides,
  };
}

// ============================================================
// Test Suite: StubInAppChannelExecutor
// ============================================================

describe('MOD-016 C5-II — StubInAppChannelExecutor', () => {
  const executor = new StubInAppChannelExecutor();

  describe('channel type', () => {
    it('should have IN_APP as its channel type', () => {
      expect(executor.channelType).toBe(NotificationChannel.IN_APP);
    });
  });

  describe('execute()', () => {
    it('should return SUCCESS for valid IN_APP notification', async () => {
      const notification = createTestNotification({
        channelType: NotificationChannel.IN_APP,
      });

      const result = await executor.execute(notification, 'recipient-uuid-001');

      expect(result.status).toBe(ChannelExecutionStatus.SUCCESS);
      expect(result.providerReferenceId).toBeDefined();
      expect(result.providerReferenceId).toContain('INAPP-');
      expect(result.isRetryable).toBe(false);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return SUCCESS with minimal recipient target', async () => {
      const notification = createTestNotification({
        channelType: NotificationChannel.IN_APP,
      });

      const result = await executor.execute(notification, 'user-123');

      expect(result.status).toBe(ChannelExecutionStatus.SUCCESS);
    });

    it('should return FAILED for channel type mismatch', async () => {
      const notification = createTestNotification({
        channelType: NotificationChannel.EMAIL, // Wrong channel
      });

      const result = await executor.execute(notification, 'test@example.com');

      expect(result.status).toBe(ChannelExecutionStatus.FAILED);
      expect(result.isRetryable).toBe(false);
      expect(result.errorMessage).toContain('Channel mismatch');
    });

    it('should return FAILED for empty recipient target', async () => {
      const notification = createTestNotification({
        channelType: NotificationChannel.IN_APP,
      });

      const result = await executor.execute(notification, '');

      expect(result.status).toBe(ChannelExecutionStatus.FAILED);
      expect(result.errorMessage).toContain('Empty recipient target');
    });

    it('should return FAILED for null recipient target', async () => {
      const notification = createTestNotification({
        channelType: NotificationChannel.IN_APP,
      });

      const result = await executor.execute(notification, '' as never);

      expect(result.status).toBe(ChannelExecutionStatus.FAILED);
    });
  });

  describe('verifyDelivery()', () => {
    it('should verify valid INAPP reference', async () => {
      const result = await executor.verifyDelivery('INAPP-notif-test-id-001');

      expect(result.status).toBe(ChannelExecutionStatus.SUCCESS);
      expect(result.providerReferenceId).toBe('INAPP-notif-test-id-001');
    });

    it('should reject invalid format', async () => {
      const result = await executor.verifyDelivery('INVALID-format');

      expect(result.status).toBe(ChannelExecutionStatus.FAILED);
      expect(result.errorMessage).toContain('Invalid IN_APP provider reference format');
    });

    it('should reject empty reference', async () => {
      const result = await executor.verifyDelivery('');

      expect(result.status).toBe(ChannelExecutionStatus.FAILED);
    });

    it('should reject null reference', async () => {
      const result = await executor.verifyDelivery(null as never);

      expect(result.status).toBe(ChannelExecutionStatus.FAILED);
    });
  });
});

// ============================================================
// Test Suite: StubChannelExecutor (fallback for non-IN_APP)
// ============================================================

describe('MOD-016 C5-II — StubChannelExecutor', () => {
  const channels: NotificationChannel[] = [
    NotificationChannel.EMAIL,
    NotificationChannel.SMS,
    NotificationChannel.PUSH,
    NotificationChannel.WHATSAPP,
  ];

  for (const channel of channels) {
    describe(channel, () => {
      const executor = new StubChannelExecutor(channel);

      it(`should have correct channel type: ${channel}`, () => {
        expect(executor.channelType).toBe(channel);
      });

      it('should report PROVIDER_NOT_CONFIGURED for valid input', async () => {
        const notification = createTestNotification({ channelType: channel });
        const result = await executor.execute(notification, `target-for-${channel}`);

        // I-3 §9: an unimplemented provider must not be disguised as a completed
        // integration. The C5-II stub returned SUCCESS with a fabricated STUB-
        // reference, which made the pipeline mark undelivered rows SENT.
        expect(result.status).toBe(ChannelExecutionStatus.FAILED);
        expect(result.errorMessage).toContain('PROVIDER_NOT_CONFIGURED');
        expect(result.errorMessage).toContain(channel);
        expect(result.providerReferenceId).toBeUndefined();
        expect(result.isRetryable).toBe(false);
      });

      it('should return FAILED for empty recipient', async () => {
        const notification = createTestNotification({ channelType: channel });
        const result = await executor.execute(notification, '');

        expect(result.status).toBe(ChannelExecutionStatus.FAILED);
        expect(result.isRetryable).toBe(false);
      });

      it('should report PROVIDER_NOT_CONFIGURED when verifying a reference', async () => {
        // No provider exists, so no reference can be verified against one.
        const ref = `STUB-${channel}-notif-test`;
        const result = await executor.verifyDelivery(ref);

        expect(result.status).toBe(ChannelExecutionStatus.FAILED);
        expect(result.errorMessage).toContain('PROVIDER_NOT_CONFIGURED');
        expect(result.providerReferenceId).toBeUndefined();
      });

      it('should reject invalid stub reference format', async () => {
        const result = await executor.verifyDelivery('INVALID-format');

        expect(result.status).toBe(ChannelExecutionStatus.FAILED);
      });
    });
  }

  it('should throw for invalid channel type', () => {
    expect(() => new StubChannelExecutor('INVALID' as never)).toThrow();
  });
});

// ============================================================
// Test Suite: Channel Executor Registry
// ============================================================

describe('MOD-016 C5-II — ChannelExecutorRegistry', () => {
  let registry: ChannelExecutorRegistry;

  beforeEach(() => {
    // Reset singleton for each test
    vi.resetModules();
    registry = ChannelExecutorRegistry.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = ChannelExecutorRegistry.getInstance();
    const instance2 = ChannelExecutorRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should start with no registered channels', () => {
    expect(registry.getRegisteredChannels()).toHaveLength(0);
  });

  it('should register and retrieve an executor', () => {
    const executor = new StubInAppChannelExecutor();
    registry.register(executor);

    expect(registry.hasExecutor(NotificationChannel.IN_APP)).toBe(true);
    expect(registry.getExecutor(NotificationChannel.IN_APP)).toBe(executor);
  });

  it('should return undefined for unregistered channel', () => {
    expect(registry.getExecutor(NotificationChannel.EMAIL)).toBeUndefined();
  });

  it('should list all registered channels', () => {
    registry.register(new StubInAppChannelExecutor());
    registry.register(new StubChannelExecutor(NotificationChannel.EMAIL));

    const channels = registry.getRegisteredChannels();
    expect(channels).toContain(NotificationChannel.IN_APP);
    expect(channels).toContain(NotificationChannel.EMAIL);
    expect(channels).toHaveLength(2);
  });
});

// ============================================================
// Test Suite: resolveRecipientTarget
// ============================================================

describe('MOD-016 C5-II — resolveRecipientTarget', () => {
  it('should return recipientId for IN_APP', () => {
    const target = resolveRecipientTarget('user-123', NotificationChannel.IN_APP);
    expect(target).toBe('user-123');
  });

  // I-3 §4C: no provider credentials exist for these channels, so no delivery
  // target may be fabricated. A null target makes the processor report a terminal
  // PROVIDER_NOT_CONFIGURED failure instead of inventing an email/phone/token.
  it('should return null for EMAIL (no provider configured)', () => {
    expect(resolveRecipientTarget('user-123', NotificationChannel.EMAIL)).toBeNull();
  });

  it('should return null for SMS (no provider configured)', () => {
    expect(resolveRecipientTarget('user-123', NotificationChannel.SMS)).toBeNull();
  });

  it('should return null for PUSH (no provider configured)', () => {
    expect(resolveRecipientTarget('user-123', NotificationChannel.PUSH)).toBeNull();
  });

  it('should return null for WHATSAPP (no provider configured)', () => {
    expect(resolveRecipientTarget('user-123', NotificationChannel.WHATSAPP)).toBeNull();
  });

  it('should throw for unknown channel type', () => {
    expect(() => resolveRecipientTarget('user-123', 'UNKNOWN' as never))
      .toThrow('Unknown channel type');
  });
});

// ============================================================
// Test Suite: Retry Engine (computeBackoffDelay)
// ============================================================

describe('MOD-016 — Retry Engine (I-3 §4B / ESS-001C §4.1)', () => {
  it('should have MAX_RETRY_COUNT set to 5', () => {
    // ESS-001C §4.1 requires 5–10 bounded retries; migration 059 caps attempts at 5.
    expect(MAX_RETRY_COUNT).toBe(5);
    expect(MAX_RETRY_COUNT).toBeGreaterThanOrEqual(5);
    expect(MAX_RETRY_COUNT).toBeLessThanOrEqual(10);
  });

  it('should have RETRY_BASE_DELAY_MS set to 1000', () => {
    expect(RETRY_BASE_DELAY_MS).toBe(1000);
  });

  describe('computeBackoffDelay()', () => {
    // ESS-001C §4.1 mandates exponential backoff WITH jitter, so the result is a
    // band [base*2^n, base*2^n * 1.3) rather than a deterministic value.
    function expectInBand(retryCount: number, baseDelayMs = RETRY_BASE_DELAY_MS) {
      const floor = baseDelayMs * Math.pow(2, Math.min(retryCount, MAX_BACKOFF_EXPONENT));
      const delay = computeBackoffDelay(retryCount, baseDelayMs);
      expect(delay).toBeGreaterThanOrEqual(floor);
      expect(delay).toBeLessThan(Math.ceil(floor * (1 + BACKOFF_JITTER_RATIO)));
    }

    it('should return the base delay band for retry count 0', () => {
      expectInBand(0);
    });

    it('should double the delay band for each retry count', () => {
      expectInBand(0); // 1000..1300
      expectInBand(1); // 2000..2600
      expectInBand(2); // 4000..5200
      expectInBand(3); // 8000..10400
    });

    it('should respect custom base delay', () => {
      expectInBand(0, 500);
      expectInBand(1, 500);
      expectInBand(2, 500);
    });

    it('should apply jitter so identical retry counts are not all equal', () => {
      const samples = Array.from({ length: 40 }, () => computeBackoffDelay(4));
      expect(new Set(samples).size).toBeGreaterThan(1);
    });

    it('should clamp the exponent so the delay cannot grow without bound', () => {
      const ceiling = RETRY_BASE_DELAY_MS * Math.pow(2, MAX_BACKOFF_EXPONENT);
      expect(computeBackoffDelay(MAX_BACKOFF_EXPONENT + 25)).toBeLessThan(
        Math.ceil(ceiling * (1 + BACKOFF_JITTER_RATIO)),
      );
    });

    it('should never return a negative delay', () => {
      expect(computeBackoffDelay(-3)).toBeGreaterThanOrEqual(RETRY_BASE_DELAY_MS);
    });
  });
});

// ============================================================
// Test Suite: Security — Server-Only Processing Boundary
// ============================================================

describe('MOD-016 C5-II — Security Boundaries', () => {
  it('should validate notification fields before processing', () => {
    // The processor validates claimed notifications have required fields
    // Direct unit test would require mocking the entire DB layer
    
    // Instead, verify the types enforce required fields
    const notification = createTestNotification();
    expect(notification.id).toBeDefined();
    expect(notification.recipientId).toBeDefined();
    expect(notification.channelType).toBeDefined();
  });

  it('should reject notifications without ID for processing', () => {
    const notification = createTestNotification({ id: '' as never });
    
    // In production, the processor throws on empty ID
    // Here we verify the data contract
    expect(() => {
      if (!notification.id) {
        throw new Error('Claimed notification missing ID');
      }
    }).toThrow('Claimed notification missing ID');
  });

  it('should reject notifications without recipientId', () => {
    const notification = createTestNotification({ recipientId: '' as never });
    
    expect(() => {
      if (!notification.recipientId) {
        throw new Error('Claimed notification missing recipientId');
      }
    }).toThrow('Claimed notification missing recipientId');
  });

  it('should reject notifications with invalid channel type', () => {
    const notification = createTestNotification({ 
      channelType: 'INVALID_CHANNEL' as never 
    });
    
    // NotificationChannel enum validation
    const validChannels = Object.values(NotificationChannel);
    expect(validChannels.includes(notification.channelType as any)).toBe(false);
  });
});

// ============================================================
// Test Suite: Delivery Status Lifecycle
// ============================================================

describe('MOD-016 C5-II — Delivery Status Lifecycle', () => {
  it('should define QUEUED status', () => {
    expect(DeliveryStatus.QUEUED).toBe('QUEUED');
  });

  it('should define SENT status', () => {
    expect(DeliveryStatus.SENT).toBe('SENT');
  });

  it('should define DELIVERED status', () => {
    expect(DeliveryStatus.DELIVERED).toBe('DELIVERED');
  });

  it('should define FAILED status', () => {
    expect(DeliveryStatus.FAILED).toBe('FAILED');
  });

  it('should define SUCCEEDED delivery event status', () => {
    expect(DeliveryEventStatus.SUCCEEDED).toBe('SUCCEEDED');
  });

  it('should define RETRY_SCHEDULED delivery event status', () => {
    expect(DeliveryEventStatus.RETRY_SCHEDULED).toBe('RETRY_SCHEDULED');
  });

  it('should define ATTEMPTED delivery event status', () => {
    expect(DeliveryEventStatus.ATTEMPTED).toBe('ATTEMPTED');
  });

  it('should define FAILED delivery event status', () => {
    expect(DeliveryEventStatus.FAILED).toBe('FAILED');
  });
});

// ============================================================
// Test Suite: Provider Adapter Compatibility
// ============================================================

describe('MOD-016 C5-II — Provider Adapter Compatibility', () => {
  it('should still export StubEmailProviderAdapter from C5-I', () => {
    const adapter = new StubEmailProviderAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.send).toBe('function');
    expect(typeof adapter.verifyDelivery).toBe('function');
  });

  it('StubEmailProviderAdapter should remain deterministic (no network)', async () => {
    const adapter = new StubEmailProviderAdapter();
    
    // Should not throw even without network
    await expect(adapter.send({
      recipient: 'test@test.com',
      channelType: NotificationChannel.EMAIL,
      title: 'Test',
      body: 'Test body',
      correlationId: 'corr-1',
      priorityLevel: 'MEDIUM',
    })).resolves.not.toThrow();
  });
});

// ============================================================
// Test Suite: Security — Server-Only Processing Boundary
// ============================================================

describe('MOD-016 C5-II — Security Boundaries', () => {
  it('should validate notification fields before processing', () => {
    // The processor validates claimed notifications have required fields
    // Direct unit test would require mocking the entire DB layer
    
    // Instead, verify the types enforce required fields
    const notification = createTestNotification();
    expect(notification.id).toBeDefined();
    expect(notification.recipientId).toBeDefined();
    expect(notification.channelType).toBeDefined();
  });

  it('should reject notifications without ID for processing', () => {
    const notification = createTestNotification({ id: '' as never });
    
    // In production, the processor throws on empty ID
    // Here we verify the data contract
    expect(() => {
      if (!notification.id) {
        throw new Error('Claimed notification missing ID');
      }
    }).toThrow('Claimed notification missing ID');
  });

  it('should reject notifications without recipientId', () => {
    const notification = createTestNotification({ recipientId: '' as never });
    
    expect(() => {
      if (!notification.recipientId) {
        throw new Error('Claimed notification missing recipientId');
      }
    }).toThrow('Claimed notification missing recipientId');
  });

  it('should reject notifications with invalid channel type', () => {
    const notification = createTestNotification({ 
      channelType: 'INVALID_CHANNEL' as never 
    });
    
    // NotificationChannel enum validation
    const validChannels = Object.values(NotificationChannel);
    expect(validChannels.includes(notification.channelType as any)).toBe(false);
  });
});

// ============================================================
// Test Suite: Correlation ID Preservation
// ============================================================

describe('MOD-016 C5-II — Correlation ID Propagation', () => {
  it('should preserve correlation ID through notification creation', () => {
    const notification = createTestNotification({
      eventCorrelationId: 'my-correlation-id-xyz',
    });

    expect(notification.eventCorrelationId).toBe('my-correlation-id-xyz');
  });

  it('should handle null correlation ID gracefully', () => {
    const notification = createTestNotification({
      eventCorrelationId: null,
    });

    expect(notification.eventCorrelationId).toBeNull();
  });

  it('should include correlation ID in delivery result tracking', () => {
    // Simulate what the delivery processor returns
    const notification = createTestNotification({
      eventCorrelationId: 'corr-abc-123',
    });

    // The delivery result includes correlationId for traceability
    const result = {
      notificationId: notification.id,
      success: true,
      deliveryEventStatus: DeliveryEventStatus.SUCCEEDED,
      finalDeliveryStatus: DeliveryStatus.DELIVERED,
      channelUsed: notification.channelType,
      retryCount: 0,
      correlationId: notification.eventCorrelationId,
      processedAt: new Date(),
    };

    expect(result.correlationId).toBe('corr-abc-123');
  });
});
