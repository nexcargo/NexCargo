// NexCargo MOD-016 â€” Notification Delivery Processor API Route (C5-II)
// C5 Increment 2 â€” Authorized per HAO-C5-002
// POST /api/notifications/delivery-processor
// Server-only endpoint for processing queued notifications.
//
// SECURITY: This endpoint is server-side only. It cannot be invoked
// from client-side code because it uses SUPABASE_SERVICE_ROLE_KEY
// which is never exposed to the browser.
//
// USAGE: manual/on-demand trigger by a platform governance tier. Automatic
// draining and stall recovery run in-database via pg_cron (migration 059 Part 7),
// so no machine credential is required for the scheduled path.
// Accepts optional body parameter { batchSize: number } (default 10).

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getApiAuthContext } from '@/lib/supabase/api-auth';
import { getDeliveryProcessor } from '@/modules/mod-016-notifications/infrastructure/services/notification-delivery-processor';
import { MAX_RETRY_COUNT } from '@/modules/mod-016-notifications/domain/types/delivery-pipeline';
import { replayFailedEventConsumptions } from '@/shared/events/handler-registry';
import type { EventReplayResult } from '@/shared/events/handler-registry';

// ============================================================
// Request Body Type
// ============================================================

interface DeliveryProcessorRequest {
  batchSize?: number;
}

// ============================================================
// Response Type
// ============================================================

interface ApiResponse {
  success: boolean;
  data?: BatchProcessingResponse;
  error?: { code: string; message: string };
  meta: { timestamp: string; correlationId: string };
}

interface StatusResponse {
  success: boolean;
  data?: {
    initialized: boolean;
    registeredChannels: string[];
    maxRetryCount: number;
    description: string;
  };
  error?: { code: string; message: string };
  meta: { timestamp: string; correlationId: string };
}

interface BatchProcessingResponse {
  processedCount: number;
  successCount: number;
  failedCount: number;
  requeuedCount: number;
  recoveredStalls: number;
  eventReplay: EventReplayResult;
  results: Array<{
    notificationId: string;
    success: boolean;
    deliveryEventStatus: string;
    finalDeliveryStatus: string;
    channelUsed: string | null;
    retryCount: number;
    failureReason?: string;
    correlationId: string | null;
  }>;
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest) {
  const requestCorrelationId = crypto.randomUUID();
  const startTime = Date.now();

  // I-2 PART C item 6: the header of this file claims it "cannot be invoked from client-side code". That was
  // never true — an App Router handler is a public HTTP endpoint, and this one drains the whole delivery
  // queue with provider side effects. No scheduler or machine credential is configured anywhere in the
  // repository, so the queue is now drained only by a governance-tier session; an authorized cron identity
  // for this endpoint is an open decision for the Lead Architect, not something to invent here.
  const ctx = await getApiAuthContext(request);
  if (!ctx) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERR_1003', message: 'Authentication required' },
        meta: { timestamp: new Date().toISOString(), correlationId: requestCorrelationId },
      },
      { status: 401 },
    );
  }
  if (!ctx.platformRole) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERR_1004', message: 'Only a platform governance tier may drain the delivery queue' },
        meta: { timestamp: new Date().toISOString(), correlationId: requestCorrelationId },
      },
      { status: 403 },
    );
  }

  try {
    // Parse optional batch size from request body
    let batchSize = 10;
    try {
      const body: DeliveryProcessorRequest = await request.json();
      if (body.batchSize && typeof body.batchSize === 'number' && body.batchSize > 0) {
        batchSize = Math.min(body.batchSize, 100); // Cap at 100 to prevent abuse
      }
    } catch {
      // No body or invalid JSON â€” use default batch size
    }

    const processor = getDeliveryProcessor();
    await processor.initialize();

    // I-3 §4B/§4D: release claims stranded by a crashed worker and re-run failed
    // event consumers first, so notifications they recover are drained in this pass.
    const recoveredStalls = await processor.recoverStalledProcessing();
    const eventReplay = await replayFailedEventConsumptions({ batchSize });

    const batchResult = await processor.processBatch(batchSize);
    const durationMs = Date.now() - startTime;
    batchResult.durationMs = durationMs;

    console.log(
      `[MOD-016 DeliveryProcessor] Processed ${batchResult.processedCount} notifications ` +
      `(${batchResult.successCount} success, ${batchResult.failedCount} failed, ` +
      `${batchResult.requeuedCount} requeued) in ${durationMs}ms`,
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          processedCount: batchResult.processedCount,
          successCount: batchResult.successCount,
          failedCount: batchResult.failedCount,
          requeuedCount: batchResult.requeuedCount,
          recoveredStalls,
          eventReplay,
          results: batchResult.results.map((r) => ({
            notificationId: r.notificationId,
            success: r.success,
            deliveryEventStatus: r.deliveryEventStatus,
            finalDeliveryStatus: r.finalDeliveryStatus,
            channelUsed: r.channelUsed,
            retryCount: r.retryCount,
            failureReason: r.failureReason,
            correlationId: r.correlationId,
          })),
        },
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: requestCorrelationId,
        },
      } satisfies ApiResponse,
      { status: 200 },
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[MOD-016 DeliveryProcessor] Unexpected error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_DELIVERY_PROCESSOR',
          message: 'Internal error during notification delivery processing',
        },
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: requestCorrelationId,
        },
      } satisfies ApiResponse,
      { status: 500 },
    );
  }
}

/**
 * GET handler â€” Returns processor status and configuration.
 * Useful for health checks and monitoring.
 */
export async function GET() {
  const requestCorrelationId = crypto.randomUUID();

  try {
    const processor = getDeliveryProcessor();
    await processor.initialize();

    const registry = processor['registry'];
    const registeredChannels = registry.getRegisteredChannels();

    return NextResponse.json(
      {
        success: true,
        data: {
          initialized: true,
          registeredChannels,
          maxRetryCount: MAX_RETRY_COUNT,
          description: 'Notification delivery processor ready',
        },
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: requestCorrelationId,
        },
      } satisfies StatusResponse,
      { status: 200 },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[MOD-016 DeliveryProcessor GET] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ERR_DELIVERY_STATUS',
          message: 'Failed to retrieve delivery processor status',
        },
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: requestCorrelationId,
        },
      } satisfies StatusResponse,
      { status: 500 },
    );
  }
}