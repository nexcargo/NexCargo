// NexCargo MOD-011 Mobile Money — Provider-Specific Type Definitions
// Authoritative source: ESS-001A §3.2 (Mobile Money Aggregator Layer), MOD-011 §4.1 Integration Contract Object
// Provides contract-compatible type definitions for mobile money payment operations.
// Provider-specific API payloads are abstracted; these types define the common surface.

import { BaseContractSchema } from '@/shared/standards/api-contract-schema';

/**
 * Mobile money provider identifier per ESS-001A.
 */
export enum MobileMoneyProvider {
  MPESA = 'MPESA',           // Vodacom Mozambique
  MKESH = 'MKESH',           // Tmcel
  E_MOLA = 'E_MOLA',         // Movitel
}

/**
 * Payment channel type for mobile money transactions.
 */
export enum MobileMoneyChannelType {
  WALLET_FUNDING = 'WALLET_FUNDING',
  PAYOUT = 'PAYOUT',
  TRANSACTION_STATUS_QUERY = 'TRANSACTION_STATUS_QUERY',
}

/**
 * Transaction status from provider callback/response.
 */
export enum MobileMoneyTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

/**
 * Error category for normalized mobile money errors per ESS-001E.
 */
export enum MobileMoneyErrorCategory {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  UNKNOWN_PROVIDER_ERROR = 'UNKNOWN_PROVIDER_ERROR',
}

/**
 * Authentication method for mobile money API access per ESS-001B.
 */
export enum MobileMoneyAuthMethod {
  API_KEY_SECRET = 'API_KEY_SECRET',   // OAuth 2.0 Client Credentials (M-Pesa)
  BASIC_AUTH = 'BASIC_AUTH',           // Basic auth header
  CUSTOM = 'CUSTOM',                   // Provider-specific mechanism
}

/**
 * Mobile money integration contract metadata.
 */
export interface MobileMoneyIntegrationMeta extends BaseContractSchema {
  provider: MobileMoneyProvider;
  region: string;                        // e.g., 'MZ' for Mozambique
  baseUrl: string;                       // Provider API base URL (env-based)
  webhookUrl?: string;                   // Callback endpoint registered with provider
}

/**
 * Common fields for any mobile money payment request.
 * Adapter implementations map these to provider-specific payload formats.
 */
export interface MobileMoneyPaymentRequest {
  amount: number;                      // Amount in local currency units
  currency: string;                    // ISO 4217 currency code (e.g., 'MZN')
  recipientPhone: string;              // Phone number formatted per provider requirements
  senderPhone?: string;                // Sender phone (for wallet-to-wallet transfers)
  referenceId: string;                 // Internal transaction reference (idempotency key)
  purposeCode?: string;                // Provider-specific purpose/billing code
  callbackUrl?: string;                // Where provider should send confirmation
}

/**
 * Common fields for a payment response or callback from any provider.
 */
export interface MobileMoneyPaymentResponse {
  transactionId: string;               // Provider-assigned transaction ID
  referenceId: string;                 // Original internal reference
  status: MobileMoneyTransactionStatus;
  amount: number;
  currency: string;
  recipientPhone: string;
  feeAmount?: number;                  // Provider charge for this transaction
  completedAt?: string;                // ISO 8601 completion timestamp
  rawProviderData?: Record<string, unknown>; // Original unparsed response
}

/**
 * Normalized error from a mobile money provider operation.
 */
export interface MobileMoneyError {
  errorCode: MobileMoneyErrorCategory;
  providerErrorCode?: string;          // Raw provider error code
  message: string;                     // Human-readable description
  isTransient: boolean;                // Whether retry is appropriate
  requiresManualIntervention: boolean; // Must be escalated if true
  requestId?: string;                  // Correlation/request ID from provider
}

/**
 * Webhook payload received from a mobile money provider.
 * Signature verification happens before deserialization.
 */
export interface MobileMoneyWebhookPayload {
  eventType: string;                   // Event type from provider (e.g., 'payment.completed')
  transactionId: string;
  referenceId: string;
  status: MobileMoneyTransactionStatus;
  amount: number;
  currency: string;
  recipientPhone: string;
  timestamp: string;                   // ISO 8601 from provider
  signature?: string;                  // HMAC signature for verification
  rawBody?: string;                    // Original raw body for audit
}
