// NexCargo I-5 §3H — the operational choices the Transporter screens offer.
// Both lists are derived from the authoritative MOD-003 and MOD-014 state machines rather than copied from
// them, so the UI can never offer a transition the domain forbids. The server re-validates regardless; this
// only keeps the form honest about what is possible from the current state.

import { ShipmentStatus } from '@/shared/types/enums';
import {
  validateTrackingTransition,
  type TrackingStatus,
} from '@/modules/mod-003-tracking/domain/services/tracking-state-machine';
import { AssignmentStatus } from '@/modules/mod-014-fleet-assets/domain/enums';
import { validateAssignmentTransition } from '@/modules/mod-014-fleet-assets/domain/services/asset-state-machine';

const TRACKING_STATES: TrackingStatus[] = [...Object.values(ShipmentStatus), 'CANCELLED'];
const ASSIGNMENT_STATES: AssignmentStatus[] = Object.values(AssignmentStatus);

export function nextTrackingStatuses(current: string): string[] {
  return TRACKING_STATES.filter((candidate) => {
    try {
      validateTrackingTransition(current as TrackingStatus, candidate);
      return true;
    } catch {
      return false;
    }
  });
}

export function nextAssignmentStatuses(current: string): string[] {
  return ASSIGNMENT_STATES.filter((candidate) => {
    try {
      validateAssignmentTransition(current as AssignmentStatus, candidate);
      return true;
    } catch {
      return false;
    }
  });
}