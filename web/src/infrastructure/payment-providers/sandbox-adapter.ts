// NexCargo Sandbox Payment Provider Adapter — C4 Deterministic Test Stub
// Authoritative: ESS-001F §4 (Payment Channels) — adapter-ready, NOT production
// This adapter simulates provider behavior deterministically for testing/staging.
// It does NOT connect to any external payment system.

import type {
  PaymentProviderAdapter,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentQueryRequest,
  PaymentQueryResponse,
  ProviderWebhookPayload,
  RefundRequest,
  RefundResponse,
  SettlementRequest,
  SettlementResponse,
  PaymentMethodType,
} from './provider-interface';

/** In-memory store of simulated payments (sandbox only) */
interface SimulatedPayment {
  paymentIntentId: string;
  providerReferenceId: string;
  amount: number;
  currency: string;
  status: 'INITIATED' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
  customerIdentifier: string;
  createdAt: string;
  confirmedAt: string | null;
  failureReason: string | null;
}

export class SandboxPaymentProvider implements PaymentProviderAdapter {
  readonly providerName = 'SANDBOX_DETERMINISTIC';
  readonly isProductionReady = false;

  private readonly payments = new Map<string, SimulatedPayment>();
  private seqCounter = 0;

  /** Generate a deterministic provider reference ID */
  private generateReferenceId(): string {
    this.seqCounter++;
    return `SBX-${Date.now()}-${this.seqCounter}`;
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const refId = this.generateReferenceId();

    // Create simulated payment record
    const payment: SimulatedPayment = {
      paymentIntentId: request.paymentIntentId,
      providerReferenceId: refId,
      amount: request.amount,
      currency: request.currency,
      status: 'INITIATED',
      customerIdentifier: request.customerIdentifier,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      failureReason: null,
    };

    this.payments.set(request.paymentIntentId, payment);

    return {
      success: true,
      providerReferenceId: refId,
      providerStatus: 'INITIATED',
      message: `Payment initiated in sandbox. Reference: ${refId}`,
    };
  }

  async queryPayment(request: PaymentQueryRequest): Promise<PaymentQueryResponse> {
    const payment = this.payments.get(request.paymentIntentId);

    if (!payment) {
      return {
        paymentIntentId: request.paymentIntentId,
        providerReferenceId: request.providerReferenceId,
        status: 'FAILED',
        amount: 0,
        currency: '',
        confirmedAt: null,
        failureReason: 'Payment not found in sandbox',
      };
    }

    return {
      paymentIntentId: payment.paymentIntentId,
      providerReferenceId: payment.providerReferenceId || request.providerReferenceId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      confirmedAt: payment.confirmedAt,
      failureReason: payment.failureReason,
    };
  }

  async processWebhook(_rawBody: string, _headers: Record<string, string>, payload: ProviderWebhookPayload): Promise<{ valid: boolean; processed: boolean }> {
    // Sandbox webhooks are always valid (no signature verification needed)
    // The state transition is determined by the payload status
    const payment = this.payments.get(payload.paymentIntentId);

    if (!payment) {
      return { valid: true, processed: false };
    }

    switch (payload.status) {
      case 'COMPLETED':
        payment.status = 'CONFIRMED';
        payment.confirmedAt = payload.timestamp;
        break;
      case 'FAILED':
      case 'CANCELLED':
        payment.status = 'FAILED';
        payment.failureReason = payload.failureReason || 'Provider reported failure';
        break;
      case 'REFUNDED':
        payment.status = 'REFUNDED';
        break;
      default:
        return { valid: true, processed: false };
    }

    return { valid: true, processed: true };
  }

  async verifyWebhookSignature(_rawBody: string, _signature: string): Promise<boolean> {
    // Sandbox: all signatures are valid
    return true;
  }

  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    const payment = this.payments.get(request.paymentIntentId);

    if (!payment) {
      return {
        success: false,
        refundReferenceId: null,
        providerStatus: 'NOT_FOUND',
        message: 'Payment not found',
        error: { code: 'PAYMENT_NOT_FOUND', description: 'No matching payment in sandbox' },
      };
    }

    if (payment.status !== 'CONFIRMED') {
      return {
        success: false,
        refundReferenceId: null,
        providerStatus: 'INVALID_STATE',
        message: 'Cannot refund payment not in CONFIRMED state',
        error: { code: 'INVALID_STATE', description: 'Only CONFIRMED payments can be refunded' },
      };
    }

    payment.status = 'REFUNDED';

    return {
      success: true,
      refundReferenceId: `SBX-REFUND-${request.paymentIntentId}`,
      providerStatus: 'REFUNDED',
      message: 'Refund processed successfully in sandbox',
    };
  }

  async executeSettlement(request: SettlementRequest): Promise<SettlementResponse> {
    // Sandbox settlement: simulate successful transfer
    return {
      success: true,
      settlementReferenceId: `SBX-STL-${request.escrowId}-${Date.now()}`,
      providerStatus: 'EXECUTED',
      message: `Settlement of ${request.amount} ${request.currency} executed in sandbox`,
    };
  }

  /** Get all simulated payments (for testing) */
  getSimulatedPayments(): SimulatedPayment[] {
    return Array.from(this.payments.values());
  }

  /** Clear all simulated payments (for test isolation) */
  clear(): void {
    this.payments.clear();
    this.seqCounter = 0;
  }
}
