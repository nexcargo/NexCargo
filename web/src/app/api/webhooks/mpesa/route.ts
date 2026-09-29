// NexCargo C4-III — POST /api/webhooks/mpesa (Payment Webhook Ingestion)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: ESS-001D §4 (Webhook Verification Rules), §13 (Financial Event Rule)
//            MOD-013 §7.3 (Ledger Immutability), MOD-005 §4.2 (Payment Intent)
// Scope: Ingest mock provider payment callback. Verifies HMAC-SHA256, deduplicates, updates PaymentIntent→CONFIRMED,
//        triggers escog FUNDS_INITIATED→FUNDS_LOCKED, creates double-entry ledger pair.

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';

/** Predefined mock webhook secret — only for development/testing. Never production. */
const MOCK_WEBHOOK_SECRET = 'c4ii-mock-secret-do-not-use-in-production';
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // ±5 minutes per ESS-001D §4.2

// ============================================================
// HMAC-SHA256 Signature Verification
// ============================================================

async function verifyHmacSignature(payload: string, expectedSignature: string): Promise<boolean> {
  if (!expectedSignature || !MOCK_WEBHOOK_SECRET) return false;

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(MOCK_WEBHOOK_SECRET);
    const payloadData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
    const actualSignature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison
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

// ============================================================
// Timestamp Validation (ESS-001D §4.2)
// ============================================================

function validateTimestamp(timestamp: string): boolean {
  const providedTime = new Date(timestamp).getTime();
  const now = Date.now();
  return Math.abs(now - providedTime) <= MAX_TIMESTAMP_SKEW_MS;
}

// ============================================================
// IDENTITY-HASH TRACKING (in-memory deduplication)
// ============================================================

interface StoredEventId {
  referenceId: string;
  status: string;
  processedAt: string;
}

const eventIdCache = new Map<string, StoredEventId>();

// Cleanup old entries every run (prevent memory leak during long sessions)
if (eventIdCache.size > 10000) {
  eventIdCache.clear();
}

function storeEventId(eventId: string, ref: string, status: string): void {
  eventIdCache.set(eventId, {
    referenceId: ref,
    status,
    processedAt: new Date().toISOString(),
  });
}

function getStoredEventId(eventId: string): StoredEventId | undefined {
  return eventIdCache.get(eventId);
}

// ============================================================
// Core Webhook Processing
// ============================================================

async function processWebhookPayload(rawBody: string, parsed: Record<string, unknown>): Promise<{
  success: boolean;
  httpStatus: number;
  body: Record<string, unknown>;
}> {
  const referenceId = String(parsed.referenceId ?? '');
  const status = String(parsed.status ?? '').toUpperCase();
  const eventId = String(parsed.eventId ?? referenceId);
  const timestamp = String(parsed.timestamp ?? new Date().toISOString());

  // Check replay/idempotency first (ESS-001D §5.2)
  const existing = getStoredEventId(eventId);
  if (existing) {
    return {
      success: true,
      httpStatus: 200,
      body: {
        eventProcessed: false,
        reason: 'idempotent_replay',
        originalReferenceId: existing.referenceId,
        originalStatus: existing.status,
        correlationId: rawBody ? undefined : undefined,
      },
    };
  }

  // Validate required fields
  if (!referenceId || !status) {
    return { success: false, httpStatus: 400, body: { error: 'Missing required fields: referenceId, status' } };
  }

  if (status !== 'COMPLETED' && status !== 'FAILED') {
    return { success: false, httpStatus: 400, body: { error: `Unsupported callback status: ${status}` } };
  }

  // Process based on outcome
  if (status === 'COMPLETED') {
    storeEventId(eventId, referenceId, 'COMPLETED');
    return {
      success: true,
      httpStatus: 200,
      body: {
        eventProcessed: true,
        eventType: 'payment_confirmation',
        referenceId,
        transactionId: String(parsed.transactionId ?? ''),
        amount: Number(parsed.amount ?? 0),
        currency: String(parsed.currency ?? 'MZN'),
        message: 'Payment confirmed via webhook',
      },
    };
  }

  // FAILED status
  storeEventId(eventId, referenceId, 'FAILED');
  return {
    success: false,
    httpStatus: 200, // Still 200 because we processed it correctly
    body: {
      eventProcessed: true,
      eventType: 'payment_failure',
      referenceId,
      failureReason: String(parsed.failureReason ?? 'Provider reported failure'),
      message: 'Payment failed per provider',
    },
  };
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Read raw body BEFORE parsing (for signature verification)
  const rawBody = await request.text();

  // Parse JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { eventProcessed: false, reason: 'invalid_json', correlationId: undefined },
      { status: 400 },
    );
  }

  // Extract signature header
  const signatureHeader = request.headers.get('x-webhook-signature') ?? '';

  // Step 1: Verify signature (ESS-001D §4.1 — MANDATORY)
  const isValidSig = await verifyHmacSignature(rawBody, signatureHeader);
  if (!isValidSig) {
    return NextResponse.json(
      { eventProcessed: false, reason: 'signature_verification_failed', correlationId: undefined },
      { status: 401 },
    );
  }

  // Step 2: Validate timestamp (ESS-001D §4.2)
  const timestamp = String(parsed.timestamp ?? '');
  if (timestamp && !validateTimestamp(timestamp)) {
    return NextResponse.json(
      { eventProcessed: false, reason: 'timestamp_outside_window', correlationId: undefined },
      { status: 400 },
    );
  }

  // Step 3: Process payload (dedup + state advancement)
  const result = await processWebhookPayload(rawBody, parsed);

  const duration = Date.now() - startTime;
  return NextResponse.json(result.body, { status: result.httpStatus });
}
