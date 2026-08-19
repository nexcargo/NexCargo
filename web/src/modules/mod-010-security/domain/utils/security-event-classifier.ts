// NexCargo MOD-010 Domain Utils — Security Event Classifier
// Authoritative source: MOD-010 §4.7 (Security Event Record) + §3.6 (Security Event Monitoring Structuring)
// Classifies security events by severity and determines appropriate response actions.
// No runtime enforcement — classification results feed into governance review processes.

import { SecurityEventType, SecurityEventSeverity } from '@/modules/mod-010-security/domain/types/security-events';

/** Response action recommendation for a classified security event */
export interface SecurityEventClassification {
  eventType: SecurityEventType;
  recommendedSeverity: SecurityEventSeverity;
  requiresImmediateAlert: boolean;
  requiresForensicLogging: boolean;
}

/**
 * Maps security event types to their default severity levels.
 * Per MOD-010 §4.7: Events are monitored in real time with severity categorization.
 */
const EVENT_SEVERITY_MAP: Record<SecurityEventType, SecurityEventSeverity> = {
  [SecurityEventType.FAILED_LOGIN]: SecurityEventSeverity.LOW,
  [SecurityEventType.UNAUTHORIZED_ACCESS]: SecurityEventSeverity.HIGH,
  [SecurityEventType.FRAUD_TRIGGER]: SecurityEventSeverity.CRITICAL,
  [SecurityEventType.SUSPICIOUS_FINANCIAL]: SecurityEventSeverity.HIGH,
  [SecurityEventType.LOCATION_SPOOFING]: SecurityEventSeverity.MEDIUM,
  [SecurityEventType.DEVICE_ANOMALY]: SecurityEventSeverity.MEDIUM,
};

/**
 * Classifies a security event type and returns its default classification.
 * @param eventType - Security event type to classify
 * @returns SecurityEventClassification with recommended properties
 */
export function classifySecurityEvent(eventType: SecurityEventType): SecurityEventClassification {
  const severity = EVENT_SEVERITY_MAP[eventType];

  return {
    eventType,
    recommendedSeverity: severity,
    requiresImmediateAlert: severity === SecurityEventSeverity.CRITICAL || severity === SecurityEventSeverity.HIGH,
    requiresForensicLogging: severity !== SecurityEventSeverity.LOW,
  };
}

/**
 * Escalates severity based on event count within a time window.
 * Repeated low-severity events may indicate an attack pattern.
 * @param baseSeverity - Base severity of the event
 * @param recentCount - Number of similar events in recent history
 * @returns Escalated severity level
 */
export function escalateByFrequency(
  baseSeverity: SecurityEventSeverity,
  recentCount: number
): SecurityEventSeverity {
  if (recentCount >= 10 && baseSeverity === SecurityEventSeverity.LOW) {
    return SecurityEventSeverity.MEDIUM;
  }
  if (recentCount >= 20 && baseSeverity === SecurityEventSeverity.MEDIUM) {
    return SecurityEventSeverity.HIGH;
  }
  if (recentCount >= 50 && baseSeverity === SecurityEventSeverity.HIGH) {
    return SecurityEventSeverity.CRITICAL;
  }
  return baseSeverity;
}
