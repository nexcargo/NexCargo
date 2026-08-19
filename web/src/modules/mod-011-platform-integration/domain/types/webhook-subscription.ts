// NexCargo MOD-011 Domain Types — Webhook Subscription Framework
// Authoritative source: MOD-011 §4.3 (Webhook Subscription Object)
// Implements exit criteria X-02: Webhook Subscription Object with HMAC-SHA256 verification pattern

import { BaseContractSchema } from '@/shared/standards/api-contract-schema';

/**
 * Webhook delivery status enum per MOD-011 §4.3
 */
export enum WebhookDeliveryStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  FAILED = 'FAILED',
}

/**
 * Webhook Verification method enum per MOD-011 §4.3
 */
export enum WebhookVerificationMethod {
  HMAC_SHA256 = 'HMAC_SHA256',
  SHA256 = 'SHA256',
  NONE = 'NONE',
}

/**
 * Webhook Subscription Object — represents external event intake configuration.
 * Per MOD-011 §4.3. Extends BaseContractSchema (Standard S-03).
 */
export interface WebhookSubscription extends BaseContractSchema {
  // Core attributes from MOD-011 §4.3
  sourceSystem: string;
  eventTypes: string[];        // Array of event type references (camelCase per Event Registry)
  targetUrl: string;
  verificationMethod: WebhookVerificationMethod;
  retryPolicyReference?: string; // Reference to ESS-001C retry policy
  payloadSchema?: Record<string, unknown>;
  securitySignatureRequirement?: string; // e.g., "HMAC-SHA256"
  deliveryStatus: WebhookDeliveryStatus;
}

/**
 * Computes HMAC-SHA256 signature for webhook payload verification.
 * Per MOD-011 §7.6 (Webhook Security Rule): Webhooks MUST be signed and verifiable.
 * @param payload - The webhook payload string
 * @param secret - The shared secret key
 * @returns Hex-encoded HMAC-SHA256 signature
 */
export async function computeWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies a webhook signature against the expected value.
 * @param payload - The webhook payload string
 * @param secret - The shared secret key
 * @param expectedSignature - The expected signature from the webhook header
 * @returns true if signature is valid
 */
export async function verifyWebhookSignature(
  payload: string,
  secret: string,
  expectedSignature: string
): Promise<boolean> {
  const actualSignature = await computeWebhookSignature(payload, secret);
  // Constant-time comparison to prevent timing attacks
  if (actualSignature.length !== expectedSignature.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < actualSignature.length; i++) {
    result |= actualSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}
