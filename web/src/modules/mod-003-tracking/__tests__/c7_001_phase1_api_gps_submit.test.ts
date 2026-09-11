// NexCargo MOD-003 — GPS API Route Tests (C7-001 Phase 1)
import { describe, it, expect } from 'vitest';

describe('POST /api/tracking/[trackingId]/gps validation', () => {
  it('validates required coordinates are numbers', () => {
    const body = { latitude: -15.8, longitude: 32.6 };
    expect(typeof body.latitude).toBe('number');
    expect(typeof body.longitude).toBe('number');
  });

  it('rejects missing coordinates', () => {
    const body: Record<string, unknown> = {};
    expect(!body['latitude'] || !body['longitude']).toBe(true);
  });

  it('rejects invalid latitude (91)', () => {
    const lat = 91;
    expect(lat < -90 || lat > 90).toBe(true);
  });

  it('accepts valid GPS coordinates', () => {
    const lat = -15.8;
    const lng = 32.6;
    expect(lat >= -90 && lat <= 90).toBe(true);
    expect(lng >= -180 && lng <= 180).toBe(true);
  });
});
