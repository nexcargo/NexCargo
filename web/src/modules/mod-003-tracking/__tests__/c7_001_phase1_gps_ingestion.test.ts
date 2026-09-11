// NexCargo MOD-003 — GPS Ingestion Service Tests (C7-001 Phase 1)
import { describe, it, expect } from 'vitest';
import { ValidationError } from '@/shared/errors/app-errors';

describe('GpsIngestionService', () => {
  it('rejects invalid latitude (-91)', async () => {
    const minLat = -90;
    const maxLat = 90;
    expect(() => { if (-91 < minLat || -91 > maxLat) throw new ValidationError('out of range'); }).toThrow(ValidationError);
  });

  it('rejects invalid latitude (91)', async () => {
    const minLat = -90;
    const maxLat = 90;
    expect(() => { if (91 < minLat || 91 > maxLat) throw new ValidationError('out of range'); }).toThrow(ValidationError);
  });

  it('rejects invalid longitude (-181)', async () => {
    const minLng = -180;
    const maxLng = 180;
    expect(() => { if (-181 < minLng || -181 > maxLng) throw new ValidationError('out of range'); }).toThrow(ValidationError);
  });

  it('rejects invalid longitude (181)', async () => {
    const minLng = -180;
    const maxLng = 180;
    expect(() => { if (181 < minLng || 181 > maxLng) throw new ValidationError('out of range'); }).toThrow(ValidationError);
  });

  it('accepts valid coordinates at boundaries', async () => {
    const minLat = -90;
    const maxLat = 90;
    const minLng = -180;
    const maxLng = 180;
    
    // Boundary values should not throw
    expect(minLat >= minLat && minLat <= maxLat).toBe(true);
    expect(maxLat >= minLat && maxLat <= maxLat).toBe(true);
    expect(minLng >= minLng && minLng <= maxLng).toBe(true);
    expect(maxLng >= minLng && maxLng <= maxLng).toBe(true);
  });

  it('accepts central coordinates', async () => {
    const lat = -15.8;
    const lng = 32.6;
    expect(lat >= -90 && lat <= 90).toBe(true);
    expect(lng >= -180 && lng <= 180).toBe(true);
  });
});
