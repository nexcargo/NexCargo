// NexCargo MOD-016 â€” Notification Delivery Processor API Route (C5-II)
// C5 Increment 2 â€” Authorized per HAO-C5-002
// POST /api/notifications/delivery-processor
// Server-only endpoint for processing queued notifications.
//
// SECURITY: This endpoint is server-side only. It cannot be invoked
// from client-side code because it uses SUPABASE_SERVICE_ROLE_KEY
// which is never exposed to the browser.
//
// USAGE: Invoke via cron job, scheduled task, or manual trigger.
// Accepts optional body parameter { batchSize: number } (default 10).

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDeliveryProcessor } from '@/modules/mod-016-notifications/infrastructure/services/notification-delivery-processor';
import { DeliveryStatus } from '@/modules/mod-016-notifications/domain/enums';

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

    // Get the delivery processor singleton and initialize it
    const processor = getDeliveryProcessor();
    await processor.initialize();

    // Process the batch
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
          maxRetryCount: 3,
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