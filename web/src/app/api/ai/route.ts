// NexCargo API — AI (/api/ai)
// Module: MOD-006, MOD-018 | Status: Scaffold per PROMPT 1 + PROMPT 6
// Constraint: AI outputs advisory only per ESS-003

import { NextResponse } from 'next/server';

/** GET /api/ai — Get AI recommendations */
export async function GET() {
  return NextResponse.json({
    success: false,
    data: undefined,
    error: { code: 'ERR_4002', message: 'AI API not yet implemented' },
    meta: { timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() },
  });
}
