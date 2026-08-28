// NexCargo MOD-014 — Asset State Machine Tests
// Wave 2 — Stage 2B, Increment 3 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)

import { describe, it, expect } from 'vitest';
import { AssignmentStatus } from '../domain/enums';
import { validateAssignmentTransition, applyAssignmentTransition, isAssignmentTerminal, assertNoDoubleBookingSimple, validateAssignmentTimeWindow } from '../domain/services/asset-state-machine';

describe('MOD-014 Assignment State Machine — Main Lifecycle', () => {
  describe('PLANNED → ACTIVE / CANCELLED', () => {
    it('allows PLANNED to ACTIVE (assignment begins)', () => {
      expect(() => validateAssignmentTransition(AssignmentStatus.PLANNED, AssignmentStatus.ACTIVE)).not.toThrow();
    });

    it('allows PLANNED to CANCELLED (assignment cancelled before execution)', () => {
      expect(() => validateAssignmentTransition(AssignmentStatus.PLANNED, AssignmentStatus.CANCELLED)).not.toThrow();
    });

    it('rejects PLANNED directly to COMPLETED (must execute first)', () => {
      expect(() => validateAssignmentTransition(AssignmentStatus.PLANNED, AssignmentStatus.COMPLETED))
        .toThrow(/Invalid assignment transition/);
    });
  });

  describe('ACTIVE → COMPLETED / CANCELLED', () => {
    it('allows ACTIVE to COMPLETED (shipment delivered)', () => {
      expect(() => validateAssignmentTransition(AssignmentStatus.ACTIVE, AssignmentStatus.COMPLETED)).not.toThrow();
    });

    it('allows ACTIVE to CANCELLED (mid-execution cancellation)', () => {
      expect(() => validateAssignmentTransition(AssignmentStatus.ACTIVE, AssignmentStatus.CANCELLED)).not.toThrow();
    });

    it('rejects ACTIVE back to PLANNED (cannot revert to planned after activation)', () => {
      expect(() => validateAssignmentTransition(AssignmentStatus.ACTIVE, AssignmentStatus.PLANNED))
        .toThrow(/Invalid assignment transition/);
    });
  });
});

describe('MOD-014 Assignment State Machine — Terminal States', () => {
  it('COMPLETED has no outgoing transitions', () => {
    expect(() => validateAssignmentTransition(AssignmentStatus.COMPLETED, AssignmentStatus.ACTIVE))
      .toThrow(/terminal/);
  });

  it('CANCELLED has no outgoing transitions', () => {
    expect(() => validateAssignmentTransition(AssignmentStatus.CANCELLED, AssignmentStatus.PLANNED))
      .toThrow(/terminal/);
  });

  it('no terminal state allows self-transition', () => {
    expect(() => validateAssignmentTransition(AssignmentStatus.COMPLETED, AssignmentStatus.COMPLETED))
      .toThrow(/terminal/);
    expect(() => validateAssignmentTransition(AssignmentStatus.CANCELLED, AssignmentStatus.CANCELLED))
      .toThrow(/terminal/);
  });

  it('isAssignmentTerminal returns true for COMPLETED', () => {
    expect(isAssignmentTerminal(AssignmentStatus.COMPLETED)).toBe(true);
  });

  it('isAssignmentTerminal returns true for CANCELLED', () => {
    expect(isAssignmentTerminal(AssignmentStatus.CANCELLED)).toBe(true);
  });

  it('isAssignmentTerminal returns false for non-terminal states', () => {
    expect(isAssignmentTerminal(AssignmentStatus.PLANNED)).toBe(false);
    expect(isAssignmentTerminal(AssignmentStatus.ACTIVE)).toBe(false);
  });
});

describe('MOD-014 Assignment State Machine — Double Booking Prevention', () => {
  const existingAssignments = [
    { vehicleId: 'veh-001', driverId: 'drv-001', status: AssignmentStatus.ACTIVE },
    { vehicleId: 'veh-002', driverId: 'drv-002', status: AssignmentStatus.PLANNED },
    { vehicleId: 'veh-003', driverId: 'drv-003', status: AssignmentStatus.COMPLETED }, // Completed does not block new assignment
    { vehicleId: 'veh-004', driverId: 'drv-004', status: AssignmentStatus.CANCELLED }, // Cancelled does not block
  ];

  it('accepts new assignment when vehicle and driver are free', () => {
    const result = assertNoDoubleBookingSimple({
      existingAssignments,
      proposedVehicleId: 'veh-999',
      proposedDriverId: 'drv-999',
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects assignment with already-assigned vehicle', () => {
    const result = assertNoDoubleBookingSimple({
      existingAssignments,
      proposedVehicleId: 'veh-001',
      proposedDriverId: 'drv-999',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('vehicle'))).toBe(true);
  });

  it('rejects assignment with already-assigned driver', () => {
    const result = assertNoDoubleBookingSimple({
      existingAssignments,
      proposedVehicleId: 'veh-999',
      proposedDriverId: 'drv-002',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('driver'))).toBe(true);
  });

  it('allows reassignment of vehicle/driver from completed assignment', () => {
    const result = assertNoDoubleBookingSimple({
      existingAssignments,
      proposedVehicleId: 'veh-003',
      proposedDriverId: 'drv-003',
    });
    expect(result.isValid).toBe(true);
  });

  it('allows reassignment of vehicle/driver from cancelled assignment', () => {
    const result = assertNoDoubleBookingSimple({
      existingAssignments,
      proposedVehicleId: 'veh-004',
      proposedDriverId: 'drv-004',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects both vehicle and driver conflict simultaneously', () => {
    const result = assertNoDoubleBookingSimple({
      existingAssignments,
      proposedVehicleId: 'veh-001',
      proposedDriverId: 'drv-002',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});

describe('MOD-014 Assignment State Machine — Time Window Validation', () => {
  const validTimes = {
    startTime: new Date('2026-09-01T08:00:00Z'),
    endTime: new Date('2026-09-01T18:00:00Z'),
  };

  it('accepts valid time window (startTime < endTime)', () => {
    const result = validateAssignmentTimeWindow(validTimes);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects endTime before startTime', () => {
    const result = validateAssignmentTimeWindow({
      startTime: new Date('2026-09-01T18:00:00Z'),
      endTime: new Date('2026-09-01T08:00:00Z'),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('after startTime'))).toBe(true);
  });

  it('rejects identical start and end times', () => {
    const sameTime = new Date('2026-09-01T12:00:00Z');
    const result = validateAssignmentTimeWindow({
      startTime: sameTime,
      endTime: sameTime,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('after startTime'))).toBe(true);
  });
});

describe('MOD-014 Asset State Machine — Full Lifecycle Chain', () => {
  it('runs through primary path: PLANNED → ACTIVE → COMPLETED', () => {
    let status = AssignmentStatus.PLANNED;
    status = applyAssignmentTransition(status, AssignmentStatus.ACTIVE);
    status = applyAssignmentTransition(status, AssignmentStatus.COMPLETED);
    expect(status).toBe(AssignmentStatus.COMPLETED);
    expect(isAssignmentTerminal(status)).toBe(true);
  });

  it('handles cancellation at planned stage', () => {
    let status = AssignmentStatus.PLANNED;
    status = applyAssignmentTransition(status, AssignmentStatus.CANCELLED);
    expect(status).toBe(AssignmentStatus.CANCELLED);
    expect(isAssignmentTerminal(status)).toBe(true);
  });

  it('handles cancellation at active stage', () => {
    let status = AssignmentStatus.PLANNED;
    status = applyAssignmentTransition(status, AssignmentStatus.ACTIVE);
    status = applyAssignmentTransition(status, AssignmentStatus.CANCELLED);
    expect(status).toBe(AssignmentStatus.CANCELLED);
    expect(isAssignmentTerminal(status)).toBe(true);
  });
});
