// NexCargo MOD-011 — Mobile Money Type Tests
// Authoritative source: ESS-002 §3.1 (Unit Validation Mandatory)
// Tests type definitions and enum values for mobile money integration layer.

import { describe, it, expect } from 'vitest';
import {
  MobileMoneyProvider,
  MobileMoneyChannelType,
  MobileMoneyTransactionStatus,
  MobileMoneyErrorCategory,
  MobileMoneyAuthMethod,
} from '../../infrastructure/adapters/mobile-money.types';

describe('MOD-011 Mobile Money Types', () => {
  describe('MobileMoneyProvider enum', () => {
    it('contains MPESA provider', () => {
      expect(MobileMoneyProvider.MPESA).toBe('MPESA');
    });

    it('contains MKESH provider', () => {
      expect(MobileMoneyProvider.MKESH).toBe('MKESH');
    });

    it('contains E_MOLA provider', () => {
      expect(MobileMoneyProvider.E_MOLA).toBe('E_MOLA');
    });

    it('has exactly 3 providers', () => {
      const values = Object.values(MobileMoneyProvider);
      expect(values).toHaveLength(3);
      expect(values).toContain('MPESA');
      expect(values).toContain('MKESH');
      expect(values).toContain('E_MOLA');
    });
  });

  describe('MobileMoneyTransactionStatus enum', () => {
    it('contains all expected status values', () => {
      expect(MobileMoneyTransactionStatus.PENDING).toBe('PENDING');
      expect(MobileMoneyTransactionStatus.COMPLETED).toBe('COMPLETED');
      expect(MobileMoneyTransactionStatus.FAILED).toBe('FAILED');
      expect(MobileMoneyTransactionStatus.REFUNDED).toBe('REFUNDED');
      expect(MobileMoneyTransactionStatus.CANCELLED).toBe('CANCELLED');
    });

    it('has exactly 5 status values', () => {
      const values = Object.values(MobileMoneyTransactionStatus);
      expect(values).toHaveLength(5);
    });
  });

  describe('MobileMoneyErrorCategory enum', () => {
    it('contains error categories', () => {
      expect(MobileMoneyErrorCategory.AUTHENTICATION_FAILED).toBe('AUTHENTICATION_FAILED');
      expect(MobileMoneyErrorCategory.INSUFFICIENT_FUNDS).toBe('INSUFFICIENT_FUNDS');
      expect(MobileMoneyErrorCategory.PROVIDER_TIMEOUT).toBe('PROVIDER_TIMEOUT');
      expect(MobileMoneyErrorCategory.UNKNOWN_PROVIDER_ERROR).toBe('UNKNOWN_PROVIDER_ERROR');
    });

    it('has at least 8 error categories', () => {
      const values = Object.values(MobileMoneyErrorCategory);
      expect(values.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('MobileMoneyAuthMethod enum', () => {
    it('contains authentication methods', () => {
      expect(MobileMoneyAuthMethod.API_KEY_SECRET).toBe('API_KEY_SECRET');
      expect(MobileMoneyAuthMethod.BASIC_AUTH).toBe('BASIC_AUTH');
      expect(MobileMoneyAuthMethod.CUSTOM).toBe('CUSTOM');
    });
  });
});
