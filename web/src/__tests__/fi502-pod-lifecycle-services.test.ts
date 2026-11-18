// NexCargo F-I5-02 — POD verification return handling and the VERIFIED-before-COMPLETED gate.
//
// What runs for real here: PodRepository, PodSubmissionService and TrackingOrchestratorService are
// the unmodified application classes. Only the Supabase client is replaced with a table-aware mock
// that answers the same chains PostgREST does, so the corrected .select() handling and the
// completion gate are exercised through the real code paths. RLS itself is proven separately
// against the live database with rolled-back probes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PodRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/pod-repository';
import { PodSubmissionService } from '@/modules/mod-003-tracking/application/services/pod-submission-service';
import { TrackingOrchestratorService } from '@/modules/mod-003-tracking/application/services/tracking-orchestrator-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { ShipmentStatus } from '@/shared/types/enums';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

const TRACKING_ID = 'tttttttt-0000-4000-8000-000000000006';
const BOOKING_ID = 'kkkkkkkk-0000-4000-8000-000000000007';
const POD_ID = 'pppppppp-0000-4000-8000-000000000008';

function podRow(verificationStatus: string, id: string = POD_ID) {
  return {
    id,
    tracking_id: TRACKING_ID,
    booking_id: BOOKING_ID,
    recipient_name: 'Ana Recipient',
    signature_ref: 'pod/signature.png',
    photo_refs: ['pod/photo-1.jpg'],
    gps_lat: -25.96,
    gps_lon: 32.58,
    submission_method: 'ONLINE',
    verification_status: verificationStatus,
    admin_override: false,
    submitted_at: '2026-11-15T09:00:00Z',
    verified_at: verificationStatus === 'PENDING' ? null : '2026-11-15T10:00:00Z',
    created_at: '2026-11-15T09:00:00Z',
    updated_at: '2026-11-15T09:00:00Z',
  };
}

function trackingRow(status: string) {
  return {
    id: TRACKING_ID,
    tracking_ref: 'TRK-20261115-TEST01',
    booking_id: BOOKING_ID,
    contract_id: null,
    status,
    visibility_level: 'RESTRICTED',
    activated_at: '2026-11-10T08:00:00Z',
    completed_at: null,
    last_updated: '2026-11-14T10:00:00Z',
    correlation_id: null,
    is_deleted: false,
    version: 1,
    created_at: '2026-11-10T08:00:00Z',
    updated_at: '2026-11-14T10:00:00Z',
  };
}

interface QueryRecord { table: string; ops: string[]; updatePayload: Record<string, unknown> | null }

interface DbState {
  tracking: ReturnType<typeof trackingRow> | null;
  pods: ReturnType<typeof podRow>[];
  podById: ReturnType<typeof podRow> | null;
  verifyResult: { data: unknown; error: { message: string } | null };
  rpcError: { message: string } | null;
}

let db: DbState;
let rpcCalls: Array<[string, Record<string, unknown>]>;
let queryLog: QueryRecord[];

/** Fluent PostgREST-shaped mock: records the operation chain and answers per table. */
function makeClient() {
  const from = (table: string) => {
    const ops: string[] = [];
    const eqs: Array<[string, unknown]> = [];
    let updatePayload: Record<string, unknown> | null = null;

    const resolve = async () => {
      queryLog.push({ table, ops: [...ops], updatePayload });
      if (table === 'shipment_tracking_records') {
        if (ops.includes('update')) return { data: null, error: null };
        return db.tracking
          ? { data: db.tracking, error: null }
          : { data: null, error: { code: 'PGRST116' } };
      }
      if (table === 'proof_of_delivery') {
        if (ops.includes('update')) return db.verifyResult;
        if (eqs.some(([col]) => col === 'tracking_id')) return { data: db.pods, error: null };
        return db.podById
          ? { data: db.podById, error: null }
          : { data: null, error: { code: 'PGRST116' } };
      }
      if (table === 'tracking_events') return { data: null, error: null };
      return { data: null, error: new Error(`unexpected table ${table}`) };
    };

    const builder: Record<string, unknown> = {};
    const chain = (name: string) => (...args: unknown[]) => {
      ops.push(name);
      if (name === 'eq') eqs.push(args as [string, unknown]);
      if (name === 'update') updatePayload = args[0] as Record<string, unknown>;
      return builder;
    };
    for (const method of ['select', 'insert', 'update', 'eq', 'in', 'order', 'range']) {
      builder[method] = chain(method);
    }
    builder.single = () => resolve();
    builder.then = (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) => resolve().then(onOk, onErr);
    return builder;
  };

  return {
    schema: () => ({ from }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push([fn, args]);
      return { data: null, error: db.rpcError };
    },
  };
}

beforeEach(() => {
  db = {
    tracking: trackingRow('DELIVERED'),
    pods: [podRow('VERIFIED')],
    podById: podRow('VERIFIED'),
    verifyResult: { data: [podRow('VERIFIED')], error: null },
    rpcError: null,
  };
  rpcCalls = [];
  queryLog = [];
  createClientMock.mockReset();
  createClientMock.mockResolvedValue(makeClient() as never);
});

describe('F-I5-02 §4.5 — PodRepository.verify() return handling', () => {
  it('requests the updated representation (.select()) and resolves on a successful update', async () => {
    const repo = new PodRepository();

    await expect(repo.verify({ podId: POD_ID, verify: true })).resolves.toBeUndefined();

    const verifyQuery = queryLog.find(q => q.table === 'proof_of_delivery' && q.ops.includes('update'));
    expect(verifyQuery).toBeDefined();
    expect(verifyQuery!.ops).toEqual(['update', 'eq', 'in', 'select']);
  });

  it('writes VERIFIED with verified_at when approving', async () => {
    const repo = new PodRepository();

    await repo.verify({ podId: POD_ID, verify: true });

    const verifyQuery = queryLog.find(q => q.table === 'proof_of_delivery' && q.ops.includes('update'));
    expect(verifyQuery!.updatePayload).toMatchObject({ verification_status: 'VERIFIED' });
    expect(typeof verifyQuery!.updatePayload!.verified_at).toBe('string');
  });

  it('writes REJECTED when rejecting and carries adminOverride only when supplied', async () => {
    const repo = new PodRepository();

    await repo.verify({ podId: POD_ID, verify: false, adminOverride: true });

    const verifyQuery = queryLog.find(q => q.table === 'proof_of_delivery' && q.ops.includes('update'));
    expect(verifyQuery!.updatePayload).toMatchObject({ verification_status: 'REJECTED', admin_override: true });
  });

  it('raises a conflict (ValidationError) when no PENDING row matched', async () => {
    db.verifyResult = { data: [], error: null };
    const repo = new PodRepository();

    await expect(repo.verify({ podId: POD_ID, verify: true })).rejects.toBeInstanceOf(ValidationError);
  });

  it('raises a conflict when the representation is absent', async () => {
    db.verifyResult = { data: null, error: null };
    const repo = new PodRepository();

    await expect(repo.verify({ podId: POD_ID, verify: true })).rejects.toBeInstanceOf(ValidationError);
  });

  it('propagates a genuine database failure as an error', async () => {
    db.verifyResult = { data: null, error: { message: 'connection lost' } };
    const repo = new PodRepository();

    await expect(repo.verify({ podId: POD_ID, verify: true })).rejects.toThrow('Failed to verify POD: connection lost');
  });
});

describe('F-I5-02 §4.6 — completeAfterPODVVerification requires a VERIFIED POD', () => {
  it('completes the shipment when the POD is VERIFIED', async () => {
    const service = new PodSubmissionService();

    await expect(service.completeAfterPODVVerification(POD_ID)).resolves.toBeUndefined();

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0][0]).toBe('atomic_tracking_status_update');
    expect(rpcCalls[0][1]).toMatchObject({ p_tracking_id: TRACKING_ID, p_target_status: 'COMPLETED' });
  });

  it('refuses completion while the POD is still PENDING — submission is not verification', async () => {
    db.podById = podRow('PENDING');
    const service = new PodSubmissionService();

    await expect(service.completeAfterPODVVerification(POD_ID)).rejects.toBeInstanceOf(ValidationError);
    expect(rpcCalls).toHaveLength(0);
  });

  it('refuses completion when the POD was REJECTED', async () => {
    db.podById = podRow('REJECTED');
    const service = new PodSubmissionService();

    await expect(service.completeAfterPODVVerification(POD_ID)).rejects.toBeInstanceOf(ValidationError);
    expect(rpcCalls).toHaveLength(0);
  });

  it('refuses completion when the POD does not exist', async () => {
    db.podById = null;
    const service = new PodSubmissionService();

    await expect(service.completeAfterPODVVerification(POD_ID)).rejects.toThrow('not found');
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('F-I5-02 §4.6 — orchestrator gates COMPLETED on a verified POD', () => {
  it('allows DELIVERED -> COMPLETED when a VERIFIED POD exists', async () => {
    const orchestrator = new TrackingOrchestratorService();

    await expect(orchestrator.updateTrackingStatus(TRACKING_ID, ShipmentStatus.COMPLETED, 'MOD-003')).resolves.toBeUndefined();

    expect(rpcCalls.some(([fn, args]) => fn === 'atomic_tracking_status_update' && args.p_target_status === 'COMPLETED')).toBe(true);
    expect(queryLog.some(q => q.table === 'shipment_tracking_records' && q.ops.includes('update'))).toBe(true);
  });

  it('refuses COMPLETED when no POD was ever submitted', async () => {
    db.pods = [];
    const orchestrator = new TrackingOrchestratorService();

    await expect(orchestrator.updateTrackingStatus(TRACKING_ID, ShipmentStatus.COMPLETED, 'MOD-003')).rejects.toThrow('verified POD');
    expect(rpcCalls).toHaveLength(0);
  });

  it('refuses COMPLETED when the only POD is PENDING', async () => {
    db.pods = [podRow('PENDING')];
    const orchestrator = new TrackingOrchestratorService();

    await expect(orchestrator.updateTrackingStatus(TRACKING_ID, ShipmentStatus.COMPLETED, 'MOD-003')).rejects.toBeInstanceOf(ValidationError);
    expect(rpcCalls).toHaveLength(0);
  });

  it('refuses COMPLETED when the only POD was REJECTED', async () => {
    db.pods = [podRow('REJECTED')];
    const orchestrator = new TrackingOrchestratorService();

    await expect(orchestrator.updateTrackingStatus(TRACKING_ID, ShipmentStatus.COMPLETED, 'MOD-003')).rejects.toBeInstanceOf(ValidationError);
    expect(rpcCalls).toHaveLength(0);
  });

  it('accepts when any POD in the existing multi-POD design is VERIFIED', async () => {
    db.pods = [podRow('REJECTED', 'pppppppp-0000-4000-8000-000000000011'), podRow('VERIFIED')];
    const orchestrator = new TrackingOrchestratorService();

    await expect(orchestrator.updateTrackingStatus(TRACKING_ID, ShipmentStatus.COMPLETED, 'MOD-003')).resolves.toBeUndefined();
    expect(rpcCalls).toHaveLength(1);
  });

  it('still refuses an invalid transition before the POD gate is consulted', async () => {
    db.tracking = trackingRow('IN_TRANSIT');
    const orchestrator = new TrackingOrchestratorService();

    await expect(orchestrator.updateTrackingStatus(TRACKING_ID, ShipmentStatus.COMPLETED, 'MOD-003')).rejects.toThrow('Invalid tracking transition');
    expect(queryLog.some(q => q.table === 'proof_of_delivery')).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it('leaves unrelated transitions untouched — IN_TRANSIT -> DELIVERED needs no POD', async () => {
    db.tracking = trackingRow('IN_TRANSIT');
    const orchestrator = new TrackingOrchestratorService();

    await expect(orchestrator.updateTrackingStatus(TRACKING_ID, ShipmentStatus.DELIVERED, 'MOD-003')).resolves.toBeUndefined();

    expect(queryLog.some(q => q.table === 'proof_of_delivery')).toBe(false);
    expect(rpcCalls.some(([fn, args]) => fn === 'atomic_tracking_status_update' && args.p_target_status === 'DELIVERED')).toBe(true);
  });
});