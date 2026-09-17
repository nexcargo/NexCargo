// NexCargo — Tracking Status Endpoint Security Tests (RBAC Enforcement)
// C7 Tracking Status Endpoint Security Remediation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';

const mockTrackingOrchestrator = {
  updateTrackingStatus: vi.fn().mockResolvedValue(undefined),
  initializeTracking: vi.fn().mockResolvedValue({
    id: 'tracking-uuid-1', trackingRef: 'TRK-20260917-ABC123',
    bookingId: 'booking-uuid-1', contractId: null, status: 'CREATED',
    visibilityLevel: 'RESTRICTED', activatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }),
};

vi.mock('@/modules/mod-003-tracking/application/services/tracking-orchestrator-service', () => ({
  TrackingOrchestratorService: vi.fn(() => mockTrackingOrchestrator),
}));

function makeStatusRequest(trackingId: string): NextRequest {
  return new NextRequest(`http://localhost/api/tracking/${trackingId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetStatus: 'BOOKED', sourceModule: 'TEST' }),
  });
}

describe('Tracking Status — RBAC Registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrackingOrchestrator.updateTrackingStatus.mockReset().mockResolvedValue(undefined);
  });

  describe('tracking_status resource role assignment', () => {
    it('allows TRANSPORTER to create tracking_status entries', () => {
      const result = evaluateRBAC('TRANSPORTER', 'tracking_status', 'status_update');
      expect(result.permitted).toBe(true);
    });

    it('allows DISPATCHER to create tracking_status entries', () => {
      const result = evaluateRBAC('DISPATCHER', 'tracking_status', 'status_update');
      expect(result.permitted).toBe(true);
    });

    it('allows MODERATOR to create tracking_status entries', () => {
      const result = evaluateRBAC('MODERATOR', 'tracking_status', 'status_update');
      expect(result.permitted).toBe(true);
    });

    it('allows ADMIN to create tracking_status entries', () => {
      const result = evaluateRBAC('ADMIN', 'tracking_status', 'status_update');
      expect(result.permitted).toBe(true);
    });

    it('allows SUPER_ADMIN to create tracking_status entries', () => {
      const result = evaluateRBAC('SUPER_ADMIN', 'tracking_status', 'status_update');
      expect(result.permitted).toBe(true);
    });

    it('denies SHIPPER from creating tracking_status entries', () => {
      const result = evaluateRBAC('SHIPPER', 'tracking_status', 'status_update');
      expect(result.permitted).toBe(false);
    });

    it('denies DRIVER from creating tracking_status entries', () => {
      const result = evaluateRBAC('DRIVER', 'tracking_status', 'status_update');
      expect(result.permitted).toBe(false);
    });
  });

  describe('endpoint auth guard behavior', () => {
    it('returns 403 when assertApiAuthorization throws FORBIDDEN', async () => {
      await vi.resetModules();
      
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(new Error('FORBIDDEN: Role is not authorized to access resource')),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(makeStatusRequest('test-tracking-id'), { params: Promise.resolve({ trackingId: 'test-tracking-id' }) } as any);

      expect(response.status).toBe(403);
    });

    it('returns 401 when no authenticated session', async () => {
      await vi.resetModules();
      
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      }));

      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(makeStatusRequest('test-tracking-id'), { params: Promise.resolve({ trackingId: 'test-tracking-id' }) } as any);

      expect(response.status).toBe(401);
    });
  });

  describe('validation preserved when authenticated', () => {
    beforeEach(async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockResolvedValue({
          userId: 'admin-user-1', email: 'admin@test.com', role: 'ADMIN',
        }),
      }));
    });

    it('rejects missing trackingId', async () => {
      // The route extracts trackingId from params, not body, so this should pass validation
      // but fail at orchestrator level if record not found — we verify structure only
      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const badUrl = new NextRequest('http://localhost/api/tracking///status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'BOOKED' }),
      });
      const response = await mod.POST(badUrl, { params: Promise.resolve({ trackingId: '' }) } as any);
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
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any
      );
      expect(response.status).toBe(400);
    });

    it('rejects invalid targetStatus', async () => {
      const mod = await import('@/app/api/tracking/[trackingId]/status/route');
      const response = await mod.POST(
        new NextRequest('http://localhost/api/tracking/test-id/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetStatus: 'INVALID_STATE' }),
        }),
        { params: Promise.resolve({ trackingId: 'test-id' }) } as any
      );
      expect(response.status).toBe(400);
    });
  });
});
