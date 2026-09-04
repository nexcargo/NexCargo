import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { BookingStatus } from '@/modules/mod-002-booking/domain/enums';
import { applyBookingTransition, validateBookingTransition } from '@/modules/mod-002-booking/domain/services/booking-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({ single: vi.fn() }),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }),
  })),
}));

describe('C2-Increment-002 Booking Confirm Endpoint — Predecessor Guard & State Machine Enforcement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('/confirm predecessor guard', () => {
    it('CONFIRMED only reachable from ALIGNMENT_CHECKED via state machine', () => {
      const result = applyBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.CONFIRMED);
      expect(result).toBe(BookingStatus.CONFIRMED);
    });

    it('direct REQUESTED→CONFIRMED rejected by state machine', () => {
      expect(() => validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.CONFIRMED))
        .toThrow(/Invalid booking transition/);
    });

    it('PUBLISHED→CONFIRMED never valid (no such source)', () => {
      // Listing PUBLISHED is a different entity; Booking starts at REQUESTED
      expect(() => validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.CONFIRMED))
        .toThrow(/Invalid booking transition: REQUESTED.*ALIGNMENT_CHECKED/);
    });

    it('terminal states reject CONFIRMED transition', () => {
      for (const terminal of [BookingStatus.CONFIRMED, BookingStatus.FAILED, BookingStatus.CANCELLED]) {
        expect(() => validateBookingTransition(terminal, BookingStatus.CONFIRMED))
          .toThrow(/Invalid booking transition/);
      }
    });
  });

  describe('Full lifecycle through /confirm', () => {
    it('REQUESTED → ALIGNMENT_CHECKED → CONFIRMED succeeds', () => {
      let s = BookingStatus.REQUESTED;
      s = applyBookingTransition(s, BookingStatus.ALIGNMENT_CHECKED);
      expect(s).toBe(BookingStatus.ALIGNMENT_CHECKED);
      s = applyBookingTransition(s, BookingStatus.CONFIRMED);
      expect(s).toBe(BookingStatus.CONFIRMED);
    });

    it('CANCELLED blocks further transitions', () => {
      const s = BookingStatus.CANCELLED;
      expect(() => validateBookingTransition(s, BookingStatus.CONFIRMED))
        .toThrow(/none \(terminal state\)/);
    });

    it('FAILED blocks further transitions', () => {
      const s = BookingStatus.FAILED;
      expect(() => validateBookingTransition(s, BookingStatus.CONFIRMED))
        .toThrow(/none \(terminal state\)/);
    });
  });

  describe('VALID_TRANSITIONS map integrity', () => {
    it('REQUESTED allows exactly one transition', () => {
      expect(validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.ALIGNMENT_CHECKED)).toBeUndefined();
      expect(() => validateBookingTransition(BookingStatus.REQUESTED, BookingStatus.CONFIRMED))
        .toThrow();
    });

    it('ALIGNMENT_CHECKED allows three transitions', () => {
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.CONFIRMED)).not.toThrow();
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.CANCELLED)).not.toThrow();
      expect(() => validateBookingTransition(BookingStatus.ALIGNMENT_CHECKED, BookingStatus.FAILED)).not.toThrow();
    });
  });
});
