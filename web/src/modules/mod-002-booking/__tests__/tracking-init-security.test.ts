// NexCargo — Tracking Init Security Tests (RBAC Enforcement)
// Workstream B: Validates POST /api/tracking/init auth guard and RBAC registry
// Uses vi.mock at module level for proper hoisting

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';

const mockTrackingOrchestrator = {
  initializeTracking: vi.fn().mockResolvedValue({
    id: 'tracking-uuid-1',
    trackingRef: 'TRK-20260917-ABC123',
    bookingId: 'booking-uuid-1',
    contractId: null,
    status: 'CREATED',
    visibilityLevel: 'RESTRICTED',
    activatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
};

vi.mock('@/modules/mod-003-tracking/application/services/tracking-orchestrator-service', () => ({
  TrackingOrchestratorService: vi.fn(() => mockTrackingOrchestrator),
}));

function makeInitRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/tracking/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Tracking Init — RBAC Registry', () => {
  describe('tracking resource role assignment', () => {
    it('allows ADMIN to create tracking records', () => {
      const result = evaluateRBAC('ADMIN', 'tracking', 'create');
      expect(result.permitted).toBe(true);
    });

    it('allows SUPER_ADMIN to create tracking records', () => {
      const result = evaluateRBAC('SUPER_ADMIN', 'tracking', 'create');
      expect(result.permitted).toBe(true);
    });

    it('denies SHIPPER from creating tracking records', () => {
      const result = evaluateRBAC('SHIPPER', 'tracking', 'create');
      expect(result.permitted).toBe(false);
    });

    it('denies TRANSPORTER from creating tracking records', () => {
      const result = evaluateRBAC('TRANSPORTER', 'tracking', 'create');
      expect(result.permitted).toBe(false);
    });

    it('denies DISPATCHER from creating tracking records', () => {
      const result = evaluateRBAC('DISPATCHER', 'tracking', 'create');
      expect(result.permitted).toBe(false);
    });

    it('denies MODERATOR from creating tracking records', () => {
      const result = evaluateRBAC('MODERATOR', 'tracking', 'create');
      expect(result.permitted).toBe(false);
    });
  });

  describe('endpoint auth guard — DENY paths verified', () => {
    // These tests verify that non-privileged roles receive FORBIDDEN (403)
    // The route checks auth BEFORE body parsing, so unauthenticated/non-admin routes
    // correctly deny before reaching the orchestrator.
    
    it('returns 403 when assertApiAuthorization throws FORBIDDEN for any non-admin role', async () => {
      await vi.resetModules();
      
      const mockAssert = vi.fn().mockRejectedValue(new Error('FORBIDDEN: Role is not authorized to access resource'));
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: mockAssert,
      }));
      
      // Also restore the orchestrator mock after resetModules
      vi.doMock('@/modules/mod-003-tracking/application/services/tracking-orchestrator-service', () => ({
        TrackingOrchestratorService: vi.fn(() => ({
          initializeTracking: vi.fn().mockResolvedValue({
            id: 'test-tracking-id',
            trackingRef: 'TRK-20260917-XYZ',
            bookingId: 'booking-uuid-1',
            contractId: null,
            status: 'CREATED',
            visibilityLevel: 'RESTRICTED',
            activatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        })),
      }));

      const mod = await import('@/app/api/tracking/init/route');
      const response = await mod.POST(makeInitRequest({ bookingId: 'test-uuid-1' }));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('forbidden');
    });

    it('returns 401 when no authenticated session', async () => {
      await vi.resetModules();
      
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuth: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
        assertApiAuthorization: vi.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      }));

      const mod = await import('@/app/api/tracking/init/route');
      const response = await mod.POST(makeInitRequest({ bookingId: 'test-uuid-1' }));

      expect(response.status).toBe(401);
    });
  });

  describe('validation preserved', () => {
    it('route handler exists and accepts requests', async () => {
      const mod = await import('@/app/api/tracking/init/route');
      expect(mod.POST).toBeDefined();
      expect(typeof mod.POST).toBe('function');
    });

    it('rejects missing bookingId', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockResolvedValue({
          userId: 'admin-user-1', email: 'admin@test.com', role: 'ADMIN',
        }),
      }));
      vi.doMock('@/modules/mod-003-tracking/application/services/tracking-orchestrator-service', () => ({
        TrackingOrchestratorService: vi.fn(() => ({
          initializeTracking: vi.fn().mockResolvedValue({
            id: 'test-tracking-id', trackingRef: 'TRK-20260917-XYZ',
            bookingId: 'booking-uuid-1', contractId: null, status: 'CREATED',
            visibilityLevel: 'RESTRICTED', activatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        })),
      }));

      const mod = await import('@/app/api/tracking/init/route');
      const response = await mod.POST(makeInitRequest({}));

      expect(response.status).toBe(400);
    });

    it('rejects non-string bookingId', async () => {
      await vi.resetModules();
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockResolvedValue({
          userId: 'admin-user-1', email: 'admin@test.com', role: 'ADMIN',
        }),
      }));
      vi.doMock('@/modules/mod-003-tracking/application/services/tracking-orchestrator-service', () => ({
        TrackingOrchestratorService: vi.fn(() => ({
          initializeTracking: vi.fn().mockResolvedValue({
            id: 'test-tracking-id', trackingRef: 'TRK-20260917-XYZ',
            bookingId: 'booking-uuid-1', contractId: null, status: 'CREATED',
            visibilityLevel: 'RESTRICTED', activatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        })),
      }));

      const mod = await import('@/app/api/tracking/init/route');
      const response = await mod.POST(makeInitRequest({ bookingId: 12345 }));

      expect(response.status).toBe(400);
    });
  });
});
