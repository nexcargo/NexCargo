// NexCargo MOD-004 — Document Download Route
// GET /api/documents/[id]/download
// Authenticates the request, resolves the document record, verifies caller access to the document,
// and redirects to the signed storage URL.

import { NextRequest, NextResponse } from 'next/server';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { DocumentRepository } from '@/modules/mod-004-documents/infrastructure/repositories/document-repository';
import { getFileUrl } from '@/modules/mod-004-documents/infrastructure/storage/nexca-storage';
import { verifyDocumentAccess } from '@/modules/mod-004-documents/infrastructure/authorization/document-access';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/documents/[id]/download — Redirect to signed storage URL for download */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    await assertApiAuthorization(request, 'documents', 'read');

    const { id } = await params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Document ID is required', code: 'ERR_4002' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const repo = new DocumentRepository();
    const document = await repo.findById(id.trim());

    if (!document) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Document not found', code: 'ERR_4004' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // ── Verify specific document access ────────────────────────────────
    const authCtx = await assertApiAuthorization(request, 'documents', 'read');
    const hasAccess = await verifyDocumentAccess(
      {
        linked_entity_type: document.linkedEntityType,
        linked_entity_id: document.linkedEntityId,
        created_by: document.createdBy,
      },
      authCtx.userId,
      authCtx.role,
    );

    if (!hasAccess) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'You do not have permission to access this document', code: 'ERR_1004' }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const storagePath = document.fileReference;
    if (!storagePath) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'No storage path available for this document', code: 'ERR_4004' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const signedUrl = await getFileUrl(storagePath, 3600);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
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
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: 'ERR_4004' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework({ error: 'Internal server error', code: 'ERR_1000' }, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
