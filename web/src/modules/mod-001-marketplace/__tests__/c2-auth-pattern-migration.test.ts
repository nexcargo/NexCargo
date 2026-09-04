import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertApiAuthorization, getApiAuthContext } from '@/lib/supabase/api-auth';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('C2-Increment-002 Auth Migration — Pattern A Verification', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('assertApiAuthorization pattern', () => {
    it('throws UNAUTHORIZED when no session user', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      }) as any);

      const mockReq = {} as any;
      await expect(assertApiAuthorization(mockReq, 'matching', 'read'))
        .rejects.toThrow('UNAUTHORIZED');
    });

    it('throws FORBIDDEN when RBAC evaluation denies access', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@test.com', user_metadata: { role: 'USER' } } },
          error: null,
        })},
      }) as any);

      const mockReq = {} as any;
      // USER role is not in the matching resource allowedRoles per static rule table
      await expect(assertApiAuthorization(mockReq, 'matching', 'execute'))
        .rejects.toThrow(/FORBIDDEN/i);
    });

    it('returns AuthContext on successful auth + RBAC pass', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'shipper-1', email: 'shipper@nexcargo.com', user_metadata: { role: 'SHIPPER' } } },
          error: null,
        })},
      }) as any);

      const mockReq = {} as any;
      // SHIPPER role is in allowedRoles['matching'] for execute action
      const ctx = await assertApiAuthorization(mockReq, 'matching', 'execute');
      expect(ctx.userId).toBe('shipper-1');
      expect(ctx.email).toBe('shipper@nexcargo.com');
      expect(ctx.role).toBe('SHIPPER');
    });
  });

  describe('getApiAuthContext pattern', () => {
    it('returns null when no user in session', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      }) as any);

      const result = await getApiAuthContext({} as any);
      expect(result).toBeNull();
    });

    it('extracts userId/email/role from session user metadata', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'transporter-99',
              email: 'trans@fleet.mz',
              user_metadata: { role: 'TRANSPORTER', tenantId: 'tenant-a' },
            },
          },
          error: null,
        })},
      }) as any);

      const result = await getApiAuthContext({} as any);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('transporter-99');
      expect(result!.email).toBe('trans@fleet.mz');
      expect(result!.role).toBe('TRANSPORTER');
      expect(result!.tenantId).toBe('tenant-a');
    });

    it('uses default role USER when user_metadata.role is absent', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'a@b.c', user_metadata: {} } },
          error: null,
        })},
      }) as any);

      const result = await getApiAuthContext({} as any);
      expect(result!.role).toBe('USER');
    });
  });

  describe('No header-based fallback (Pattern B elimination)', () => {
    it('assertApiAuthorization does not accept x-user-role header as identity source', async () => {
      // The function reads from Supabase session cookies, NOT request headers.
      // This test verifies that even with a crafted request lacking a session,
      // the function rejects without falling back to any header value.
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      }) as any);

      const mockReq = { headers: new Map([['x-user-role', 'ADMIN']]) } as any;
      // Should throw UNAUTHORIZED regardless of header presence
      await expect(assertApiAuthorization(mockReq, 'bookings', 'create'))
        .rejects.toThrow('UNAUTHORIZED');
    });

    it('getApiAuthContext returns null when no session exists (even with x-user-role header)', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      }) as any);

      const mockReq = { headers: new Map([['x-user-role', 'MODERATOR']]) } as any;
      const result = await getApiAuthContext(mockReq);
      expect(result).toBeNull();
    });
  });
});
