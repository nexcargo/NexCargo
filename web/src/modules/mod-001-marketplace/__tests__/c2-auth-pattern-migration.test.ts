import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertApiAuthorization, getApiAuthContext } from '@/lib/supabase/api-auth';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// I-1 §3.6 — the only role inputs are the two database resolvers:
//   public.effective_user_role()        -> platform tiers  (app.platform_roles)
//   public.effective_marketplace_role() -> marketplace     (app.marketplace_memberships)
// user_metadata is client-writable, so it is never consulted for authority.
type RpcResult = string | null | 'error';

function makeMock(user: any, marketplace: RpcResult, platform: RpcResult) {
  const shaped = (value: RpcResult) =>
    value === 'error'
      ? { data: null, error: new Error('RPC unavailable in test') }
      : { data: value, error: null };

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn(async (fn: string) =>
      fn === 'effective_marketplace_role' ? shaped(marketplace) : shaped(platform),
    ),
  } as any;
}

function session(user: any, marketplace: RpcResult, platform: RpcResult) {
  vi.mocked(createClient).mockResolvedValue(makeMock(user, marketplace, platform));
}

describe('C2 Auth Pattern — I-1 authoritative role resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a legitimate marketplace role from the marketplace resolver', async () => {
    session({ id: 'shipper-1', email: 'shipper@nexcargo.com' }, 'SHIPPER', null);

    const ctx = await assertApiAuthorization({} as any, 'matching', 'execute');

    expect(ctx.marketplaceRole).toBe('SHIPPER');
    expect(ctx.platformRole).toBeNull();
    expect(ctx.role).toBe('SHIPPER');
  });

  it('resolves a platform role from the platform resolver', async () => {
    session({ id: 'mod-1', email: 'mod@nexcargo.com' }, null, 'MODERATOR');

    const ctx = await assertApiAuthorization({} as any, 'matching', 'execute');

    expect(ctx.platformRole).toBe('MODERATOR');
    expect(ctx.marketplaceRole).toBeNull();
    expect(ctx.role).toBe('MODERATOR');
  });

  it('never falls back to metadata when a resolver RPC errors', async () => {
    session({ id: 'u1', email: 'a@b.c', user_metadata: { role: 'SHIPPER' } }, 'error', 'error');

    expect((await getApiAuthContext({} as any))!.role).toBeNull();
    await expect(assertApiAuthorization({} as any, 'matching', 'execute')).rejects.toThrow(/FORBIDDEN/);
  });

  it('does not grant platform authority from a metadata value of SUPER_ADMIN', async () => {
    session(
      { id: 'attacker', email: 'a@b.c', user_metadata: { role: 'SUPER_ADMIN' } },
      null,
      null,
    );

    const ctx = await getApiAuthContext({} as any);
    expect(ctx!.platformRole).toBeNull();
    expect(ctx!.role).toBeNull();
    await expect(assertApiAuthorization({} as any, 'matching', 'execute')).rejects.toThrow(/FORBIDDEN/);
  });

  it('does not establish marketplace membership from a metadata role value', async () => {
    session(
      { id: 'u2', email: 'a@b.c', user_metadata: { role: 'TRANSPORTER' } },
      null,
      null,
    );

    const ctx = await getApiAuthContext({} as any);
    expect(ctx!.marketplaceRole).toBeNull();
    expect(ctx!.role).toBeNull();
    await expect(assertApiAuthorization({} as any, 'matching', 'execute')).rejects.toThrow(/FORBIDDEN/);
  });

  it('does not resolve DRIVER — the classification is not selectable and holds no granted role', async () => {
    session({ id: 'u3', email: 'a@b.c', user_metadata: { role: 'DRIVER' } }, 'DRIVER', 'DRIVER');

    const ctx = await getApiAuthContext({} as any);
    expect(ctx!.marketplaceRole).toBeNull();
    expect(ctx!.platformRole).toBeNull();
    expect(ctx!.role).toBeNull();
  });

  it('fails safely on an invalid or missing membership row', async () => {
    session({ id: 'u4', email: 'a@b.c', user_metadata: { role: 'ADMIN' } }, 'CONTRIBUTOR', null);

    const ctx = await getApiAuthContext({} as any);
    expect(ctx!.marketplaceRole).toBeNull();
    expect(ctx!.role).toBeNull();
  });

  it('returns null with no session user, whatever the headers claim', async () => {
    session(null, 'SHIPPER', 'ADMIN');

    expect(await getApiAuthContext({ headers: new Map([['x-user-role', 'ADMIN']]) } as any)).toBeNull();
    await expect(
      assertApiAuthorization({ headers: new Map([['x-user-role', 'ADMIN']]) } as any, 'bookings', 'create'),
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('keeps non-authority metadata available without affecting role resolution', async () => {
    session(
      { id: 't1', email: 'fleet@nexcargo.mz', user_metadata: { tenantId: 'tenant-a', role: 'ADMIN' } },
      'TRANSPORTER',
      null,
    );

    const ctx = await getApiAuthContext({} as any);
    expect(ctx!.tenantId).toBe('tenant-a');
    expect(ctx!.marketplaceRole).toBe('TRANSPORTER');
    expect(ctx!.role).toBe('TRANSPORTER');
  });
});
