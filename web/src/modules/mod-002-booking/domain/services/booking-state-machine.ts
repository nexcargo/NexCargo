// NexCargo MOD-002 — Booking State Machine
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Increment: MOD-002 Increment 1 (Phase 1 — Core Contract Formation)
// Reference: MOD-002 §4.1 (Booking entity), §5.1 (Lifecycle Model), §7.4 (Alignment Rule)
//
// Booking status transitions:
//   REQUESTED → ALIGNMENT_CHECKED → CONFIRMED | FAILED | CANCELLED

import { BookingStatus } from '../enums';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Valid transition map — single source of truth per MOD-002 §5.1
// ============================================================

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.REQUESTED]: [BookingStatus.ALIGNMENT_CHECKED],
  [BookingStatus.ALIGNMENT_CHECKED]: [BookingStatus.CONFIRMED, BookingStatus.FAILED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [],
  [BookingStatus.FAILED]: [],
  [BookingStatus.CANCELLED]: [],
};

// ============================================================
// Helper: get allowed transitions for a given status
// ============================================================

function getAllowedTransitions(status: BookingStatus): BookingStatus[] {
  return [...VALID_TRANSITIONS[status]];
}

// ============================================================
// validateBookingTransition — throws ValidationError if invalid
// ============================================================

export function validateBookingTransition(
  currentStatus: BookingStatus,
  targetStatus: BookingStatus,
): void {
  const allowed = getAllowedTransitions(currentStatus);

  if (!allowed.includes(targetStatus)) {
    throw new ValidationError(`Invalid booking transition: ${currentStatus} → ${targetStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`, {
      currentStatus,
      targetStatus,
      allowedTransitions: allowed,
    });
  }
}

// ============================================================
// applyBookingTransition — returns validated new state (advisory-only, no persistence)
// ============================================================

export function applyBookingTransition(
  currentStatus: BookingStatus,
  targetStatus: BookingStatus,
): BookingStatus {
  validateBookingTransition(currentStatus, targetStatus);
  return targetStatus;
}

// ============================================================
// isBookingTerminal — returns true if no further transitions allowed
// ============================================================

export function isBookingTerminal(status: BookingStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

// ============================================================
// Full lifecycle chain test helper — runs the complete valid path
// ============================================================

export function runBookingLifecycleChain(): BookingStatus[] {
  const states: BookingStatus[] = [];
  let status: BookingStatus = BookingStatus.REQUESTED;
  states.push(status);

  // Phase 1: Request → Alignment Checked
  status = applyBookingTransition(status, BookingStatus.ALIGNMENT_CHECKED);
  states.push(status);

  // Phase 2a: Alignment Check → Confirmed (happy path)
  status = applyBookingTransition(status, BookingStatus.CONFIRMED);
  states.push(status);

  return states;
}
