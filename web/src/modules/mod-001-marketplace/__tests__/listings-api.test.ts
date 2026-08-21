import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET as listingsGET, POST as listingsPOST } from '@/app/api/marketplace/listings/route';

describe('MOD-001 Listings API — Wave 1 Increment 4', () => {
  // ============================================================
  // GET /api/marketplace/listings
  // ============================================================

  describe('GET /api/marketplace/listings', () => {
    it('returns 200 with contract-wrapped response for valid request', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        headers: { 'x-user-role': 'SHIPPER' },
      });

      const response = await listingsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.contract.ownerModule).toBe('MOD-001');
      expect(typeof data.correlationId).toBe('string');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('includes correlation ID in response headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        headers: { 'x-user-role': 'SHIPPER' },
      });

      const response = await listingsGET(request);
      
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });

    it('returns 403 when RBAC denies access', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        headers: { 'x-user-role': 'UNKNOWN_ROLE' },
      });

      const response = await listingsGET(request);
      
      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // POST /api/marketplace/listings
  // ============================================================

  describe('POST /api/marketplace/listings', () => {
    it('returns 201 with DRAFT status for valid listing creation', async () => {
      const body = {
        shipperId: 'shipper-001',
        origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
        destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
        cargoType: 'GENERAL',
        weightKg: 10000,
        timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await listingsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.status).toBe('DRAFT');
      expect(data.shipperId).toBe('shipper-001');
    });

    it('returns 400 when required fields are missing', async () => {
      const body = {
        shipperId: 'shipper-001',
        // Missing origin, destination, cargoType, etc.
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await listingsPOST(request);
      
      expect(response.status).toBe(400);
    });

    it('returns 400 when origin is incomplete', async () => {
      const body = {
        shipperId: 'shipper-001',
        origin: { latitude: -25.9692 }, // Missing longitude and address
        destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
        cargoType: 'GENERAL',
        weightKg: 10000,
        timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await listingsPOST(request);
      
      expect(response.status).toBe(400);
    });

    it('returns 403 when TRANSPORTER tries to create listing', async () => {
      const body = {
        shipperId: 'shipper-001',
        origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
        destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
        cargoType: 'GENERAL',
        weightKg: 10000,
        timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'x-user-role': 'TRANSPORTER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await listingsPOST(request);
      
      expect(response.status).toBe(403);
    });
  });
});
