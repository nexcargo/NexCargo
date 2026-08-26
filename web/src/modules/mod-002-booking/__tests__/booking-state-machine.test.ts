// NexCargo MOD-002 — Booking State Machine Tests
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Increment: MOD-002 Increment 1 (Phase 1 — Core Contract Formation)
// Reference: MOD-002 §4.1, §5.1 (Lifecycle Model), §7.4

import { describe, it, expect } from 'vitest';
import {
  validateBookingTransition,
  applyBookingTransition,
  isBookingTerminal,
  runBookingLifecycleChain,
} from '@/modules/mod-002-booking/domain/services/booking-state-machine';
import { BookingStatus } from '@/modules/mod-002-booking/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';

describe('MOD-002 Booking State Machine — Valid Transitions', () => {
  describe('REQUESTED → ALIGNMENT_CHECKED', () => {
    it('allows REQUESTED to ALIGNMENT_CHECKED transition', () => {
      expect(() => validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.ALIGNMENT_CHECKED)).not.toThrow();
      const result = applyBookingTransition(BookingStatus.REQUESTED, BookingStatus.ALIGNMENT_CHECKED);
      expect(result).toBe(BookingStatus.ALIGNMENT_CHECKED);
    });

    it('rejects REQUESTED to CONFIRMED (skips alignment check)', () => {
      expect(() => validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.CONFIRMED))
        .toThrow(ValidationError);
    });

    it('rejects REQUESTED to FAILED', () => {
      expect(() => validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.FAILED))
        .toThrow(ValidationError);
    });

    it('rejects REQUESTED to CANCELLED', () => {
      expect(() => validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.CANCELLED))
        .toThrow(ValidationError);
    });
  });

  describe('ALIGNMENT_CHECKED → CONFIRMED | FAILED | CANCELLED', () => {
    it('allows ALIGNMENT_CHECKED to CONFIRMED transition', () => {
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.CONFIRMED)).not.toThrow();
      const result = applyBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.CONFIRMED);
      expect(result).toBe(BookingStatus.CONFIRMED);
    });

    it('allows ALIGNMENT_CHECKED to FAILED transition', () => {
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.FAILED)).not.toThrow();
      const result = applyBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.FAILED);
      expect(result).toBe(BookingStatus.FAILED);
    });

    it('allows ALIGNMENT_CHECKED to CANCELLED transition', () => {
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.CANCELLED)).not.toThrow();
      const result = applyBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.CANCELLED);
      expect(result).toBe(BookingStatus.CANCELLED);
    });

    it('rejects ALIGNMENT_CHECKED back to REQUESTED', () => {
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.REQUESTED))
        .toThrow(ValidationError);
    });

    it('rejects ALIGNMENT_CHECKED to itself (no-op)', () => {
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.ALIGNMENT_CHECKED))
        .toThrow(ValidationError);
    });
  });

  describe('Terminal states prevent further transitions', () => {
    it('CONFIRMED has no valid outgoing transitions', () => {
      expect(() => validateBookingTransition(BookingStatus.CONFIRMED, BookingStatus.CANCELLED))
        .toThrow(ValidationError);
      expect(() => validateBookingTransition(BookingStatus.CONFIRMED, BookingStatus.FAILED))
        .toThrow(ValidationError);
    });

    it('FAILED has no valid outgoing transitions', () => {
      expect(() => validateBookingTransition(BookingStatus.FAILED, BookingStatus.CONFIRMED))
        .toThrow(ValidationError);
    });

    it('CANCELLED has no valid outgoing transitions', () => {
      expect(() => validateBookingTransition(BookingStatus.CANCELLED, BookingStatus.CONFIRMED))
        .toThrow(ValidationError);
    });
  });
});

describe('MOD-002 Booking State Machine — Terminal Detection', () => {
  it('isBookingTerminal returns true for CONFIRMED', () => {
    expect(isBookingTerminal(BookingStatus.CONFIRMED)).toBe(true);
  });

  it('isBookingTerminal returns true for FAILED', () => {
    expect(isBookingTerminal(BookingStatus.FAILED)).toBe(true);
  });

  it('isBookingTerminal returns true for CANCELLED', () => {
    expect(isBookingTerminal(BookingStatus.CANCELLED)).toBe(true);
  });

  it('isBookingTerminal returns false for REQUESTED', () => {
    expect(isBookingTerminal(BookingStatus.REQUESTED)).toBe(false);
  });

  it('isBookingTerminal returns false for ALIGNMENT_CHECKED', () => {
    expect(isBookingTerminal(BookingStatus.ALIGNMENT_CHECKED)).toBe(false);
  });
});

describe('MOD-002 Booking State Machine — Full Lifecycle Chain', () => {
  it('runs through the complete happy path: REQUESTED → ALIGNMENT_CHECKED → CONFIRMED', () => {
    const chain = runBookingLifecycleChain();
    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe(BookingStatus.REQUESTED);
    expect(chain[1]).toBe(BookingStatus.ALIGNMENT_CHECKED);
    expect(chain[2]).toBe(BookingStatus.CONFIRMED);
  });
});

describe('MOD-002 Booking State Machine — Error Message Content', () => {
  it('includes current and target status in error message', () => {
    try {
      validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.CONFIRMED);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.message).toContain('REQUESTED');
        expect(error.message).toContain('CONFIRMED');
        expect(error.details).toEqual(expect.objectContaining({
          currentStatus: BookingStatus.REQUESTED,
          targetStatus: BookingStatus.CONFIRMED,
        }));
      }
    }
  });
});
