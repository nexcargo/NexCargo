// NexCargo MOD-011 Mobile Money -- Base Adapter Interface
// Authoritative source: MOD-011 ?5.2 (Isolation Principle), ??4.5 (Enterprise Integration Adapter)
// Defines the contract that ALL mobile money provider adapters MUST implement.
// Provider-specific implementation details are isolated inside each adapter.

import type {
  MobileMoneyProvider,
  MobileMoneyPaymentRequest,
  MobileMoneyPaymentResponse,
  MobileMoneyError,
  MobileMoneyWebhookPayload,
  MobileMoneyAuthMethod,
} from './mobile-money.types';

/**
 * Health status of a mobile money provider connection.
 */
export interface MobileMoneyHealthStatus {
  provider: MobileMoneyProvider;
  operational: boolean;
  lastChecked: string;                 // ISO 8601
  latencyMs?: number;
  error?: string;
}

/**
 * Retry configuration for provider operations.
 * Aligns with ESS-001C Retry & Timeout Policy Matrix.
 */
export interface RetryConfiguration {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];           // Error categories that justify retry
}

/**
 * Authentication credentials for a mobile money provider.
 * Loaded from environment variables -- never hardcoded.
 */
export interface MobileMoneyCredentials {
  method: MobileMoneyAuthMethod;
  apiKey?: string;                     // Client ID / API key
  apiSecret?: string;                  // Client secret
  passkey?: string;                    // M-Pesa style passkey
  baseUrl: string;                     // Provider API endpoint
}

/**
 * Base adapter interface -- ALL mobile money provider adapters MUST implement this.
 * Each concrete adapter handles provider-specific request/response transformation.
 */
export interface IMobileMoneyAdapter {
  /** Provider identifier this adapter handles */
  readonly provider: MobileMoneyProvider;

  /** Initialize credentials and validate connectivity */
  initialize(credentials: MobileMoneyCredentials): Promise<void>;

  /** Initiate a payment transaction via this provider */
  initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResponse | MobileMoneyError>;

  /** Query transaction status by reference or provider transaction ID */
  queryTransaction(referenceId: string, transactionId?: string): Promise<MobileMoneyPaymentResponse | MobileMoneyError>;

  /** Process and verify an incoming webhook callback */
  processWebhook(rawBody: string, signatureHeader: string): Promise<MobileMoneyWebhookPayload | MobileMoneyError>;

  /** Check provider health/status */
  getHealth(): Promise<MobileMoneyHealthStatus>;

  /** Get the configured retry policy for this provider */
  getRetryPolicy(): RetryConfiguration;
}

/**
 * Default retry configuration aligned with shared RETRY_POLICY constants.
 */
export const DEFAULT_MOBILE_MONEY_RETRY_POLICY: Required<RetryConfiguration> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE'],
};

/**
 * Validates phone number format against basic Mozambican number rules.
 * Mozambique numbers: +258 XXX XXX XXX (9 digits after country code).
 * Returns null if invalid, otherwise normalized E.164 format.
 * @param phoneNumber - Raw phone number input
 * @returns Normalized E.164 string or null if invalid
 */
export function normalizePhone(phoneNumber: string): string | null {
  const cleaned = phoneNumber.replace(/[- ()]+/g, '');

  // Handle formats with/without +258 country code
  let subscriberDigits: string;
  if (cleaned.startsWith('+258')) {
    subscriberDigits = cleaned.slice(4); // Remove '+258' (4 chars)
  } else if (cleaned.startsWith('258')) {
    subscriberDigits = cleaned.slice(3); // Remove '258' (3 chars)
  } else if (cleaned.startsWith('8')) {
    // Local format: e.g., 841234567 -> treat as Mozambique (append 258 prefix)
    const fullNumber = '258' + cleaned;
    // Validate full Mozambique number: starts with 258, followed by exactly 9 subscriber digits
    if (!/^258\d{9}$/.test(fullNumber)) {
      return null;
    }
    return `+${fullNumber}`;
  } else {
    return null;
  }

  // Validate: must be exactly 9 subscriber digits after removing Mozambique country code
  if (!/^\d{9}$/.test(subscriberDigits)) {
    return null;
  }

  return `+258${subscriberDigits}`;
}

/**
 * Generates a deterministic idempotency key from request parameters.
 * Used to prevent duplicate processing when retries occur.
 * Format: <provider>:<reference>:<amount>:<recipient>
 * @param provider - Mobile money provider
 * @param referenceId - Internal reference ID
 * @param amount - Transaction amount
 * @param recipientPhone - Recipient phone number
 * @returns Idempotency key string
 */
export async function generateIdempotencyKey(
  provider: MobileMoneyProvider,
  referenceId: string,
  amount: number,
  recipientPhone: string
): Promise<string> {
  const payload = `${provider}:${referenceId}:${amount}:${recipientPhone}`;
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    // Fallback synchronous key if crypto.subtle not available in test env
    return `${provider}-${referenceId}-idem`;
  }
}

// Alias for provider adapter compatibility
export { normalizePhone as normalizePhoneForAdapter };

// Re-export payment type aliases for convenience (providers commonly use these)
export type { MobileMoneyPaymentRequest } from './mobile-money.types';
export type { MobileMoneyPaymentResponse } from './mobile-money.types';
export type { MobileMoneyError } from './mobile-money.types';
export type { MobileMoneyWebhookPayload } from './mobile-money.types';
export type { MobileMoneyAuthMethod } from './mobile-money.types';
export type { MobileMoneyProvider } from './mobile-money.types';
