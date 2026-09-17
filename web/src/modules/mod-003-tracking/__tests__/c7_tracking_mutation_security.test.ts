// NexCargo — Tracking Mutation Security Tests (C7 Closure)
// Verifies authentication, RBAC, and error handling for all tracking mutation endpoints.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================
// Status Endpoint Security
// ============================================================

describe('POST /api/tracking/[trackingId]/status — Authentication & RBAC', () => {
  beforeEach(() => vi.clearAllMocks());

  const mockOrchestrator = { updateTrackingStatus: vi.fn().mockResolvedValue(undefined) };

  vi.mock('@/modules/mod-003-tracking/application/services/tracking-orchestrator-service', () => ({
    TrackingOrchestratorService: vi.fn(() => mockOrchestrator),
  }));

  function makeStatusRequest(trackingId: string, body?: Record<string, unknown>): NextRequest {
    return new NextRequest(`http://localhost/api/tracking/${trackingId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? { targetStatus: 'IN_TRANSIT', sourceModule: 'TEST' }),
    });
  }

  describe('anonymous access', () => {
    it('returns 401 when no authenticated session', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(
        makeStatusRequest('test-id'),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('unauthorized role denied', () => {
    it('denies SHIPPER status updates', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(
          new Error('FORBIDDEN: Role \'SHIPPER\' is not authorized to access resource'),
        ),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(
        makeStatusRequest('test-id'),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(403);
    });

    it('denies DRIVER status updates', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(
          new Error('FORBIDDEN: Role \'DRIVER\' does not have \'status_update\' permission'),
        ),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(
        makeStatusRequest('test-id'),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(403);
    });
  });

  describe('validation preserved when authenticated', () => {
    beforeEach(async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockResolvedValue({
          userId: 'admin-user', email: 'admin@test.com', role: 'ADMIN',
        }),
      }));
    });

    it('rejects invalid targetStatus', async () => {
      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(
        new NextRequest('http://localhost/api/tracking/test-id/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetStatus: 'INVALID_STATE' }),
        }),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(400);
    });

    it('rejects missing targetStatus', async () => {
      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(
        new NextRequest('http://localhost/api/tracking/test-id/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(400);
    });
  });
});

// ============================================================
// GPS Endpoint Security
// ============================================================

describe('POST /api/tracking/[trackingId]/gps — Authentication Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeGpsRequest(trackingId: string, body?: Record<string, unknown>): NextRequest {
    return new NextRequest(`http://localhost/api/tracking/${trackingId}/gps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? { latitude: -23.5, longitude: -46.6 }),
    });
  }

  describe('anonymous access denied', () => {
    it('returns 401 when no authenticated session', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuth: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/gps/route');
      const response = await mod.POST(
        makeGpsRequest('test-id'),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('authentication required on all requests', () => {
    it('rejects missing latitude/longitude after auth', async () => {
      await vi.resetModules();
      const mockIngestion = { ingest: vi.fn().mockResolvedValue(undefined) };
      vi.doMock('@modules/mod-003-tracking/application/services/gps-ingestion-service', () => ({
        GpsIngestionService: vi.fn(() => mockIngestion),
      }));
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuth: vi.fn().mockResolvedValue({
          userId: 'driver-user', email: 'driver@test.com', role: 'DRIVER',
        }),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/gps/route');
      const response = await mod.POST(
        new NextRequest('http://localhost/api/tracking/test-id/gps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(400);
    });
  });
});

// ============================================================
// POD Submit Endpoint Security
// ============================================================

describe('POST /api/tracking/[trackingId]/pod — Authentication Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('@/modules/mod-003-tracking/application/services/pod-submission-service');
  });

  function makePodRequest(trackingId: string, body?: Record<string, unknown>): NextRequest {
    return new NextRequest(`http://localhost/api/tracking/${trackingId}/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        body ?? {
          bookingId: 'booking-uuid', recipientName: 'John Doe', signatureRef: 'sig.png',
          photoRefs: ['photo1.jpg'], gpsLat: -23.5, gpsLon: -46.6,
        },
      ),
    });
  }

  describe('anonymous access denied', () => {
    it('returns 401 when no authenticated session', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuth: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/pod/route');
      const response = await mod.POST(
        makePodRequest('test-id'),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('forbidden propagation for unauthorized roles', () => {
    it('returns 403 when assertApiAuth also triggers FORBIDDEN path', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuth: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/pod/route');
      const response = await mod.POST(
        makePodRequest('test-id'),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('validation preserved after auth', () => {
    beforeEach(async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuth: vi.fn().mockResolvedValue({
          userId: 'driver-user', email: 'driver@test.com', role: 'DRIVER',
        }),
      }));
    });

    it('rejects missing required fields', async () => {
      const mod = await import('@/app/api/tracking/[trackingId]/pod/route');
      const response = await mod.POST(
        new NextRequest('http://localhost/api/tracking/test-id/pod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(400);
    });

    it('rejects photos array empty', async () => {
      const mod = await import('@/app/api/tracking/[trackingId]/pod/route');
      const response = await mod.POST(
        new NextRequest('http://localhost/api/tracking/test-id/pod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoRefs: [] }),
        }),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any,
      );
      expect(response.status).toBe(400);
    });
  });
});

// ============================================================
// POD Verify Endpoint Security
// ============================================================

describe('PATCH /api/tracking/[trackingId]/pod/[podId]/verify — Authentication & RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('@/modules/mod-003-tracking/application/services/pod-submission-service');
  });

  function makeVerifyRequest(podId: string): NextRequest {
    return new NextRequest(`http://localhost/api/tracking/test-tracker/pod/${podId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify: true }),
    });
  }

  describe('anonymous access denied', () => {
    it('returns 401 when no authenticated session', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/pod/[podId]/verify/route');
      const response = await mod.PATCH(
        makeVerifyRequest('pod-uuid'),
        { params: Promise.resolve({ trackingId: 'test-tracker', podId: 'pod-uuid' }) } as any,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('unauthorized role denied', () => {
    it('denies TRANSPORTER POD verification', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(
          new Error('FORBIDDEN: Role \'TRANSPORTER\' is not authorized to access resource'),
        ),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/pod/[podId]/verify/route');
      const response = await mod.PATCH(
        makeVerifyRequest('pod-uuid'),
        { params: Promise.resolve({ trackingId: 'test-tracker', podId: 'pod-uuid' }) } as any,
      );
      expect(response.status).toBe(403);
    });

    it('denies DRIVER POD verification', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(
          new Error('FORBIDDEN: Role \'DRIVER\' is not authorized to access resource'),
        ),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/pod/[podId]/verify/route');
      const response = await mod.PATCH(
        makeVerifyRequest('pod-uuid'),
        { params: Promise.resolve({ trackingId: 'test-tracker', podId: 'pod-uuid' }) } as any,
      );
      expect(response.status).toBe(403);
    });
  });

  describe('validation preserved after auth', () => {
    beforeEach(async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockResolvedValue({
          userId: 'moderator-user', email: 'mod@test.com', role: 'MODERATOR',
        }),
      }));
    });

    it('rejects missing verify boolean', async () => {
      const mod = await import('@/app/api/tracking/[trackingId]/pod/[podId]/verify/route');
      const response = await mod.PATCH(
        new NextRequest('http://localhost/api/tracking/test-tracker/pod/pod-uuid/verify', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verify: 'not-a-boolean' }),
        }),
        { params: Promise.resolve({ trackingId: 'test-tracker', podId: 'pod-uuid' }) } as any,
      );
      expect(response.status).toBe(400);
    });
  });
});
