// NexCargo MOD-011 mKesh Adapter — Provider-Specific Implementation (Mock/Sandbox)
// Authoritative source: ESS-001A §3.2 (mKesh/Tmcel)
// Lightweight adapter following IMobileMoneyAdapter interface.
// Uses mock/sandbox data — does NOT make real network requests.

import type {
  IMobileMoneyAdapter,
  MobileMoneyCredentials,
  RetryConfiguration,
} from './base.adapter';
import { DEFAULT_MOBILE_MONEY_RETRY_POLICY, normalizePhoneForAdapter } from './base.adapter';
import {
  MobileMoneyProvider,
  MobileMoneyTransactionStatus,
  MobileMoneyErrorCategory,
  MobileMoneyPaymentRequest,
  MobileMoneyPaymentResponse,
  MobileMoneyError,
  MobileMoneyWebhookPayload,
  MobileMoneyAuthMethod,
} from './mobile-money.types';
import type { MobileMoneyHealthStatus } from './base.adapter';
import { verifyWebhookSignature, parseStatus, calculateFee } from './mkesh.helpers';

export class MkeshAdapter implements IMobileMoneyAdapter {
  readonly provider = MobileMoneyProvider.MKESH;
  private credentials: MobileMoneyCredentials | null = null;
  private transactions: Map<string, Record<string, unknown>> = new Map();

  async initialize(credentials: MobileMoneyCredentials): Promise<void> {
    if (!credentials.baseUrl) {
      throw new Error('MkeshAdapter: baseUrl is required');
    }
    this.credentials = credentials;
  }

  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    if (!this.credentials) {
      return createMkeshError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, request.referenceId);
    }
    const normalizedPhone = normalizePhoneForAdapter(request.recipientPhone);
    if (!normalizedPhone) {
      return createMkeshError(MobileMoneyErrorCategory.INVALID_PHONE_NUMBER, request.referenceId);
    }
    for (const [, tx] of this.transactions.entries()) {
      if (tx.ref === request.referenceId && ['COMPLETED', 'PENDING'].includes(tx.status as string)) {
        return createMkeshError(MobileMoneyErrorCategory.DUPLICATE_TRANSACTION, request.referenceId);
      }
    }
    const now = new Date().toISOString();
    const mockTx = {
      id: `MK${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      ref: request.referenceId,
      status: 'COMPLETED',
      amount: request.amount,
      currency: request.currency || 'MZN',
      phone: normalizedPhone,
      created: now,
    };
    this.transactions.set(request.referenceId, mockTx);
    return {
      transactionId: mockTx.id,
      referenceId: mockTx.ref,
      status: MobileMoneyTransactionStatus.COMPLETED,
      amount: mockTx.amount,
      currency: mockTx.currency,
      recipientPhone: mockTx.phone,
      feeAmount: calculateFee(mockTx.amount),
      completedAt: now,
      rawProviderData: { mkeshRef: mockTx.id, resultCode: '0' },
    };
  }

  async queryTransaction(referenceId: string): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    if (!this.credentials) {
      return createMkeshError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, referenceId);
    }
    const tx = this.transactions.get(referenceId);
    if (!tx) {
      return createMkeshError(MobileMoneyErrorCategory.UNKNOWN_PROVIDER_ERROR, referenceId);
    }
    return {
      transactionId: tx.id as string, referenceId: tx.ref as string,
      status: parseStatus(tx.status as string),
      amount: tx.amount as number, currency: tx.currency as string, recipientPhone: tx.phone as string,
      completedAt: tx.created as string | undefined, rawProviderData: tx as Record<string, unknown>,
    };
  }

  async processWebhook(rawBody: string, signatureHeader: string): Promise<MobileMoneyWebhookPayload | MobileMoneyError> {
    if (!this.credentials?.apiKey) {
      return createMkeshError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'webhook');
    }
    const isValid = await verifyWebhookSignature(rawBody, this.credentials.apiKey, signatureHeader);
    if (!isValid) {
      return createMkeshError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'webhook');
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
      return createMkeshError(MobileMoneyErrorCategory.UNKNOWN_PROVIDER_ERROR, 'webhook');
    }
  }

  async getHealth(): Promise<MobileMoneyHealthStatus> {
    return {
      provider: this.provider, operational: !!this.credentials,
      lastChecked: new Date().toISOString(),
    };
  }

  getRetryPolicy() { return DEFAULT_MOBILE_MONEY_RETRY_POLICY; }
}

function createMkeshError(category: MobileMoneyErrorCategory, requestId: string): import('./mobile-money.types').MobileMoneyError {
  return { errorCode: category, message: `${category.toLowerCase().replace(/_/g, ' ')} for ${requestId}`, isTransient: false, requiresManualIntervention: false, requestId };
}
