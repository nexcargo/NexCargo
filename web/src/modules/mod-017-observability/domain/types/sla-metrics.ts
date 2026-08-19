// NexCargo MOD-017 Domain Types — SLA Metric Framework
// Authoritative source: MOD-017 §4.8 (SLAMetric Object) + §3.10 (SLA Monitoring & Reporting)
// Implements exit criteria X-14: SLA metric objects with compliance status tracking

/**
 * SLA type enum per MOD-017 §4.8
 */
export enum SLAType {
  UPTIME = 'UPTIME',            // Target 99.9% uptime per MOD-017 §3.10
  RESPONSE_TIME = 'RESPONSE_TIME',
  RESOLUTION_TIME = 'RESOLUTION_TIME',
  RECOVERY_TIME = 'RECOVERY_TIME',
}

/**
 * SLA compliance status enum per MOD-017 §4.8
 */
export enum SLAComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  BREACHED = 'BREACHED',
}

/**
 * SLA Metric Object — represents SLA compliance metrics.
 * Per MOD-017 §4.8.
 */
export interface SLAMetricObject {
  // Core attributes from MOD-017 §4.8
  slaMetricId: string;          // UUID v4
  slaType: SLAType;
  targetValue: number;          // e.g., 99.9 for uptime percentage
  actualValue: number;          // Actual measured value
  periodStart: string;          // ISO 8601
  periodEnd: string;            // ISO 8601
  complianceStatus: SLAComplianceStatus;
  breachReason?: string;        // Optional — reason for SLA breach
  generatedAt: string;          // ISO 8601
}
