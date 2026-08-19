// NexCargo MOD-011 Domain Utils — Integration Adapter Factory
// Authoritative source: MOD-011 §4.5 (Enterprise Integration Adapter) + §5.5 (Deterministic Integration Rule)
// Creates EnterpriseIntegrationAdapter instances with validation per MOD-011 specification.
// Per MOD-011 §7.5 (Event Integrity Rule): External events MUST be immutable after ingestion.
// Per MOD-011 §7.7 (Neutrality Rule): Data mapping layer is required for each integration.

import type { EnterpriseIntegrationAdapter, TargetSystem, AdapterType, SyncFrequency } from '@/modules/mod-011-platform-integration/domain/types/enterprise-gateway';

/**
 * Validation result for an integration adapter.
 */
export interface AdapterValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates an EnterpriseIntegrationAdapter against MOD-011 §4.5 constraints.
 * @param adapter - Adapter to validate
 * @returns Validation result with any errors found
 */
export function validateIntegrationAdapter(adapter: EnterpriseIntegrationAdapter): AdapterValidationResult {
  const errors: string[] = [];

  if (!adapter.adapterId || typeof adapter.adapterId !== 'string') {
    errors.push('adapterId is required');
  }
  if (!adapter.targetSystem) {
    errors.push('targetSystem is required');
  }
  if (!adapter.adapterType) {
    errors.push('adapterType is required');
  }
  if (!adapter.dataMappingRules || Object.keys(adapter.dataMappingRules).length === 0) {
    errors.push('dataMappingRules are required and must not be empty');
  }
  if (!adapter.syncFrequency) {
    errors.push('syncFrequency is required');
  }
  if (!adapter.status || !['ACTIVE', 'MAINTENANCE', 'DEPRECATED'].includes(adapter.status)) {
    errors.push('status must be ACTIVE, MAINTENANCE, or DEPRECATED');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a new EnterpriseIntegrationAdapter with validation.
 * @param params - Partial adapter parameters
 * @returns Validated EnterpriseIntegrationAdapter or null if invalid
 */
export function createIntegrationAdapter(params: Partial<EnterpriseIntegrationAdapter>): EnterpriseIntegrationAdapter | null {
  if (!params.targetSystem || !params.adapterType || !params.syncFrequency) {
    return null;
  }

  const candidate: EnterpriseIntegrationAdapter = {
    adapterId: crypto.randomUUID(),
    targetSystem: params.targetSystem,
    adapterType: params.adapterType,
    syncFrequency: params.syncFrequency,
    dataMappingRules: params.dataMappingRules ?? {},
    status: params.status || 'ACTIVE',
    supportedVersion: params.supportedVersion,
  };

  const validation = validateIntegrationAdapter(candidate);
  return validation.valid ? candidate : null;
}

/**
 * Generates a deterministic adapter ID based on target system and adapter type.
 * Used for consistent identification across deployments.
 * @param targetSystem - Target system identifier
 * @param adapterType - Adapter type
 * @param syncFrequency - Synchronization frequency
 * @returns Deterministic adapter ID string
 */
export function generateDeterministicAdapterId(
  targetSystem: string,
  adapterType: string,
  syncFrequency: string
): string {
  const normalized = `${targetSystem.toLowerCase()}-${adapterType.toLowerCase()}-${syncFrequency.toLowerCase()}`;
  // Simple hash for deterministic ID generation
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `adapter-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}
