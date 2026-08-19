// NexCargo MOD-010 Domain Types — Security Event Monitoring Structure
// Authoritative source: MOD-010 §4.7 (Security Event Record) + §3.6 (Security Event Monitoring Structuring)
// Implements exit criteria X-20: Security event taxonomy, severity categorization, forensic logging

/**
 * Security event type enum per MOD-010 §4.7
 */
export enum SecurityEventType {
  FAILED_LOGIN = 'FAILED_LOGIN',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  FRAUD_TRIGGER = 'FRAUD_TRIGGER',
  SUSPICIOUS_FINANCIAL = 'SUSPICIOUS_FINANCIAL',
  LOCATION_SPOOFING = 'LOCATION_SPOOFING',
  DEVICE_ANOMALY = 'DEVICE_ANOMALY',
}

/**
 * Security event severity enum per MOD-010 §4.7
 */
export enum SecurityEventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Security Event Record Object — represents a security monitoring event.
 * Per MOD-010 §4.7. Supports forensic logging with detailed metadata.
 */
export interface SecurityEventRecord {
  // Core attributes from MOD-010 §4.7
  securityEventId: string;        // UUID v4
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;                // Optional user ID
  sourceIp?: string;              // Source IP address
  timestamp: string;              // ISO 8601
  details: Record<string, unknown>; // Structured JSON details
  alertSent: boolean;             // Whether an alert was sent for this event
  alertDeliveredAt?: string;      // Optional ISO 8601 — when alert was delivered
}
