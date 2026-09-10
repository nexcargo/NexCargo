import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertApiAuthorization, getApiAuthContext } from '@/lib/supabase/api-auth';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Helper: create mock client with rpc() failing → forces metadata fallback path
function makeMock(user: any) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn(async () => ({ data: null, error: new Error('RPC unavailable in test') })),
  } as any;
}

describe('C2-Increment-002 Auth Migration — Pattern A Verification', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('assertApiAuthorization pattern', () => {
    it('throws UNAUTHORIZED when no session user', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        rpc: vi.fn(async () => ({ data: null, error: new Error('RPC unavailable') })),
      } as any);

      await expect(assertApiAuthorization({} as any, 'matching', 'read'))
        .rejects.toThrow('UNAUTHORIZED');
    });

    it('throws FORBIDDEN when RBAC evaluation denies access (unassigned role)', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue(makeMock({ id: 'user-1', email: 'test@test.com', user_metadata: { role: null } }));

      // Unassigned/null role → getEffectiveRole returns null → FORBIDDEN
      await expect(assertApiAuthorization({} as any, 'matching', 'execute'))
        .rejects.toThrow(/FORBIDDEN/i);
    });

    it('returns AuthContext on successful auth + RBAC pass', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue(makeMock({
        id: 'shipper-1',
        email: 'shipper@nexcargo.com',
        user_metadata: { role: 'SHIPPER' },
      }));

      // SHIPPER passes metadata fallback whitelist AND evaluateRBAC for matching/execute
      const ctx = await assertApiAuthorization({} as any, 'matching', 'execute');
      expect(ctx.userId).toBe('shipper-1');
      expect(ctx.email).toBe('shipper@nexcargo.com');
      expect(ctx.role).toBe('SHIPPER');
    });
  });

  describe('getApiAuthContext pattern', () => {
    it('returns null when no user in session', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        rpc: vi.fn(async () => ({ data: null, error: new Error('RPC unavailable') })),
      } as any);

      expect(await getApiAuthContext({} as any)).toBeNull();
    });

    it('extracts userId/email/role from session user metadata', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue(makeMock({
        id: 'transporter-99',
        email: 'trans@fleet.mz',
        user_metadata: { role: 'TRANSPORTER', tenantId: 'tenant-a' },
      }));

      const result = await getApiAuthContext({} as any);
      expect(result!.userId).toBe('transporter-99');
      expect(result!.email).toBe('trans@fleet.mz');
      expect(result!.role).toBe('TRANSPORTER');
      expect(result!.tenantId).toBe('tenant-a');
    });

    it('returns null role when user_metadata.role is absent (unassigned/onboarding state)', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue(makeMock({ id: 'u1', email: 'a@b.c', user_metadata: {} }));

      expect((await getApiAuthContext({} as any))!.role).toBeNull();
    });
  });

  describe('No header-based fallback (Pattern B elimination)', () => {
    it('assertApiAuthorization does not accept x-user-role header as identity source', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        rpc: vi.fn(async () => ({ data: null, error: new Error('RPC unavailable') })),
      } as any);

      await expect(assertApiAuthorization({ headers: new Map([['x-user-role', 'ADMIN']]) } as any, 'bookings', 'create'))
        .rejects.toThrow('UNAUTHORIZED');
    });

    it('getApiAuthContext returns null when no session exists (even with x-user-role header)', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        rpc: vi.fn(async () => ({ data: null, error: new Error('RPC unavailable') })),
      } as any);

      expect(await getApiAuthContext({ headers: new Map([['x-user-role', 'MODERATOR']]) } as any)).toBeNull();
    });
  });
});
