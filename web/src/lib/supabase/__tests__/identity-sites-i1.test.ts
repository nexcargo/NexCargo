import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthenticatedUser, requireAuth } from '@/lib/supabase/get-user';
import { getUserRoleFromSession } from '@/app/(dashboard)/user-session';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// I-1 §5.2/§5.3 — the two remaining identity sites resolve from the database resolvers.
// Both previously read user_metadata.role, which any authenticated user can write.
function client(marketplace: string | null, platform: string | null, user: any) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn(async (fn: string) =>
      fn === 'effective_marketplace_role'
        ? { data: marketplace, error: null }
        : { data: platform, error: null },
    ),
  } as any;
}

describe('getAuthenticatedUser (I-1 §5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the resolved marketplace role, not the metadata claim', async () => {
    vi.mocked(createClient).mockResolvedValue(
      client('SHIPPER', null, { id: 'u1', email: 'a@b.c', user_metadata: { role: 'SUPER_ADMIN' } }),
    );

    const user = await getAuthenticatedUser();
    expect(user!.role).toBe('SHIPPER');
    expect(user!.platformRole).toBeNull();
    expect(user!.marketplaceRole).toBe('SHIPPER');
  });

  it('prefers the platform tier when one is assigned', async () => {
    vi.mocked(createClient).mockResolvedValue(client('SHIPPER', 'ADMIN', { id: 'u1', email: 'a@b.c' }));
    expect((await getAuthenticatedUser())!.role).toBe('ADMIN');
  });

  it('reports role null when the resolvers give nothing — unassigned, not defaulted', async () => {
    vi.mocked(createClient).mockResolvedValue(
      client(null, null, { id: 'u1', email: 'a@b.c', user_metadata: { role: 'DRIVER' } }),
    );
    expect((await getAuthenticatedUser())!.role).toBeNull();
  });

  it('does not authenticate on a metadata role alone', async () => {
    vi.mocked(createClient).mockResolvedValue(client(null, null, null));
    expect(await getAuthenticatedUser()).toBeNull();
    await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
  });
});

describe('getUserRoleFromSession (I-1 §5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the dashboard the database-resolved classification', async () => {
    vi.mocked(createClient).mockResolvedValue(
      client('TRANSPORTER', null, { id: 'u1', email: 'a@b.c', user_metadata: { role: 'ADMIN' } }),
    );
    expect(await getUserRoleFromSession({} as any)).toBe('TRANSPORTER');
  });

  it('no longer renders DRIVER from a metadata claim', async () => {
    vi.mocked(createClient).mockResolvedValue(
      client(null, null, { id: 'u1', email: 'a@b.c', user_metadata: { role: 'DRIVER' } }),
    );
    expect(await getUserRoleFromSession({} as any)).toBeNull();
  });

  it('fails closed to null when the resolvers error', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
      rpc: vi.fn(async () => ({ data: null, error: new Error('resolver unavailable') })),
    } as any);
    expect(await getUserRoleFromSession({} as any)).toBeNull();
  });

  it('returns null without contacting the resolvers when there is no user', async () => {
    vi.mocked(createClient).mockImplementation(async () => {
      throw new Error('no cookie store');
    });
    expect(await getUserRoleFromSession(null as any)).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});
