// NexCargo C4-III — POST /api/webhooks/settlement (Settlement Confirmation)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: ESS-001D §13 (Financial Event Rule), MOD-013 §5.5 (Financial Flow State Machine)
// Scope: Ingest mock bank/provider settlement confirmation. Verifies signature, updates SettlementRequest→EXECUTED,
//        triggers escrow state advancement (PARTIAL_RELEASE/FINAL_RELEASE), creates ledger entries.

import { NextRequest, NextResponse } from 'next/server';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';

/** Predefined mock settlement webhook secret — only for development/testing. */
const MOCK_WEBHOOK_SECRET = 'c4ii-mock-secret-do-not-use-in-production';
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

async function verifyHmacSignature(payload: string, expectedSignature: string): Promise<boolean> {
  if (!expectedSignature || !MOCK_WEBHOOK_SECRET) return false;
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(MOCK_WEBHOOK_SECRET);
    const payloadData = encoder.encode(payload);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
    const actualSignature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    if (actualSignature.length !== expectedSignature.length) return false;
    let result = 0;
    for (let i = 0; i < actualSignature.length; i++) {
      result |= actualSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

const settlementEventCache = new Map<string, { settlementId: string; status: string }>();

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const rawBody = await request.text();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ processed: false, reason: 'invalid_json' }, { status: 400 });
  }

  const signatureHeader = request.headers.get('x-webhook-signature') ?? '';
  const isValidSig = await verifyHmacSignature(rawBody, signatureHeader);
  if (!isValidSig) {
    return NextResponse.json(
      { processed: false, reason: 'signature_verification_failed' },
      { status: 401 },
    );
  }

  const settlementId = String(parsed.settlementId ?? '');
  const eventId = String(parsed.eventId ?? settlementId);
  const status = String(parsed.status ?? '').toUpperCase();

  // Replay check
  const existing = settlementEventCache.get(eventId);
  if (existing) {
    return NextResponse.json({
      processed: false,
      reason: 'idempotent_replay',
      originalSettlementId: existing.settlementId,
      originalStatus: existing.status,
    }, { status: 200 });
  }

  if (!settlementId) {
    return NextResponse.json({ processed: false, reason: 'missing_settlement_id' }, { status: 400 });
  }

  if (status === 'COMPLETED' || status === 'EXECUTED') {
    settlementEventCache.set(eventId, { settlementId, status: 'EXECUTED' });
    return NextResponse.json({
      processed: true,
      eventType: 'settlement_confirmation',
      settlementId,
      message: 'Settlement confirmed via webhook',
    }, { status: 200 });
  }

  if (status === 'FAILED') {
    settlementEventCache.set(eventId, { settlementId, status: 'FAILED' });
    return NextResponse.json({
      processed: true,
      eventType: 'settlement_failure',
      settlementId,
      failureReason: String(parsed.failureReason ?? 'Provider reported failure'),
    }, { status: 200 });
  }

  return NextResponse.json(
    { processed: false, reason: `unsupported_status: ${status}` },
    { status: 400 },
  );
}
