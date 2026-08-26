// NexCargo MOD-013 — Financial Domain Services Tests
// Wave 2 — Phase 2A, Increment 2 — Authorized per HAO-MOD013-INC2
// Reference: MOD-013 §6 (Responsibilities)

import { describe, it, expect } from 'vitest';
import {
  validateSettlementRequest,
  validateLedgerEntry,
  validateCurrencyConversion,
  validateRefundInstruction,
  validateFeeRecord,
  validatePayoutInstruction,
  validateAuditRecord,
} from '@/modules/mod-013-financial-infrastructure/domain/services/financial-services';
import type { CurrencyCode } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import type { DebitCreditType, LedgerEntryType } from '@/modules/mod-013-financial-infrastructure/domain/enums';
import type { RecipientChannel } from '@/modules/mod-013-financial-infrastructure/domain/enums';

// ============================================================
// Settlement Request Validation Tests
// Per MOD-013 §6.2 — Settlement Structuring
// ============================================================

describe('MOD-013 Settlement Request Validation', () => {
  it('accepts valid settlement request with FULL type', () => {
    expect(() => validateSettlementRequest({
      escrowId: 'test-escrow-id',
      triggerEvent: 'DELIVERY_CONFIRMED',
      settlementAmount: 500,
      settlementType: 'FULL' as any,
    })).not.toThrow();
  });

  it('accepts settlement request with MILESTONE type', () => {
    expect(() => validateSettlementRequest({
      escrowId: 'test-escrow-id',
      triggerEvent: 'POD_APPROVED',
      settlementAmount: 100,
      settlementType: 'MILESTONE' as any,
    })).not.toThrow();
  });

  it('accepts settlement request with REFUND type', () => {
    expect(() => validateSettlementRequest({
      escrowId: 'test-escrow-id',
      triggerEvent: 'DELIVERY_CONFIRMED',
      settlementAmount: 200,
      settlementType: 'REFUND' as any,
    })).not.toThrow();
  });

  it('rejects missing escrowId', () => {
    try {
      validateSettlementRequest({
        escrowId: '',
        triggerEvent: 'DELIVERY_CONFIRMED',
        settlementAmount: 500,
        settlementType: 'FULL' as any,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects zero settlement amount', () => {
    try {
      validateSettlementRequest({
        escrowId: 'test-escrow',
        triggerEvent: 'DELIVERY_CONFIRMED',
        settlementAmount: 0,
        settlementType: 'FULL' as any,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects negative settlement amount', () => {
    try {
      validateSettlementRequest({
        escrowId: 'test-escrow',
        triggerEvent: 'DELIVERY_CONFIRMED',
        settlementAmount: -100,
        settlementType: 'FULL' as any,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid settlement type', () => {
    try {
      validateSettlementRequest({
        escrowId: 'test-escrow',
        triggerEvent: 'DELIVERY_CONFIRMED',
        settlementAmount: 500,
        settlementType: 'INVALID_TYPE' as any,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================
// Double-Entry Ledger Validation Tests
// Per MOD-013 §6.3 — Ledger Mirror Definition
// ============================================================

describe('MOD-013 Ledger Entry Validation', () => {
  it('accepts valid DEBIT entry', () => {
    expect(() => validateLedgerEntry({
      transactionReference: 'tx-001',
      debitCreditType: 'DEBIT' as DebitCreditType,
      amount: 1000,
      currency: 'MZN' as CurrencyCode,
      source: 'wallet-shipper',
      destination: 'escrow-account',
      entryType: 'ESCROW' as LedgerEntryType,
    })).not.toThrow();
  });

  it('accepts valid CREDIT entry', () => {
    expect(() => validateLedgerEntry({
      transactionReference: 'tx-002',
      debitCreditType: 'CREDIT' as DebitCreditType,
      amount: 1000,
      currency: 'USD' as CurrencyCode,
      source: 'escrow-account',
      destination: 'wallet-transporter',
      entryType: 'SETTLEMENT' as LedgerEntryType,
    })).not.toThrow();
  });

  it('rejects missing transactionReference', () => {
    try {
      validateLedgerEntry({
        transactionReference: '',
        debitCreditType: 'DEBIT' as DebitCreditType,
        amount: 100,
        currency: 'ZAR' as CurrencyCode,
        source: 'src',
        destination: 'dst',
        entryType: 'PAYMENT' as LedgerEntryType,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects zero or negative amount', () => {
    try {
      validateLedgerEntry({
        transactionReference: 'tx-003',
        debitCreditType: 'DEBIT' as DebitCreditType,
        amount: 0,
        currency: 'MZN' as CurrencyCode,
        source: 'src',
        destination: 'dst',
        entryType: 'FEE' as LedgerEntryType,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects missing source', () => {
    try {
      validateLedgerEntry({
        transactionReference: 'tx-004',
        debitCreditType: 'DEBIT' as DebitCreditType,
        amount: 100,
        currency: 'MZN' as CurrencyCode,
        source: '',
        destination: 'dst',
        entryType: 'ESCROW' as LedgerEntryType,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects missing destination', () => {
    try {
      validateLedgerEntry({
        transactionReference: 'tx-005',
        debitCreditType: 'DEBIT' as DebitCreditType,
        amount: 100,
        currency: 'MZN' as CurrencyCode,
        source: 'src',
        destination: '',
        entryType: 'ESCROW' as LedgerEntryType,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid entry type', () => {
    try {
      validateLedgerEntry({
        transactionReference: 'tx-006',
        debitCreditType: 'DEBIT' as DebitCreditType,
        amount: 100,
        currency: 'MZN' as CurrencyCode,
        source: 'src',
        destination: 'dst',
        entryType: 'INVALID_ENTRY' as LedgerEntryType,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid debit/credit type', () => {
    try {
      validateLedgerEntry({
        transactionReference: 'tx-007',
        debitCreditType: 'INVALID_DCTYPE' as DebitCreditType,
        amount: 100,
        currency: 'MZN' as CurrencyCode,
        source: 'src',
        destination: 'dst',
        entryType: 'ESCROW' as LedgerEntryType,
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================
// Currency Conversion Validation Tests
// Per MOD-013 §4.5 — Multi-Currency Operations
// ============================================================

describe('MOD-013 Currency Conversion Validation', () => {
  it('accepts valid conversion from USD to ZAR', () => {
    expect(() => validateCurrencyConversion({
      fromCurrency: 'USD' as CurrencyCode,
      toCurrency: 'ZAR' as CurrencyCode,
      amount: 100,
      convertedAmount: 1800,
      exchangeRate: 18,
      rateSource: 'central-bank',
    })).not.toThrow();
  });

  it('rejects same from and to currency', () => {
    try {
      validateCurrencyConversion({
        fromCurrency: 'MZN' as CurrencyCode,
        toCurrency: 'MZN' as CurrencyCode,
        amount: 100,
        convertedAmount: 100,
        exchangeRate: 1,
        rateSource: 'internal',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects non-positive original amount', () => {
    try {
      validateCurrencyConversion({
        fromCurrency: 'USD' as CurrencyCode,
        toCurrency: 'ZAR' as CurrencyCode,
        amount: 0,
        convertedAmount: 0,
        exchangeRate: 18,
        rateSource: 'central-bank',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects negative converted amount', () => {
    try {
      validateCurrencyConversion({
        fromCurrency: 'USD' as CurrencyCode,
        toCurrency: 'ZAR' as CurrencyCode,
        amount: 100,
        convertedAmount: -1800,
        exchangeRate: 18,
        rateSource: 'central-bank',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects non-positive exchange rate', () => {
    try {
      validateCurrencyConversion({
        fromCurrency: 'USD' as CurrencyCode,
        toCurrency: 'ZAR' as CurrencyCode,
        amount: 100,
        convertedAmount: 1800,
        exchangeRate: 0,
        rateSource: 'central-bank',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================
// Refund Instruction Validation Tests
// Per MOD-013 §4.6 & §6.6 — Dispute & Refund Structuring
// ============================================================

describe('MOD-013 Refund Instruction Validation', () => {
  it('accepts valid FULL refund instruction', () => {
    expect(() => validateRefundInstruction({
      escrowId: 'test-escrow',
      refundType: 'FULL' as any,
      amount: 1000,
      currency: 'MZN',
      recipientId: 'transporter-001',
      resolutionOutcome: 'RELEASE_TO_TRANSPORTER',
      approvedBy: 'admin-001',
    })).not.toThrow();
  });

  it('accepts valid PARTIAL refund instruction', () => {
    expect(() => validateRefundInstruction({
      escrowId: 'test-escrow',
      refundType: 'PARTIAL' as any,
      amount: 500,
      currency: 'USD',
      recipientId: 'shipper-001',
      resolutionOutcome: 'REFUND_TO_SHIPPER',
    })).not.toThrow();
  });

  it('accepts valid SPLIT_SETTLEMENT refund instruction', () => {
    expect(() => validateRefundInstruction({
      escrowId: 'test-escrow',
      refundType: 'SPLIT_SETTLEMENT' as any,
      amount: 750,
      currency: 'ZAR',
      recipientId: 'transporter-002',
    })).not.toThrow();
  });

  it('rejects missing escrowId', () => {
    try {
      validateRefundInstruction({
        escrowId: '',
        refundType: 'FULL',
        amount: 1000,
        currency: 'MZN',
        recipientId: 'tp-001',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects zero or negative amount', () => {
    try {
      validateRefundInstruction({
        escrowId: 'test-escrow',
        refundType: 'FULL',
        amount: 0,
        currency: 'MZN',
        recipientId: 'tp-001',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid refund type', () => {
    try {
      validateRefundInstruction({
        escrowId: 'test-escrow',
        refundType: 'INVALID_REFUND' as any,
        amount: 100,
        currency: 'MZN',
        recipientId: 'tp-001',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects missing recipientId', () => {
    try {
      validateRefundInstruction({
        escrowId: 'test-escrow',
        refundType: 'FULL',
        amount: 100,
        currency: 'MZN',
        recipientId: '',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================
// Fee Record Validation Tests
// Per MOD-013 §4.7 & §6.5 — Fee & Commission Structuring
// ============================================================

describe('MOD-013 Fee Record Validation', () => {
  it('accepts valid PLATFORM_COMMISSION fee record', () => {
    expect(() => validateFeeRecord({
      transactionId: 'tx-001',
      feeType: 'PLATFORM_COMMISSION' as any,
      feeAmount: 50,
      feeCurrency: 'MZN',
      corridorId: 'maputo-cape-town',
    })).not.toThrow();
  });

  it('accepts valid PAYMENT_PROCESSING fee record', () => {
    expect(() => validateFeeRecord({
      transactionId: 'tx-002',
      feeType: 'PAYMENT_PROCESSING' as any,
      feeAmount: 10,
      feeCurrency: 'USD',
      feePercentage: 2,
    })).not.toThrow();
  });

  it('accepts valid CURRENCY_CONVERSION fee record', () => {
    expect(() => validateFeeRecord({
      transactionId: 'tx-003',
      feeType: 'CURRENCY_CONVERSION' as any,
      feeAmount: 5,
      feeCurrency: 'ZAR',
    })).not.toThrow();
  });

  it('rejects missing transactionId', () => {
    try {
      validateFeeRecord({
        transactionId: '',
        feeType: 'PLATFORM_COMMISSION' as any,
        feeAmount: 50,
        feeCurrency: 'MZN',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects negative fee amount', () => {
    try {
      validateFeeRecord({
        transactionId: 'tx-004',
        feeType: 'PLATFORM_COMMISSION' as any,
        feeAmount: -50,
        feeCurrency: 'MZN',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid fee type', () => {
    try {
      validateFeeRecord({
        transactionId: 'tx-005',
        feeType: 'UNKNOWN_FEE' as any,
        feeAmount: 50,
        feeCurrency: 'MZN',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================
// Payout Instruction Validation Tests
// Per MOD-013 §4.8 & §6.4 — Payout Orchestration
// ============================================================

describe('MOD-013 Payout Instruction Validation', () => {
  it('accepts valid MOBILE_MONEY payout instruction', () => {
    expect(() => validatePayoutInstruction({
      settlementId: 'settle-001',
      recipientId: 'transporter-001',
      recipientChannel: 'MOBILE_MONEY' as any,
      amount: 1000,
      currency: 'MZN',
    })).not.toThrow();
  });

  it('accepts valid BANK_TRANSFER payout instruction', () => {
    expect(() => validatePayoutInstruction({
      settlementId: 'settle-002',
      recipientId: 'transporter-002',
      recipientChannel: 'BANK_TRANSFER' as any,
      amount: 5000,
      currency: 'ZAR',
    })).not.toThrow();
  });

  it('rejects missing settlementId', () => {
    try {
      validatePayoutInstruction({
        settlementId: '',
        recipientId: 'tp-001',
        recipientChannel: 'MOBILE_MONEY' as any,
        amount: 100,
        currency: 'MZN',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects missing recipientId', () => {
    try {
      validatePayoutInstruction({
        settlementId: 'settle-003',
        recipientId: '',
        recipientChannel: 'MOBILE_MONEY' as any,
        amount: 100,
        currency: 'MZN',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects zero or negative amount', () => {
    try {
      validatePayoutInstruction({
        settlementId: 'settle-004',
        recipientId: 'tp-001',
        recipientChannel: 'MOBILE_MONEY' as any,
        amount: 0,
        currency: 'MZN',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid recipient channel', () => {
    try {
      validatePayoutInstruction({
        settlementId: 'settle-005',
        recipientId: 'tp-001',
        recipientChannel: 'CRYPTO' as any,
        amount: 100,
        currency: 'MZN',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});
