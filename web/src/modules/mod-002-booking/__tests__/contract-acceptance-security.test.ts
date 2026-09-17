// NexCargo — Contract Acceptance Security Tests (SECDEF Authorization)
// Workstream A: Validates authorization flow for PATCH /api/contracts/[id]/accept
// Uses vi.mock at module level for proper hoisting

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockUser = {
  id: 'shipper-user-1',
  email: 'shipper@test.com',
  user_metadata: { role: 'SHIPPER' },
};

const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

const validContractId = 'eeeeeeee-1111-2222-3333-eeeeeeeeeeee';

function makePatchRequest(contractIdVal: string): NextRequest {
  const url = `http://localhost/api/contracts/${contractIdVal}/accept`;
  return new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
}

describe('Contract Acceptance — SECDEF Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.rpc.mockReset();
  });

  describe('authentication required', () => {
    it('returns 401 when no authenticated session', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') });

      // Dynamic import after vi.mock is active
      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(401);
    });
  });

  describe('SECDEF RPC authorization errors mapped correctly', () => {
    it('maps ACCESS_DENIED to 403', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'unrelated-user', email: 'user@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'ACCESS_DENIED: caller is not a party to this contract' },
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(403);
    });

    it('maps CONTRACT_NOT_FOUND to 404', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'shipper-user', email: 'shipper@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'CONTRACT_NOT_FOUND: contract eee... not found or deleted' },
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(404);
    });

    it('maps CONTRACT_NOT_DRAFT to 409', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'shipper-user', email: 'shipper@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'CONTRACT_NOT_DRAFT: contract is in status ACTIVE, cannot accept' },
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(409);
    });
  });

  describe('first signature success path', () => {
    it('returns first_signature_recorded on successful first signatory', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'shipper-user', email: 'shipper@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          action: 'first_signature_recorded',
          contract_id: validContractId,
          contract_acceptance_status: 'DRAFT',
          num_signatories: 1,
          signatory_role: 'SHIPPER',
          message: 'First signature recorded. Awaiting second party.',
        },
        error: null,
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.action).toBe('first_signature_recorded');
      expect(body.data.num_signatories).toBe(1);
    });
  });

  describe('second signature — finalization with tracking', () => {
    it('returns contract_finalized_with_tracking on final signatory', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'transporter-user', email: 'transporter@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          action: 'contract_finalized_with_tracking',
          contract_id: validContractId,
          contract_acceptance_status: 'ACTIVE',
          num_signatories: 2,
          signed_at: '2026-09-17T10:00:00Z',
          tracking_record_id: 'tracking-uuid-abc',
          tracking_ref: 'TRK-20260917-ABCDEF',
          tracking_status: 'CREATED',
          message: 'Contract finalized and tracking initialized.',
        },
        error: null,
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.action).toBe('contract_finalized_with_tracking');
      expect(body.data.contract_acceptance_status).toBe('ACTIVE');
      expect(body.data.num_signatories).toBe(2);
      expect(body.data.tracking_record_id).toBeDefined();
    });

    it('returns contract_finalized_tracking_exists when tracking already present (idempotent)', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'transporter-user', email: 'transporter@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          action: 'contract_finalized_tracking_exists',
          contract_id: validContractId,
          contract_acceptance_status: 'ACTIVE',
          num_signatories: 2,
          signed_at: '2026-09-17T10:00:00Z',
          message: 'Contract finalized. Tracking record already exists.',
        },
        error: null,
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.action).toBe('contract_finalized_tracking_exists');
    });
  });

  describe('retry/idempotency paths', () => {
    it('returns signature_already_recorded when same party signs before final', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'shipper-user', email: 'shipper@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          action: 'signature_already_recorded',
          contract_id: validContractId,
          contract_acceptance_status: 'DRAFT',
          num_signatories: 1,
          signatory_role: 'SHIPPER',
          message: 'Shipper signature already recorded. Waiting for transporter.',
        },
        error: null,
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.action).toBe('signature_already_recorded');
    });

    it('returns contract_already_finalized when fully signed contract retried', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'shipper-user', email: 'shipper@test.com' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          action: 'contract_already_finalized',
          contract_id: validContractId,
          contract_acceptance_status: 'ACTIVE',
          num_signatories: 2,
          signed_at: '2026-09-17T10:00:00Z',
          message: 'Contract was already finalized. Result returned idempotently.',
        },
        error: null,
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(makePatchRequest(validContractId), { params: Promise.resolve({ id: validContractId }) } as any);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.action).toBe('contract_already_finalized');
    });
  });

  describe('validation', () => {
    it('rejects invalid UUID format', async () => {
      const badUrl = new NextRequest('http://localhost/api/contracts/not-a-uuid/accept', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user', email: 'user@test.com' } },
        error: null,
      });

      const mod = await import('@/app/api/contracts/[id]/accept/route');
      const response = await mod.PATCH(badUrl, { params: Promise.resolve({ id: 'not-a-uuid' }) } as any);

      expect(response.status).toBe(400);
    });
  });
});
