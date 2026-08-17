// NexCargo API — Documents (/api/documents)
// Module: MOD-004 | Status: Scaffold per PROMPT 1 + PROMPT 6

import { NextResponse } from 'next/server';

/** GET /api/documents — List documents */
export async function GET() {
  return NextResponse.json({
    success: false,
    data: undefined,
    error: { code: 'ERR_4002', message: 'Documents API not yet implemented' },
    meta: { timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() },
  });
}
