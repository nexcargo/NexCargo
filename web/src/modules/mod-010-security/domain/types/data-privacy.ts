// NexCargo MOD-010 Domain Types — Data Privacy Policy Object Framework
// Authoritative source: MOD-010 §4.8 (Data Privacy Policy Object) + §3.7 (Data Privacy & Protection Layer)
// Implements exit criteria X-21: Encryption requirements, data categories, retention periods

/**
 * Data category enum per MOD-010 §4.8
 */
export enum DataCategory {
  PERSONAL_IDENTITY = 'PERSONAL_IDENTITY',
  FINANCIAL = 'FINANCIAL',
  SHIPMENT_TRACKING = 'SHIPMENT_TRACKING',
  DOCUMENTS = 'DOCUMENTS',
}

/**
 * Encryption requirement enum per MOD-010 §4.8
 */
export enum EncryptionRequirement {
  AT_REST = 'AT_REST',
  IN_TRANSIT = 'IN_TRANSIT',
  BOTH = 'BOTH',
}

/**
 * Privacy standard enum per MOD-010 §4.8
 */
export enum PrivacyStandard {
  GDPR = 'GDPR',
  LOCAL = 'LOCAL',
}

/**
 * Data Privacy Policy Object — represents privacy rules for sensitive data.
 * Per MOD-010 §4.8. Enforces encryption at rest and in transit per MOD-010 §7.6.
 */
export interface DataPrivacyPolicy {
  // Core attributes from MOD-010 §4.8
  policyId: string;               // UUID v4
  dataCategory: DataCategory;
  encryptionRequirement: EncryptionRequirement;
  retentionPeriod: string;        // ISO 8601 duration format (e.g., "P1Y" for 1 year)
  accessRestrictionLevel: string; // e.g., "ADMIN_ONLY", "ROLE_BASED"
  applicableJurisdictions: string[]; // Array of country codes
  privacyStandard: PrivacyStandard;
}
