// NexCargo API Routes — Root endpoint per PROMPT 6
// All API routes follow standard response format: { success, data, error, meta }

import { NextResponse } from 'next/server';

/** GET /api — Health check endpoint */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      service: 'NexCargo Platform API',
      version: '1.0.0',
      status: 'operational',
    },
    error: undefined,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
    },
  });
}
