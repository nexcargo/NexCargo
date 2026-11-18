// F-I5-03 — Contract state information disclosure: focused regression tests.
// Real PATCH /api/contracts/[id]/accept route. Only @/lib/supabase/server is mocked, and the
// mock mirrors the LIVE enforcement measured on project cvdggspiudmudbbdkjrc:
//   - contracts SELECT is party-scoped (contracts_shipper_read / contracts_transporter_read
//     over the persisted booking parties), so a foreign contract is invisible in ANY state;
//   - accept_and_finalize_contract (SECDEF, after migration 065) checks party ownership
//     BEFORE state and returns uniform CONTRACT_NOT_FOUND for non-parties; the route gate
//     remains the first authorization layer and must never invoke it for a non-party.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const SHIPPER_PARTY = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const TRANSPORTER_PARTY = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const OUTSIDER_SHIPPER = 'cccccccc-3333-4333-8333-cccccccccccc';
const OUTSIDER_TRANSPORTER = 'dddddddd-4444-4444-8444-dddddddddddd';
const NO_MEMBERSHIP = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
const CONTRACT_ID = 'f1503000-0000-4000-8000-0000000000c1';
const MISSING_ID = 'f1503000-0000-4000-8000-00000000dead';
const CORR_ID = 'fi503-fixed-correlation-id';

interface ContractRow {
  id: string;
  acceptance_status: string;
  shipper_id: string;
  transporter_id: string;
  is_deleted: boolean;
  num_signatories: number;
}

const db = { contracts: new Map<string, ContractRow>() };
let currentUser: { id: string } | null = null;
let visibilityError: string | null = null;
let rpcOverride: { data: unknown; error: { message: string } | null } | null = null;
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
const selectArgs: string[] = [];

function seedContract(state: string, opts: Partial<ContractRow> = {}) {
  db.contracts.set(CONTRACT_ID, {
    id: CONTRACT_ID,
    acceptance_status: state,
    shipper_id: SHIPPER_PARTY,
    transporter_id: TRANSPORTER_PARTY,
    is_deleted: false,
    num_signatories: 0,
    ...opts,
  });
}

// RLS-faithful visibility: only the persisted booking parties can see the row, in any state.
function rlsVisibleContract(id: string): ContractRow | null {
  const row = db.contracts.get(id);
  if (!row || row.is_deleted) return null;
  if (!currentUser) return null;
  if (row.shipper_id !== currentUser.id && row.transporter_id !== currentUser.id) return null;
  return row;
}

// Mirrors the live SECDEF ordering after migration 065: not-found -> party (uniform
// not-found for non-parties) -> state. The route gate must still never invoke it for a
// non-party; both layers are now disclosure-safe independently.
function simulateSecdef(args: { p_contract_id_uuid: string }) {
  const row = db.contracts.get(args.p_contract_id_uuid);
  if (!row || row.is_deleted) {
    return { data: null, error: { message: `CONTRACT_NOT_FOUND: contract ${args.p_contract_id_uuid} not found or deleted` } };
  }
  if (!currentUser || (row.shipper_id !== currentUser.id && row.transporter_id !== currentUser.id)) {
    return { data: null, error: { message: `CONTRACT_NOT_FOUND: contract ${args.p_contract_id_uuid} not found or deleted` } };
  }
  if (row.acceptance_status !== 'DRAFT') {
    return { data: null, error: { message: `CONTRACT_NOT_DRAFT: contract is in status ${row.acceptance_status}, cannot accept` } };
  }
  const role = row.shipper_id === currentUser.id ? 'SHIPPER' : 'TRANSPORTER';
  return {
    data: {
      success: true,
      action: 'first_signature_recorded',
      contract_id: row.id,
      contract_acceptance_status: row.acceptance_status,
      num_signatories: 1,
      signatory_role: role,
      message: 'First signature recorded. Awaiting second party.',
    },
    error: null,
  };
}

const mockMaybeSingle = vi.fn(async () => {
  if (visibilityError) return { data: null, error: { message: visibilityError } };
  const id = (mockMaybeSingle as unknown as { lastId?: string }).lastId;
  const row = id ? rlsVisibleContract(id) : null;
  return { data: row ? { id: row.id } : null, error: null };
});

const mockQuery: Record<string, unknown> = {
  select: vi.fn((cols: string) => { selectArgs.push(cols); return mockQuery; }),
  eq: vi.fn((col: string, val: string) => {
    if (col === 'id') (mockMaybeSingle as unknown as { lastId?: string }).lastId = val;
    return mockQuery;
  }),
  maybeSingle: mockMaybeSingle,
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: currentUser }, error: currentUser ? null : new Error('no session') })),
  },
  rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    if (rpcOverride) return rpcOverride;
    if (name === 'accept_and_finalize_contract') return simulateSecdef(args as { p_contract_id_uuid: string });
    return { data: null, error: null };
  }),
  schema: vi.fn(() => ({ from: vi.fn(() => mockQuery) })),
};

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(() => mockSupabase) }));

function patch(contractId: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/contracts/${contractId}/accept`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-correlation-id': CORR_ID },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(contractId: string, body?: Record<string, unknown>) {
  const mod = await import('@/app/api/contracts/[id]/accept/route');
  const res = await mod.PATCH(patch(contractId, body), { params: Promise.resolve({ id: contractId }) } as never);
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.contracts.clear();
  currentUser = null;
  visibilityError = null;
  rpcOverride = null;
  rpcCalls.length = 0;
  selectArgs.length = 0;
  (mockMaybeSingle as unknown as { lastId?: string }).lastId = undefined;
});

describe('F-I5-03 §6.1 — unauthorized callers learn nothing about contract state', () => {
  it('rejects an unauthenticated request with 401 before any read or RPC', async () => {
    seedContract('DRAFT');
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it.each(['DRAFT', 'ACTIVE'] as const)(
    'gives a non-party Shipper the same 404 for a foreign %s contract, never invoking the SECDEF',
    async (state) => {
      seedContract(state);
      currentUser = { id: OUTSIDER_SHIPPER };
      const r = await call(CONTRACT_ID);
      expect(r.status).toBe(404);
      expect(r.body.data).toMatchObject({ error: 'Contract not found', code: 'ERR_3003' });
      expect(rpcCalls).toHaveLength(0);
    },
  );

  it.each(['DRAFT', 'ACTIVE'] as const)(
    'gives a non-party Transporter the same 404 for a foreign %s contract, never invoking the SECDEF',
    async (state) => {
      seedContract(state);
      currentUser = { id: OUTSIDER_TRANSPORTER };
      const r = await call(CONTRACT_ID);
      expect(r.status).toBe(404);
      expect(r.body.data).toMatchObject({ error: 'Contract not found', code: 'ERR_3003' });
      expect(rpcCalls).toHaveLength(0);
    },
  );

  it('gives a user with no effective marketplace membership (no party relationship) a 404', async () => {
    seedContract('DRAFT');
    currentUser = { id: NO_MEMBERSHIP };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(404);
    expect(rpcCalls).toHaveLength(0);
  });

  it('ignores body-supplied party identities: claiming the shipper ID does not grant access', async () => {
    seedContract('ACTIVE');
    currentUser = { id: OUTSIDER_SHIPPER };
    const r = await call(CONTRACT_ID, {
      userId: SHIPPER_PARTY, shipperId: SHIPPER_PARTY, transporterId: TRANSPORTER_PARTY,
      role: 'SHIPPER', bookingId: '827194cf-185f-4ef3-b59b-61d5284bad46',
    });
    expect(r.status).toBe(404);
    expect(rpcCalls).toHaveLength(0);
  });

  it('fails closed with a generic 500 when party visibility resolution errors, without raw detail', async () => {
    seedContract('ACTIVE');
    currentUser = { id: OUTSIDER_SHIPPER };
    visibilityError = 'connection reset while reading logistics_schema.contracts';
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(500);
    expect(r.body.data).toMatchObject({ error: 'Contract acceptance failed', code: 'ERR_3099' });
    expect(JSON.stringify(r.body)).not.toContain('connection reset');
    expect(rpcCalls).toHaveLength(0);
  });

  it('selects only the id column at the gate — no state or party column is read into the response path', async () => {
    seedContract('DRAFT');
    currentUser = { id: SHIPPER_PARTY };
    await call(CONTRACT_ID);
    expect(selectArgs).toEqual(['id']);
  });
});

describe('F-I5-03 §6.2 — nonexistent and foreign contracts are indistinguishable', () => {
  it('returns byte-identical status and body for nonexistent, foreign DRAFT, and foreign ACTIVE', async () => {
    currentUser = { id: OUTSIDER_SHIPPER };

    seedContract('DRAFT');
    const foreignDraft = await call(CONTRACT_ID);
    seedContract('ACTIVE');
    const foreignActive = await call(CONTRACT_ID);
    db.contracts.clear();
    const nonexistent = await call(MISSING_ID);

    expect(foreignDraft.status).toBe(404);
    expect(foreignActive.status).toBe(404);
    expect(nonexistent.status).toBe(404);
    expect(foreignDraft.body).toEqual(nonexistent.body);
    expect(foreignActive.body).toEqual(nonexistent.body);
    expect(rpcCalls).toHaveLength(0);
    for (const r of [foreignDraft, foreignActive, nonexistent]) {
      // The constant framework envelope (contract.status:'ACTIVE') is identical in every
      // response; contract-lifecycle disclosure would appear in the data payload.
      const serialized = JSON.stringify(r.body.data);
      expect(serialized).not.toContain('DRAFT');
      expect(serialized).not.toContain('ACTIVE');
      expect(serialized).not.toContain('signature');
      expect(serialized).not.toContain(SHIPPER_PARTY);
      expect(serialized).not.toContain(TRANSPORTER_PARTY);
    }
  });

  it('does not expose raw database errors when the SECDEF fails unexpectedly for an authorized party', async () => {
    seedContract('DRAFT');
    currentUser = { id: SHIPPER_PARTY };
    rpcOverride = { data: null, error: { message: 'CONTRACT_NO_BOOKING: internal detail xyz' } };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('internal detail xyz');
    expect(JSON.stringify(r.body)).not.toContain('CONTRACT_NO_BOOKING');
  });
});

describe('F-I5-03 §6.3 — authorized parties keep the existing workflow', () => {
  it('lets the legitimate Shipper party sign a DRAFT contract (first signature, no activation)', async () => {
    seedContract('DRAFT');
    currentUser = { id: SHIPPER_PARTY };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ action: 'first_signature_recorded', num_signatories: 1, signatory_role: 'SHIPPER' });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe('accept_and_finalize_contract');
  });

  it('lets the legitimate Transporter party sign a DRAFT contract', async () => {
    seedContract('DRAFT');
    currentUser = { id: TRANSPORTER_PARTY };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ action: 'first_signature_recorded', signatory_role: 'TRANSPORTER' });
  });

  it('still returns the correct 409 state conflict to an authorized party on a non-DRAFT contract', async () => {
    seedContract('ACTIVE');
    currentUser = { id: SHIPPER_PARTY };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(409);
    expect(r.body.data).toMatchObject({ error: 'Contract not in DRAFT state', code: 'ERR_3004' });
    expect(rpcCalls).toHaveLength(1);
  });

  it('passes finalization-with-tracking through unchanged', async () => {
    seedContract('DRAFT', { num_signatories: 1 });
    currentUser = { id: TRANSPORTER_PARTY };
    rpcOverride = {
      data: {
        success: true, action: 'contract_finalized_with_tracking', contract_id: CONTRACT_ID,
        contract_acceptance_status: 'ACTIVE', num_signatories: 2, signed_at: '2026-11-16T10:00:00Z',
        tracking_record_id: 'tracking-uuid', tracking_ref: 'TRK-20261116-ABC', tracking_status: 'CREATED',
        message: 'Contract finalized and tracking initialized.',
      },
      error: null,
    };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ action: 'contract_finalized_with_tracking', tracking_status: 'CREATED', num_signatories: 2 });
  });

  it('passes idempotent retry responses through unchanged', async () => {
    seedContract('DRAFT', { num_signatories: 1 });
    currentUser = { id: SHIPPER_PARTY };
    rpcOverride = {
      data: {
        success: true, action: 'signature_already_recorded', contract_id: CONTRACT_ID,
        contract_acceptance_status: 'DRAFT', num_signatories: 1, signatory_role: 'SHIPPER',
        message: 'Shipper signature already recorded. Waiting for transporter.', is_final: false,
      },
      error: null,
    };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ action: 'signature_already_recorded', is_final: false });
  });

  it('answers 404 to a party for a soft-deleted contract, consistent with the gate convention', async () => {
    seedContract('DRAFT', { is_deleted: true });
    currentUser = { id: SHIPPER_PARTY };
    const r = await call(CONTRACT_ID);
    expect(r.status).toBe(404);
    expect(rpcCalls).toHaveLength(0);
  });

  it('keeps the 400 validation for a malformed contract ID before any session work', async () => {
    const r = await call('not-a-uuid');
    expect(r.status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});