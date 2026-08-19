// NexCargo MOD-011 Domain Types — Enterprise Integration Gateway Structure
// Authoritative source: MOD-011 §4.5 (Enterprise Integration Adapter)
// Implements exit criteria X-04: Enterprise Integration Adapter with target system, adapter type, data mapping rules, sync frequency

/**
 * Target system enum per MOD-011 §4.5
 */
export enum TargetSystem {
  SAP = 'SAP',
  ORACLE_ERP = 'ORACLE_ERP',
  CUSTOM_TMS = 'CUSTOM_TMS',
  WMS = 'WMS',
  CUSTOMS_SYSTEM = 'CUSTOMS_SYSTEM',
  GOVERNMENT_DATABASE = 'GOVERNMENT_DATABASE',
}

/**
 * Adapter type enum per MOD-011 §4.5
 */
export enum AdapterType {
  BATCH = 'BATCH',
  REAL_TIME = 'REAL_TIME',
  HYBRID = 'HYBRID',
}

/**
 * Sync frequency enum per MOD-011 §4.5
 */
export enum SyncFrequency {
  CONTINUOUS = 'CONTINUOUS',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
}

/**
 * Enterprise Integration Adapter — represents a pre-built integration adapter for enterprise systems.
 * Per MOD-011 §4.5.
 */
export interface EnterpriseIntegrationAdapter {
  // Core attributes from MOD-011 §4.5
  adapterId: string;           // UUID v4
  targetSystem: TargetSystem;
  adapterType: AdapterType;
  dataMappingRules: Record<string, unknown>;
  syncFrequency: SyncFrequency;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DEPRECATED';
  supportedVersion?: string;   // Semantic versioning MAJOR.MINOR.PATCH
}
