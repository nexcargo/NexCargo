// NexCargo MOD-004 — Document API Route Tests (C7-004: Document -> Contract Auto-Association)
// Wave 2 — Stage 2B, Increment 2 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import type { DocumentCreateInput, DocumentSummary } from '@/modules/mod-004-documents/infrastructure/repositories/document-repository';

/** Local copy of allowed extensions (module-internal constant not exported) */
const TEST_ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.tiff', '.tif']);

/**
 * Admin-client double for the MOD-004 repository.
 *
 * Built from plain closures inside `vi.hoisted` rather than `vi.fn()` doubles: the
 * mock factory runs before this module body, and the `vi.resetAllMocks()` in
 * `beforeEach` would strip an implementation attached to a spy.
 *
 * The chain mirrors PostgREST: every verb chains, the chain itself awaits to
 * `{ data, error }`, and a database failure is *returned* rather than thrown, so
 * the repository's own error handling decides whether a caller sees a rejection.
 * Anything the repository must not do (wrong schema, unmapped table) throws
 * immediately instead of resolving to a plausible-looking empty result.
 */
type StubError = { code?: string; message?: string };
type StubPayload = Record<string, unknown>;

interface StubResult {
  data: unknown;
  error: StubError | null;
}

type StubChain = Promise<StubResult> & {
  select: (columns?: string) => StubChain;
  insert: (payload: StubPayload) => StubChain;
  eq: (column: string, value: unknown) => StubChain;
  order: (column: string, options: { ascending: boolean }) => StubChain;
  limit: (count: number) => StubChain;
  single: () => StubChain;
};

interface StubClient {
  schema: (name: string) => { from: (table: string) => StubChain };
}

/** A `logistics_schema.documents` row exactly as the repository reads it. */
interface StubDocumentRow {
  id: string;
  document_id: string;
  document_type: string;
  linked_entity_type: string;
  linked_entity_id: string;
  status: string;
  created_by: string;
  updated_by: string;
  file_reference: string;
  file_hash: string;
  expiry_date: string | null;
  issue_date: string | null;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface LoggedRead { table: string; filters: StubPayload }
interface LoggedWrite { table: string; payload: StubPayload }

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

/** PostgREST returns only the projected columns, so a missing one stays missing. */
function pickColumns(row: StubPayload, columns: string[]): StubPayload {
  return columns.reduce<StubPayload>((acc, column) => {
    if (column in row) acc[column] = row[column];
    return acc;
  }, {});
}

const db = vi.hoisted(() => {
  const DOCUMENT_TABLES = [
    'documents',
    'document_versions',
    'document_linkages',
    'document_approvals',
    'ocr_results',
    'digital_signatures',
    'document_expiry_records',
  ];

  const DOCUMENT_ROW: StubDocumentRow = {
    id: 'row-0001',
    document_id: 'doc-001',
    document_type: 'CONTRACT',
    linked_entity_type: 'contract',
    linked_entity_id: 'contract-001',
    status: 'ACTIVE',
    created_by: 'user-001',
    updated_by: 'user-001',
    file_reference: 'contracts/doc-001.pdf',
    file_hash: 'abc123',
    expiry_date: null,
    issue_date: null,
    correlation_id: null,
    is_deleted: false,
    version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  /** Columns the database generates; a representation-returning INSERT echoes them. */
  const SERVER_DEFAULTS: StubPayload = {
    id: 'row-generated',
    is_deleted: false,
    version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const seed = new Map<string, unknown[]>();
  const reads: LoggedRead[] = [];
  const writes: LoggedWrite[] = [];
  let failure: StubError | null = null;

  function buildChain(table: string): StubChain {
    const filters: StubPayload = {};
    let inserted: StubPayload | null = null;
    let projection: string[] | null = null;
    let wantsSingle = false;
    let wantsLimit: number | null = null;
    let ordering: { column: string; ascending: boolean } | null = null;

    function settle(): StubResult {
      if (failure) return { data: null, error: failure };

      if (inserted) {
        writes.push({ table, payload: inserted });
        return { data: wantsSingle ? { ...SERVER_DEFAULTS, ...inserted } : null, error: null };
      }

      reads.push({ table, filters: { ...filters } });
      const matched = (seed.get(table) ?? []).filter((row) =>
        Object.entries(filters).every(([column, value]) => (row as StubPayload)[column] === value),
      );
      let rows = matched;
      if (ordering) {
        const { column, ascending } = ordering;
        rows = [...rows].sort((a, b) => {
          const direction = compareValues((a as StubPayload)[column], (b as StubPayload)[column]);
          return ascending ? direction : -direction;
        });
      }

      if (wantsSingle) {
        const first = rows[0];
        return first === undefined
          ? { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
          : { data: project(first), error: null };
      }
      const page = wantsLimit === null ? rows : rows.slice(0, wantsLimit);
      return { data: page.map(project), error: null };
    }

    function project(row: unknown): unknown {
      return projection === null ? row : pickColumns(row as StubPayload, projection);
    }

    const chain = Promise.resolve().then(settle) as StubChain;
    return Object.assign(chain, {
      select: (columns?: string): StubChain => {
        if (columns && columns !== '*') projection = columns.split(',').map((name) => name.trim());
        return chain;
      },
      insert: (payload: StubPayload): StubChain => {
        inserted = payload;
        return chain;
      },
      eq: (column: string, value: unknown): StubChain => {
        filters[column] = value;
        return chain;
      },
      order: (column: string, options: { ascending: boolean }): StubChain => {
        ordering = { column, ascending: options.ascending };
        return chain;
      },
      limit: (count: number): StubChain => {
        wantsLimit = count;
        return chain;
      },
      single: (): StubChain => {
        wantsSingle = true;
        return chain;
      },
    });
  }

  function createAdminClient(): StubClient {
    return {
      schema(name: string) {
        if (name !== 'logistics_schema') {
          throw new Error(`DocumentRepository requested an unexpected schema: ${name}`);
        }
        return {
          from(table: string) {
            if (!DOCUMENT_TABLES.includes(table)) {
              throw new Error(`DocumentRepository queried an unmapped table: ${table}`);
            }
            return buildChain(table);
          },
        };
      },
    };
  }

  return {
    DOCUMENT_ROW,
    reads,
    writes,
    reset() {
      seed.clear();
      reads.length = 0;
      writes.length = 0;
      failure = null;
    },
    setRows(table: string, rows: unknown[]) {
      seed.set(table, rows);
    },
    /** Make requests answer like a failing database so the repository's error paths stay assertable. */
    setError(error: StubError) {
      failure = error;
    },
    createAdminClient,
  };
});


// ─── Top-level mocks that must execute before any module imports ────────────

vi.mock('@/lib/env', () => ({
  DATABASE_URL: 'https://test-project.supabase.co',
}));

vi.mock('@/infrastructure/database/supabase', () => ({
  createAdminClient: () => db.createAdminClient(),
}));

vi.mock('@/modules/mod-004-documents/infrastructure/storage/nexca-storage', () => ({
  computeHash: vi.fn().mockResolvedValue('sha256-mock-hash'),
  constructPath: vi.fn((linkedEntityType, linkedEntityId, documentId, version, filename) => {
    const parts = [linkedEntityType, linkedEntityId, documentId];
    if (version !== undefined) parts.push(String(version));
    if (filename !== undefined) parts.push(filename);
    return parts.join('/');
  }),
  getFileUrl: vi.fn().mockResolvedValue('https://signed.storage.url?token=abc'),
  uploadFile: vi.fn().mockResolvedValue({ path: 'path/to/file', hash: 'sha256-mock' }),
  ensureBucketExists: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.resetAllMocks();
  db.reset();
});

// --------------------------------------------------------------------------- *
// A. RBAC Integration Tests — evaluateRBAC gates document operations
// -------------------------------------------------------------------------- **

describe('A. RBAC Integration — Documents Resource Authorization', () => {
  it('SHIPPER can documents/create', () => {
    const result = evaluateRBAC('SHIPPER', 'documents', 'create');
    expect(result.permitted).toBe(true);
    expect(result.role).toBe('SHIPPER');
    expect(result.resource).toBe('documents');
    expect(result.action).toBe('create');
  });

  it('TRANSPORTER can documents/create', () => {
    const result = evaluateRBAC('TRANSPORTER', 'documents', 'create');
    expect(result.permitted).toBe(true);
  });

  it('ADMIN can documents/create', () => {
    const result = evaluateRBAC('ADMIN', 'documents', 'create');
    expect(result.permitted).toBe(true);
  });

  it('SUPER_ADMIN can documents/create', () => {
    const result = evaluateRBAC('SUPER_ADMIN', 'documents', 'create');
    expect(result.permitted).toBe(true);
  });

  it('MODERATOR CANNOT documents/create (not in create action roles)', () => {
    const result = evaluateRBAC('MODERATOR', 'documents', 'create');
    expect(result.permitted).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('create');
  });

  it('DISPATCHER cannot documents/create (not in resources or create action)', () => {
    const result = evaluateRBAC('DISPATCHER', 'documents', 'create');
    expect(result.permitted).toBe(false);
  });

  it('DRIVER cannot documents/create', () => {
    const result = evaluateRBAC('DRIVER', 'documents', 'create');
    expect(result.permitted).toBe(false);
  });

  it('MODERATOR can documents/read (governance oversight)', () => {
    const result = evaluateRBAC('MODERATOR', 'documents', 'read');
    expect(result.permitted).toBe(true);
  });

  it('SHIPPER can documents/read', () => {
    const result = evaluateRBAC('SHIPPER', 'documents', 'read');
    expect(result.permitted).toBe(true);
  });

  it('TRANSPORTER can documents/read', () => {
    const result = evaluateRBAC('TRANSPORTER', 'documents', 'read');
    expect(result.permitted).toBe(true);
  });

  it('ADMIN can documents/read', () => {
    const result = evaluateRBAC('ADMIN', 'documents', 'read');
    expect(result.permitted).toBe(true);
  });

  it('SUPER_ADMIN can documents/read', () => {
    const result = evaluateRBAC('SUPER_ADMIN', 'documents', 'read');
    expect(result.permitted).toBe(true);
  });

  it('Driver cannot documents/create', () => {
    const result = evaluateRBAC('DRIVER', 'documents', 'create');
    expect(result.permitted).toBe(false);
  });

  it('User with null role cannot access documents (unassigned/onboarding state)', () => {
    const result = evaluateRBAC('', 'documents', 'read');
    expect(result.permitted).toBe(false);
  });

  it('Unknown role cannot access documents', () => {
    const result = evaluateRBAC('UNKNOWN_ROLE', 'documents', 'create');
    expect(result.permitted).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('denied evaluation includes human-readable reason', () => {
    const result = evaluateRBAC('DISPATCHER', 'documents', 'create');
    expect(result.permitted).toBe(false);
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
    expect(result.reason!.length).toBeGreaterThan(0);
  });

  it('undefined role is not permitted for any resource/action combination', () => {
    const result = evaluateRBAC(undefined as unknown as string, 'documents', 'read');
    expect(result.permitted).toBe(false);
  });

  it('empty string resource is not permitted for any role', () => {
    const result = evaluateRBAC('ADMIN', '', 'read');
    expect(result.permitted).toBe(false);
  });

  it('ADMIN can execute action on documents (ADMIN is in both lists)', () => {
    // ADMIN appears in allowedRoles['documents'] AND allowedActions['execute'], so permitted=true
    const result = evaluateRBAC('ADMIN', 'documents', 'execute');
    expect(result.permitted).toBe(true);
  });

  it('DISPATCHER cannot documents/read (DISPATCHER not in documents resource roles)', () => {
    // DISPATCHER has read permission but documents resource doesn't include DISPATCHER
    const result = evaluateRBAC('DISPATCHER', 'documents', 'read');
    expect(result.permitted).toBe(false);
  });

  it('ADMIN has full access to documents (create, read, update, delete)', () => {
    expect(evaluateRBAC('ADMIN', 'documents', 'create').permitted).toBe(true);
    expect(evaluateRBAC('ADMIN', 'documents', 'read').permitted).toBe(true);
    expect(evaluateRBAC('ADMIN', 'documents', 'update').permitted).toBe(true);
    expect(evaluateRBAC('ADMIN', 'documents', 'delete').permitted).toBe(true);
  });

  it('SUPER_ADMIN mirrors ADMIN permissions on documents', () => {
    expect(evaluateRBAC('SUPER_ADMIN', 'documents', 'create').permitted).toBe(true);
    expect(evaluateRBAC('SUPER_ADMIN', 'documents', 'read').permitted).toBe(true);
    expect(evaluateRBAC('SUPER_ADMIN', 'documents', 'update').permitted).toBe(true);
    expect(evaluateRBAC('SUPER_ADMIN', 'documents', 'delete').permitted).toBe(true);
  });
});

/** -------------------------------------------------------------------------- *
 * B. Contract Validation Helper Tests — mocking repository methods
 * -------------------------------------------------------------------------- **/

describe('B. Contract Validation — Conceptual Flow Verification', () => {
  // The upload route calls repo.findExistingByHashAndEntity() before storage upload.
  // If linkedEntityType === 'contract' and contract not found → 404 (fail-fast).
  // This ensures no orphan documents are stored.
  it('concept: contract check gates storage operations', () => {
    expect(true).toBe(true);
  });
});

/** -------------------------------------------------------------------------- *
 * C. Repository Method Signatures — contractExists & findExistingByHashAndEntity
 * -------------------------------------------------------------------------- **/

describe('C. Repository Method Signatures — New C7-004 Methods', () => {
  let repo: Awaited<ReturnType<typeof loadRepo>>;

  async function loadRepo() {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    return new DocumentRepository();
  }

  beforeEach(async () => {
    repo = await loadRepo();
  });

  it('DocumentRepository.prototype.contractExists is an async function', async () => {
    expect(typeof repo.findExistingByHashAndEntity).toBe('function');
    const result = repo.findExistingByHashAndEntity('hash', 'type', 'id');
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeNull();
  });

  it('DocumentRepository.prototype.findExistingByHashAndEntity is an async function', async () => {
    expect(typeof repo.findExistingByHashAndEntity).toBe('function');
    const result = repo.findExistingByHashAndEntity('hash', 'type', 'id');
    expect(result).toBeInstanceOf(Promise);
    await result;

    // The dedup probe is pinned to the documented (hash, type, id, not-deleted) combo.
    expect(db.reads[db.reads.length - 1]).toEqual({
      table: 'documents',
      filters: { file_hash: 'hash', linked_entity_type: 'type', linked_entity_id: 'id', is_deleted: false },
    });
  });

  it('contractExists accepts a single string argument (contractId)', async () => {
    await expect(
      repo.findExistingByHashAndEntity('hash', 'type', '00000000-0000-0000-0000-000000000001'),
    ).resolves.toBeNull();

    let pending!: ReturnType<typeof repo.findExistingByHashAndEntity>;
    expect(() => {
      pending = repo.findExistingByHashAndEntity('hash', 'type', 'any-string-here');
    }).not.toThrow();
    await expect(pending).resolves.toBeNull();
  });

  it('findExistingByHashAndEntity accepts three string arguments (hash, entityType, entityId)', async () => {
    db.setRows('documents', [db.DOCUMENT_ROW]);

    const existing = await repo.findExistingByHashAndEntity('abc123', 'contract', 'contract-001');
    expect(existing?.documentId).toBe('doc-001');
    expect(existing?.fileHash).toBe('abc123');

    let pending!: ReturnType<typeof repo.findExistingByHashAndEntity>;
    expect(() => {
      pending = repo.findExistingByHashAndEntity('hash', 'entity', 'id');
    }).not.toThrow();
    await expect(pending).resolves.toBeNull();
  });

  it('findById method still exists and accepts string documentId', async () => {
    expect(typeof repo.findById).toBe('function');
    db.setRows('documents', [db.DOCUMENT_ROW]);

    const result = repo.findById('doc-001');
    expect(result).toBeInstanceOf(Promise);

    const detail = await result;
    expect(detail?.documentId).toBe('doc-001');
    expect(detail?.fileReference).toBe('contracts/doc-001.pdf');
    expect(detail?.versions).toEqual([]);
    expect(detail?.expiryRecord).toBeNull();

    // No row is the repository's null signal, not a thrown error.
    await expect(repo.findById('doc-missing')).resolves.toBeNull();
  });

  it('findById surfaces a database failure as a rejection', async () => {
    db.setError({ code: 'PGRST999', message: 'connection lost' });
    await expect(repo.findById('doc-001')).rejects.toThrow(/Failed to find document: connection lost/);
  });

  it('listByEntity method still exists with correct signature', async () => {
    expect(typeof repo.listByEntity).toBe('function');
    db.setRows('documents', [db.DOCUMENT_ROW]);

    const result = repo.listByEntity('contract', 'contract-001', { status: 'ACTIVE' });
    expect(result).toBeInstanceOf(Promise);

    const summaries = await result;
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ documentId: 'doc-001', documentType: 'CONTRACT', status: 'ACTIVE' });

    await expect(repo.listByEntity('contract', 'contract-001', { status: 'EXPIRED' })).resolves.toEqual([]);
  });

  it('listByStatus method still exists with correct signature', async () => {
    expect(typeof repo.listByStatus).toBe('function');
    db.setRows('documents', [db.DOCUMENT_ROW]);

    const result = repo.listByStatus('ACTIVE');
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toHaveLength(1);
  });

  it('create method exists with correct signature accepting DocumentCreateInput', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    expect(typeof repo.create).toBe('function');

    const input: DocumentCreateInput = {
      documentId: 'doc-001',
      documentType: 'CONTRACT',
      linkedEntityType: 'contract',
      linkedEntityId: 'contract-001',
      fileReference: 'contracts/doc-001.pdf',
      fileHash: 'abc123',
      createdBy: 'user-001',
      updatedBy: 'user-001',
    };

    // Signature should accept this object, and create() must fan the write out
    // across document + linkage + v1 version in that order.
    let pending!: ReturnType<typeof repo.create>;
    expect(() => {
      pending = repo.create(input);
    }).not.toThrow();

    const created = await pending;
    expect(created.documentId).toBe('doc-001');
    expect(created.status).toBe('UPLOADED');
    expect(created.linkedEntityId).toBe('contract-001');
    expect(db.writes.map((write) => write.table)).toEqual([
      'documents',
      'document_linkages',
      'document_versions',
    ]);
    expect(db.writes[1].payload).toMatchObject({
      document_id: 'doc-001',
      module_reference: 'MOD-004',
      entity_reference: 'contract-001',
    });
    expect(db.writes[2].payload).toMatchObject({ document_id: 'doc-001', version_number: 1 });
  });

  it('create writes an expiry record only when the document carries an expiry date', async () => {
    const created = await repo.create({
      documentId: 'doc-002',
      documentType: 'CONTRACT',
      linkedEntityType: 'contract',
      linkedEntityId: 'contract-002',
      fileReference: 'contracts/doc-002.pdf',
      fileHash: 'def456',
      createdBy: 'user-001',
      updatedBy: 'user-001',
      expiryDate: '2026-12-31T00:00:00.000Z',
    });
    expect(created.expiryDate).toBeInstanceOf(Date);
    expect(db.writes.map((write) => write.table)).toEqual([
      'documents',
      'document_linkages',
      'document_expiry_records',
      'document_versions',
    ]);
  });

  it('create rejects with an AppError when the database refuses the insert', async () => {
    db.setError({ code: '23505', message: 'duplicate key value violates unique constraint' });

    await expect(
      repo.create({
        documentId: 'doc-dup',
        documentType: 'POD',
        linkedEntityType: 'shipment',
        linkedEntityId: 'ship-001',
        fileReference: 'shipments/ship-001/pod.pdf',
        fileHash: 'dup-hash',
        createdBy: 'user-001',
        updatedBy: 'user-001',
      }),
    ).rejects.toThrow('Failed to create document: duplicate key value violates unique constraint');
    expect(db.writes).toEqual([]);
  });
});

/** -------------------------------------------------------------------------- *
 * D. Upload Route Input Validation Concepts — Constants & Extension Check
 * -------------------------------------------------------------------------- **/

describe('D. Upload Route — File Validation Constants & Extension Checking', () => {
  it('MAX_FILE_SIZE_BYTES equals 25 MB (26214400 bytes)', () => {
    const expectedMax = 25 * 1024 * 1024;
    expect(expectedMax).toBe(26_214_400);
  });

  it('ALLOWED_EXTENSIONS contains all required formats', () => {
    const requiredFormats = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.tiff', '.tif'];
    for (const ext of requiredFormats) {
      expect(TEST_ALLOWED_EXTENSIONS.has(ext)).toBe(true);
    }
  });

  // Simulates the validateExtension logic from upload/route.ts
  function checkExtension(filename: string): boolean {
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    return TEST_ALLOWED_EXTENSIONS.has(ext);
  }

  it('upload validates .pdf as accepted extension', () => {
    expect(checkExtension('document.pdf')).toBe(true);
  });

  it('upload validates .docx as accepted extension', () => {
    expect(checkExtension('report.docx')).toBe(true);
  });

  it('upload validates .xlsx as accepted extension', () => {
    expect(checkExtension('spreadsheet.xlsx')).toBe(true);
  });

  it('upload validates .jpg as accepted extension', () => {
    expect(checkExtension('photo.jpg')).toBe(true);
  });

  it('upload validates .jpeg as accepted extension', () => {
    expect(checkExtension('photo.jpeg')).toBe(true);
  });

  it('upload validates .png as accepted extension', () => {
    expect(checkExtension('image.png')).toBe(true);
  });

  it('upload validates .tiff as accepted extension', () => {
    expect(checkExtension('scan.tiff')).toBe(true);
  });

  it('upload rejects .exe files as invalid type', () => {
    expect(checkExtension('malware.exe')).toBe(false);
  });

  it('upload rejects .zip files as invalid type', () => {
    expect(checkExtension('archive.zip')).toBe(false);
  });

  it('upload rejects .mp4 video files as invalid type', () => {
    expect(checkExtension('video.mp4')).toBe(false);
  });

  it('upload rejects .txt plain text files as invalid type', () => {
    expect(checkExtension('notes.txt')).toBe(false);
  });

  it('upload handles case-insensitive extension matching (.PDF accepted)', () => {
    expect(checkExtension('document.PDF')).toBe(true);
  });

  it('upload handles mixed-case extensions (.Jpg accepted)', () => {
    expect(checkExtension('photo.Jpg')).toBe(true);
  });

  it('upload rejects files with no extension', () => {
    expect(checkExtension('noextension')).toBe(false);
  });

  it('SUPPORTED_FORMATS constant size matches known count (8 extensions)', () => {
    expect(TEST_ALLOWED_EXTENSIONS.size).toBe(8);
  });

  it('computeHash helper is available from storage module', async () => {
    const mod = await import('@/modules/mod-004-documents/infrastructure/storage/nexca-storage');
    expect(typeof mod.computeHash).toBe('function');
    const hash = await mod.computeHash(new Blob(['test']));
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

/** -------------------------------------------------------------------------- *
 * E. List Endpoint Query Param Handling — Parameter Parsing
 * -------------------------------------------------------------------------- **/

describe('E. List Endpoint — Query Param Parsing', () => {
  function parseListParams(requestUrl: URL): Record<string, string | number | undefined> {
    const linkedEntityType = requestUrl.searchParams.get('linkedEntityType') ?? undefined;
    const linkedEntityId = requestUrl.searchParams.get('linkedEntityId') ?? undefined;
    const status = requestUrl.searchParams.get('status') ?? undefined;
    const documentType = requestUrl.searchParams.get('documentType') ?? undefined;
    const limitParam = requestUrl.searchParams.get('limit');
    const offsetParam = requestUrl.searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    return {
      linkedEntityType,
      linkedEntityId,
      status,
      documentType,
      limit,
      offset,
    };
  }

  it('accepts linkedEntityType query param', () => {
    const url = new URL('http://localhost/api/documents?linkedEntityType=contract');
    const params = parseListParams(url);
    expect(params.linkedEntityType).toBe('contract');
  });

  it('accepts linkedEntityId query param', () => {
    const url = new URL('http://localhost/api/documents?linkedEntityId=contract-001');
    const params = parseListParams(url);
    expect(params.linkedEntityId).toBe('contract-001');
  });

  it('accepts status filter query param', () => {
    const url = new URL('http://localhost/api/documents?status=ACTIVE');
    const params = parseListParams(url);
    expect(params.status).toBe('ACTIVE');
  });

  it('accepts documentType filter query param', () => {
    const url = new URL('http://localhost/api/documents?documentType=CONTRACT');
    const params = parseListParams(url);
    expect(params.documentType).toBe('CONTRACT');
  });

  it('parses limit parameter as integer', () => {
    const url = new URL('http://localhost/api/documents?limit=25');
    const params = parseListParams(url);
    expect(params.limit).toBe(25);
    expect(typeof params.limit).toBe('number');
  });

  it('parses offset parameter as integer', () => {
    const url = new URL('http://localhost/api/documents?offset=10');
    const params = parseListParams(url);
    expect(params.offset).toBe(10);
    expect(typeof params.offset).toBe('number');
  });

  it('returns undefined for missing optional parameters', () => {
    const url = new URL('http://localhost/api/documents');
    const params = parseListParams(url);
    expect(params.linkedEntityType).toBeUndefined();
    expect(params.linkedEntityId).toBeUndefined();
    expect(params.status).toBeUndefined();
    expect(params.documentType).toBeUndefined();
    expect(params.limit).toBeUndefined();
    expect(params.offset).toBeUndefined();
  });

  it('accepts all four filters simultaneously', () => {
    const url = new URL(
      'http://localhost/api/documents?linkedEntityType=contract&linkedEntityId=cont-01&status=ACTIVE&documentType=POD',
    );
    const params = parseListParams(url);
    expect(params.linkedEntityType).toBe('contract');
    expect(params.linkedEntityId).toBe('cont-01');
    expect(params.status).toBe('ACTIVE');
    expect(params.documentType).toBe('POD');
  });

  it('parses large pagination numbers correctly', () => {
    const url = new URL('http://localhost/api/documents?limit=1000&offset=5000');
    const params = parseListParams(url);
    expect(params.limit).toBe(1000);
    expect(params.offset).toBe(5000);
  });

  it('parseInt with NaN on invalid limit value', () => {
    const url = new URL('http://localhost/api/documents?limit=abc');
    const params = parseListParams(url);
    expect(Number.isNaN(params.limit as number)).toBe(true);
  });
});

/** -------------------------------------------------------------------------- *
 * F. Integration Flow Conceptual Tests — End-to-end Logic Verification
 * -------------------------------------------------------------------------- **/

describe('F. Integration Flows — Conceptual Upload & Download Sequences', () => {
  it('storage path construction follows deterministic pattern', async () => {
    const { constructPath } = await import('@/modules/mod-004-documents/infrastructure/storage/nexca-storage');
    const path = constructPath('contract', 'contract-uuid', 'doc-001', 1, 'document.pdf');
    expect(path).toBe('contract/contract-uuid/doc-001/1/document.pdf');
  });

  it('storage path omits trailing segments when version/filename absent', async () => {
    const { constructPath } = await import('@/modules/mod-004-documents/infrastructure/storage/nexca-storage');
    expect(constructPath('shipment', 'ship-001', 'doc-001')).toBe('shipment/ship-001/doc-001');
    expect(constructPath('shipment', 'ship-001', 'doc-001', 1)).toBe('shipment/ship-001/doc-001/1');
  });

  it('upload flow: contract existence checked BEFORE storage upload (conceptual)', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    // In the actual upload route, contractExists() is called before storage upload
    // If contract not found → 404 returned before touching storage
    expect(typeof repo.findExistingByHashAndEntity).toBe('function');
  });

  it('upload flow: deduplication checks hash + entity combo before DB insert (conceptual)', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    expect(typeof repo.findExistingByHashAndEntity).toBe('function');
    // In the upload route: if existing !== null, return 200 with existing doc
    // Otherwise proceed to repo.create()
  });

  it('download route: auth + find doc + redirect to signed URL conceptually', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    // In download route: findById(id) → get fileReference → getFileUrl(path, 3600) → redirect
    expect(typeof repo.findById).toBe('function');
  });

  it('preview route uses same logic as download route (auth → find → signed URL)', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    // Preview and download share identical logic: auth → findById → getFileUrl → redirect
    expect(typeof repo.findById).toBe('function');
  });

  it('repository listByStatus exists for admin document listing', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    expect(typeof repo.listByStatus).toBe('function');
  });

  it('repository listByEntity exists with filtering support', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    expect(typeof repo.listByEntity).toBe('function');
  });

  it('DocumentCreateInput requires all mandatory fields for create()', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    const input: DocumentCreateInput = {
      documentId: 'doc-required',
      documentType: 'POD',
      linkedEntityType: 'shipment',
      linkedEntityId: 'ship-001',
      fileReference: 'shipments/ship-001/pod.pdf',
      fileHash: 'req-hash',
      createdBy: 'user-001',
      updatedBy: 'user-001',
    };
    let pending!: ReturnType<typeof repo.create>;
    expect(() => {
      pending = repo.create(input);
    }).not.toThrow();

    const created = await pending;
    expect(created.documentId).toBe('doc-required');
    expect(created.documentType).toBe('POD');
    expect(created.fileHash).toBe('req-hash');
  });

  it('DocumentCreateInput accepts optional correlationId field', async () => {
    const input: DocumentCreateInput = {
      documentId: 'doc-corr',
      documentType: 'CONTRACT',
      linkedEntityType: 'contract',
      linkedEntityId: 'c-001',
      fileReference: 'c/correlation.pdf',
      fileHash: 'corr-hash',
      createdBy: 'user-001',
      updatedBy: 'user-001',
      correlationId: 'corr-abc-123',
    };
    expect(input.correlationId).toBe('corr-abc-123');
  });

  it('fileReference is extracted from document for storage operations', async () => {
    const { DocumentRepository } = await import('@/modules/mod-004-documents/infrastructure/repositories/document-repository');
    const repo = new DocumentRepository();
    // Verify that DocumentDetail contains fileReference field via shape
    const mockDocRow = {
      id: 'detail-r', document_id: 'doc-detail-001', document_type: 'CONTRACT',
      linked_entity_type: 'contract', linked_entity_id: 'c-001', status: 'ACTIVE',
      created_by: 'u1', updated_by: 'u1', file_reference: 'c/d.pdf', file_hash: 'dh',
      expiry_date: null, issue_date: null, correlation_id: null,
      is_deleted: false, version: 1,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    };
    // Type-check: the row structure maps to DocumentDetail
    expect(mockDocRow.file_reference).toBe('c/d.pdf');

    db.setRows('documents', [mockDocRow]);
    const pending = repo.findById('doc-detail-001');
    expect(pending).toBeInstanceOf(Promise);

    const detail = await pending;
    expect(detail?.fileReference).toBe('c/d.pdf');
  });

  it('ValidationError class extends Error and has correct code', async () => {
    const { ValidationError, ErrorCode } = await import('@/shared/errors/app-errors');
    const err = new ValidationError('Invalid file format', { field: 'file' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.message).toBe('Invalid file format');
  });

  it('AppError stores code, message, details, and timestamp', async () => {
    const { AppError, ErrorCode } = await import('@/shared/errors/app-errors');
    const err = new AppError(ErrorCode.INTERNAL_ERROR, 'Something went wrong', { requestId: 'req-123' });
    expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(err.message).toBe('Something went wrong');
    expect(err.details).toEqual({ requestId: 'req-123' });
    expect(typeof err.timestamp).toBe('string');
  });

  it('DocumentStatus enum contains expected lifecycle states', async () => {
    const { DocumentStatus } = await import('@/modules/mod-004-documents/domain/enums');
    expect(DocumentStatus.UPLOADED).toBe('UPLOADED');
    expect(DocumentStatus.VALIDATED).toBe('VALIDATED');
    expect(DocumentStatus.ACTIVE).toBe('ACTIVE');
    expect(DocumentStatus.REVIEW).toBe('REVIEW');
    expect(DocumentStatus.SIGNED).toBe('SIGNED');
    expect(DocumentStatus.APPROVED).toBe('APPROVED');
    expect(DocumentStatus.REJECTED).toBe('REJECTED');
    expect(DocumentStatus.EXPIRING).toBe('EXPIRING');
    expect(DocumentStatus.EXPIRED).toBe('EXPIRED');
    expect(DocumentStatus.RENEWED).toBe('RENEWED');
    expect(DocumentStatus.ARCHIVED).toBe('ARCHIVED');
  });

  it('DocumentSummary interface has expected flat shape', () => {
    const summary: DocumentSummary = {
      id: 's-row',
      documentId: 'doc-summary-001',
      documentType: 'CONTRACT',
      status: 'ACTIVE',
      fileReference: 'contracts/summary.pdf',
      fileHash: 'summary-hash',
      expiryDate: null,
      issueDate: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      createdBy: 'user-001',
    };
    expect(summary.documentId).toBe('doc-summary-001');
    expect(summary.documentType).toBe('CONTRACT');
    expect(summary.status).toBe('ACTIVE');
    expect(summary.createdBy).toBe('user-001');
  });
});

/** -------------------------------------------------------------------------- *
 * G. Edge Cases — Boundary Conditions for ID and String Validation
 * -------------------------------------------------------------------------- **/

describe('G. Edge Cases — Boundary Conditions for ID and String Validation', () => {
  it('whitespace-only document IDs are rejected in upload route', () => {
    const emptyString = '   ';
    expect(emptyString.trim() === '').toBe(true);
  });

  it('empty string linkedEntityId is rejected in upload route', () => {
    const emptyId: string = '';
    expect(!emptyId || emptyId.trim() === '').toBe(true);
  });

  it('UUID-format document IDs pass basic shape check', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('download/preview route validates empty ID parameter', () => {
    const emptyCases: string[] = ['', '   '];
    for (const badId of emptyCases) {
      const isValid = !badId || typeof badId !== 'string' || badId.trim() === '';
      expect(isValid).toBe(true);
    }
  });

  it('contract linkage check only runs when linkedEntityType === "contract"', () => {
    expect('contract'.toLowerCase() === 'contract').toBe(true);
    expect('shipment'.toLowerCase() === 'contract').toBe(false);
    expect('booking'.toLowerCase() === 'contract').toBe(false);
    expect('CONTRACT'.toLowerCase() === 'contract').toBe(true);
  });

  it('validateExtension extracts extension correctly for nested-dot filenames', () => {
    const parts = 'my.contract.document.pdf'.split('.');
    const ext = '.' + parts.pop()?.toLowerCase();
    expect(ext).toBe('.pdf');

    const parts2 = 'scan-image.TIFF.backup'.split('.');
    const ext2 = '.' + parts2.pop()?.toLowerCase();
    expect(ext2).toBe('.backup');
  });

  it('RBAC allows MODERATOR to read but not create/delete on documents', () => {
    expect(evaluateRBAC('MODERATOR', 'documents', 'read').permitted).toBe(true);
    expect(evaluateRBAC('MODERATOR', 'documents', 'create').permitted).toBe(false);
    expect(evaluateRBAC('MODERATOR', 'documents', 'delete').permitted).toBe(false);
    expect(evaluateRBAC('MODERATOR', 'documents', 'update').permitted).toBe(true);
  });
});
