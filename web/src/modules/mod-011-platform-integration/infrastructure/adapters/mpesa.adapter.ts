// NexCargo MOD-011 M-Pesa Adapter — Provider-Specific Implementation (Mock/Sandbox)
// Authoritative source: ESS-001A §3.2, ESS-001B Authentication Standards, ESS-001C Retry Policy
// Implements IMobileMoneyAdapter for Vodacom M-Pesa Mozambique using mock/sandbox data.
// In production, this would call the actual M-Pesa Daraja API endpoints.
// No real API calls are made in this implementation.

import type {
  IMobileMoneyAdapter,
  MobileMoneyCredentials,
  RetryConfiguration,
  MobileMoneyHealthStatus,
  MobileMoneyPaymentRequest,
  MobileMoneyPaymentResponse,
  MobileMoneyError,
  MobileMoneyWebhookPayload,
} from './base.adapter';
import { DEFAULT_MOBILE_MONEY_RETRY_POLICY, normalizePhoneForAdapter } from './base.adapter';
import {
  MobileMoneyProvider,
  MobileMoneyTransactionStatus,
  MobileMoneyErrorCategory,
  MobileMoneyAuthMethod,
} from './mobile-money.types';
import { verifyWebhookSignature as providerVerifyWebhookSignature, parseStatus, calculateFee } from './mkesh.helpers';

// Re-export for use by emola/mkesh adapters
export { parseStatus, calculateFee } from './mkesh.helpers';
export { DEFAULT_MOBILE_MONEY_RETRY_POLICY } from './base.adapter';

/** Create a normalized error for the mobile money adapter */
function createNormalizedError(category: MobileMoneyErrorCategory, requestId: string): MobileMoneyError {
  return { errorCode: category, message: `${category.toLowerCase().replace(/_/g, ' ')} for ${requestId}`, isTransient: false, requiresManualIntervention: false, requestId };
}

/**
 * Mock transaction store for sandbox testing.
 * In production, transactions would be persisted to a database.
 */
interface MockTransaction {
  transactionId: string;
  referenceId: string;
  status: MobileMoneyTransactionStatus;
  amount: number;
  currency: string;
  recipientPhone: string;
  createdAt: string;
}

/**
 * M-Pesa adapter for Vodacom Mozambique.
 * Uses mock/sandbox data — does NOT make real network requests.
 * Production activation requires real provider credentials and endpoint configuration.
 */
export class MpesaAdapter implements IMobileMoneyAdapter {
  readonly provider = MobileMoneyProvider.MPESA;

  private credentials: MobileMoneyCredentials | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private transactions: Map<string, MockTransaction> = new Map();

  /** Initialize the adapter with provider credentials */
  async initialize(credentials: MobileMoneyCredentials): Promise<void> {
    if (!credentials.baseUrl) {
      throw new Error('MpesaAdapter: baseUrl is required in credentials');
    }
    if (credentials.method === MobileMoneyAuthMethod.API_KEY_SECRET) {
      if (!credentials.apiKey || !credentials.apiSecret) {
        throw new Error('MpesaAdapter: API key and secret are required for OAuth authentication');
      }
    }
    this.credentials = credentials;
    // Simulate token acquisition (in production, call provider's OAuth endpoint)
    this.accessToken = `mpesa_token_${credentials.apiKey?.slice(0, 8) ?? 'sandbox'}`;
    this.tokenExpiry = Date.now() + 3600000; // 1 hour
  }

  /** Initiate payment via M-Pesa (mock/sandbox) */
  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    const authCheck = this.validateAuth();
    if (authCheck) return authCheck;

    // Validate phone number format
    const normalizedPhone = normalizePhoneForAdapter(request.recipientPhone);
    if (!normalizedPhone) {
      return createNormalizedError(MobileMoneyErrorCategory.INVALID_PHONE_NUMBER, request.referenceId);
    }

    // Check idempotency — reject duplicate reference IDs
    for (const tx of this.transactions.values()) {
      if (tx.referenceId === request.referenceId &&
          tx.status !== MobileMoneyTransactionStatus.FAILED &&
          tx.status !== MobileMoneyTransactionStatus.CANCELLED) {
        return createNormalizedError(MobileMoneyErrorCategory.DUPLICATE_TRANSACTION, request.referenceId);
      }
    }

    // Generate mock provider transaction ID
    const transactionId = `MP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    // Create mock transaction record
    const mockTx: MockTransaction = {
      transactionId,
      referenceId: request.referenceId,
      status: MobileMoneyTransactionStatus.COMPLETED,
      amount: request.amount,
      currency: request.currency || 'MZN',
      recipientPhone: normalizedPhone,
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(request.referenceId, mockTx);

    // In production, map mockTx to M-Pesa response format:
    // { ConversationID, TransactionID, ResultDesc, ResultCode, ... }

    return {
      transactionId: mockTx.transactionId,
      referenceId: mockTx.referenceId,
      status: mockTx.status,
      amount: mockTx.amount,
      currency: mockTx.currency,
      recipientPhone: mockTx.recipientPhone,
      feeAmount: calculateFee(mockTx.amount),
      completedAt: mockTx.createdAt,
      rawProviderData: {
        // Simulated M-Pesa Daraja response structure
        resultType: '0',
        resultParam: { paramIndex: 0, dataIndex: 0 },
        result: {
          ConversationID: transactionId,
          OriginatorConversationID: transactionId,
          ResultCode: 0,
          ResultDesc: 'Success',
          Recipient: normalizedPhone,
          Amount: mockTx.amount,
          TransactionTime: mockTx.createdAt,
        },
      },
    };
  }

  /** Query transaction status (mock/sandbox) */
  async queryTransaction(
    referenceId: string,
    _transactionId?: string
  ): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    const authCheck = this.validateAuth();
    if (authCheck) return authCheck;

    const tx = this.transactions.get(referenceId);
    if (!tx) {
      return createNormalizedError(MobileMoneyErrorCategory.UNKNOWN_PROVIDER_ERROR, referenceId);
    }

    return {
      transactionId: tx.transactionId,
      referenceId: tx.referenceId,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      recipientPhone: tx.recipientPhone,
      completedAt: tx.createdAt,
      rawProviderData: { StatusQueryResult: tx.status },
    };
  }

  /** Process and verify webhook callback */
  async processWebhook(rawBody: string, signatureHeader: string): Promise<MobileMoneyWebhookPayload | MobileMoneyError> {
    // Verify HMAC-SHA256 signature per ESS-001D / MOD-011 §7.6
    if (!this.credentials?.apiKey) {
      return createNormalizedError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'webhook');
    }
    // Signature verification delegate to shared utility
    const isValid = await providerVerifyWebhookSignature(rawBody, this.credentials.apiKey, signatureHeader);
    if (!isValid) {
      return createNormalizedError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'webhook');
    }

    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      return {
        eventType: String(parsed.eventType || 'payment.callback'),
        transactionId: String(parsed.transactionId || ''),
        referenceId: String(parsed.referenceId || ''),
        status: parseStatus(String(parsed.status || 'PENDING')),
        amount: Number(parsed.amount || 0),
        currency: String(parsed.currency || 'MZN'),
        recipientPhone: String(parsed.recipientPhone || ''),
        timestamp: String(parsed.timestamp || new Date().toISOString()),
        signature: signatureHeader,
        rawBody,
      };
    } catch {
      return createNormalizedError(MobileMoneyErrorCategory.UNKNOWN_PROVIDER_ERROR, 'webhook');
    }
  }

  /** Get provider health status (mock/sandbox) */
  async getHealth(): Promise<MobileMoneyHealthStatus> {
    return {
      provider: this.provider,
      operational: !!this.credentials && this.isTokenValid(),
      lastChecked: new Date().toISOString(),
      latencyMs: undefined,
      error: this.isTokenValid() ? undefined : 'Token expired or not initialized',
    };
  }

  /** Get retry policy configuration */
  getRetryPolicy(): RetryConfiguration {
    return DEFAULT_MOBILE_MONEY_RETRY_POLICY;
  }

  // --- Internal helpers ---

  private validateAuth(): MobileMoneyError | null {
    if (!this.credentials) {
      return createNormalizedError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'adapter');
    }
    if (!this.isTokenValid()) {
      return createNormalizedError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'adapter');
    }
    return null;
  }

  private isTokenValid(): boolean {
    return this.accessToken !== null && Date.now() < this.tokenExpiry;
  }
}
