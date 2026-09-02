// NexCargo MOD-011 — Mobile Money Gateway Tests
// Authoritative source: ESS-002 §3.1 (Unit Validation), §3.2 (Integration Validation)
// Tests MobileMoneyGateway coordination across adapters with retry logic.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MobileMoneyGateway,
  MobileMoneyRegistry,
  createMobileMoneyAdapter,
} from '../../infrastructure/gateways/mobile-money-gateway';
import { MpesaAdapter } from '../../infrastructure/adapters/mpesa.adapter';
import { MkeshAdapter } from '../../infrastructure/adapters/mkesh.adapter';
import { EMolaAdapter } from '../../infrastructure/adapters/emola.adapter';
import { MobileMoneyProvider, MobileMoneyAuthMethod, MobileMoneyTransactionStatus } from '../../infrastructure/adapters/mobile-money.types';
import type { IMobileMoneyAdapter, MobileMoneyCredentials } from '../../infrastructure/adapters/base.adapter';

describe('MOD-011 MobileMoneyGateway', () => {
  let gateway: MobileMoneyGateway;
  let registry: MobileMoneyRegistry;

  beforeEach(() => {
    registry = new MobileMoneyRegistry();
    gateway = new MobileMoneyGateway(registry);
  });

  describe('registry operations', () => {
    it('creates default adapter on first access', () => {
      const adapter = registry.get(MobileMoneyProvider.MPESA);
      expect(adapter).toBeInstanceOf(MpesaAdapter);
      expect(adapter.provider).toBe(MobileMoneyProvider.MPESA);
    });

    it('reuses existing adapter instance', () => {
      const a1 = registry.get(MobileMoneyProvider.MPESA);
      const a2 = registry.get(MobileMoneyProvider.MPESA);
      expect(a1).toBe(a2); // Same instance
    });

    it('registers custom adapter', () => {
      const mockAdapter: IMobileMoneyAdapter = {
        provider: MobileMoneyProvider.MKESH,
        initialize: vi.fn(),
        initiatePayment: vi.fn(),
        queryTransaction: vi.fn(),
        processWebhook: vi.fn(),
        getHealth: vi.fn(),
        getRetryPolicy: () => ({ maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2, retryableErrors: [] }),
      };
      registry.register(MobileMoneyProvider.MKESH, mockAdapter);
      const retrieved = registry.get(MobileMoneyProvider.MKESH);
      expect(retrieved).toBe(mockAdapter);
    });

    it('lists registered providers', () => {
      registry.get(MobileMoneyProvider.MPESA);
      registry.get(MobileMoneyProvider.E_MOLA);
      const providers = registry.listProviders();
      expect(providers).toContain(MobileMoneyProvider.MPESA);
      expect(providers).toContain(MobileMoneyProvider.E_MOLA);
      expect(providers).not.toContain(MobileMoneyProvider.MKESH); // Not accessed yet
    });
  });

  describe('adapter factory', () => {
    it('creates MpesaAdapter for MPESA', () => {
      const adapter = createMobileMoneyAdapter(MobileMoneyProvider.MPESA);
      expect(adapter).toBeInstanceOf(MpesaAdapter);
    });

    it('creates MkeshAdapter for MKESH', () => {
      const adapter = createMobileMoneyAdapter(MobileMoneyProvider.MKESH);
      expect(adapter).toBeInstanceOf(MkeshAdapter);
    });

    it('creates EMolaAdapter for E_MOLA', () => {
      const adapter = createMobileMoneyAdapter(MobileMoneyProvider.E_MOLA);
      expect(adapter).toBeInstanceOf(EMolaAdapter);
    });

    it('throws for unknown provider', () => {
      expect(() => createMobileMoneyAdapter('UNKNOWN' as MobileMoneyProvider)).toThrow('Unknown mobile money provider');
    });
  });

  describe('initiatePayment via gateway', () => {
    beforeEach(async () => {
      await gateway.configureProvider(MobileMoneyProvider.MPESA, {
        method: MobileMoneyAuthMethod.API_KEY_SECRET,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        baseUrl: 'https://sandbox.example.com',
      });
    });

    it('completes payment successfully', async () => {
      const result = await gateway.initiatePayment(MobileMoneyProvider.MPESA, {
        amount: 500,
        currency: 'MZN',
        recipientPhone: '+258841234567',
        referenceId: 'GW-TEST-001',
      });

      if ('transactionId' in result) {
        expect(result.status).toBe(MobileMoneyTransactionStatus.COMPLETED);
      } else {
        expect.fail('Expected successful payment response');
      }
    }, 10000); // Allow time for any retry delays
  });

  describe('queryTransaction via gateway', () => {
    it('returns error when not initialized', async () => {
      // Clear registry to ensure adapter is uninitialized
      const freshRegistry = new MobileMoneyRegistry();
      const freshGateway = new MobileMoneyGateway(freshRegistry);

      const result = await freshGateway.queryTransaction(MobileMoneyProvider.MPESA, 'NONEXISTENT');
      expect(result).toHaveProperty('errorCode');
    });
  });

  describe('getProviderHealth', () => {
    it('reports health after initialization', async () => {
      await gateway.configureProvider(MobileMoneyProvider.MPESA, {
        method: MobileMoneyAuthMethod.API_KEY_SECRET,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        baseUrl: 'https://sandbox.example.com',
      });

      const health = await gateway.getProviderHealth(MobileMoneyProvider.MPESA);
      expect(health.operational).toBe(true);
      expect(health.lastChecked).toBeDefined();
    });
  });
});
