// NexCargo PRE-I-6 WS-01 — POD completion invariant (D-WS01-1 / D-WS01-2).
//
// Two halves, mirroring the F-I5 focused-test convention:
//   Part A asserts the migration 066 ARTIFACT read from disk. This is STATIC INSPECTION of the
//     database-level correction (predicate presence, placement, idempotency, role-agnosticism,
//     preserved signatures/SECDEF/search_path). It is NOT live verification: the live catalog
//     re-measure, the rolled-back owner-class probe and the real-session HTTP/direct-RPC calls
//     are recorded separately in the WS-01 evidence row. Nothing here is RLS proof.
//   Part B runs the REAL POST /api/tracking/[trackingId]/status route + REAL
//     TrackingOrchestratorService + REAL tracking state machine against a stubbed Supabase client
//     and a stubbed auth boundary that mirror the LIVE enforcement measured on project
//     cvdggspiudmudbbdkjrc. The direct-RPC simulation mirrors the live SECDEF body AFTER migration
//     066 (POD gate on the completion transition, idempotent re-call ungated, no admin bypass).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { ShipmentStatus } from '@/shared/types/enums';

// ---------------------------------------------------------------------------
// Part A — migration 066 artifact (static inspection, read from disk)
// ---------------------------------------------------------------------------
const MIGRATION = readFileSync(
  resolve(process.cwd(), 'src/infrastructure/migrations/066_prei6_ws01_pod_completion_invariant.sql'),
  'utf8',
);

const COMPLETE_START = MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.atomic_tracking_complete');
const STATUS_START = MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update');
const FN_END = '$function$;';
const completeBody = MIGRATION.slice(COMPLETE_START, MIGRATION.indexOf(FN_END, COMPLETE_START) + FN_END.length);
const statusBody = MIGRATION.slice(STATUS_START, MIGRATION.indexOf(FN_END, STATUS_START) + FN_END.length);

const completeGuard = completeBody.slice(
  completeBody.indexOf('IF NOT EXISTS ('),
  completeBody.indexOf('UPDATE logistics_schema.shipment_tracking_records'),
);
const statusGuard = statusBody.slice(
  statusBody.indexOf("IF p_target_status = 'COMPLETED' AND v_current_state <> 'COMPLETED' THEN"),
  statusBody.indexOf('-- Atomic UPDATE + INSERT'),
);

describe('WS-01 Part A — migration 066 adds a persisted-VERIFIED-POD gate to both completion RPCs', () => {
  it('targets exactly the two authorized functions with one uncommented CREATE OR REPLACE each', () => {
    const realCreates = MIGRATION.split('\n').filter((l) => l.startsWith('CREATE OR REPLACE FUNCTION'));
    expect(realCreates).toHaveLength(2);
    expect(realCreates[0]).toContain('public.atomic_tracking_complete(');
    expect(realCreates[1]).toContain('public.atomic_tracking_status_update(');
  });

  it('preserves both signatures, RETURNS void, LANGUAGE plpgsql, SECURITY DEFINER and pinned search_path', () => {
    expect(completeBody).toContain(
      'public.atomic_tracking_complete(p_tracking_id uuid, p_caller_user_id uuid DEFAULT NULL::uuid)',
    );
    expect(statusBody).toContain(
      "public.atomic_tracking_status_update(p_tracking_id uuid, p_target_status character varying, p_source_module character varying DEFAULT 'MOD-003'::character varying, p_caller_user_id uuid DEFAULT NULL::uuid)",
    );
    for (const body of [completeBody, statusBody]) {
      expect(body).toContain('RETURNS void');
      expect(body).toContain('LANGUAGE plpgsql');
      expect(body).toContain('SECURITY DEFINER');
      expect(body).toContain("SET search_path TO 'pg_catalog', 'public'");
    }
  });

  it('gates completion on a persisted POD whose verification_status is VERIFIED, keyed by tracking_id', () => {
    for (const guard of [completeGuard, statusGuard]) {
      expect(guard).toContain('FROM logistics_schema.proof_of_delivery pod');
      expect(guard).toContain('pod.tracking_id = p_tracking_id');
      expect(guard).toContain("pod.verification_status = 'VERIFIED'");
      expect(guard).toContain('POD_REQUIRED');
      // proof_of_delivery has no is_deleted column; the predicate must not invent one, and must
      // not accept submission alone, an admin_override flag, or a client-supplied status.
      expect(guard).not.toContain('is_deleted');
      expect(guard).not.toContain('admin_override');
      expect(guard).not.toContain('submitted_at');
    }
  });

  it('is role-agnostic: neither POD guard contains a role branch or administrative exemption (D-WS01-1)', () => {
    for (const guard of [completeGuard, statusGuard]) {
      expect(guard).not.toContain('v_role');
      expect(guard).not.toContain('ADMIN');
      expect(guard).not.toContain('SUPER_ADMIN');
      expect(guard).not.toContain('MODERATOR');
      expect(guard).not.toContain('DISPATCHER');
    }
    // The pre-existing admin/scope branches remain ABOVE the gate and are unchanged; the gate is
    // reached by every role alike, so administrative privilege cannot satisfy completion.
    expect(statusBody).toContain("IF v_role = 'ADMIN' OR v_role = 'SUPER_ADMIN' THEN");
    expect(statusBody.indexOf("IF v_role = 'ADMIN'")).toBeLessThan(statusBody.indexOf('POD_REQUIRED'));
  });

  it('places the complete gate after the DELIVERED lifecycle check and before the UPDATE', () => {
    expect(completeBody.indexOf('CANNOT_COMPLETE')).toBeLessThan(completeBody.indexOf('POD_REQUIRED'));
    expect(completeBody.indexOf('POD_REQUIRED')).toBeLessThan(
      completeBody.indexOf('UPDATE logistics_schema.shipment_tracking_records'),
    );
    // atomic_tracking_complete only ever completes, so its guard is unconditional (no status predicate).
    expect(completeGuard).not.toContain("p_target_status = 'COMPLETED'");
  });

  it('places the status_update gate after authorization + state machine and before the event INSERT', () => {
    expect(statusBody.indexOf('is not authorized for tracking status updates')).toBeLessThan(
      statusBody.indexOf('POD_REQUIRED'),
    );
    expect(statusBody.indexOf('INVALID_TRANSITION')).toBeLessThan(statusBody.indexOf('POD_REQUIRED'));
    expect(statusBody.indexOf('POD_REQUIRED')).toBeLessThan(
      statusBody.indexOf('INSERT INTO logistics_schema.tracking_events'),
    );
  });

  it('gates only a real completion transition, leaving the idempotent COMPLETED->COMPLETED re-call ungated', () => {
    expect(statusGuard).toContain("p_target_status = 'COMPLETED' AND v_current_state <> 'COMPLETED'");
    // Non-completion targets never reach the POD predicate.
    expect(statusGuard.startsWith("IF p_target_status = 'COMPLETED'")).toBe(true);
  });

  it('keeps the identity, role/scope and state-machine guards byte-present (no authorization removed)', () => {
    expect(statusBody).toContain('v_caller := auth.uid()');
    expect(statusBody).toContain('UNAUTHORIZED: no authenticated user session');
    expect(statusBody).toContain('FORBIDDEN: caller identity mismatch');
    expect(statusBody).toContain('public.effective_user_role()');
    expect(statusBody).toContain('public.effective_marketplace_role()');
    expect(statusBody).toContain("FORBIDDEN: transporter cannot update another entity''s tracking");
    expect(statusBody).toContain('EXCEPTION WHEN OTHERS THEN RAISE');
    expect(completeBody).toContain('UNAUTHORIZED: no authenticated user');
    expect(completeBody).toContain('CANNOT_COMPLETE: tracking must be DELIVERED before COMPLETED');
  });

  it('carries self-guarding preconditions P1-P4, postconditions Q1-Q5 and a verbatim commented rollback', () => {
    for (const p of ['P1', 'P2', 'P3', 'P4']) expect(MIGRATION).toContain(`PRECONDITION ${p} FAILED`);
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']) expect(MIGRATION).toContain(`POSTCONDITION ${q} FAILED`);
    expect(MIGRATION).toContain('-- CREATE OR REPLACE FUNCTION public.atomic_tracking_complete');
    expect(MIGRATION).toContain('-- CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update');
    // The rollback restores the original vulnerable bodies (no POD_REQUIRED in the commented section).
    const rollback = MIGRATION.slice(MIGRATION.indexOf('-- ROLLBACK (verbatim'));
    expect(rollback).not.toContain('POD_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// Part B — real route + orchestrator + state machine, stubbed persistence/auth
// ---------------------------------------------------------------------------
const TRACKING_ID = 'ce28e62d-ded6-4dcf-8e3c-ba9febb0e4e7';
const BOOKING_ID = '827194cf-185f-4ef3-b59b-61d5284bad46';
const TRANSPORTER = 'e0fe13fd-6606-475f-a945-0a35ad879f27';
const SHIPPER = '666ed3aa-204a-45ad-83f5-b9cf0d4d8df8';

interface TrackingRow {
  id: string;
  status: string;
  version: number;
  is_deleted: boolean;
  booking_id: string;
  completed_at: string | null;
}
interface PodRow {
  id: string;
  tracking_id: string;
  verification_status: string;
  admin_override: boolean;
}

const db = {
  tracking: new Map<string, TrackingRow>(),
  pods: [] as PodRow[],
  booking: { id: BOOKING_ID, transporter_id: TRANSPORTER, shipper_id: SHIPPER },
};
let currentUser: { id: string } | null = { id: TRANSPORTER };
let currentRole = 'TRANSPORTER';
let authReject: Error | null = null;
let rpcOverride: { data: unknown; error: { message: string } | null } | null = null;
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
const markCompletedCalls: string[] = [];

// Minimal mirror of the SQL VALID_TRANSITIONS for the states exercised here.
const SQL_TRANSITIONS: Record<string, string[]> = {
  IN_TRANSIT: ['AT_BORDER', 'DELIVERED', 'CANCELLED', 'DELAYED'],
  DELIVERED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function err(message: string) {
  return { data: null, error: { message } };
}

// Mirrors the live atomic_tracking_status_update SECDEF body AFTER migration 066.
function simulateStatusUpdateRpc(args: {
  p_tracking_id: string;
  p_target_status: string;
  p_caller_user_id?: string | null;
}) {
  if (!currentUser) return err('UNAUTHORIZED: no authenticated user session');
  if (args.p_caller_user_id != null && args.p_caller_user_id !== currentUser.id) {
    return err('FORBIDDEN: caller identity mismatch');
  }
  const row = db.tracking.get(args.p_tracking_id);
  if (!row || row.is_deleted) {
    return err(`TRACKING_RECORD_NOT_FOUND: tracking ${args.p_tracking_id} not found or deleted`);
  }
  const current = row.status;
  const role = currentRole;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR') {
    // platform authority: no booking-scope restriction
  } else if (role === 'TRANSPORTER') {
    if (db.booking.transporter_id !== currentUser.id) {
      return err("FORBIDDEN: transporter cannot update another entity's tracking");
    }
  } else {
    return err(`FORBIDDEN: role '${role}' is not authorized for tracking status updates`);
  }
  const terminalSelf = (current === 'COMPLETED' || current === 'CANCELLED') && args.p_target_status === current;
  if (!terminalSelf && !(SQL_TRANSITIONS[current] ?? []).includes(args.p_target_status)) {
    return err(`INVALID_TRANSITION: ${current} -> ${args.p_target_status} is not permitted per MOD-003`);
  }
  // WS-01 / D-WS01-2: the persisted-VERIFIED-POD gate, role-agnostic, idempotent re-call ungated.
  if (args.p_target_status === 'COMPLETED' && current !== 'COMPLETED') {
    if (!db.pods.some((p) => p.tracking_id === args.p_tracking_id && p.verification_status === 'VERIFIED')) {
      return err(
        `POD_REQUIRED: tracking ${args.p_tracking_id} cannot complete without a persisted VERIFIED proof of delivery (MOD-003 §7.5)`,
      );
    }
  }
  row.status = args.p_target_status;
  row.version = (row.version ?? 1) + 1;
  if (args.p_target_status === 'COMPLETED') row.completed_at = new Date().toISOString();
  return { data: null, error: null };
}

interface QueryState {
  table: string;
  filters: Array<[string, unknown]>;
  op: 'select' | 'update';
  updateData: Record<string, unknown> | null;
}

async function resolveQuery(st: QueryState) {
  if (st.table === 'shipment_tracking_records') {
    const id = st.filters.find((f) => f[0] === 'id')?.[1] as string | undefined;
    const row = id ? db.tracking.get(id) : undefined;
    if (st.op === 'update') {
      if (row && !row.is_deleted) {
        Object.assign(row, st.updateData);
        markCompletedCalls.push(id!);
      }
      return { data: null, error: null };
    }
    if (!row || row.is_deleted) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    return { data: { ...row }, error: null };
  }
  if (st.table === 'proof_of_delivery') {
    const tid = st.filters.find((f) => f[0] === 'tracking_id')?.[1] as string | undefined;
    return { data: db.pods.filter((p) => p.tracking_id === tid).map((p) => ({ ...p })), error: null };
  }
  return { data: null, error: null };
}

function builder(table: string): any {
  const st: QueryState = { table, filters: [], op: 'select', updateData: null };
  const q: any = {
    select: () => { st.op = 'select'; return q; },
    update: (d: Record<string, unknown>) => { st.op = 'update'; st.updateData = d; return q; },
    insert: () => q,
    eq: (c: string, v: unknown) => { st.filters.push([c, v]); return q; },
    in: () => q,
    order: () => q,
    limit: () => q,
    range: () => q,
    single: () => q,
    maybeSingle: () => q,
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) => resolveQuery(st).then(res, rej),
  };
  return q;
}

const mockSupabase = {
  auth: { getUser: vi.fn(async () => ({ data: { user: currentUser }, error: currentUser ? null : new Error('no session') })) },
  schema: vi.fn(() => ({ from: (table: string) => builder(table) })),
  from: vi.fn((table: string) => builder(table)),
  rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    if (rpcOverride) return rpcOverride;
    if (name === 'atomic_tracking_status_update') {
      return simulateStatusUpdateRpc(args as { p_tracking_id: string; p_target_status: string; p_caller_user_id?: string | null });
    }
    return { data: null, error: null };
  }),
};

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase) }));
vi.mock('@/lib/supabase/api-auth', () => ({
  // PRE-I-6 Item 3: the status route's Driver fallback calls assertApiAuth after a FORBIDDEN;
  // the mocked DB has no driver rows, so resolveDriverAssignment returns null and the denial stands.
  assertApiAuth: vi.fn(async () => {
    if (!currentUser) throw new Error('UNAUTHORIZED');
    return {
      userId: currentUser.id,
      email: 'transporter@example.test',
      role: currentRole,
      marketplaceRole: currentRole === 'TRANSPORTER' ? 'TRANSPORTER' : null,
      platformRole: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(currentRole) ? currentRole : null,
      delegation: null,
    };
  }),
  assertApiAuthorization: vi.fn(async () => {
    if (authReject) throw authReject;
    return {
      userId: currentUser?.id ?? '',
      email: 'transporter@example.test',
      role: currentRole,
      marketplaceRole: currentRole === 'TRANSPORTER' ? 'TRANSPORTER' : null,
      platformRole: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(currentRole) ? currentRole : null,
      delegation: null,
    };
  }),
}));

function seedTracking(status = 'DELIVERED', version = 6) {
  db.tracking.set(TRACKING_ID, {
    id: TRACKING_ID, status, version, is_deleted: false, booking_id: BOOKING_ID, completed_at: null,
  });
}
function seedPods(...statuses: string[]) {
  db.pods = statuses.map((s, i) => ({
    id: `pod-${i}`, tracking_id: TRACKING_ID, verification_status: s, admin_override: false,
  }));
}

async function call(trackingId: string, body: Record<string, unknown>) {
  const mod = await import('@/app/api/tracking/[trackingId]/status/route');
  const req = new NextRequest(`http://localhost/api/tracking/${trackingId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-correlation-id': 'ws01-fixed-correlation-id' },
    body: JSON.stringify(body),
  });
  const res = await mod.POST(req, { params: Promise.resolve({ trackingId }) } as never);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.tracking.clear();
  db.pods = [];
  db.booking = { id: BOOKING_ID, transporter_id: TRANSPORTER, shipper_id: SHIPPER };
  currentUser = { id: TRANSPORTER };
  currentRole = 'TRANSPORTER';
  authReject = null;
  rpcOverride = null;
  rpcCalls.length = 0;
  markCompletedCalls.length = 0;
  seedTracking('DELIVERED', 6);
  seedPods('PENDING', 'PENDING');
});

describe('WS-01 Part B §1 — HTTP completion is refused without a persisted VERIFIED POD (409)', () => {
  it('refuses COMPLETED when only PENDING PODs exist, before any RPC is invoked', async () => {
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.COMPLETED, sourceModule: 'MOD-003' });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('validation_error');
    expect(String(r.body.message)).toContain('verified POD');
    expect(rpcCalls).toHaveLength(0);
    expect(markCompletedCalls).toHaveLength(0);
    expect(db.tracking.get(TRACKING_ID)!.status).toBe('DELIVERED');
  });

  it('refuses COMPLETED when the only POD is REJECTED', async () => {
    seedPods('REJECTED');
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.COMPLETED });
    expect(r.status).toBe(409);
    expect(rpcCalls).toHaveLength(0);
  });

  it('refuses COMPLETED when no POD exists at all', async () => {
    seedPods();
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.COMPLETED });
    expect(r.status).toBe(409);
    expect(rpcCalls).toHaveLength(0);
  });

  it('does not accept a client-supplied admin_override or verification claim in the request body', async () => {
    const r = await call(TRACKING_ID, {
      targetStatus: ShipmentStatus.COMPLETED,
      adminOverride: true,
      verificationStatus: 'VERIFIED',
      role: 'SUPER_ADMIN',
    });
    expect(r.status).toBe(409);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('WS-01 Part B §2 — legitimate completion with a VERIFIED POD still succeeds (200)', () => {
  it('completes when a persisted VERIFIED POD exists, invoking the RPC and marking completed_at', async () => {
    seedPods('PENDING', 'VERIFIED');
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.COMPLETED, sourceModule: 'MOD-003' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe('atomic_tracking_status_update');
    expect(rpcCalls[0].args).toMatchObject({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
    expect(markCompletedCalls).toEqual([TRACKING_ID]);
    expect(db.tracking.get(TRACKING_ID)!.status).toBe('COMPLETED');
  });

  it('does not gate a legitimate non-completion transition (IN_TRANSIT -> DELIVERED) on POD state', async () => {
    seedTracking('IN_TRANSIT', 4);
    seedPods(); // no POD at all
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.DELIVERED });
    expect(r.status).toBe(200);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args).toMatchObject({ p_target_status: 'DELIVERED' });
    expect(db.tracking.get(TRACKING_ID)!.status).toBe('DELIVERED');
  });
});

describe('WS-01 Part B §3 — authentication and authorization are preserved at the HTTP boundary', () => {
  it('answers 401 to an unauthenticated request before any read or RPC', async () => {
    authReject = new Error('UNAUTHORIZED');
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.COMPLETED });
    expect(r.status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it('answers 403 when the caller is not authorized for tracking status updates', async () => {
    authReject = new Error('FORBIDDEN: role SHIPPER is not authorized');
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.COMPLETED });
    expect(r.status).toBe(403);
    expect(rpcCalls).toHaveLength(0);
  });

  it('keeps the 400 validation for a missing targetStatus before any session work', async () => {
    const r = await call(TRACKING_ID, {});
    expect(r.status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('WS-01 Part B §4 — direct-RPC path enforces the same invariant (mirrors live SECDEF after 066)', () => {
  it('raises POD_REQUIRED on a direct COMPLETED call with only PENDING PODs, bypassing the HTTP gate', () => {
    const res = simulateStatusUpdateRpc({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
    expect(res.error?.message).toContain('POD_REQUIRED');
    expect(db.tracking.get(TRACKING_ID)!.status).toBe('DELIVERED');
  });

  it('succeeds on a direct COMPLETED call when a persisted VERIFIED POD exists', () => {
    seedPods('VERIFIED');
    const res = simulateStatusUpdateRpc({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
    expect(res.error).toBeNull();
    expect(db.tracking.get(TRACKING_ID)!.status).toBe('COMPLETED');
  });

  it('leaves the idempotent COMPLETED->COMPLETED re-call ungated even with no VERIFIED POD', () => {
    seedTracking('COMPLETED', 7);
    seedPods('PENDING');
    const res = simulateStatusUpdateRpc({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
    expect(res.error).toBeNull();
    expect(db.tracking.get(TRACKING_ID)!.status).toBe('COMPLETED');
  });

  it('gives SUPER_ADMIN no bypass: a direct COMPLETED call with no VERIFIED POD still raises POD_REQUIRED (D-WS01-1)', () => {
    currentRole = 'SUPER_ADMIN';
    currentUser = { id: '11111111-1111-1111-1111-111111111111' };
    seedPods('PENDING', 'PENDING');
    const res = simulateStatusUpdateRpc({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
    expect(res.error?.message).toContain('POD_REQUIRED');
    expect(db.tracking.get(TRACKING_ID)!.status).toBe('DELIVERED');
  });

  it('gives ADMIN no bypass either', () => {
    currentRole = 'ADMIN';
    seedPods();
    const res = simulateStatusUpdateRpc({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
    expect(res.error?.message).toContain('POD_REQUIRED');
  });

  it('still refuses a non-party Transporter on the direct path (authorization ordering preserved)', () => {
    currentUser = { id: SHIPPER };
    currentRole = 'SHIPPER';
    seedPods('VERIFIED');
    const res = simulateStatusUpdateRpc({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
    expect(res.error?.message).toContain('FORBIDDEN');
    expect(res.error?.message).not.toContain('POD_REQUIRED');
  });

  it('surfaces a direct-RPC POD_REQUIRED as a 500 through the route when the HTTP gate is bypassed by override', async () => {
    // Models a caller that reaches the RPC directly (e.g. a future code path that skips the
    // orchestrator gate): the database invariant still refuses, and the route does not report success.
    seedPods('VERIFIED'); // let the HTTP gate pass
    rpcOverride = err(`POD_REQUIRED: tracking ${TRACKING_ID} cannot complete without a persisted VERIFIED proof of delivery (MOD-003 §7.5)`);
    const r = await call(TRACKING_ID, { targetStatus: ShipmentStatus.COMPLETED });
    expect(r.status).toBe(500);
    expect(r.body.success).toBeUndefined();
    expect(markCompletedCalls).toHaveLength(0);
  });
});