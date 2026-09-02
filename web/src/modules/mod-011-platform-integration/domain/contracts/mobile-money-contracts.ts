// NexCargo MOD-011 Mobile Money — Integration Contracts (ESS-004 Compliant)
// Authoritative source: ESS-004 §3 (Contract Structure Standard), ESS-001A §3.2
// Defines provider-specific integration contracts for mobile money aggregators.
// Each contract follows the ESS-004 JSON schema structure.

import { BaseContractSchema, ApiContractStatus } from '@/shared/standards/api-contract-schema';
import { MobileMoneyProvider } from '@/modules/mod-011-platform-integration/infrastructure/adapters/mobile-money.types';

/**
 * Contract domain for financial integrations per ESS-004 §3.
 */
export const MOBILE_MONEY_DOMAIN = 'FINANCIAL' as const;

/**
 * Base mobile money contract extending BaseContractSchema with provider fields.
 * Per ESS-004 §3: every integration MUST define contractId/provider/domain/version/endpoints/authentication/requestSchema/responseSchema/errorMapping/timeoutPolicy/retryPolicy/idempotencyRequired.
 */
export interface MobileMoneyIntegrationContract extends BaseContractSchema {
  provider: MobileMoneyProvider;
  domain: typeof MOBILE_MONEY_DOMAIN;
  version: string;
  baseUrl: string;
  authentication: string;           // e.g., 'OAuth 2.0 Client Credentials', 'API Key/Secret'
  endpoints: MobileMoneyEndpoint[];
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  errorMapping: ErrorMappingEntry[];
  timeoutPolicy: string;            // ISO 8601 duration or descriptive text
  retryPolicy: string;              // Reference to ESS-001C policy
  idempotencyRequired: true;        // All payment operations require idempotency
}

/**
 * Endpoint definition per ESS-004 §4 (Endpoint Contract Rule).
 */
export interface MobileMoneyEndpoint {
  name: string;                     // e.g., 'initiatePayment', 'queryTransaction', 'webhook'
  method: 'POST' | 'GET';
  path: string;                     // Provider API path
  description?: string;
}

/**
 * Error mapping entry per ESS-004: maps provider-specific errors to normalized codes.
 */
export interface ErrorMappingEntry {
  providerErrorCode: string;        // Raw error code from provider
  normalizedCode: string;           // Normalized error category string
  isRetryable: boolean;             // Whether this error justifies a retry
  description: string;              // Human-readable explanation
}

/**
 * M-Pesa (Vodacom Mozambique) integration contract.
 * Production activation requires real Daraja API base URL and OAuth credentials.
 * Current endpoint configuration uses placeholder values for sandbox development.
 */
export const MPESA_CONTRACT: MobileMoneyIntegrationContract = {
  contractId: 'mpesa-mz-integration',
  status: ApiContractStatus.TESTING,
  createdAt: new Date().toISOString(),
  ownerModule: 'MOD-011',
  provider: MobileMoneyProvider.MPESA,
  domain: MOBILE_MONEY_DOMAIN,
  version: '1.0.0',
  baseUrl: process.env.MPESA_API_BASE_URL ?? 'https://sandbox.safaricom.co.ke/mpesa',
  authentication: 'OAuth 2.0 Client Credentials',
  endpoints: [
    { name: 'initiatePayment', method: 'POST', path: '/mpesa/c2b/v1/pay', description: 'Customer to Business payment initiation' },
    { name: 'queryTransaction', method: 'POST', path: '/mpesa/b2c/v1/queryrequest', description: 'Transaction status query' },
    { name: 'webhook', method: 'POST', path: '/api/v1/mobile-money/mpesa/webhook', description: 'M-Pesa callback endpoint' },
  ],
  requestSchema: {
    type: 'object',
    properties: {
      amount: { type: 'number', minimum: 1 },
      currency: { type: 'string', default: 'MZN' },
      recipientPhone: { type: 'string', pattern: '^\\+258[0-9]{9}$' },
      referenceId: { type: 'string', minLength: 1 },
    },
    required: ['amount', 'recipientPhone', 'referenceId'],
  },
  responseSchema: {
    type: 'object',
    properties: {
      transactionId: { type: 'string' },
      referenceId: { type: 'string' },
      status: { type: 'string', enum: ['COMPLETED', 'FAILED', 'PENDING'] },
      amount: { type: 'number' },
      currency: { type: 'string' },
      feeAmount: { type: 'number' },
      completedAt: { type: 'string', format: 'date-time' },
    },
    required: ['transactionId', 'referenceId', 'status', 'amount'],
  },
  errorMapping: [
    { providerErrorCode: 'OR_011', normalizedCode: 'INSUFFICIENT_FUNDS', isRetryable: false, description: 'Sender does not have sufficient balance' },
    { providerErrorCode: 'GS_002', normalizedCode: 'PROVIDER_UNAVAILABLE', isRetryable: true, description: 'Gateway service unavailable' },
    { providerErrorCode: '', normalizedCode: 'UNKNOWN_PROVIDER_ERROR', isRetryable: false, description: 'Unrecognized provider error' },
  ],
  timeoutPolicy: '5s per request, aligns with shared RETRY_POLICY (ESS-001C)',
  retryPolicy: 'DEFAULT_MOBILE_MONEY_RETRY_POLICY (ESS-001C)',
  idempotencyRequired: true,
};

/**
 * mKesh (Tmcel) integration contract.
 * Endpoint URLs are placeholders pending provider documentation review.
 */
export const MKESH_CONTRACT: MobileMoneyIntegrationContract = {
  contractId: 'mkesh-tmcel-integration',
  status: ApiContractStatus.TESTING,
  createdAt: new Date().toISOString(),
  ownerModule: 'MOD-011',
  provider: MobileMoneyProvider.MKESH,
  domain: MOBILE_MONEY_DOMAIN,
  version: '1.0.0',
  baseUrl: process.env.MKESH_API_BASE_URL ?? '',
  authentication: 'API Key/Secret',
  endpoints: [
    { name: 'initiatePayment', method: 'POST', path: '/v1/payments/initiate', description: '[PLACEHOLDER — awaiting Tmcel API documentation]' },
    { name: 'queryTransaction', method: 'GET', path: '/v1/payments/{id}', description: '[PLACEHOLDER — awaiting Tmcel API documentation]' },
    { name: 'webhook', method: 'POST', path: '/api/v1/mobile-money/mkesh/webhook', description: 'mKesh callback endpoint' },
  ],
  requestSchema: {
    type: 'object',
    properties: {
      amount: { type: 'number', minimum: 1 },
      currency: { type: 'string', default: 'MZN' },
      recipientPhone: { type: 'string', pattern: '^\\+258[0-9]{9}$' },
      referenceId: { type: 'string', minLength: 1 },
    },
    required: ['amount', 'recipientPhone', 'referenceId'],
  },
  responseSchema: {
    type: 'object',
    properties: {
      transactionId: { type: 'string' },
      referenceId: { type: 'string' },
      status: { type: 'string', enum: ['COMPLETED', 'FAILED', 'PENDING'] },
      amount: { type: 'number' },
      currency: { type: 'string' },
    },
    required: ['transactionId', 'referenceId', 'status', 'amount'],
  },
  errorMapping: [
    { providerErrorCode: '*', normalizedCode: 'UNKNOWN_PROVIDER_ERROR', isRetryable: false, description: '[PLACEHOLDER — awaiting Tmcel error code documentation]' },
  ],
  timeoutPolicy: '5s per request, aligns with shared RETRY_POLICY (ESS-001C)',
  retryPolicy: 'DEFAULT_MOBILE_MONEY_RETRY_POLICY (ESS-001C)',
  idempotencyRequired: true,
};

/**
 * e-Mola (Movitel) integration contract.
 * Endpoint URLs are placeholders pending provider documentation review.
 */
export const E_MOLA_CONTRACT: MobileMoneyIntegrationContract = {
  contractId: 'emola-movitel-integration',
  status: ApiContractStatus.TESTING,
  createdAt: new Date().toISOString(),
  ownerModule: 'MOD-011',
  provider: MobileMoneyProvider.E_MOLA,
  domain: MOBILE_MONEY_DOMAIN,
  version: '1.0.0',
  baseUrl: process.env.E_MOLA_API_BASE_URL ?? '',
  authentication: 'API Key/Secret',
  endpoints: [
    { name: 'initiatePayment', method: 'POST', path: '/v1/payments/send', description: '[PLACEHOLDER — awaiting Movitel API documentation]' },
    { name: 'queryTransaction', method: 'GET', path: '/v1/payments/{id}/status', description: '[PLACEHOLDER — awaiting Movitel API documentation]' },
    { name: 'webhook', method: 'POST', path: '/api/v1/mobile-money/emola/webhook', description: 'e-Mola callback endpoint' },
  ],
  requestSchema: {
    type: 'object',
    properties: {
      amount: { type: 'number', minimum: 1 },
      currency: { type: 'string', default: 'MZN' },
      recipientPhone: { type: 'string', pattern: '^\\+258[0-9]{9}$' },
      referenceId: { type: 'string', minLength: 1 },
    },
    required: ['amount', 'recipientPhone', 'referenceId'],
  },
  responseSchema: {
    type: 'object',
    properties: {
      transactionId: { type: 'string' },
      referenceId: { type: 'string' },
      status: { type: 'string', enum: ['COMPLETED', 'FAILED', 'PENDING'] },
      amount: { type: 'number' },
      currency: { type: 'string' },
    },
    required: ['transactionId', 'referenceId', 'status', 'amount'],
  },
  errorMapping: [
    { providerErrorCode: '*', normalizedCode: 'UNKNOWN_PROVIDER_ERROR', isRetryable: false, description: '[PLACEHOLDER — awaiting Movitel error code documentation]' },
  ],
  timeoutPolicy: '5s per request, aligns with shared RETRY_POLICY (ESS-001C)',
  retryPolicy: 'DEFAULT_MOBILE_MONEY_RETRY_POLICY (ESS-001C)',
  idempotencyRequired: true,
};

/**
 * Registry of all registered mobile money contracts.
 */
export const MOBILE_MONEY_CONTRACTS: Map<MobileMoneyProvider, MobileMoneyIntegrationContract> = new Map([
  [MobileMoneyProvider.MPESA, MPESA_CONTRACT],
  [MobileMoneyProvider.MKESH, MKESH_CONTRACT],
  [MobileMoneyProvider.E_MOLA, E_MOLA_CONTRACT],
]);
