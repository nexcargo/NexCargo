// NexCargo MOD-011 — Contract Validation Tests
// Authoritative source: ESS-002 §3.1 (Unit Validation Mandatory)
// Tests contract validator against MOD-011 specification requirements.

import { describe, it, expect } from 'vitest';
import { validateIntegrationContract } from '../../domain/utils/contract-validator';
import { ApiContractStatus } from '@/shared/standards/api-contract-schema';

describe('MOD-011 Contract Validation', () => {
  const baseValidContract = {
    contractId: 'test-contract-id',
    version: '1.0.0',
    status: ApiContractStatus.ACTIVE as const,
    createdAt: new Date().toISOString(),
    ownerModule: 'MOD-011',
  };

  describe('validateIntegrationContract', () => {
    it('accepts a valid integration contract', () => {
      const contract = {
        ...baseValidContract,
        integrationName: 'Test Integration',
        providerType: 'BANK' as never, // Just needs to be a valid enum value
        protocolType: 'REST' as never,
        authenticationMethod: 'OAUTH' as never,
      };

      const result = validateIntegrationContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects contract with missing integration name', () => {
      const contract = {
        ...baseValidContract,
        integrationName: '',
        providerType: 'BANK' as never,
        protocolType: 'REST' as never,
        authenticationMethod: 'OAUTH' as never,
      };

      const result = validateIntegrationContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'integrationName')).toBe(true);
    });

    it('rejects contract with invalid provider type', () => {
      const contract = {
        ...baseValidContract,
        integrationName: 'Test',
        providerType: 'INVALID_PROVIDER' as never,
        protocolType: 'REST' as never,
        authenticationMethod: 'OAUTH' as never,
      };

      const result = validateIntegrationContract(contract);
      expect(result.valid).toBe(false);
    });

    it('rejects contract with missing required fields', () => {
      const partialContract = {
        contractId: '', // Required but empty
        version: 'invalid-version', // Not semver
        status: ApiContractStatus.ACTIVE as const,
        createdAt: new Date().toISOString(),
        ownerModule: 'MOD-011',
        integrationName: 'Test',
        providerType: 'BANK' as never,
        protocolType: 'REST' as never,
        authenticationMethod: 'OAUTH' as never,
      };

      const result = validateIntegrationContract(partialContract);
      expect(result.valid).toBe(false);
    });
  });
});
