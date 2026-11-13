// NexCargo I-4 §3A/§4 — the Shipper area's server-side membership gate.
// The gate decides who sees the Shipper dashboard, so these tests pin the two properties the
// directive requires: it is resolved from the database, and it fails closed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const membershipQuery = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn();
const schemaMock = vi.fn();
const eqMock = vi.fn();

function client() {
  eqMock.mockReturnValue({ single: membershipQuery });
  schemaMock.mockReturnValue({
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })),
  });
  return { auth: { getUser }, rpc, schema: schemaMock };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => client()),
}));

const METADATA_USER = {
  id: 'user-001',
  email: 'shipper@example.mz',
  created_at: '2026-01-15T00:00:00Z',
  // I-1 §3.6: this block is client-writable and must never become an authority source.
  user_metadata: { role: 'SUPER_ADMIN' },
};

let getShipperContext: typeof import('@/app/[locale]/(shipper)/shipper-session').getShipperContext;

beforeEach(async () => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: METADATA_USER } });
  rpc.mockImplementation(async (fn: string) =>
    fn === 'effective_marketplace_role'
      ? { data: 'SHIPPER', error: null }
      : fn === 'effective_user_role'
        ? { data: null, error: null }
        : { data: null, error: new Error('no delegation') },
  );
  membershipQuery.mockResolvedValue({ data: { created_at: '2026-02-01T00:00:00Z' } });
  getShipperContext = (await import('@/app/[locale]/(shipper)/shipper-session')).getShipperContext;
});

describe('I-4 §3A — Shipper session resolution', () => {
  it('returns null with no session user', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await getShipperContext()).toBeNull();
  });

  it('returns null when the session client itself fails', async () => {
    getUser.mockRejectedValue(new Error('session read failed'));

    expect(await getShipperContext()).toBeNull();
  });

  it('takes the marketplace role from the resolver, not from user_metadata', async () => {
    const ctx = await getShipperContext();

    expect(ctx?.marketplaceRole).toBe('SHIPPER');
    expect(ctx?.platformRole).toBeNull();
  });

  it('reports no marketplace role when the resolver yields none, whatever metadata claims', async () => {
    rpc.mockImplementation(async () => ({ data: null, error: null }));

    const ctx = await getShipperContext();

    expect(ctx).not.toBeNull();
    expect(ctx?.marketplaceRole).toBeNull();
  });

  it('reads the membership row scoped to the session user id', async () => {
    await getShipperContext();

    expect(schemaMock).toHaveBeenCalledWith('app');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-001');
  });

  it('falls back to the account creation date when no membership row is readable', async () => {
    membershipQuery.mockResolvedValue({ data: null });

    const ctx = await getShipperContext();

    expect(ctx?.memberSince).toBe('2026-01-15T00:00:00Z');
  });
});
