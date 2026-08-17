// NexCargo API — Financial (/api/financial)
// Module: MOD-005, MOD-013 | Status: Scaffold per PROMPT 1 + PROMPT 6
// Constraint: No client-side financial computation per ESS-006

import { NextResponse } from 'next/server';

/** GET /api/financial — List financial operations */
export async function GET() {
  return NextResponse.json({
    success: false,
    data: undefined,
    error: { code: 'ERR_4002', message: 'Financial API not yet implemented' },
    meta: { timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() },
  });
}
