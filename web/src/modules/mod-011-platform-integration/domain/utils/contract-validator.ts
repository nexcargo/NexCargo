// NexCargo MOD-011 Domain Utils — Integration Contract Validator
// Authoritative source: MOD-011 §4.1–§4.6 + ESS-004 §3 (Contract Structure Standard)
// Validates contract objects against their specification requirements.
// No runtime enforcement — validation results feed into governance workflows.

import { IntegrationProviderType, IntegrationProtocolType, IntegrationAuthMethod, HttpMethod } from '@/modules/mod-011-platform-integration/domain/types/integration-contracts';
import type { IntegrationContract, ApiEndpointDefinition, ApiVersionRecord } from '@/modules/mod-011-platform-integration/domain/types/integration-contracts';
import { BaseContractSchema, ApiContractStatus } from '@/shared/standards/api-contract-schema';
import { isValidSemver, incrementVersion } from '@/shared/standards/api-contract-schema';

/** Validation result for a single field */
export interface ValidationResult {
  field: string;
  valid: boolean;
  message?: string;
}

/** Overall validation result for a contract object */
export interface ContractValidationResult {
  valid: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
}

/**
 * Validates that a version string follows semantic versioning.
 * @param version - Version string to validate
 * @returns true if valid MAJOR.MINOR.PATCH format
 */
export function isVersionValid(version: string): boolean {
  return isValidSemver(version);
}

/**
 * Creates the next minor version from an existing version.
 * @param currentVersion - Current version string
 * @returns Next minor version string
 */
export function getNextMinorVersion(currentVersion: string): string {
  return incrementVersion(currentVersion, 'minor');
}

/**
 * Validates a base contract schema against its required fields.
 * @param schema - Base contract schema to validate
 * @returns ContractValidationResult with errors and warnings
 */
export function validateBaseContract(schema: BaseContractSchema): ContractValidationResult {
  const errors: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];

  // Required fields
  if (!schema.contractId || typeof schema.contractId !== 'string') {
    errors.push({ field: 'contractId', valid: false, message: 'Required UUID v4 identifier' });
  }
  if (!schema.version || !isVersionValid(schema.version)) {
    errors.push({ field: 'version', valid: false, message: 'Required semver MAJOR.MINOR.PATCH' });
  }
  if (!schema.status || !(Object.values(ApiContractStatus) as string[]).includes(schema.status)) {
    errors.push({ field: 'status', valid: false, message: `Required one of: ${Object.values(ApiContractStatus).join(', ')}` });
  }
  if (!schema.createdAt) {
    errors.push({ field: 'createdAt', valid: false, message: 'Required ISO 8601 creation timestamp' });
  }
  if (!schema.ownerModule || !/^MOD-\d{3}$/.test(schema.ownerModule)) {
    errors.push({ field: 'ownerModule', valid: false, message: 'Required module reference (MOD-###)' });
  }

  // Governance warnings
  if (schema.status === ApiContractStatus.DEPRECATED && !schema.deprecationDate) {
    warnings.push({ field: 'deprecationDate', valid: false, message: 'Deprecation date recommended when status is DEPRECATED' });
  }
  if (schema.status === ApiContractStatus.SUNSET && !schema.sunsetDate) {
    warnings.push({ field: 'sunsetDate', valid: false, message: 'Sunset date required when status is SUNSET' });
  }
  if (schema.deprecationDate && schema.sunsetDate && schema.deprecationDate >= schema.sunsetDate) {
    warnings.push({ field: 'sunseTdate', valid: false, message: 'Sunset date must be after deprecation date' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates an IntegrationContract against MOD-011 §4.1 requirements.
 * @param contract - Integration contract to validate
 * @returns ContractValidationResult
 */
export function validateIntegrationContract(contract: IntegrationContract): ContractValidationResult {
  const baseResult = validateBaseContract(contract);
  const errors = [...baseResult.errors];

  if (!contract.integrationName || contract.integrationName.trim().length === 0) {
    errors.push({ field: 'integrationName', valid: false, message: 'Required integration name' });
  }
  if (!contract.providerType || !Object.values(IntegrationProviderType).includes(contract.providerType)) {
    errors.push({ field: 'providerType', valid: false, message: `Required one of: ${Object.values(IntegrationProviderType).join(', ')}` });
  }
  if (!contract.protocolType || !Object.values(IntegrationProtocolType).includes(contract.protocolType)) {
    errors.push({ field: 'protocolType', valid: false, message: `Required one of: ${Object.values(IntegrationProtocolType).join(', ')}` });
  }
  if (!contract.authenticationMethod || !Object.values(IntegrationAuthMethod).includes(contract.authenticationMethod)) {
    errors.push({ field: 'authenticationMethod', valid: false, message: `Required one of: ${Object.values(IntegrationAuthMethod).join(', ')}` });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: baseResult.warnings,
  };
}

/**
 * Validates an ApiEndpointDefinition against MOD-011 §4.2 requirements.
 * @param endpoint - API endpoint definition to validate
 * @returns ContractValidationResult
 */
export function validateApiEndpoint(endpoint: ApiEndpointDefinition): ContractValidationResult {
  const baseResult = validateBaseContract(endpoint);
  const errors = [...baseResult.errors];

  if (!endpoint.path || !endpoint.path.startsWith('/')) {
    errors.push({ field: 'path', valid: false, message: 'Required path starting with /' });
  }
  if (!endpoint.method || !Object.values(HttpMethod).includes(endpoint.method)) {
    errors.push({ field: 'method', valid: false, message: `Required one of: ${Object.values(HttpMethod).join(', ')}` });
  }
  if (!endpoint.authenticationRequirement || !Object.values(IntegrationAuthMethod).includes(endpoint.authenticationRequirement)) {
    errors.push({ field: 'authenticationRequirement', valid: false, message: `Required one of: ${Object.values(IntegrationAuthMethod).join(', ')}` });
  }
  if (!endpoint.moduleOwner || !/^MOD-\d{3}$/.test(endpoint.moduleOwner)) {
    errors.push({ field: 'moduleOwner', valid: false, message: 'Required module owner reference (MOD-###)' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: baseResult.warnings,
  };
}
