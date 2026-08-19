// NexCargo MOD-011 Domain Utils — API Contract Registry
// Authoritative source: MOD-011 §4.1–§4.6 + ESS-004 §3 (Contract Structure Standard)
// Provides a centralized contract registry interface for managing IntegrationContracts,
// ApiEndpointDefinitions, and ApiVersionRecords using Standard S-03 (BaseContractSchema).
// Per MOD-011 §5.1 (Contract-First Principle): All integrations MUST be defined BEFORE implementation.

import type { IntegrationContract, ApiEndpointDefinition, ApiVersionRecord } from '@/modules/mod-011-platform-integration/domain/types/integration-contracts';
import type { BaseContractSchema, ApiContractStatus } from '@/shared/standards/api-contract-schema';
import { validateIntegrationContract, validateApiEndpoint } from '@/modules/mod-011-platform-integration/domain/utils/contract-validator';
import { isValidSemver } from '@/shared/standards/api-contract-schema';

/** Registry entry type discriminator */
export type ContractRegistryType = 'INTEGRATION' | 'ENDPOINT' | 'VERSION';

/** Registry entry wrapper for typed contracts */
export interface ContractRegistryEntry<T extends BaseContractSchema = BaseContractSchema> {
  type: ContractRegistryType;
  schema: T;
  registeredAt: string;
  validated: boolean;
}

/**
 * API Contract Registry — centralized management of all Wave 0 integration contracts.
 * Per MOD-011 §7.2 (Schema Authority Rule): All integrations MUST reference explicit schema definitions.
 */
export class ApiContractRegistry {
  private readonly entries: Map<string, ContractRegistryEntry>;

  constructor() {
    this.entries = new Map();
  }

  /**
   * Registers an IntegrationContract in the registry.
   * @param contract - Integration contract to register
   * @returns true if registration succeeded
   */
  registerIntegration(contract: IntegrationContract): boolean {
    const validation = validateIntegrationContract(contract);
    const entry: ContractRegistryEntry<IntegrationContract> = {
      type: 'INTEGRATION',
      schema: contract,
      registeredAt: new Date().toISOString(),
      validated: validation.valid,
    };
    this.entries.set(contract.contractId, entry);
    return validation.valid;
  }

  /**
   * Registers an ApiEndpointDefinition in the registry.
   * @param endpoint - API endpoint definition to register
   * @returns true if registration succeeded
   */
  registerEndpoint(endpoint: ApiEndpointDefinition): boolean {
    const validation = validateApiEndpoint(endpoint);
    const entry: ContractRegistryEntry<ApiEndpointDefinition> = {
      type: 'ENDPOINT',
      schema: endpoint,
      registeredAt: new Date().toISOString(),
      validated: validation.valid,
    };
    this.entries.set(endpoint.contractId, entry);
    return validation.valid;
  }

  /**
   * Registers an ApiVersionRecord in the registry.
   * @param record - API version record to register
   * @returns true if registration succeeded
   */
  registerVersion(record: ApiVersionRecord): boolean {
    if (!isValidSemver(record.versionNumber)) {
      return false;
    }
    const entry: ContractRegistryEntry<ApiVersionRecord> = {
      type: 'VERSION',
      schema: record,
      registeredAt: new Date().toISOString(),
      validated: true,
    };
    this.entries.set(record.contractId, entry);
    return true;
  }

  /**
   * Retrieves a contract by its ID.
   * @param contractId - Contract identifier
   * @returns Contract entry or undefined
   */
  get<T extends BaseContractSchema>(contractId: string): ContractRegistryEntry<T> | undefined {
    return this.entries.get(contractId) as ContractRegistryEntry<T> | undefined;
  }

  /**
   * Lists all registered contracts filtered by type.
   * @param type - Optional contract type filter
   * @returns Array of matching registry entries
   */
  list(type?: ContractRegistryType): ContractRegistryEntry[] {
    if (type) {
      return [...this.entries.values()].filter(e => e.type === type);
    }
    return [...this.entries.values()];
  }

  /**
   * Gets the count of registered contracts by type.
   * @returns Record of type counts
   */
  getCounts(): Record<ContractRegistryType, number> {
    const counts: Record<ContractRegistryType, number> = { INTEGRATION: 0, ENDPOINT: 0, VERSION: 0 };
    for (const entry of this.entries.values()) {
      counts[entry.type]++;
    }
    return counts;
  }

  /**
   * Removes a contract from the registry.
   * @param contractId - Contract identifier to remove
   * @returns true if the contract was found and removed
   */
  remove(contractId: string): boolean {
    return this.entries.delete(contractId);
  }

  /** Total number of registered contracts */
  get size(): number {
    return this.entries.size;
  }
}
