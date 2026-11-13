// NexCargo I-5 §4/§3F — the Transporter membership gate and the quotation read scope.
//
// The gate must resolve the marketplace role from the database and fail closed, and the Shipper area must
// resolve it through the same implementation so the two journeys cannot drift apart. The quotation read the
// Transporter dashboard depends on is pinned to the caller id, and a database failure propagates instead of
// answering an empty list (C1 hardened-repository convention).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

const USER_ID = 'transporter-user-009';

function sessionClient(marketplace: string | null = 'TRANSPORTER') {
  return {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'effective_marketplace_role') return { data: marketplace, error: null };
      if (fn === 'effective_user_role') return { data: null, error: null };
      return { data: null, error: new Error('no delegation in this fixture') };
    }),
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { created_at: '2026-02-01T00:00:00Z' }, error: null }),
          })),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  const client = sessionClient();
  client.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: USER_ID,
        email: 'ops@example.mz',
        created_at: '2026-01-15T00:00:00Z',
        // I-1 §3.6: this block is client-writable and must carry no authority.
        user_metadata: { role: 'SUPER_ADMIN' },
      },
    },
    error: null,
  });
  createClientMock.mockResolvedValue(client as never);
});

describe('I-5 §4 — Transporter membership resolution', () => {
  it('takes the marketplace role from the resolver, never from user_metadata', async () => {
    const { getTransporterContext } = await import('@/app/[locale]/(transporter)/transporter-session');

    const ctx = await getTransporterContext();

    expect(ctx?.marketplaceRole).toBe('TRANSPORTER');
    expect(ctx?.platformRole).toBeNull();
    expect(ctx?.userId).toBe(USER_ID);
    expect(ctx?.memberSince).toBe('2026-02-01T00:00:00Z');
  });

  it('reports no marketplace role when the resolver yields none', async () => {
    const client = sessionClient(null);
    client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'x@example.mz' } }, error: null });
    createClientMock.mockResolvedValue(client as never);
    const { getTransporterContext } = await import('@/app/[locale]/(transporter)/transporter-session');

    const ctx = await getTransporterContext();

    expect(ctx).not.toBeNull();
    expect(ctx?.marketplaceRole).toBeNull();
  });

  it('fails closed when the session cannot be read', async () => {
    const client = sessionClient();
    client.auth.getUser.mockRejectedValue(new Error('session read failed'));
    createClientMock.mockResolvedValue(client as never);
    const { getTransporterContext } = await import('@/app/[locale]/(transporter)/transporter-session');

    expect(await getTransporterContext()).toBeNull();
  });

  it('resolves through the same implementation the Shipper area uses', async () => {
    const shipper = await import('@/app/[locale]/(shipper)/shipper-session');
    const transporter = await import('@/app/[locale]/(transporter)/transporter-session');

    // One membership gate under two names: if these ever diverge, the two journeys drift apart silently.
    expect(transporter.getTransporterContext).toBe(shipper.getShipperContext);
  });
});

describe('I-5 §3F — the quotation read is scoped to the session Transporter', () => {
  /** The PostgREST builder is thenable, so one self-returning chain models select/eq/order. */
  function offersQueryChain(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {
      then: (onFulfilled: (value: unknown) => unknown) => onFulfilled(result),
    };
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    const client = {
      schema: vi.fn(() => ({
        from: vi.fn(() => ({ select: vi.fn(() => chain) })),
      })),
    };
    return { client, eq: chain.eq as ReturnType<typeof vi.fn> };
  }

  it('filters offers by the caller id instead of trusting a listing or header value', async () => {
    const { client, eq } = offersQueryChain({ data: [], error: null });
    createClientMock.mockResolvedValue(client as never);

    const { OffersRepository } = await import('@/infrastructure/repositories/offers-repository');
    const rows = await new OffersRepository().listByTransporter(USER_ID);

    expect(rows).toEqual([]);
    expect(client.schema).toHaveBeenCalledWith('marketplace_schema');
    expect(eq).toHaveBeenCalledWith('transporter_id', USER_ID);
    expect(eq).toHaveBeenCalledWith('is_deleted', false);
  });

  it('propagates a database failure rather than answering an empty list', async () => {
    const { client } = offersQueryChain({ data: null, error: { message: 'permission denied for offers' } });
    createClientMock.mockResolvedValue(client as never);

    const { OffersRepository } = await import('@/infrastructure/repositories/offers-repository');

    await expect(new OffersRepository().listByTransporter(USER_ID)).rejects.toThrow(/permission denied/);
  });
});
