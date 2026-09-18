// NexCargo MOD-004 — Document Upload Route (C7-004: Document → Contract Auto-Association)
// POST /api/documents/upload
// Accepts multipart form data with file + metadata fields.
// Flow: auth → validate → hash → contract authorization → dedup → storage upload → insert document + linkage
//
// Dedup happens BEFORE storage upload to avoid orphaned storage objects when a duplicate is detected.
//
// Contract authorization: when linkedEntityType === 'contract', verifies the authenticated caller
// is authorized to access that contract through the contracts→bookings chain.
//
// Storage/DB consistency: if DB persistence fails after storage succeeds, orphaned files are cleaned up.
//
// Concurrency protection: partial unique index on (file_hash, linked_entity_type, linked_entity_id)
// WHERE is_deleted = false ensures atomic dedup at the database level.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { DocumentRepository } from '@/modules/mod-004-documents/infrastructure/repositories/document-repository';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { computeHash, uploadFile as nexcaUploadFile, ensureBucketExists, deleteFile } from '@/modules/mod-004-documents/infrastructure/storage/nexca-storage';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { ErrorCode, AppError, ValidationError } from '@/shared/errors/app-errors';
import { createAdminClient } from '@/infrastructure/database/supabase';

/** Maximum file size: 25 MB */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** Supported file extensions (lowercase, with dot) */
const SUPPORTED_FORMATS = new Set(['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.tiff', '.tif']);

/**
 * Validate file extension against allowed types.
 */
function validateExtension(filename: string): void {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  if (!ext || !SUPPORTED_FORMATS.has(ext)) {
    throw new ValidationError(
      `Unsupported file type: ${ext}. Allowed types: PDF, DOCX, XLSX, JPG, JPEG, PNG, TIFF`,
    );
  }
}

/**
 * Verify the authenticated caller is authorized to associate documents with the given contract.
 * Authorization path: documents.linkedEntityId (= contract id) → contracts.booking_id → bookings.shipper_id / bookings.transporter_id
 * The caller must be either the shipper or transporter of the booking associated with the contract.
 * ADMIN/SUPER_ADMIN bypass this check entirely.
 * 
 * Returns the booking record for downstream use (linking document to both contract AND booking).
 */
async function verifyContractAuthorization(
  contractId: string,
  userId: string,
  userRole: string | null,
): Promise<{ bookingId: string; shipperId: string; transporterId: string }> {
  // ADMIN/SUPER_ADMIN have full platform-wide access
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    const adminClient = createAdminClient();
    const result = await adminClient
      .schema('logistics_schema')
      .from('contracts')
      .select('booking_id')
      .eq('id', contractId)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Contract lookup failed during authorization: ${result.error.message}`,
        { contractId },
      );
    }
    if (!result.data) {
      throw new AppError(ErrorCode.NOT_FOUND, `Contract not found: ${contractId}`, { contractId });
    }

    const bookingResult = await adminClient
      .schema('logistics_schema')
      .from('bookings')
      .select('id, shipper_id, transporter_id')
      .eq('id', (result.data as { booking_id: string }).booking_id)
      .eq('is_deleted', false)
      .single();

    if (bookingResult.error) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Booking lookup failed during contract authorization: ${bookingResult.error.message}`,
        { contractId, bookingId: (result.data as { booking_id: string }).booking_id },
      );
    }
    if (!bookingResult.data) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `Booking for contract not found or deleted: ${contractId}`,
        { contractId },
      );
    }

    const bd = bookingResult.data as { id: string; shipper_id: string; transporter_id: string };
    return { bookingId: bd.id, shipperId: bd.shipper_id, transporterId: bd.transporter_id };
  }

  // For SHIPPER/TRANSPORTER: verify they own the booking
  const adminClient = createAdminClient();

  // Step 1: Get contract's booking_id
  const contractCheck = await adminClient
    .schema('logistics_schema')
    .from('contracts')
    .select('booking_id')
    .eq('id', contractId)
    .eq('is_deleted', false)
    .single();

  if (contractCheck.error) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      `Contract lookup failed: ${contractCheck.error.message}`,
      { contractId },
    );
  }

  if (!contractCheck.data) {
    throw new AppError(ErrorCode.NOT_FOUND, `Contract not found or deleted: ${contractId}`, { contractId });
  }

  // Step 2: Check if user is shipper or transporter of that booking
  const bookingCheck = await adminClient
    .schema('logistics_schema')
    .from('bookings')
    .select('id, shipper_id, transporter_id')
    .eq('id', (contractCheck.data as { booking_id: string }).booking_id)
    .eq('is_deleted', false)
    .single();

  if (bookingCheck.error) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      `Booking lookup failed during contract authorization: ${bookingCheck.error.message}`,
      { contractId },
    );
  }

  if (!bookingCheck.data) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Booking for contract not found or deleted: ${contractId}`,
      { contractId },
    );
  }

  const booking = bookingCheck.data as { id: string; shipper_id: string; transporter_id: string };

  if (userRole === 'SHIPPER' && booking.shipper_id === userId) {
    return { bookingId: booking.id, shipperId: booking.shipper_id, transporterId: booking.transporter_id };
  }

  if (userRole === 'TRANSPORTER' && booking.transporter_id === userId) {
    return { bookingId: booking.id, shipperId: booking.shipper_id, transporterId: booking.transporter_id };
  }

  throw new AppError(
    ErrorCode.FORBIDDEN,
    `You do not have authorization to associate documents with this contract. Contract belongs to booking owned by shipper/transporter, but you are neither.`,
    { contractId, userId, role: userRole },
  );
}

/**
 * POST /api/documents/upload
 * 
 * Expects multipart/form-data with fields:
 * - file: the binary file to upload
 * - documentType: classification (e.g. "BILL_OF_LADING", "CERTIFICATE_OF_ORIGIN")
 * - linkedEntityType: entity this doc links to (e.g. "contract", "booking", "shipment")
 * - linkedEntityId: UUID of the linked entity
 * - issueDate: optional ISO 8601 date
 * - expiryDate: optional ISO 8601 date
 * 
 * Returns 201 with full document object including linkages.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  // Track the storage path for potential cleanup on failure
  let storagePath: string | null = null;

  try {
    // ── Auth guard ───────────────────────────────────────────────────────
    const authCtx = await assertApiAuthorization(request, 'documents', 'create');
    const userId = authCtx.userId;

    // ── Parse multipart form data ────────────────────────────────────────
    let file: File | null = null;
    let documentType: string | null = null;
    let linkedEntityType: string | null = null;
    let linkedEntityId: string | null = null;
    let issueDate: string | null = null;
    let expiryDate: string | null = null;

    try {
      const formData = await request.formData();
      file = formData.get('file') as File | null;
      documentType = formData.get('documentType') as string | null;
      linkedEntityType = formData.get('linkedEntityType') as string | null;
      linkedEntityId = formData.get('linkedEntityId') as string | null;
      issueDate = formData.get('issueDate') as string | null;
      expiryDate = formData.get('expiryDate') as string | null;
    } catch {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Request must be multipart/form-data', code: 'ERR_1001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // ── Validate required fields ─────────────────────────────────────────
    if (!file) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'No file provided', code: 'ERR_1001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!documentType || typeof documentType !== 'string') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'documentType is required and must be a string', code: 'ERR_1001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!linkedEntityType || typeof linkedEntityType !== 'string') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'linkedEntityType is required and must be a string', code: 'ERR_1001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!linkedEntityId || typeof linkedEntityId !== 'string' || linkedEntityId.trim() === '') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'linkedEntityId is required and must be a non-empty string', code: 'ERR_1001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // ── Validate file extension ──────────────────────────────────────────
    try {
      validateExtension(file.name);
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json(
          wrapInContractFramework({ error: e.message, code: e.code }, correlationId),
          { status: 400, headers: { 'x-correlation-id': correlationId } },
        );
      }
      throw e;
    }

    // ── Validate file size ───────────────────────────────────────────────
    if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        wrapInContractFramework(
          { error: `File size exceeds the 25 MB limit`, code: 'ERR_1001' },
          correlationId,
        ),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // ── Compute SHA-256 hash ─────────────────────────────────────────────
    const fileHash = await computeHash(file);

    // ── Contract authorization (before anything else) ────────────────────
    if (linkedEntityType.toLowerCase() === 'contract') {
      await verifyContractAuthorization(
        linkedEntityId.trim(),
        userId,
        authCtx.role,
      );
    }

    // ── Deduplication: check for existing document with same hash + entity ──
    // BEFORE storage upload to avoid orphaned files in dedup cases.
    const repo = new DocumentRepository();
    const existing = await repo.findExistingByHashAndEntity(
      fileHash,
      linkedEntityType.trim(),
      linkedEntityId.trim(),
    );

    if (existing) {
      // Return existing document instead of creating duplicate — no storage used
      return NextResponse.json(
        wrapInContractFramework(existing, correlationId),
        { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
      );
    }

    // ── Ensure storage bucket exists ─────────────────────────────────────
    await ensureBucketExists();

    // ── Upload file to Supabase Storage ──────────────────────────────────
    const genDocId = crypto.randomUUID();
    let uploadResult: { path: string; hash: string };
    try {
      uploadResult = await nexcaUploadFile(file, linkedEntityType.trim(), genDocId);
    } catch (e) {
      if (e instanceof Error) {
        return NextResponse.json(
          wrapInContractFramework(
            { error: `Storage upload failed: ${e.message}`, code: 'ERR_1000' },
            correlationId,
          ),
          { status: 502, headers: { 'x-correlation-id': correlationId } },
        );
      }
      throw e;
    }
    storagePath = uploadResult.path;

    // ── Create document record in DB (with concurrent-duplicate handling) ──
    const cleanLinkedEntityId = linkedEntityId.trim();
    const createResult = await repo.createWithDuplicateHandling({
      documentId: genDocId,
      documentType: documentType.trim(),
      linkedEntityType: linkedEntityType.trim(),
      linkedEntityId: cleanLinkedEntityId,
      fileReference: uploadResult.path,
      fileHash: uploadResult.hash,
      expiryDate: expiryDate ? expiryDate.trim() : undefined,
      issueDate: issueDate ? issueDate.trim() : undefined,
      createdBy: userId,
      updatedBy: userId,
      correlationId: correlationId,
    });

    // ── Handle race condition: if we lost the race, clean up our storage object ──
    if (!createResult.isNew && storagePath) {
      try {
        await deleteFile(storagePath);
      } catch {
        // Best-effort cleanup of orphaned storage object from lost race
      }
    }

    return NextResponse.json(
      wrapInContractFramework(createResult.document, correlationId),
      { status: 201, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
    );
  } catch (error) {
    // ── Storage cleanup on DB failure ────────────────────────────────────
    // If storage succeeded but DB insert/linkage failed, clean up the orphaned file.
    if (storagePath) {
      try {
        await deleteFile(storagePath);
      } catch {
        // Best-effort cleanup: log but don't mask original error
      }
    }

    // Handle specific error types
    if (error instanceof ValidationError) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: error.code }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof AppError) {
      if (error.details?.code) {
        return NextResponse.json(
          wrapInContractFramework({ error: error.message, code: error.details.code }, correlationId),
          { status: 500, headers: { 'x-correlation-id': correlationId } },
        );
      }
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: error.code }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: 'ERR_1004' }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized: valid session required', code: 'ERR_1003' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework({ error: 'Internal server error', code: 'ERR_1000' }, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
