// NexCargo MOD-017 Domain Utils — Incident Lifecycle Manager
// Authoritative source: MOD-017 §4.6 (Incident Object) + §5.5 (Incident Lifecycle Model)
// Validates incident status transitions per the defined lifecycle.
// Per MOD-017 §5.5: ANOMALY DETECTED → ALERT GENERATED → INCIDENT CREATED → INVESTIGATION → MITIGATION → RESOLUTION → POST-MORTEM → CLOSED

import { IncidentStatus, IncidentSeverity } from '@/modules/mod-017-observability/domain/types/incidents';

/**
 * Valid incident status transitions per MOD-017 §5.5 lifecycle model.
 */
const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.DETECTED]: [IncidentStatus.INVESTIGATING],
  [IncidentStatus.INVESTIGATING]: [IncidentStatus.MITIGATING, IncidentStatus.CLOSED],
  [IncidentStatus.MITIGATING]: [IncidentStatus.RESOLVED],
  [IncidentStatus.RESOLVED]: [IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [], // Terminal state — no transitions allowed
};

/**
 * Checks whether a status transition is valid per the incident lifecycle model.
 * @param currentStatus - Current incident status
 * @param targetStatus - Desired target status
 * @returns true if the transition is allowed
 */
export function isValidTransition(currentStatus: IncidentStatus, targetStatus: IncidentStatus): boolean {
  const allowedTargets = VALID_TRANSITIONS[currentStatus];
  return allowedTargets.includes(targetStatus);
}

/**
 * Gets the next possible statuses from a given status.
 * @param currentStatus - Current incident status
 * @returns Array of valid next statuses
 */
export function getNextPossibleStatuses(currentStatus: IncidentStatus): IncidentStatus[] {
  return [...VALID_TRANSITIONS[currentStatus]];
}

/**
 * Determines whether an incident is in a terminal state.
 * @param status - Incident status to check
 * @returns true if the incident cannot be further modified
 */
export function isTerminal(status: IncidentStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * Computes the estimated priority escalation based on incident severity and age.
 * Higher severity incidents get higher base priority.
 * This utility supports alerting systems in determining response urgency.
 * @param severity - Incident severity level
 * @returns Numeric priority (1 = highest urgency)
 */
export function getIncidentPriority(severity: IncidentSeverity): number {
  switch (severity) {
    case IncidentSeverity.CRITICAL:
      return 1;
    case IncidentSeverity.MAJOR:
      return 2;
    case IncidentSeverity.MINOR:
      return 3;
    default:
      return 4;
  }
}
