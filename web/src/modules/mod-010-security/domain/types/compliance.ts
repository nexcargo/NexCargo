// NexCargo MOD-010 Domain Types — Compliance Rule Framework
// Authoritative source: MOD-010 §4.4 (Compliance Rule Object) + §3.4 (Compliance Framework Structure)
// Implements exit criteria X-17: Compliance rule objects, regulatory taxonomy, jurisdiction-specific structures

/**
 * Regulation type enum per MOD-010 §4.4
 */
export enum RegulationType {
  TRANSPORT_LICENSING = 'TRANSPORT_LICENSING',
  CUSTOMS = 'CUSTOMS',
  FINANCIAL = 'FINANCIAL',
  DATA_PROTECTION = 'DATA_PROTECTION',
  INSURANCE = 'INSURANCE',
}

/**
 * Severity level enum per MOD-010 §4.4
 */
export enum SeverityLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  BLOCKING = 'BLOCKING',
}

/**
 * Compliance Rule Object — represents regulatory constraints.
 * Per MOD-010 §4.4. References ESS-006 as primary validation source.
 */
export interface ComplianceRule {
  // Core attributes from MOD-010 §4.4
  ruleId: string;                   // UUID v4
  regulationType: RegulationType;
  applicableModules: string[];      // Array of module references (MOD-001 through MOD-018)
  applicableJurisdictions: string[];// Array of country codes (e.g., "MZ", "ZA", "ZW")
  ruleDefinition: Record<string, unknown>; // Structured JSON rule definition
  severityLevel: SeverityLevel;
  validationSource: string;         // Must reference "ESS-006" per MOD-010 §7.3
}
