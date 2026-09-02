// NexCargo MOD-011 e-Mola Adapter — Provider-Specific Implementation (Mock/Sandbox)
// Authoritative source: ESS-001A §3.2 (e-Mola/Movitel)
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

export class EMolaAdapter implements IMobileMoneyAdapter {
  readonly provider = MobileMoneyProvider.E_MOLA;
  private credentials: MobileMoneyCredentials | null = null;
  private transactions: Map<string, Record<string, unknown>> = new Map();

  async initialize(credentials: MobileMoneyCredentials): Promise<void> {
    if (!credentials.baseUrl) {
      throw new Error('EMolaAdapter: baseUrl is required');
    }
    this.credentials = credentials;
  }

  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    if (!this.credentials) {
      return createEMolaError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, request.referenceId);
    }
    const normalizedPhone = normalizePhoneForAdapter(request.recipientPhone);
    if (!normalizedPhone) {
      return createEMolaError(MobileMoneyErrorCategory.INVALID_PHONE_NUMBER, request.referenceId);
    }
    for (const [, tx] of this.transactions.entries()) {
      if (tx.ref === request.referenceId && ['COMPLETED', 'PENDING'].includes(tx.status as string)) {
        return createEMolaError(MobileMoneyErrorCategory.DUPLICATE_TRANSACTION, request.referenceId);
      }
    }
    const now = new Date().toISOString();
    const mockTx = {
      id: `EM${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      ref: request.referenceId,
      status: 'COMPLETED',
      amount: request.amount,
      currency: request.currency || 'MZN',
      phone: normalizedPhone,
      created: now,
    };
    this.transactions.set(request.referenceId, mockTx);
    return {
      transactionId: mockTx.id, referenceId: mockTx.ref,
      status: MobileMoneyTransactionStatus.COMPLETED,
      amount: mockTx.amount, currency: mockTx.currency, recipientPhone: mockTx.phone,
      feeAmount: calculateFee(mockTx.amount), completedAt: now,
      rawProviderData: { emolaRef: mockTx.id, result: 'SUCCESS' },
    };
  }

  async queryTransaction(referenceId: string): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    if (!this.credentials) {
      return createEMolaError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, referenceId);
    }
    const tx = this.transactions.get(referenceId);
    if (!tx) {
      return createEMolaError(MobileMoneyErrorCategory.UNKNOWN_PROVIDER_ERROR, referenceId);
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
      return createEMolaError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'webhook');
    }
    const isValid = await verifyWebhookSignature(rawBody, this.credentials.apiKey, signatureHeader);
    if (!isValid) {
      return createEMolaError(MobileMoneyErrorCategory.AUTHENTICATION_FAILED, 'webhook');
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
      return createEMolaError(MobileMoneyErrorCategory.UNKNOWN_PROVIDER_ERROR, 'webhook');
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

function createEMolaError(category: MobileMoneyErrorCategory, requestId: string): import('./mobile-money.types').MobileMoneyError {
  return { errorCode: category, message: `${category.toLowerCase().replace(/_/g, ' ')} for ${requestId}`, isTransient: false, requiresManualIntervention: false, requestId };
}
