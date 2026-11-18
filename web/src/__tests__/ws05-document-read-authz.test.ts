// NexCargo Pre-I-6 WS-05 capability D — shipment document read-path authorization.
//
// SCOPE AND EVIDENCE CLASS: these are UNIT tests with an in-memory fake admin client and a
// mocked auth assertion. They prove the application-layer gate logic (shared verifyDocumentAccess,
// detail-route 403, list-route filtering) but are NOT live HTTP or live database verification.
// Live verification is recorded separately in the WS-05 workstream report.
//
// Defect under correction: GET /api/documents and GET /api/documents/[id] previously enforced only
// the RBAC role check while reading through the service-role client (RLS bypassed), so any
// marketplace party could read any document's metadata cross-party. The download/preview routes
// already enforced ownership/party access; the same model is now applied to the metadata reads.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// In-memory database behind the mocked service-role client
// ---------------------------------------------------------------------------

const SHIPPER = '666ed3aa-204a-45ad-83f5-b9cf0d4d8df8';
const TRANSPORTER = 'e0fe13fd-6606-475f-a945-0a35ad879f27';
const OTHER_TRANSPORTER = '272b1abc-7c91-4fbc-b768-0e9ead019d0e';
const ADMIN_UID = '11111111-1111-1111-1111-111111111111';
const BOOKING = '827194cf-0000-4000-8000-000000000001';
const OTHER_BOOKING = '827194cf-0000-4000-8000-000000000002';
const CONTRACT = 'a38816b7-0000-4000-8000-000000000001';

interface FakeRow { [column: string]: unknown }

const db: { tables: Record<string, FakeRow[]> } = { tables: {} };

function seedDocument(overrides: Partial<FakeRow> & { document_id: string }): void {
  db.tables.documents.push({
    id: `row-${overrides.document_id}`,
    document_type: 'CONTRACT',
    linked_entity_type: 'booking',
    linked_entity_id: BOOKING,
    status: 'ACTIVE',
    created_by: SHIPPER,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    file_reference: `docs/${overrides.document_id}.pdf`,
    file_hash: `hash-${overrides.document_id}`,
    expiry_date: null,
    issue_date: null,
    is_deleted: false,
    version: 1,
    ...overrides,
  });
}

function resolveFake(table: string, filters: Array<[string, unknown]>, single: boolean) {
  const rows = (db.tables[table] ?? []).filter(row =>
    filters.every(([col, val]) => row[col] === val),
  );
  if (single) {
    if (rows.length === 0) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    return { data: { ...rows[0] }, error: null };
  }
  return { data: rows.map(r => ({ ...r })), error: null };
}

function fakeBuilder(table: string): any {
  const filters: Array<[string, unknown]> = [];
  let single = false;
  const q: any = {
    select: () => q,
    eq: (col: string, val: unknown) => { filters.push([col, val]); return q; },
    order: () => q,
    single: () => { single = true; return q; },
    maybeSingle: () => { single = true; return q; },
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(resolveFake(table, filters, single)).then(res, rej),
  };
  return q;
}

const fakeAdminClient = {
  schema: vi.fn(() => ({ from: (table: string) => fakeBuilder(table) })),
  from: vi.fn((table: string) => fakeBuilder(table)),
};

vi.mock('@/infrastructure/database/supabase', () => ({
  createAdminClient: vi.fn(() => fakeAdminClient),
}));

// ---------------------------------------------------------------------------
// Mocked auth assertion (identity + effective role controlled per test)
// ---------------------------------------------------------------------------

let currentUserId = TRANSPORTER;
let currentRole: string | null = 'TRANSPORTER';
let authReject: Error | null = null;

vi.mock('@/lib/supabase/api-auth', () => ({
  assertApiAuthorization: vi.fn(async () => {
    if (authReject) throw authReject;
    return {
      userId: currentUserId,
      email: 'party@example.test',
      role: currentRole,
      marketplaceRole: currentRole === 'SHIPPER' || currentRole === 'TRANSPORTER' ? currentRole : null,
      platformRole: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(currentRole ?? '') ? currentRole : null,
      delegation: null,
    };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callDetail(documentId: string) {
  const mod = await import('@/app/api/documents/[id]/route');
  const req = new NextRequest(`http://localhost/api/documents/${documentId}`, {
    headers: { 'x-correlation-id': 'ws05-fixed-correlation-id' },
  });
  const res = await mod.GET(req, { params: Promise.resolve({ id: documentId }) } as never);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

async function callList(query: string) {
  const mod = await import('@/app/api/documents/route');
  const req = new NextRequest(`http://localhost/api/documents${query}`, {
    headers: { 'x-correlation-id': 'ws05-fixed-correlation-id' },
  });
  const res = await mod.GET(req);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.tables = {
    documents: [],
    bookings: [
      { id: BOOKING, shipper_id: SHIPPER, transporter_id: TRANSPORTER, is_deleted: false },
      { id: OTHER_BOOKING, shipper_id: SHIPPER, transporter_id: OTHER_TRANSPORTER, is_deleted: false },
    ],
    contracts: [
      { id: CONTRACT, booking_id: BOOKING, is_deleted: false },
    ],
    document_versions: [],
    document_linkages: [],
    document_approvals: [],
    ocr_results: [],
    digital_signatures: [],
    document_expiry_records: [],
  };
  currentUserId = TRANSPORTER;
  currentRole = 'TRANSPORTER';
  authReject = null;
});

// ---------------------------------------------------------------------------
// A. Shared verifyDocumentAccess model (unit, fake admin client)
// ---------------------------------------------------------------------------

describe('WS-05 D §A — shared verifyDocumentAccess authorization model', () => {
  it('allows the document owner regardless of role', async () => {
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    const subject = { linked_entity_type: 'user', linked_entity_id: SHIPPER, created_by: SHIPPER };
    await expect(verifyDocumentAccess(subject, SHIPPER, null)).resolves.toBe(true);
  });

  it('allows ADMIN and SUPER_ADMIN for any document', async () => {
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    const subject = { linked_entity_type: 'booking', linked_entity_id: OTHER_BOOKING, created_by: SHIPPER };
    await expect(verifyDocumentAccess(subject, ADMIN_UID, 'ADMIN')).resolves.toBe(true);
    await expect(verifyDocumentAccess(subject, ADMIN_UID, 'SUPER_ADMIN')).resolves.toBe(true);
  });

  it('allows the booking shipper and the booking transporter', async () => {
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    const subject = { linked_entity_type: 'booking', linked_entity_id: BOOKING, created_by: 'someone-else' };
    await expect(verifyDocumentAccess(subject, SHIPPER, 'SHIPPER')).resolves.toBe(true);
    await expect(verifyDocumentAccess(subject, TRANSPORTER, 'TRANSPORTER')).resolves.toBe(true);
  });

  it('denies a cross-party transporter on a booking they do not serve', async () => {
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    const subject = { linked_entity_type: 'booking', linked_entity_id: BOOKING, created_by: SHIPPER };
    await expect(verifyDocumentAccess(subject, OTHER_TRANSPORTER, 'TRANSPORTER')).resolves.toBe(false);
  });

  it('allows contract parties through the contracts-to-bookings chain', async () => {
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    const subject = { linked_entity_type: 'contract', linked_entity_id: CONTRACT, created_by: 'someone-else' };
    await expect(verifyDocumentAccess(subject, SHIPPER, 'SHIPPER')).resolves.toBe(true);
    await expect(verifyDocumentAccess(subject, TRANSPORTER, 'TRANSPORTER')).resolves.toBe(true);
    await expect(verifyDocumentAccess(subject, OTHER_TRANSPORTER, 'TRANSPORTER')).resolves.toBe(false);
  });

  it('denies when the linked booking is soft-deleted or missing', async () => {
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    (db.tables.bookings[0] as any).is_deleted = true;
    const subject = { linked_entity_type: 'booking', linked_entity_id: BOOKING, created_by: SHIPPER };
    await expect(verifyDocumentAccess(subject, TRANSPORTER, 'TRANSPORTER')).resolves.toBe(false);
    const missing = { linked_entity_type: 'booking', linked_entity_id: 'no-such-booking', created_by: SHIPPER };
    await expect(verifyDocumentAccess(missing, TRANSPORTER, 'TRANSPORTER')).resolves.toBe(false);
  });

  it('admits non-owner MODERATOR read access (PRE-I-6 FINAL COMPLETION DIRECTIVE Item 2)', async () => {
    // Supersedes the WS-05 denial: the documents:read matrix and the DB RLS "I2 delegated reads
    // documents" policy both admit MODERATOR, so the shared gate now matches them. Read only.
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    const subject = { linked_entity_type: 'booking', linked_entity_id: BOOKING, created_by: SHIPPER };
    await expect(verifyDocumentAccess(subject, 'moderator-uid', 'MODERATOR')).resolves.toBe(true);
  });

  it('denies user-linked documents to non-owners and unknown entity types to parties', async () => {
    const { verifyDocumentAccess } = await import(
      '@/modules/mod-004-documents/infrastructure/authorization/document-access'
    );
    const userDoc = { linked_entity_type: 'user', linked_entity_id: SHIPPER, created_by: SHIPPER };
    await expect(verifyDocumentAccess(userDoc, TRANSPORTER, 'TRANSPORTER')).resolves.toBe(false);
    const unknown = { linked_entity_type: 'shipment', linked_entity_id: BOOKING, created_by: SHIPPER };
    await expect(verifyDocumentAccess(unknown, TRANSPORTER, 'TRANSPORTER')).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B. GET /api/documents/[id] — detail metadata gate
// ---------------------------------------------------------------------------

describe('WS-05 D §B — detail route enforces document access', () => {
  it('returns 401 without a session', async () => {
    authReject = new Error('UNAUTHORIZED');
    seedDocument({ document_id: 'doc-1' });
    const r = await callDetail('doc-1');
    expect(r.status).toBe(401);
  });

  it('returns 404 for a nonexistent document', async () => {
    const r = await callDetail('doc-missing');
    expect(r.status).toBe(404);
  });

  it('allows the booking transporter to read the metadata', async () => {
    seedDocument({ document_id: 'doc-1' });
    const r = await callDetail('doc-1');
    expect(r.status).toBe(200);
    // Document.toJSON() governs serialization (pre-existing contract): the base entity fields.
    expect(r.body.data.id).toBe('row-doc-1');
  });

  it('denies a cross-party transporter with 403 and no metadata disclosure', async () => {
    seedDocument({ document_id: 'doc-1' });
    currentUserId = OTHER_TRANSPORTER;
    const r = await callDetail('doc-1');
    expect(r.status).toBe(403);
    expect(r.body.data.code).toBe('ERR_1004');
    expect(JSON.stringify(r.body)).not.toContain('doc-1');
    expect(JSON.stringify(r.body)).not.toContain('file_reference');
  });

  it('denies a shipper on a booking they do not own', async () => {
    seedDocument({ document_id: 'doc-1', linked_entity_id: OTHER_BOOKING, created_by: OTHER_TRANSPORTER });
    currentUserId = 'ffffffff-0000-4000-8000-000000000099';
    currentRole = 'SHIPPER';
    const r = await callDetail('doc-1');
    expect(r.status).toBe(403);
  });

  it('allows ADMIN to read any document metadata', async () => {
    seedDocument({ document_id: 'doc-1', linked_entity_id: OTHER_BOOKING });
    currentUserId = ADMIN_UID;
    currentRole = 'ADMIN';
    const r = await callDetail('doc-1');
    expect(r.status).toBe(200);
  });

  it('allows the owner even when the role is not a party to the linked booking', async () => {
    seedDocument({ document_id: 'doc-1', linked_entity_id: OTHER_BOOKING, created_by: OTHER_TRANSPORTER });
    currentUserId = OTHER_TRANSPORTER;
    const r = await callDetail('doc-1');
    expect(r.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// C. GET /api/documents — list filtering
// ---------------------------------------------------------------------------

describe('WS-05 D §C — list route omits inaccessible documents', () => {
  it('filters cross-party documents out of an entity list and recomputes total', async () => {
    seedDocument({ document_id: 'doc-party', linked_entity_id: BOOKING });
    seedDocument({ document_id: 'doc-other', linked_entity_id: OTHER_BOOKING });
    currentUserId = OTHER_TRANSPORTER;
    const r = await callList(`?linkedEntityType=booking&linkedEntityId=${OTHER_BOOKING}`);
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.documents.map((d: any) => d.documentId)).toEqual(['doc-other']);
  });

  it('returns both party documents to the booking transporter', async () => {
    seedDocument({ document_id: 'doc-a', linked_entity_id: BOOKING });
    seedDocument({ document_id: 'doc-b', linked_entity_id: BOOKING, created_by: TRANSPORTER });
    const r = await callList(`?linkedEntityType=booking&linkedEntityId=${BOOKING}`);
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(2);
  });

  it('filters a status list down to accessible documents for a marketplace party', async () => {
    seedDocument({ document_id: 'doc-party', linked_entity_id: BOOKING });
    seedDocument({ document_id: 'doc-cross', linked_entity_id: OTHER_BOOKING });
    seedDocument({ document_id: 'doc-user', linked_entity_type: 'user', linked_entity_id: SHIPPER, created_by: SHIPPER });
    const r = await callList('?status=ACTIVE');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.documents[0].documentId).toBe('doc-party');
  });

  it('lets ADMIN see every document in a status list', async () => {
    seedDocument({ document_id: 'doc-party', linked_entity_id: BOOKING });
    seedDocument({ document_id: 'doc-cross', linked_entity_id: OTHER_BOOKING });
    currentUserId = ADMIN_UID;
    currentRole = 'ADMIN';
    const r = await callList('?status=ACTIVE');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(2);
  });

  it('applies pagination after access filtering, with total reflecting the filtered set', async () => {
    seedDocument({ document_id: 'doc-a', linked_entity_id: BOOKING });
    seedDocument({ document_id: 'doc-b', linked_entity_id: BOOKING });
    seedDocument({ document_id: 'doc-cross', linked_entity_id: OTHER_BOOKING });
    const r = await callList('?status=ACTIVE&limit=1');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(2);
    expect(r.body.data.documents).toHaveLength(1);
  });

  it('returns an empty list when no filter is supplied', async () => {
    seedDocument({ document_id: 'doc-a' });
    const r = await callList('');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(0);
    expect(r.body.data.documents).toEqual([]);
  });

  it('returns 401 without a session', async () => {
    authReject = new Error('UNAUTHORIZED');
    const r = await callList('?status=ACTIVE');
    expect(r.status).toBe(401);
  });

  it('returns 403 when the RBAC role lacks documents:read', async () => {
    authReject = new Error('FORBIDDEN: role DRIVER cannot read documents');
    const r = await callList('?status=ACTIVE');
    expect(r.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// D. Structural pins — single shared gate, linkage fields carried by summaries
// ---------------------------------------------------------------------------

describe('WS-05 D §D — structural pins (static inspection, not runtime proof)', () => {
  const root = resolve(__dirname, '..');
  const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

  it('all four document routes import the shared verifyDocumentAccess helper', () => {
    const routes = [
      'app/api/documents/route.ts',
      'app/api/documents/[id]/route.ts',
      'app/api/documents/[id]/download/route.ts',
      'app/api/documents/[id]/preview/route.ts',
    ];
    for (const rel of routes) {
      const src = read(rel);
      expect(src).toContain(
        "import { verifyDocumentAccess } from '@/modules/mod-004-documents/infrastructure/authorization/document-access'",
      );
      expect(src).not.toContain('async function verifyDocumentAccess');
    }
  });

  it('repository summary selects carry the entity linkage needed by the access gate', () => {
    const src = read('modules/mod-004-documents/infrastructure/repositories/document-repository.ts');
    const selectsWithLinkage = src.match(
      /'id, document_id, document_type, linked_entity_type, linked_entity_id, status, file_reference, file_hash, expiry_date, issue_date, created_at, updated_at, created_by'/g,
    );
    expect(selectsWithLinkage).toHaveLength(2);
    expect(src).toContain('linkedEntityType: row.linked_entity_type');
    expect(src).toContain('linkedEntityId: row.linked_entity_id');
  });

  it('detail route gates before returning the document payload', () => {
    const src = read('app/api/documents/[id]/route.ts');
    const gate = src.indexOf('const hasAccess = await verifyDocumentAccess');
    const payload = src.indexOf('wrapInContractFramework(document, correlationId)');
    expect(gate).toBeGreaterThan(-1);
    expect(payload).toBeGreaterThan(gate);
  });

  it('list route filters before pagination and recomputes total', () => {
    const src = read('app/api/documents/route.ts');
    const filter = src.indexOf('documents = documents.filter');
    const pagination = src.indexOf('// Apply pagination at the application layer');
    expect(filter).toBeGreaterThan(-1);
    expect(pagination).toBeGreaterThan(filter);
    expect(src).toContain('total = documents.length;');
  });
});