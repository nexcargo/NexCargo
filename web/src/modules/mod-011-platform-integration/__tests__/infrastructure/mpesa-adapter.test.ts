// NexCargo MOD-011 — M-Pesa Adapter Tests
// Authoritative source: ESS-002 §3.1 (Unit Validation Mandatory)
// Tests MpesaAdapter behavior with mock/sandbox data.

import { describe, it, expect, beforeEach } from 'vitest';
import { MpesaAdapter } from '../../infrastructure/adapters/mpesa.adapter';
import { MobileMoneyProvider, MobileMoneyTransactionStatus, MobileMoneyErrorCategory, MobileMoneyAuthMethod } from '../../infrastructure/adapters/mobile-money.types';
import type { MobileMoneyPaymentRequest } from '../../infrastructure/adapters/mobile-money.types';

describe('MpesaAdapter', () => {
  let adapter: MpesaAdapter;

  beforeEach(() => {
    adapter = new MpesaAdapter();
  });

  describe('initialization', () => {
    it('accepts valid credentials', async () => {
      await expect(
        adapter.initialize({
          method: MobileMoneyAuthMethod.API_KEY_SECRET,
          apiKey: 'test-key-12345',
          apiSecret: 'test-secret-67890',
          baseUrl: 'https://sandbox.safaricom.co.ke/mpesa',
        })
      ).resolves.toBeUndefined();
    });

    it('rejects missing baseUrl', async () => {
      await expect(
        adapter.initialize({
          method: MobileMoneyAuthMethod.API_KEY_SECRET,
          apiKey: 'test-key',
          apiSecret: 'test-secret',
          baseUrl: '',
        })
      ).rejects.toThrow('baseUrl is required');
    });

    it('rejects missing API key/secret for OAuth', async () => {
      await expect(
        adapter.initialize({
          method: MobileMoneyAuthMethod.API_KEY_SECRET,
          apiKey: '',
          apiSecret: '',
          baseUrl: 'https://example.com',
        })
      ).rejects.toThrow(/API key and secret/);
    });

    it('reports correct provider', () => {
      expect(adapter.provider).toBe(MobileMoneyProvider.MPESA);
    });
  });

  describe('initiatePayment', () => {
    beforeEach(async () => {
      await adapter.initialize({
        method: MobileMoneyAuthMethod.API_KEY_SECRET,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        baseUrl: 'https://sandbox.example.com',
      });
    });

    it('completes a valid payment', async () => {
      const request: MobileMoneyPaymentRequest = {
        amount: 500,
        currency: 'MZN',
        recipientPhone: '+258841234567',
        referenceId: 'TEST-REF-001',
      };

      const result = await adapter.initiatePayment(request);

      expect(result).not.toHaveProperty('errorCode');
      if ('transactionId' in result) {
        expect(result.transactionId).toBeDefined();
        expect(result.referenceId).toBe('TEST-REF-001');
        expect(result.status).toBe(MobileMoneyTransactionStatus.COMPLETED);
        expect(result.amount).toBe(500);
        expect(result.currency).toBe('MZN');
        expect(result.feeAmount).toBeGreaterThan(0);
        expect(result.completedAt).toBeDefined();
      } else {
        expect.fail('Expected successful payment response');
      }
    });

    it('rejects invalid phone number', async () => {
      const request: MobileMoneyPaymentRequest = {
        amount: 100,
        currency: 'MZN',
        recipientPhone: 'invalid-phone',
        referenceId: 'TEST-REF-002',
      };

      const result = await adapter.initiatePayment(request);

      if ('errorCode' in result) {
        expect(result.errorCode).toBe(MobileMoneyErrorCategory.INVALID_PHONE_NUMBER);
      } else {
        expect.fail('Expected error response for invalid phone');
      }
    });

    it('rejects duplicate reference ID', async () => {
      const request: MobileMoneyPaymentRequest = {
        amount: 100,
        currency: 'MZN',
        recipientPhone: '+258841234567',
        referenceId: 'DUP-REF-001',
      };

      // First call succeeds
      const firstResult = await adapter.initiatePayment(request);
      expect(firstResult).toHaveProperty('transactionId');

      // Second call with same reference fails
      const secondResult = await adapter.initiatePayment(request);
      if ('errorCode' in secondResult) {
        expect(secondResult.errorCode).toBe(MobileMoneyErrorCategory.DUPLICATE_TRANSACTION);
      } else {
        expect.fail('Expected duplicate rejection');
      }
    });

    it('calculates fee correctly for small amounts', async () => {
      const request: MobileMoneyPaymentRequest = {
        amount: 30,
        currency: 'MZN',
        recipientPhone: '+258841234567',
        referenceId: 'FEE-TEST-001',
      };

      const result = await adapter.initiatePayment(request);

      if ('transactionId' in result && result.feeAmount !== undefined) {
        expect(result.feeAmount).toBe(0);
      } else {
        expect.fail('Expected successful payment with zero fee');
      }
    });
  });

  describe('queryTransaction', () => {
    beforeEach(async () => {
      await adapter.initialize({
        method: MobileMoneyAuthMethod.API_KEY_SECRET,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        baseUrl: 'https://sandbox.example.com',
      });
    });

    it('returns transaction for known reference', async () => {
      const ref = 'QRY-' + Math.random().toString(36).slice(2);
      const payResult = await adapter.initiatePayment({
        amount: 200,
        currency: 'MZN',
        recipientPhone: '+258841234567',
        referenceId: ref,
      });
      expect(payResult).not.toHaveProperty('errorCode');
      const result = await adapter.queryTransaction(ref);
      expect(result).not.toHaveProperty('errorCode');
      if ('transactionId' in result && result) {
        expect((result as any).referenceId).toBe(ref);
      }
    });

    it('returns error for unknown reference', async () => {
      const result = await adapter.queryTransaction('NONEXISTENT-999');
      expect(result).toHaveProperty('errorCode');
    });
  });

  describe('webhook processing', () => {
    beforeEach(async () => {
      await adapter.initialize({
        method: MobileMoneyAuthMethod.API_KEY_SECRET,
        apiKey: 'test-webhook-secret',
        apiSecret: 'test-secret',
        baseUrl: 'https://sandbox.example.com',
      });
    });

    it('rejects webhook without signature verification', async () => {
      const payload = JSON.stringify({
        eventType: 'payment.completed',
        transactionId: 'TEST-TX-001',
        referenceId: 'WEBHOOK-REF-001',
        status: 'COMPLETED',
        amount: 500,
        recipientPhone: '+258841234567',
        timestamp: new Date().toISOString(),
      });

      const result = await adapter.processWebhook(payload, '');
      // Without valid signature, should return error
      expect(result).not.toHaveProperty('eventType');
    });
  });

  describe('health check', () => {
    it('reports not operational when not initialized', async () => {
      const health = await adapter.getHealth();
      expect(health.operational).toBe(false);
    });

    it('reports operational after initialization', async () => {
      await adapter.initialize({
        method: MobileMoneyAuthMethod.API_KEY_SECRET,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        baseUrl: 'https://sandbox.example.com',
      });
      const health = await adapter.getHealth();
      expect(health.operational).toBe(true);
    });

    it('reports correct provider in health', async () => {
      const health = await adapter.getHealth();
      expect(health.provider).toBe(MobileMoneyProvider.MPESA);
    });
  });

  describe('retry policy', () => {
    it('returns retry configuration', () => {
      const policy = adapter.getRetryPolicy();
      expect(policy.maxRetries).toBe(3);
      expect(policy.initialDelayMs).toBe(1000);
      expect(policy.retryableErrors).toContain('PROVIDER_TIMEOUT');
      expect(policy.retryableErrors).toContain('PROVIDER_UNAVAILABLE');
    });
  });
});
