// NexCargo API — Analytics (/api/data)
// Module: MOD-012 | Status: Scaffold per PROMPT 1 + PROMPT 6
// Constraint: Does NOT compute KPIs at runtime per MOD-012

import { NextResponse } from 'next/server';

/** GET /api/data — Retrieve analytics data */
export async function GET() {
  return NextResponse.json({
    success: false,
    data: undefined,
    error: { code: 'ERR_4002', message: 'Analytics API not yet implemented' },
    meta: { timestamp: new Date().toISOString(), correlationId: crypto.randomUUID() },
  });
}
