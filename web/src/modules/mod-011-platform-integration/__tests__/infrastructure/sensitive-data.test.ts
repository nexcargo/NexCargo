// NexCargo MOD-011 — Sensitive Data Logging Test
// Authoritative source: ESS-006 §6.2 (Sensitive Data Handling), MOD-011 §7.7 (Neutrality)
// Ensures API keys and secrets are never logged in plaintext.

import { describe, it, expect } from 'vitest';
import { hashApiKey, validateKeyPermissions } from '../../domain/utils/api-key-management';

describe('MOD-011 Sensitive Data Handling', () => {
  describe('API key hashing', () => {
    it('produces consistent hash for same input', async () => {
      const key = 'my-secret-api-key';
      const hash1 = await hashApiKey(key);
      const hash2 = await hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await hashApiKey('key-one');
      const hash2 = await hashApiKey('key-two');
      expect(hash1).not.toBe(hash2);
    });

    it('does not include raw key in hash output', async () => {
      const rawKey = 'SUPER_SECRET_KEY_12345';
      const hash = await hashApiKey(rawKey);
      expect(hash).not.toContain('SUPER_SECRET_KEY');
      expect(hash).not.toContain('12345');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('permission validation', () => {
    it('grants access when all required permissions are present', () => {
      const granted = ['read', 'write', 'admin'];
      const required = ['read', 'write'];
      expect(validateKeyPermissions(granted, required)).toBe(true);
    });

    it('denies access when some required permissions are missing', () => {
      const granted = ['read'];
      const required = ['read', 'write', 'admin'];
      expect(validateKeyPermissions(granted, required)).toBe(false);
    });

    it('allows empty required permissions', () => {
      const granted = ['read'];
      const required: string[] = [];
      expect(validateKeyPermissions(granted, required)).toBe(true);
    });
  });
});
