// NexCargo MOD-017 Domain Utils — SLA Metric Recorder
// Authoritative source: MOD-017 §4.8 (SLAMetric Object) + §3.10 (SLA Monitoring & Reporting)
// Records SLA metrics with compliance tracking, providing a structured interface for
// uptime, response time, resolution time, and recovery time monitoring.
// Uses Standard S-02 (CorrelationContext) for traceability.

import { SLAMetricObject, SLAType, SLAComplianceStatus } from '@/modules/mod-017-observability/domain/types/sla-metrics';

/** SLA metric recording parameters */
export interface SLAMetricRecordParams {
  slaType: SLAType;
  targetValue: number;
  actualValue: number;
  periodStart: string;
  periodEnd?: string;
  breachReason?: string;
}

/**
 * Computes SLA compliance status based on actual vs target value.
 * @param slaType - Type of SLA being evaluated
 * @param targetValue - Target threshold value
 * @param actualValue - Actual measured value
 * @returns Computed compliance status
 */
export function computeSLACompliance(
  slaType: SLAType,
  targetValue: number,
  actualValue: number
): SLAComplianceStatus {
  switch (slaType) {
    case SLAType.UPTIME:
      // Uptime: actual >= target means compliant
      return actualValue >= targetValue ? SLAComplianceStatus.COMPLIANT : SLAComplianceStatus.BREACHED;
    case SLAType.RESPONSE_TIME:
      // Response time: actual <= target means compliant (lower is better)
      return actualValue <= targetValue ? SLAComplianceStatus.COMPLIANT : SLAComplianceStatus.BREACHED;
    case SLAType.RESOLUTION_TIME:
      // Resolution time: actual <= target means compliant
      return actualValue <= targetValue ? SLAComplianceStatus.COMPLIANT : SLAComplianceStatus.BREACHED;
    case SLAType.RECOVERY_TIME:
      // Recovery time: actual <= target means compliant
      return actualValue <= targetValue ? SLAComplianceStatus.COMPLIANT : SLAComplianceStatus.BREACHED;
    default:
      return SLAComplianceStatus.COMPLIANT;
  }
}

/**
 * Creates an SLA metric record with computed compliance status.
 * Per MOD-017 §4.8: SLA breaches must trigger alerts.
 * @param params - SLA metric recording parameters
 * @returns Complete SLAMetricObject
 */
export function recordSLAMetric(params: SLAMetricRecordParams): SLAMetricObject {
  const complianceStatus = computeSLACompliance(params.slaType, params.targetValue, params.actualValue);

  return {
    slaMetricId: crypto.randomUUID(),
    slaType: params.slaType,
    targetValue: params.targetValue,
    actualValue: params.actualValue,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd || new Date().toISOString(),
    complianceStatus,
    breachReason: complianceStatus === SLAComplianceStatus.BREACHED
      ? params.breachReason || 'Actual value exceeded target threshold'
      : undefined,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * SLA Metric Recorder — manages SLA metric records over time.
 * Provides querying by type, period, and compliance status.
 */
export class SLAMetricRecorder {
  private readonly records: SLAMetricObject[];

  constructor() {
    this.records = [];
  }

  /**
   * Records an SLA metric.
   * @param params - Recording parameters
   * @returns The created SLAMetricObject
   */
  record(params: SLAMetricRecordParams): SLAMetricObject {
    const metric = recordSLAMetric(params);
    this.records.push(metric);
    return metric;
  }

  /**
   * Gets all recorded metrics filtered by SLA type.
   * @param slaType - Optional SLA type filter
   * @returns Array of matching SLA metric records
   */
  getByType(slaType?: SLAType): SLAMetricObject[] {
    if (!slaType) return [...this.records];
    return this.records.filter(r => r.slaType === slaType);
  }

  /**
   * Gets all SLA metrics that are in breach.
   * @returns Array of breached SLA metric records
   */
  getBreaches(): SLAMetricObject[] {
    return this.records.filter(r => r.complianceStatus === SLAComplianceStatus.BREACHED);
  }

  /**
   * Gets compliance summary by SLA type.
   * @returns Record of SLA types with their compliance counts
   */
  getComplianceSummary(): Record<SLAType, { compliant: number; breached: number }> {
    const summary: Record<SLAType, { compliant: number; breached: number }> = {
      [SLAType.UPTIME]: { compliant: 0, breached: 0 },
      [SLAType.RESPONSE_TIME]: { compliant: 0, breached: 0 },
      [SLAType.RESOLUTION_TIME]: { compliant: 0, breached: 0 },
      [SLAType.RECOVERY_TIME]: { compliant: 0, breached: 0 },
    };

    for (const record of this.records) {
      summary[record.slaType][record.complianceStatus === SLAComplianceStatus.COMPLIANT ? 'compliant' : 'breached']++;
    }

    return summary;
  }

  /** Total number of recorded metrics */
  get count(): number {
    return this.records.length;
  }
}
