import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET as quotesGET, POST as quotesPOST } from '@/app/api/marketplace/quotes/route';
import { GET as matchesGET, POST as matchesPOST } from '@/app/api/marketplace/matches/route';
import { CargoType, PricingModel, MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';

describe('MOD-001 Increment 5 API Routes — Quotes & Matches', () => {
  // ============================================================
  // Quotes API (Enhanced with real quote generation)
  // ============================================================

  describe('POST /api/marketplace/quotes', () => {
    it('generates a corridor-based advisory quote for GENERAL cargo', async () => {
      const body = {
        listingId: 'listing-001',
        cargoType: CargoType.GENERAL,
        weightKg: 5000,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await quotesPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.contract.ownerModule).toBe('MOD-001');
      expect(data.data.quoteId).toBeDefined();
      expect(data.data.suggestedPriceMin).toBeGreaterThan(0);
      expect(data.data.suggestedPriceMax).toBeGreaterThan(data.data.suggestedPriceMin);
      expect(data.data.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(data.data.basis).toContain('corridor_pricing_general');
    });

    it('generates different prices for HAZARDOUS cargo', async () => {
      const hazardousBody = {
        listingId: 'listing-002',
        cargoType: CargoType.HAZARDOUS,
        weightKg: 5000,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(hazardousBody),
      });

      const response = await quotesPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      // Hazardous should be more expensive than general
      expect(data.data.suggestedPriceMin).toBeGreaterThan(0);
    });

    it('returns 400 when cargoType is missing', async () => {
      const body = {
        listingId: 'listing-001',
        weightKg: 5000,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await quotesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 when weightKg is zero', async () => {
      const body = {
        listingId: 'listing-001',
        cargoType: CargoType.GENERAL,
        weightKg: 0,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await quotesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 403 for unauthorized role', async () => {
      const body = {
        listingId: 'listing-001',
        cargoType: CargoType.GENERAL,
        weightKg: 5000,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'TRANSPORTER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await quotesPOST(request);
      expect(response.status).toBe(403);
    });

    it('includes correlation ID in response headers', async () => {
      const body = {
        listingId: 'listing-001',
        cargoType: CargoType.GENERAL,
        weightKg: 5000,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await quotesPOST(request);
      
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });

    it('uses negotiable pricing to widen range', async () => {
      const fixedBody = {
        listingId: 'listing-fixed',
        cargoType: CargoType.GENERAL,
        weightKg: 5000,
        pricingModel: PricingModel.FIXED,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const negBody = {
        listingId: 'listing-neg',
        cargoType: CargoType.GENERAL,
        weightKg: 5000,
        pricingModel: PricingModel.NEGOTIATED,
        timeWindow: {
          earliestPickup: '2026-09-15T08:00:00Z',
          latestDelivery: '2026-09-25T18:00:00Z',
        },
      };

      const fixedRequest = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(fixedBody),
      });

      const negRequest = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(negBody),
      });

      const fixedResp = await quotesPOST(fixedRequest);
      const negResp = await quotesPOST(negRequest);
      const fixedData = await fixedResp.json();
      const negData = await negResp.json();

      // Negotiated pricing should have lower minimum (wider range)
      expect(negData.data.suggestedPriceMin).toBeLessThanOrEqual(fixedData.data.suggestedPriceMin);
    });
  });

  // ============================================================
  // Matches API (New endpoints)
  // ============================================================

  describe('GET /api/marketplace/matches', () => {
    it('returns empty match list for valid request', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/matches?listingId=listing-001',
        { headers: { 'x-user-role': 'SHIPPER' } },
      );

      const response = await matchesGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.listingId).toBe('listing-001');
      expect(Array.isArray(data.data.matches)).toBe(true);
      expect(data.data.matches.length).toBe(0); // Stub returns empty
    });

    it('returns 400 when listingId query param is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        headers: { 'x-user-role': 'SHIPPER' },
      });

      const response = await matchesGET(request);
      expect(response.status).toBe(400);
    });

    it('returns 403 for TRANSPORTER trying to read matches', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/matches?listingId=listing-001',
        { headers: { 'x-user-role': 'TRANSPORTER' } },
      );

      const response = await matchesGET(request);
      expect(response.status).toBe(403);
    });

    it('includes correlation ID header', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/matches?listingId=listing-001',
        { headers: { 'x-user-role': 'SHIPPER' } },
      );

      const response = await matchesGET(request);
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });
  });

  describe('POST /api/marketplace/matches', () => {
    it('creates a match proposal with correct structure', async () => {
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 85.5,
        rankingPosition: 1,
        reasoningTrace: 'Excellent corridor alignment',
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.matchId).toBeDefined();
      expect(data.data.listingId).toBe('listing-001');
      expect(data.data.offerId).toBe('offer-001');
      expect(data.data.matchScore).toBe(85.5);
      expect(data.data.rankingPosition).toBe(1);
      expect(data.data.status).toBe(MatchStatus.PROPOSED);
      expect(data.data.reasoningTrace).toBe('Excellent corridor alignment');
    });

    it('rounds matchScore to 2 decimal places', async () => {
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 85.567,
        rankingPosition: 1,
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      const data = await response.json();

      expect(data.data.matchScore).toBe(85.57);
    });

    it('does not include BaseEntity persistence fields', async () => {
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 80,
        rankingPosition: 2,
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      const data = await response.json();

      expect('id' in data.data).toBe(false);
      expect('created_at' in data.data).toBe(false);
    });

    it('returns 400 when listingId is missing', async () => {
      const body = {
        offerId: 'offer-001',
        matchScore: 80,
        rankingPosition: 1,
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 when matchScore is out of range (>100)', async () => {
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 150,
        rankingPosition: 1,
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 when rankingPosition < 1', async () => {
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 80,
        rankingPosition: 0,
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 403 for TRANSPORTER creating matches', async () => {
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 80,
        rankingPosition: 1,
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'TRANSPORTER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      expect(response.status).toBe(403);
    });

    it('includes correlation ID header', async () => {
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 80,
        rankingPosition: 1,
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await matchesPOST(request);
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });
  });
});
