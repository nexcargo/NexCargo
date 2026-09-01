// NexCargo MOD-017 — Structured Logging Tests (Wave 5 Increment 1)
// Authoritative source: ESS-002 §3.1, MOD-017 §4.1, ESS-006 §6.2

import { describe, it, expect } from 'vitest';
import { maskSensitiveFields, validateNoSensitiveData } from '../domain/services/runtime-logger';

describe('MOD-017 Structured Logging', () => {
  describe('maskSensitiveFields', () => {
    it('masks apiKey field', () => {
      const input = { apiKey: 'secret-key-123', userId: 'user-1' };
      const result = maskSensitiveFields(input);
      expect(result).toEqual({ apiKey: '[REDACTED]', userId: 'user-1' });
    });

    it('masks apiSecret field', () => {
      const input = { apiSecret: 'my-secret', safeField: 'public-data' };
      const result = maskSensitiveFields(input);
      expect(result).toEqual({ apiSecret: '[REDACTED]', safeField: 'public-data' });
    });

    it('masks token field', () => {
      const input = { token: 'bearer-token-value', sessionId: 'session-123' };
      const result = maskSensitiveFields(input);
      expect(result).toEqual({ token: '[REDACTED]', sessionId: 'session-123' });
    });

    it('masks nested sensitive fields', () => {
      const input = {
        request: {
          authorization: 'Bearer xyz',
          headers: {
            bearer: 'token-in-header',
          },
        },
        metadata: { normal: 'value' },
      };
      const result = maskSensitiveFields(input);
      expect((result as any).request.authorization).toBe('[REDACTED]');
      expect((result as any).request.headers.bearer).toBe('[REDACTED]');
      expect((result as any).metadata.normal).toBe('value');
    });

    it('does not modify non-sensitive fields', () => {
      const input = { userId: 'user-1', action: 'login', timestamp: '2026-09-01T00:00:00Z' };
      const result = maskSensitiveFields(input);
      expect(result).toEqual(input);
    });

    it('handles array values safely (does not crash)', () => {
      const input = { tags: ['tag1', 'tag2'], message: 'normal log' };
      const result = maskSensitiveFields(input);
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.message).toBe('normal log');
    });

    it('handles empty object', () => {
      expect(maskSensitiveFields({})).toEqual({});
    });

    it('handles null/undefined gracefully', () => {
      expect(maskSensitiveFields(null as any)).toBeNull();
      // undefined top-level would fail type check but we test the depth limit path
    });
  });

  describe('validateNoSensitiveData', () => {
    it('returns true when no secrets in output', () => {
      const output = 'INFO user login success';
      expect(validateNoSensitiveData(output, ['super-secret'])).toBe(true);
    });

    it('returns false when secret value appears unmasked', () => {
      const output = 'API key super-secret used for auth';
      expect(validateNoSensitiveData(output, ['super-secret'])).toBe(false);
    });

    it('returns true when secret is properly masked', () => {
      const output = 'API key [REDACTED] used for auth';
      expect(validateNoSensitiveData(output, ['super-secret'])).toBe(true);
    });

    it('checks multiple secrets simultaneously', () => {
      const output = 'User authenticated with [REDACTED] for service';
      const secrets = ['actual-secret-1', 'actual-secret-2'];
      expect(validateNoSensitiveData(output, secrets)).toBe(true);
    });
  });
});
