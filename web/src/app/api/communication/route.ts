// NexCargo API — Communication (/api/communication)
// Module: MOD-016 | Status: Scaffold per PROMPT 1 + PROMPT 6

import { NextResponse } from 'next/server';

/** GET /api/communication — List communications */
export async function GET() {
  return NextResponse.json({
    success: false,
    data: undefined,
    error: { code: 'ERR_4002', message: 'Communication API not yet implemented' },
    meta: { timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() },
  });
}
