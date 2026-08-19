// NexCargo MOD-011 Domain Utils — API Key Management
// Authoritative source: MOD-011 §4.1 (Integration Contract Object) + migration 001_initial.sql api_keys table
// Implements exit criteria X-06: key hashing and permission scoping using existing platform_infrastructure_schema.api_keys table

/**
 * Hashes an API key for secure storage.
 * Uses SHA-256 hashing per ESS-009 data governance rules.
 * The hashed value is stored in api_keys.key_hash column (VARCHAR(255)).
 * @param apiKey - The raw API key to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates that a permission set includes all required permissions.
 * Per MOD-011 §4.1: Each integration must have explicit schemas and versioning metadata.
 * Permission scoping ensures least-privilege access.
 * @param grantedPermissions - Permissions assigned to the API key
 * @param requiredPermissions - Permissions required for the operation
 * @returns true if all required permissions are granted
 */
export function validateKeyPermissions(
  grantedPermissions: string[],
  requiredPermissions: string[]
): boolean {
  const grantedSet = new Set(grantedPermissions);
  return requiredPermissions.every((perm) => grantedSet.has(perm));
}

/**
 * Generates a unique API key name from provider and module context.
 * Used for naming convention consistency in api_keys.name column.
 * @param provider - Integration provider identifier
 * @param moduleOwner - Owning module identifier
 * @returns Formatted key name
 */
export function generateApiKeyName(provider: string, moduleOwner: string): string {
  return `${moduleOwner}_${provider.toLowerCase()}`;
}
