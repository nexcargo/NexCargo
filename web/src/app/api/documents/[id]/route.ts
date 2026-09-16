import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { DocumentRepository } from '@/modules/mod-004-documents/infrastructure/repositories/document-repository';

/**
 * GET /api/documents/[id]
 * 
 * Returns full document detail including versions, linkages, approvals,
 * OCR results, digital signatures, and expiry records.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately. No x-user-role fallback.
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

    return NextResponse.json(
      wrapInContractFramework(document, correlationId),
      { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(wrapInContractFramework({ error: error.message, code: error.code }, correlationId), {
        status: 400,
        headers: { 'x-correlation-id': correlationId },
      });
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(wrapInContractFramework({ error: 'Unauthorized: valid session required', code: 'ERR_1003' }, correlationId), {
        status: 401,
        headers: { 'x-correlation-id': correlationId },
      });
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(wrapInContractFramework({ error: error.message, code: 'ERR_1004' }, correlationId), {
        status: 403,
        headers: { 'x-correlation-id': correlationId },
      });
    }
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
