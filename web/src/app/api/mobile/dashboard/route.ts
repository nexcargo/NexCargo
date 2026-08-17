// NexCargo API — Mobile Dashboard (/api/mobile/dashboard)
// Module: MOD-007, MOD-008 | Status: Scaffold per PROMPT 1
// Mobile-optimized aggregated API routes per PROMPT 1

import { NextResponse } from 'next/server';

/** GET /api/mobile/dashboard — Aggregated dashboard data for mobile */
export async function GET() {
  return NextResponse.json({
    success: false,
    data: undefined,
    error: { code: 'ERR_4002', message: 'Mobile dashboard API not yet implemented' },
    meta: { timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() },
  });
}
