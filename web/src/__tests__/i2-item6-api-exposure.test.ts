// NexCargo I-2 PART C item 6 / item 8 — API exposure regression guards.
//
// These are handler-level tests: the real route handlers run against stubbed Supabase clients and
// stubbed repositories, so what is being proved is the backend authorization decision itself — who is
// refused, and which owner/tenant predicate the surviving query is pinned to. Row-level outcomes in the
// live database are verified separately (migration 045 policies plus the admissible live checks);
// nothing here should be read as RLS proof.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGIN = 'https://app.nexcargo.example';
const SESSION_USER = 'transporter-session-1';
const FOREIGN_OWNER = 'transporter-other-9';
const DELEGATION_PRINCIPAL = 'transporter-principal-7';
const FOREIGN_FLEET = 'fleet-not-mine-1';

interface LoggedQuery {
  client: 'session' | 'admin';
  table: string;
  method: string;
  args: unknown[];
}

let queries: LoggedQuery[] = [];
let outcome: { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null } = {};
let sessionUser: { id: string; email: string; user_metadata: Record<string, unknown> } | null = null;
let rpcAnswers: Record<string, unknown> = {};
let fleetRepo: Record<string, any> = {};
let trackingRepo: Record<string, any> = {};
let eventRepo: Record<string, any> = {};
let gpsRepo: Record<string, any> = {};
let deliveryProcessor: Record<string, any> = {};
let adminClientCalls = 0;

function fluent(client: 'session' | 'admin', table: string): any {
  const q: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop === 'symbol') return undefined;
        // Never thenable: `await query` must yield this same recorder, not a promise of it.
        if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
        if (prop === 'data') return outcome.data ?? null;
        if (prop === 'error') return outcome.error ?? null;
        if (prop === 'count') return outcome.count ?? null;
        return (...args: unknown[]) => {
          queries.push({ client, table, method: prop, args });
          return q;
        };
      },
    },
  );
  return q;
}

function scope(client: 'session' | 'admin') {
  return (name: string) => ({
    from: (table: string) => fluent(client, `${name}.${table}`),
  });
}

vi.mock('@/lib/supabase/server', () => ({
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser }, error: null }) },
    rpc: async (name: string) => ({ data: rpcAnswers[name] ?? null, error: null }),
    from: (table: string) => fluent('session', table),
    schema: scope('session'),
  })),
}));

vi.mock('@/infrastructure/database/supabase', () => ({
  createAdminClient: vi.fn(() => {
    adminClientCalls += 1;
    return {
      from: (table: string) => fluent('admin', table),
      schema: scope('admin'),
      rpc: async () => ({ data: null, error: null }),
    };
  }),
  createServerSupabaseClient: vi.fn(() => ({ from: (t: string) => fluent('session', t), schema: scope('session') })),
}));

vi.mock('@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository', () => ({
  FleetRepository: function () {
    return fleetRepo;
  },
}));
vi.mock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository', () => ({
  TrackingRecordRepository: function () {
    return trackingRepo;
  },
}));
vi.mock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-event-repository', () => ({
  TrackingEventRepository: function () {
    return eventRepo;
  },
}));
vi.mock('@/modules/mod-003-tracking/infrastructure/repositories/gps-update-repository', () => ({
  GpsUpdateRepository: function () {
    return gpsRepo;
  },
}));
vi.mock('@/modules/mod-016-notifications/infrastructure/services/notification-delivery-processor', () => ({
  getDeliveryProcessor: vi.fn(() => deliveryProcessor),
}));

import { GET as fleetList } from '@/app/api/fleet/route';
import { POST as vehicleCreate } from '@/app/api/fleet/vehicles/route';
import { POST as ticketCreate, GET as ticketList } from '@/app/api/support/tickets/route';
import { POST as notificationCreate } from '@/app/api/notifications/route';
import { GET as notificationRead } from '@/app/api/notifications/[notificationId]/route';
import { POST as deliveryDrain } from '@/app/api/notifications/delivery-processor/route';
import { GET as trackingDetail } from '@/app/api/tracking/[trackingId]/route';
import { GET as trackingEvents } from '@/app/api/tracking/[trackingId]/events/route';
import { GET as locationHistory } from '@/app/api/tracking/[trackingId]/location-history/route';
import { GET as trackingAll } from '@/app/api/tracking/all/route';
import { GET as transporterTrips } from '@/app/api/tracking/transporter-trips/route';
import { authDenialResponse } from '@/lib/supabase/api-auth';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { requiredOperationalScope } from '@/lib/auth/role-authority';

const SHIPPER = { effective_user_role: null, effective_marketplace_role: 'SHIPPER', effective_operational_delegation: null };
const TRANSPORTER = {
  effective_user_role: null,
  effective_marketplace_role: 'TRANSPORTER',
  effective_operational_delegation: null,
};
const ADMIN = { effective_user_role: 'ADMIN', effective_marketplace_role: null, effective_operational_delegation: null };
const UNRESOLVED = { effective_user_role: null, effective_marketplace_role: null, effective_operational_delegation: null };
// A Dispatcher under I-2 Part A: no platform role, no marketplace membership, only a bounded delegation.
const DELEGATE = {
  effective_user_role: null,
  effective_marketplace_role: null,
  effective_operational_delegation: {
    principal_transporter_user_id: DELEGATION_PRINCIPAL,
    scopes: ['operational_read', 'assignment_manage'],
  },
};

function req(path: string, init: { method?: string; body?: unknown } = {}) {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** The owner/tenant predicates a query was actually pinned to, across both clients. */
const eqsOf = (table?: string) =>
  queries
    .filter((q) => q.method === 'eq' && (table === undefined || q.table === table))
    .map((q) => [q.args[0], q.args[1]] as [string, unknown]);

const insertPayload = () => {
  const q = queries.find((x) => x.method === 'insert');
  return q?.args[0] as Record<string, unknown>;
};

const TICKET_BODY = {
  category: 'SHIPMENT',
  priorityLevel: 'MEDIUM',
  channel: 'IN_APP',
  description: 'Cargo arrived late.',
};

const NOTIFICATION_BODY = {
  recipientId: 'someone-else',
  sourceModule: 'MOD-016',
  eventType: 'delivery.exception',
  channelType: 'IN_APP',
  title: 'Test message',
  correlationId: 'corr-item-6',
};

beforeEach(() => {
  vi.clearAllMocks();
  queries = [];
  outcome = { data: null, error: null, count: 0 };
  adminClientCalls = 0;
  sessionUser = { id: SESSION_USER, email: `${SESSION_USER}@nexcargo.example`, user_metadata: {} };
  rpcAnswers = { ...TRANSPORTER };
  fleetRepo = {
    listFleets: vi.fn(async () => []),
    listVehicles: vi.fn(async () => []),
    listDrivers: vi.fn(async () => []),
    getFleetById: vi.fn(async () => null),
    createVehicle: vi.fn(async (input: unknown) => input),
    listAssignments: vi.fn(async () => []),
  };
  trackingRepo = { getById: vi.fn(async () => null), listByShipper: vi.fn(async () => []), listByTransporter: vi.fn(async () => []) };
  eventRepo = { getHistory: vi.fn(async () => []) };
  gpsRepo = { getLastForTrackingId: vi.fn(async () => null), getHistory: vi.fn(async () => []) };
  deliveryProcessor = {
    initialize: vi.fn(async () => undefined),
    processBatch: vi.fn(async () => ({ processedCount: 0, successCount: 0, failedCount: 0, requeuedCount: 0, results: [] })),
  };
});

describe('I-2 item 6: the RBAC matrix resolves the resources routes actually ask about', () => {
  it('stays fail-closed for a resource nobody registered', () => {
    expect(evaluateRBAC('ADMIN', 'not_a_real_resource', 'read').permitted).toBe(false);
  });

  it.each(['fleet', 'fleet_vehicles', 'fleet_assignments', 'support_tickets', 'tracking_read'])(
    'registers %s instead of silently denying every role',
    (resource) => {
      expect(evaluateRBAC('ADMIN', resource, 'read').permitted, resource).toBe(true);
    },
  );

  it('keeps DISPATCHER out of the role matrix — its access is delegation-only', () => {
    for (const resource of ['fleet', 'fleet_vehicles', 'tracking_read', 'support_tickets']) {
      expect(evaluateRBAC('DISPATCHER', resource, 'read').permitted, resource).toBe(false);
    }
  });

  it('maps each delegation-covered pair to the scope migration 045 gates it on', () => {
    expect(requiredOperationalScope('fleet', 'read')).toBe('operational_read');
    expect(requiredOperationalScope('fleet_vehicles', 'read')).toBe('operational_read');
    expect(requiredOperationalScope('fleet_assignments', 'read')).toBe('operational_read');
    expect(requiredOperationalScope('fleet_assignments', 'create')).toBe('assignment_manage');
    expect(requiredOperationalScope('tracking_read', 'read')).toBe('operational_read');
    // Financial and driver-onboarding capabilities are not delegable, so they carry no scope at all.
    expect(requiredOperationalScope('financial', 'execute')).toBeNull();
    expect(requiredOperationalScope('drivers', 'create')).toBeNull();
    expect(requiredOperationalScope('support_tickets', 'read')).toBeNull();
  });
});

describe('I-2 item 6 / F-I2-08: fleet owner scope comes from the session, not the query string', () => {
  it('refuses an anonymous caller before touching the fleet repository', async () => {
    sessionUser = null;
    const response = await fleetList(req('/api/fleet'));
    expect(response.status).toBe(401);
    expect(fleetRepo.listFleets).not.toHaveBeenCalled();
  });

  it('refuses a Shipper: fleet data belongs to the Transporter domain', async () => {
    rpcAnswers = { ...SHIPPER };
    const response = await fleetList(req('/api/fleet'));
    expect(response.status).toBe(403);
    expect(fleetRepo.listFleets).not.toHaveBeenCalled();
  });

  it('ignores a foreign ownerId from a Transporter and pins the query to their own account', async () => {
    const response = await fleetList(req(`/api/fleet?ownerId=${FOREIGN_OWNER}`));
    expect(response.status).toBe(200);
    expect(fleetRepo.listFleets.mock.calls[0][0]).toBe(SESSION_USER);
  });

  it('lets a governance tier keep an explicit ownerId filter', async () => {
    rpcAnswers = { ...ADMIN };
    await fleetList(req(`/api/fleet?ownerId=${FOREIGN_OWNER}`));
    expect(fleetRepo.listFleets.mock.calls[0][0]).toBe(FOREIGN_OWNER);
  });

  it('scopes a delegated Dispatcher to the Transporter that delegated, whatever ownerId was sent', async () => {
    rpcAnswers = { ...DELEGATE };
    const response = await fleetList(req(`/api/fleet?ownerId=${FOREIGN_OWNER}`));
    expect(response.status).toBe(200);
    expect(fleetRepo.listFleets.mock.calls[0][0]).toBe(DELEGATION_PRINCIPAL);
  });

  it('answers a fleet-scoped vehicle list with 404 and no list query when the fleet is not the caller\'s', async () => {
    const response = await fleetList(req(`/api/fleet?entity=vehicles&fleetId=${FOREIGN_FLEET}`));
    expect(response.status).toBe(404);
    expect(fleetRepo.getFleetById).toHaveBeenCalledWith(FOREIGN_FLEET);
    expect(fleetRepo.listVehicles).not.toHaveBeenCalled();
  });

  it('skips the session probe for governance but still does not widen a driver list', async () => {
    rpcAnswers = { ...ADMIN };
    const response = await fleetList(req(`/api/fleet?entity=drivers&fleetId=${FOREIGN_FLEET}`));
    expect(response.status).toBe(200);
    expect(fleetRepo.getFleetById).not.toHaveBeenCalled();
    expect(fleetRepo.listDrivers).toHaveBeenCalledOnce();
  });

  it('refuses to register a vehicle against a fleet the caller cannot read', async () => {
    const response = await vehicleCreate(
      req('/api/fleet/vehicles', {
        body: { fleetId: FOREIGN_FLEET, type: 'TRUCK', registrationNumber: 'AB-12-CD', capacityWeightKg: 5000 },
      }),
    );
    expect(response.status).toBe(404);
    expect(fleetRepo.createVehicle).not.toHaveBeenCalled();
  });
});

describe('I-2 item 6 / F-I2-09: support tickets attest the requester from the session', () => {
  it('refuses an anonymous caller', async () => {
    sessionUser = null;
    const response = await ticketCreate(req('/api/support/tickets', { body: TICKET_BODY }));
    expect(response.status).toBe(401);
    expect(adminClientCalls).toBe(0);
  });

  it('stores the session-resolved role and requester id, never a claimed id', async () => {
    rpcAnswers = { ...SHIPPER };
    outcome = { data: { id: 't1', ticket_id: 'TICKET-abc', requester_role: 'SHIPPER' }, error: null };
    const response = await ticketCreate(
      req('/api/support/tickets', { body: { ...TICKET_BODY, requesterRole: 'shipper', requesterId: 'somebody-else' } }),
    );
    expect(response.status).toBe(201);
    const payload = insertPayload();
    expect(payload.requester_role).toBe('SHIPPER');
    expect(payload.requester_id).toBe(SESSION_USER);
  });

  it('reports a conflicting claimed role as a client error rather than storing or dropping it', async () => {
    const response = await ticketCreate(
      req('/api/support/tickets', { body: { ...TICKET_BODY, requesterRole: 'SUPER_ADMIN' } }),
    );
    expect(response.status).toBe(400);
    expect(adminClientCalls).toBe(0);
  });

  it('pins the service-role queue query to the caller for a participant', async () => {
    outcome = { data: [], error: null, count: 0 };
    const response = await ticketList(req('/api/support/tickets'));
    expect(response.status).toBe(200);
    expect(eqsOf('logistics_schema.support_tickets')).toContainEqual(['requester_id', SESSION_USER]);
  });

  it('leaves the queue unscoped only for a governance tier', async () => {
    rpcAnswers = { ...ADMIN };
    await ticketList(req('/api/support/tickets'));
    expect(eqsOf('logistics_schema.support_tickets').map((e) => e[0])).not.toContain('requester_id');
  });
});

describe('I-2 item 6: notification surfaces are no longer anonymous', () => {
  it('refuses an anonymous POST before building the service-role client', async () => {
    sessionUser = null;
    const response = await notificationCreate(req('/api/notifications', { body: NOTIFICATION_BODY }));
    expect(response.status).toBe(401);
    expect(adminClientCalls).toBe(0);
  });

  it('refuses a marketplace participant that wants to message somebody else', async () => {
    const response = await notificationCreate(req('/api/notifications', { body: NOTIFICATION_BODY }));
    expect(response.status).toBe(403);
    expect(adminClientCalls).toBe(0);
  });

  it('lets a governance tier queue a notification for another recipient', async () => {
    rpcAnswers = { ...ADMIN };
    outcome = { data: { id: 'n-1', recipient_id: 'someone-else', status: 'QUEUED' }, error: null };
    const response = await notificationCreate(req('/api/notifications', { body: NOTIFICATION_BODY }));
    expect(response.status).toBe(201);
    expect(insertPayload().recipient_id).toBe('someone-else');
  });

  it('reads a notification on the caller session, so the live counterparty policy is the boundary', async () => {
    rpcAnswers = { ...ADMIN };
    await notificationRead(req('/api/notifications/n-1'), { params: Promise.resolve({ notificationId: 'n-1' }) });
    expect(adminClientCalls).toBe(0);
    expect(queries.filter((q) => q.method === 'eq').map((q) => q.args)).toEqual([['id', 'n-1']]);
    expect([...new Set(queries.map((q) => q.client))]).toEqual(['session']);
  });

  it('requires a governance session to drain the delivery queue', async () => {
    sessionUser = null;
    expect((await deliveryDrain(req('/api/notifications/delivery-processor', { body: {} }))).status).toBe(401);
    expect(deliveryProcessor.initialize).not.toHaveBeenCalled();

    rpcAnswers = { ...SHIPPER };
    sessionUser = { id: SESSION_USER, email: 'p@nexcargo.example', user_metadata: {} };
    const denied = await deliveryDrain(req('/api/notifications/delivery-processor', { body: {} }));
    expect(denied.status).toBe(403);
    expect(await (await denied.json()).error.code).toBe('ERR_1004');
    expect(deliveryProcessor.initialize).not.toHaveBeenCalled();
  });
});

describe('I-2 item 6: every tracking read is authorized before it reaches the query layer', () => {
  const routes: Array<[string, (r: NextRequest, c: any) => Promise<Response>]> = [
    ['/api/tracking/t-1', trackingDetail],
    ['/api/tracking/t-1/events', trackingEvents],
    ['/api/tracking/t-1/location-history', locationHistory],
  ];

  it.each(routes)('%s answers 401 with no repository call', async (path, handler) => {
    sessionUser = null;
    const response = await handler(req(path), { params: Promise.resolve({ trackingId: 't-1' }) });
    expect(response.status).toBe(401);
    expect(JSON.stringify(queries)).toBe('[]');
  });

  it.each(routes)('%s refuses an unclassified account (no resolver role)', async (path, handler) => {
    rpcAnswers = { ...UNRESOLVED };
    const response = await handler(req(path), { params: Promise.resolve({ trackingId: 't-1' }) });
    expect(response.status).toBe(403);
  });

  it.each(routes)('%s admits a delegated Dispatcher (no resolver role, bounded scope only)', async (path, handler) => {
    rpcAnswers = { ...DELEGATE };
    const response = await handler(req(path), { params: Promise.resolve({ trackingId: 't-1' }) });
    expect(response.status).not.toBe(403);
    expect(response.status).not.toBe(401);
  });

  it('lists records for the caller\'s own session instead of a literal "all" scope', async () => {
    await trackingAll(req('/api/tracking/all'));
    expect(trackingRepo.listByShipper.mock.calls[0][0]).toBe(SESSION_USER);
  });

  it('lists transporter trips for the caller\'s own session', async () => {
    await transporterTrips(req('/api/tracking/transporter-trips'));
    expect(trackingRepo.listByTransporter.mock.calls[0][0]).toBe(SESSION_USER);
  });
});

describe('I-2 item 6: a denial surfaces as its own status code', () => {
  it('maps the guard signals and leaves real failures to the caller', () => {
    expect(authDenialResponse(new Error('UNAUTHORIZED'))?.status).toBe(401);
    expect(authDenialResponse(new Error('FORBIDDEN: nope'))?.status).toBe(403);
    expect(authDenialResponse(new Error('connection reset'))).toBeNull();
    expect(authDenialResponse('FORBIDDEN: not an Error')).toBeNull();
  });
});
