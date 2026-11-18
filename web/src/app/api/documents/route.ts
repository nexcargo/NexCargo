// NexCargo MOD-004 — Documents List Route
// GET /api/documents
// Returns paginated document list with optional filtering by entity, status, and type.

import { NextRequest, NextResponse } from 'next/server';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { DocumentRepository, type DocumentSummary } from '@/modules/mod-004-documents/infrastructure/repositories/document-repository';
import { verifyDocumentAccess } from '@/modules/mod-004-documents/infrastructure/authorization/document-access';

/** GET /api/documents — List documents with filtering and pagination */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const authCtx = await assertApiAuthorization(request, 'documents', 'read');

    const url = new URL(request.url);
    const linkedEntityType = url.searchParams.get('linkedEntityType') ?? url.searchParams.get('entityType');
    const linkedEntityId = url.searchParams.get('linkedEntityId') ?? url.searchParams.get('entityId');
    const status = url.searchParams.get('status');
    const documentType = url.searchParams.get('documentType');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const repo = new DocumentRepository();

    let documents: DocumentSummary[];
    let total = 0;

    if (linkedEntityType && linkedEntityId) {
      const filters: { status?: string; documentType?: string } = {};
      if (status) filters.status = status;
      if (documentType) filters.documentType = documentType;

      documents = await repo.listByEntity(
        linkedEntityType,
        linkedEntityId,
        Object.keys(filters).length > 0 ? filters : undefined,
      );
      total = documents.length;
    } else if (status) {
      documents = await repo.listByStatus(status);
      total = documents.length;
    } else {
      documents = [];
    }

    // ── Enforce per-document ownership/party access ────────────────────
    // The repository reads through the service-role client (RLS bypassed), so each summary
    // must pass the same access gate used by the detail, download and preview routes before
    // it is exposed. Inaccessible documents are omitted, not reported.
    const accessFlags = await Promise.all(
      documents.map(summary =>
        verifyDocumentAccess(
          {
            linked_entity_type: summary.linkedEntityType,
            linked_entity_id: summary.linkedEntityId,
            created_by: summary.createdBy,
          },
          authCtx.userId,
          authCtx.role,
        ),
      ),
    );
    documents = documents.filter((_, index) => accessFlags[index]);
    total = documents.length;

    // Apply pagination at the application layer
    if (offset !== undefined) {
      documents = documents.slice(offset);
    }
    if (limit !== undefined) {
      documents = documents.slice(0, limit);
    }

    return NextResponse.json(
      wrapInContractFramework({ documents, total }, correlationId),
      { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
    );
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
    return NextResponse.json(
      wrapInContractFramework({ error: 'Internal server error', code: 'ERR_1000' }, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
