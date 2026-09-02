// NexCargo MOD-011 — Adapter Tests (Phone normalization, fee calculation, status parsing)
// Authoritative source: ESS-002 §3.1 (Unit Validation Mandatory)
// Tests shared helper functions used across provider adapters.

import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../../infrastructure/adapters/base.adapter';
import { parseStatus } from '../../infrastructure/adapters/mkesh.helpers';
import { MobileMoneyTransactionStatus, MobileMoneyErrorCategory } from '../../infrastructure/adapters/mobile-money.types';

describe('MOD-011 Adapter Helpers', () => {
  describe('normalizePhone', () => {
    it('normalizes +258XXXXXXXXX format', () => {
      expect(normalizePhone('+258841234567')).toBe('+258841234567');
    });

    it('normalizes 258XXXXXXXXX format (no plus)', () => {
      expect(normalizePhone('258841234567')).toBe('+258841234567');
    });

    it('normalizes local 8XXXXXXXXX format', () => {
      expect(normalizePhone('841234567')).toBe('+258841234567');
    });

    it('handles phone numbers with spaces', () => {
      expect(normalizePhone('+258 84 123 4567')).toBe('+258841234567');
    });

    it('handles phone numbers with dashes', () => {
      expect(normalizePhone('+258-84-123-4567')).toBe('+258841234567');
    });

    it('rejects invalid length (too short)', () => {
      expect(normalizePhone('+2588412345')).toBeNull();
    });

    it('rejects invalid length (too long)', () => {
      expect(normalizePhone('+25884123456789')).toBeNull();
    });

    it('rejects non-digit characters', () => {
      expect(normalizePhone('+258XYZABCDEF')).toBeNull();
    });

    it('rejects unsupported country codes', () => {
      expect(normalizePhone('+123456789')).toBeNull();
    });
  });

  describe('parseStatus', () => {
    it('parses COMPLETED variants', () => {
      expect(parseStatus('COMPLETED')).toBe(MobileMoneyTransactionStatus.COMPLETED);
      expect(parseStatus('SUCCESS')).toBe(MobileMoneyTransactionStatus.COMPLETED);
      expect(parseStatus('0')).toBe(MobileMoneyTransactionStatus.COMPLETED);
    });

    it('parses FAILED variants', () => {
      expect(parseStatus('FAILED')).toBe(MobileMoneyTransactionStatus.FAILED);
      expect(parseStatus('ERROR')).toBe(MobileMoneyTransactionStatus.FAILED);
      expect(parseStatus('1')).toBe(MobileMoneyTransactionStatus.FAILED);
    });

    it('parses REFUNDED', () => {
      expect(parseStatus('REFUNDED')).toBe(MobileMoneyTransactionStatus.REFUNDED);
    });

    it('parses CANCELLED', () => {
      expect(parseStatus('CANCELLED')).toBe(MobileMoneyTransactionStatus.CANCELLED);
    });

    it('defaults to PENDING for unknown values', () => {
      expect(parseStatus('UNKNOWN_STATUS')).toBe(MobileMoneyTransactionStatus.PENDING);
      expect(parseStatus('')).toBe(MobileMoneyTransactionStatus.PENDING);
    });
  });
});
