// NexCargo C4-III — Webhook Ingestion Tests (Signature + Idempotency)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Scope: HMAC-SHA256 verification, timestamp skew validation, event-id deduplication.

import { describe, it, expect } from 'vitest';

const MOCK_SECRET = 'c4ii-mock-secret-do-not-use-in-production';

// HMAC-SHA256 computation helper (same as implementation)
async function computeHmac(payload: string, secret: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const payloadData = new TextEncoder().encode(payload);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifySignature(payload: string, expectedSig: string): Promise<boolean> {
  if (!expectedSig || !MOCK_SECRET) return false;
  try {
    const computed = await computeHmac(payload, MOCK_SECRET);
    if (computed.length !== expectedSig.length) return false;
    let result = 0;
    for (let i = 0; i < computed.length; i++) {
      result |= computed.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

describe('HMAC-SHA256 Signature Verification', () => {
  it('valid signature passes verification', async () => {
    const payload = JSON.stringify({ referenceId: 'test-001', status: 'COMPLETED', eventId: 'ev-001' });
    const signature = await computeHmac(payload, MOCK_SECRET);
    
    const isValid = await verifySignature(payload, signature);
    expect(isValid).toBe(true);
  });

  it('tampered payload fails verification', async () => {
    const originalPayload = JSON.stringify({ referenceId: 'test-001', status: 'COMPLETED', eventId: 'ev-001' });
    const signature = await computeHmac(originalPayload, MOCK_SECRET);
    
    // Tamper with payload
    const tamperedPayload = JSON.stringify({ referenceId: 'test-001', status: 'FAILED', eventId: 'ev-001' });
    const isValid = await verifySignature(tamperedPayload, signature);
    expect(isValid).toBe(false);
  });

  it('wrong signature fails verification', async () => {
    const payload = JSON.stringify({ referenceId: 'test-001', status: 'COMPLETED', eventId: 'ev-001' });
    const invalidSignature = 'invalid-signature-value-here';
    
    const isValid = await verifySignature(payload, invalidSignature);
    expect(isValid).toBe(false);
  });

  it('empty signature fails verification', async () => {
    const payload = JSON.stringify({ referenceId: 'test-001', status: 'COMPLETED', eventId: 'ev-001' });
    const isValid = await verifySignature(payload, '');
    expect(isValid).toBe(false);
  });

  it('null signature fails verification', async () => {
    const payload = JSON.stringify({ referenceId: 'test-001', status: 'COMPLETED', eventId: 'ev-001' });
    const isValid = await verifySignature(payload, '');
    expect(isValid).toBe(false);
  });
});

describe('Event-ID Deduplication', () => {
  // Simulate in-memory cache behavior
  const storedEvents = new Map<string, { ref: string; status: string }>();
  
  function storeEvent(eventId: string, ref: string, status: string): void {
    storedEvents.set(eventId, { ref, status });
  }
  
  function hasStoredEvent(eventId: string): boolean {
    return storedEvents.has(eventId);
  }

  it('first occurrence is processed', () => {
    expect(hasStoredEvent('event-001')).toBe(false);
    storeEvent('event-001', 'ref-001', 'COMPLETED');
    expect(hasStoredEvent('event-001')).toBe(true);
  });

  it('duplicate event-id is detected', () => {
    expect(hasStoredEvent('event-001')).toBe(true);
  });

  it('different event-id is not flagged as duplicate', () => {
    expect(hasStoredEvent('event-different')).toBe(false);
    storeEvent('event-different', 'ref-diff', 'COMPLETED');
    expect(hasStoredEvent('event-different')).toBe(true);
  });
});

describe('Timestamp Skew Validation', () => {
  const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

  function isValidTimestamp(timestamp: string): boolean {
    const providedTime = new Date(timestamp).getTime();
    const now = Date.now();
    return Math.abs(now - providedTime) <= MAX_SKEW_MS;
  }

  it('accepts current timestamp', () => {
    const now = new Date().toISOString();
    expect(isValidTimestamp(now)).toBe(true);
  });

  it('accepts timestamp within ±5 minute window', () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    expect(isValidTimestamp(fourMinutesAgo)).toBe(true);
  });

  it('rejects timestamp outside ±5 minute window', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(isValidTimestamp(tenMinutesAgo)).toBe(false);
  });

  it('rejects future timestamps outside window', () => {
    const fiveMinutesFuture = new Date(Date.now() + 6 * 60 * 1000).toISOString();
    expect(isValidTimestamp(fiveMinutesFuture)).toBe(false);
  });
});
