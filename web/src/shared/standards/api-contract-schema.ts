// NexCargo Wave 0 Shared Standard S-03: API Contract Schema Structure
// Authoritative source: MOD-011 §4.1 (Integration Contract Object) + §4.6 (API Version Record)
// + ESS-004 §3 (Contract Structure Standard) + ESS-004 §6 (Versioning Rule)
// All contract objects defined by MOD-011 and referenced by MOD-010 MUST extend BaseContractSchema.

/** API contract lifecycle status per ESS-004 §6 and MOD-011 §4.6 */
export enum ApiContractStatus {
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  TESTING = 'TESTING',
  SUNSET = 'SUNSET',
}

/**
 * Base contract schema that ALL Wave 0 contract objects MUST extend.
 * Provides common lifecycle, metadata, and governance fields.
 */
export interface BaseContractSchema {
  // Lifecycle fields
  contractId: string;           // UUID v4
  version: string;              // Semantic versioning MAJOR.MINOR.PATCH per ESS-004 §6
  status: ApiContractStatus;    // ACTIVE | DEPRECATED | TESTING | SUNSET
  createdAt: string;            // ISO 8601
  updatedAt?: string;           // ISO 8601

  // Metadata
  description?: string;
  ownerModule: string;          // Module identifier (MOD-001 through MOD-018)
  references?: string[];        // References to other contracts or specifications

  // Governance
  deprecationDate?: string;     // ISO 8601 — required when status is DEPRECATED
  sunsetDate?: string;          // ISO 8601 — required when status is SUNSET
}

/**
 * Validates semantic versioning format (MAJOR.MINOR.PATCH).
 * @param version - Version string to validate
 * @returns true if valid semver format
 */
export function isValidSemver(version: string): boolean {
  return /^(\d+)\.(\d+)\.(\d+)$/.test(version);
}

/**
 * Increments a semantic version string according to the type of change.
 * @param currentVersion - Current version (MAJOR.MINOR.PATCH)
 * @param changeType - 'major' | 'minor' | 'patch'
 * @returns New version string
 */
export function incrementVersion(currentVersion: string, changeType: 'major' | 'minor' | 'patch'): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  if (!isValidSemver(currentVersion)) {
    throw new Error(`Invalid semver format: ${currentVersion}`);
  }
  switch (changeType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown change type: ${changeType}`);
  }
}
