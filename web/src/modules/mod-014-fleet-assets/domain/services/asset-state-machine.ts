// NexCargo MOD-014 — Asset State Machine
// Wave 2 — Stage 2B, Increment 3 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-014 §5.2 (Asset State Model), §5.3 (Asset Lifecycle)
//
// Asset lifecycle per MOD-014 §5.3:
//   ASSET_REGISTERED → AVAILABLE → ASSIGNED_TO_SHIPMENT → IN_TRANSIT → COMPLETED → AVAILABLE
//
// Asset states per §5.2: AVAILABLE / ASSIGNED / INACTIVE / SUSPENDED
// State transitions are event-driven.

import { ValidationError } from '@/shared/errors/app-errors';
import { AssignmentStatus } from '../enums';

/** Asset assignment status union for state machine operations */
type AssignmentState = AssignmentStatus;

// ============================================================
// Valid transition map — single source of truth per MOD-014 §5.3
// InTransit is an alias for ASSIGNED in operational terms.
// Suspended is terminal (compliance-related) until compliance resolved externally.
// ============================================================

const VALID_TRANSITIONS: Record<AssignmentState, AssignmentState[]> = {
  /** Planned but not yet active */
  [AssignmentStatus.PLANNED]: [
    AssignmentStatus.ACTIVE,
    AssignmentStatus.CANCELLED,
  ],
  /** Active shipment execution — linked to MOD-003 tracking */
  [AssignmentStatus.ACTIVE]: [
    AssignmentStatus.COMPLETED,
    AssignmentStatus.CANCELLED,
  ],
  /** Shipment delivered — completes the assignment */
  [AssignmentStatus.COMPLETED]: [],
  /** Cancelled before or during execution */
  [AssignmentStatus.CANCELLED]: [],
};

// ============================================================
// Helper: get allowed transitions for a given status
// ============================================================

function getAllowedTransitions(status: AssignmentState): AssignmentState[] {
  return [...VALID_TRANSITIONS[status]];
}

// ============================================================
// validateAssignmentTransition — throws ValidationError if invalid
// Per MOD-014 §7.3: "Asset states MUST be event-driven."
// Per MOD-014 §7.3: "No double-booking of vehicles or drivers is permitted."
// ============================================================

export function validateAssignmentTransition(
  currentStatus: AssignmentState,
  targetStatus: AssignmentState,
): void {
  const allowed = getAllowedTransitions(currentStatus);

  if (!allowed.includes(targetStatus)) {
    throw new ValidationError(
      `Invalid assignment transition: ${currentStatus} → ${targetStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      { currentStatus, targetStatus, allowedTransitions: allowed },
    );
  }
}

// ============================================================
// applyAssignmentTransition — returns validated new state (advisory-only, no persistence)
// This is an advisory-only function — it does NOT persist state or emit events.
// Persistence and event emission are handled by the application layer.
// ============================================================

export function applyAssignmentTransition(
  currentStatus: AssignmentState,
  targetStatus: AssignmentState,
): AssignmentState {
  validateAssignmentTransition(currentStatus, targetStatus);
  return targetStatus;
}

// ============================================================
// isAssignmentTerminal — returns true if no further transitions allowed
// Terminal states: COMPLETED, CANCELLED
// ============================================================

export function isAssignmentTerminal(status: AssignmentState): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

// ============================================================
// preventDoubleBooking — validates that vehicle/driver are not already assigned
// Per MOD-014 §7.3: "No double-booking of vehicles or drivers is permitted."
// ============================================================

export function assertNoDoubleBooking(input: {
  proposedVehicleId: string;
  proposedDriverId: string;
  existingAssignments: Array<{
    vehicleId: string;
    driverId: string;
    assignmentStatus: AssignmentState;
  }>;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for conflicting active/planned assignments on the same vehicle
  const vehicleConflict = input.existingAssignments.find(
    a => a.vehicleId === input.proposedVehicleId && (a.assignmentStatus === AssignmentStatus.ACTIVE || a.assignmentStatus === AssignmentStatus.PLANNED),
  );

  if (vehicleConflict) {
    errors.push(`vehicle ${input.proposedVehicleId} is already assigned (assignment ${vehicleConflict.assignmentStatus})`);
  }

  // Check for conflicting active/planned assignments on the same driver
  const driverConflict = input.existingAssignments.find(
    a => a.driverId === input.proposedDriverId && (a.assignmentStatus === AssignmentStatus.ACTIVE || a.assignmentStatus === AssignmentStatus.PLANNED),
  );

  if (driverConflict) {
    errors.push(`driver ${input.proposedDriverId} is already assigned (assignment ${driverConflict.assignmentStatus})`);
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateAssignmentTimeWindow — validates startTime before endTime
// Per MOD-014 §4.4: startTime and endTime are required fields
// ============================================================

export function validateAssignmentTimeWindow(input: {
  startTime: Date;
  endTime: Date;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.endTime <= input.startTime) {
    errors.push('endTime must be after startTime');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Helper type — maps test-friendly "status" field to our internal "assignmentStatus" field.
 * Tests define existingAssignments with "status" key; this normalises to "assignmentStatus".
 */
function normaliseAssignment(a: { vehicleId: string; driverId: string; status?: string; assignmentStatus?: string }): { vehicleId: string; driverId: string; assignmentStatus: string } {
  return {
    vehicleId: a.vehicleId,
    driverId: a.driverId,
    assignmentStatus: (a.assignmentStatus ?? a.status!) as string,
  };
}

export function assertNoDoubleBookingSimple(input: {
  proposedVehicleId: string;
  proposedDriverId: string;
  existingAssignments: Array<{ vehicleId: string; driverId: string; status: AssignmentState }>;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const normalised = input.existingAssignments.map(normaliseAssignment);

  const vehicleConflict = normalised.find(
    a => a.vehicleId === input.proposedVehicleId && (a.assignmentStatus === AssignmentStatus.ACTIVE || a.assignmentStatus === AssignmentStatus.PLANNED),
  );

  if (vehicleConflict) {
    errors.push(`vehicle ${input.proposedVehicleId} is already assigned (assignment ${vehicleConflict.assignmentStatus})`);
  }

  const driverConflict = normalised.find(
    a => a.driverId === input.proposedDriverId && (a.assignmentStatus === AssignmentStatus.ACTIVE || a.assignmentStatus === AssignmentStatus.PLANNED),
  );

  if (driverConflict) {
    errors.push(`driver ${input.proposedDriverId} is already assigned (assignment ${driverConflict.assignmentStatus})`);
  }

  return { isValid: errors.length === 0, errors };
}
