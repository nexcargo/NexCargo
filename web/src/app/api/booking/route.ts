// NexCargo API — Booking (/api/booking)
// Module: MOD-002 | Status: Scaffold per PROMPT 1 + PROMPT 6

import { NextResponse } from 'next/server';

/** GET /api/booking — List bookings/contracts */
export async function GET() {
  return NextResponse.json({
    success: false,
    data: undefined,
    error: { code: 'ERR_4002', message: 'Booking API not yet implemented' },
    meta: { timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() },
  });
}
