// NexCargo MOD-017 Domain Types — Alert Severity Framework
// Authoritative source: MOD-017 §4.5 (Alert Object) + §3.5 (Real-Time Alerting)
// Implements exit criteria X-11: Alert type taxonomy, severity levels, priority-based delivery patterns

/**
 * Alert type enum per MOD-017 §4.5
 */
export enum AlertType {
  HIGH_ERROR_RATE = 'HIGH_ERROR_RATE',
  SERVICE_DOWN = 'SERVICE_DOWN',
  PAYMENT_GATEWAY_FAILURE = 'PAYMENT_GATEWAY_FAILURE',
  GPS_INTERRUPTION = 'GPS_INTERRUPTION',
  LATENCY_SPIKE = 'LATENCY_SPIKE',
  INFRASTRUCTURE_FAILURE = 'INFRASTRUCTURE_FAILURE',
}

/**
 * Alert severity enum per MOD-017 §4.5
 */
export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Alert Priority ordering for multi-channel delivery.
 * Per MOD-017 §7.6 (Alerting Rule): Critical alerts must bypass batching delays.
 */
export const ALERT_PRIORITY_ORDER: Record<AlertSeverity, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

/**
 * Alert Object — represents a system anomaly alert.
 * Per MOD-017 §4.5.
 */
export interface AlertObject {
  // Core attributes from MOD-017 §4.5
  alertId: string;            // UUID v4
  alertType: AlertType;
  severity: AlertSeverity;
  sourceModule: string;       // Module identifier
  triggerCondition: string;   // Description of the condition that triggered the alert
  triggerValue: number;       // The actual value that exceeded the threshold
  thresholdValue: number;     // The threshold that was exceeded
  timestamp: string;          // ISO 8601
  resolvedAt?: string;        // ISO 8601 — optional, set when alert is resolved
  incidentId?: string;        // Optional, if escalated to incident
}

/**
 * Gets the priority number for an alert severity (lower = higher priority).
 * @param severity - Alert severity level
 * @returns Priority number for ordering
 */
export function getAlertPriority(severity: AlertSeverity): number {
  return ALERT_PRIORITY_ORDER[severity];
}
