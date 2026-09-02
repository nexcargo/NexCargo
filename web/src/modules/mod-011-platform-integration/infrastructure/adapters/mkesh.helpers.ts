// NexCargo MOD-011 Mobile Money — Shared Helper Utilities for Provider Adapters
// Reusable functions used across mKesh/e-Mola adapter implementations.
// Centralizes signature verification and status parsing logic.

import { MobileMoneyTransactionStatus } from './mobile-money.types';
import type { RetryConfiguration } from './base.adapter';
import { DEFAULT_MOBILE_MONEY_RETRY_POLICY } from './base.adapter';

/**
 * Computes HMAC-SHA256 signature for webhook payload verification.
 * Uses Web Crypto API (available in Node.js >= 15 and modern browsers).
 * @param payload - The raw webhook body string
 * @param secret - The provider's shared secret key
 * @returns Hex-encoded HMAC-SHA256 signature
 */
export async function computeWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies a webhook signature against the expected value.
 * Uses constant-time comparison to prevent timing attacks.
 * @param payload - The webhook payload string
 * @param secret - The shared secret key
 * @param expectedSignature - Expected signature from webhook header
 * @returns true if signature is valid
 */
export async function verifyWebhookSignature(
  payload: string,
  secret: string,
  expectedSignature: string
): Promise<boolean> {
  const actualSignature = await computeWebhookSignature(payload, secret);
  if (actualSignature.length !== expectedSignature.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < actualSignature.length; i++) {
    result |= actualSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Parse transaction status from provider callback string.
 * Generic implementation used by multiple providers.
 * @param rawStatus - Raw status string from provider
 * @returns Normalized MobileMoneyTransactionStatus enum
 */
export function parseStatus(rawStatus: string): MobileMoneyTransactionStatus {
  const upper = rawStatus.toUpperCase();
  switch (upper) {
    case 'COMPLETED': case 'SUCCESS': case '0':
      return MobileMoneyTransactionStatus.COMPLETED;
    case 'FAILED': case 'ERROR': case '1':
      return MobileMoneyTransactionStatus.FAILED;
    case 'REFUNDED':
      return MobileMoneyTransactionStatus.REFUNDED;
    case 'CANCELLED':
      return MobileMoneyTransactionStatus.CANCELLED;
    default:
      return MobileMoneyTransactionStatus.PENDING;
  }
}

/**
 * Calculate mobile money transaction fee (simplified model).
 * Used as fallback by adapters that don't have precise fee tables.
 * @param amount - Transaction amount
 * @returns Fee amount in same currency units
 */
export function calculateFee(amount: number): number {
  if (amount <= 50) return 0;
  if (amount <= 500) return 3;
  if (amount <= 5000) return 10;
  return Math.round(amount * 0.002);
}

/**
 * Retry delay calculation with exponential backoff and jitter.
 * Per ESS-001C: retry policy must include max retries, initial delay, max delay, and backoff multiplier.
 * @param attempt - Zero-based attempt number (0 = first retry)
 * @param config - Retry configuration
 * @returns Delay in milliseconds before this attempt
 */
export function calculateRetryDelay(attempt: number, config: RetryConfiguration): number {
  const delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );
  // Add jitter: ±20% of base delay to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(delay + jitter));
}
