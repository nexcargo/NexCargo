// NexCargo Payment Initiation Service — C4 Financial Execution
// Authoritative: MOD-005 §4.2 (Payment Intent), ESS-001F §4 (Payment Channels)
// Creates payment intents, invokes provider adapters, manages idempotency.
// Amount and currency are derived from escrow records — never trusted from client input.

import type { PaymentMethodType } from '@/infrastructure/payment-providers';
import { paymentProviderRegistry } from '@/infrastructure/payment-providers';
import { EscrowService } from './escrow-service';

export interface PaymentInitiationParams {
  escrowId: string;
  paymentMethod: PaymentMethodType;
  customerIdentifier: string;
  userId: string;
  correlationId?: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  action: string;
  paymentIntentId?: string;
  providerReferenceId?: string;
  amount: number;
  currency: string;
  status: string;
  message: string;
}

export class PaymentInitiationService {
  private escrowService = new EscrowService();

  /**
   * Initiate a payment for an escrow record.
   * - Derives amount/currency from escrow (authoritative)
   * - Creates payment intent via SECDEF RPC
   * - Invokes provider adapter for execution
   * - Returns meaningful payment status
   */
  async initiate(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    // Step 1: Verify escrow is ready for payment
    const escrowVerification = await this.escrowService.verifyForPaymentInitiation(params.escrowId);

    if (!escrowVerification.exists) {
      return {
        success: false,
        action: 'escrow_not_found',
        amount: 0,
        currency: '',
        status: 'FAILED',
        message: `Escrow not found: ${params.escrowId}`,
      };
    }

    if (escrowVerification.state !== 'PENDING_CREATION' && escrowVerification.state !== 'FUNDS_INITIATED') {
      return {
        success: false,
        action: 'escrow_not_ready',
        amount: 0,
        currency: '',
        status: 'FAILED',
        message: `Escrow is in state ${escrowVerification.state}, cannot initiate payment`,
      };
    }

    // Step 2: Create payment intent via SECDEF (derives authoritative amount)
    const supabase = await import('@/lib/supabase/server').then(m => m.createClient());
    const { data: intentData, error: intentError } = await supabase.rpc('initiate_payment_intent', {
      p_escrow_id: params.escrowId,
      p_payment_method: params.paymentMethod,
      p_correlation_id: params.correlationId || null,
    });

    if (intentError) {
      // Check for existing intent (idempotency)
      if (intentError.message.includes('existing_payment_intent')) {
        const parsed = JSON.parse(intentError.message);
        return {
          success: true,
          action: 'existing_payment_intent',
          paymentIntentId: parsed.payment_intent_id,
          amount: escrowVerification.amount,
          currency: escrowVerification.currency,
          status: 'INITIATED',
          message: 'Active payment intent already exists for this escrow',
        };
      }
      throw new Error(`Payment intent creation failed: ${intentError.message}`);
    }

    const result = intentData as Record<string, unknown>;
    const paymentIntentId = String(result.payment_intent_id ?? '');

    // Step 3: Invoke provider adapter
    const provider = paymentProviderRegistry.get(params.paymentMethod as PaymentMethodType);

    try {
      const providerResponse = await provider.initiatePayment({
        paymentIntentId,
        amount: escrowVerification.amount,
        currency: escrowVerification.currency,
        paymentMethod: params.paymentMethod as PaymentMethodType,
        customerIdentifier: params.customerIdentifier,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/payment`,
        metadata: {
          escrowId: params.escrowId,
          userId: params.userId,
          correlationId: params.correlationId,
        },
      });

      if (!providerResponse.success) {
        return {
          success: false,
          action: 'provider_initiation_failed',
          paymentIntentId,
          amount: escrowVerification.amount,
          currency: escrowVerification.currency,
          status: 'FAILED',
          message: providerResponse.message || 'Provider refused payment initiation',
        };
      }

      return {
        success: true,
        action: 'payment_initiated',
        paymentIntentId,
        providerReferenceId: providerResponse.providerReferenceId || undefined,
        amount: escrowVerification.amount,
        currency: escrowVerification.currency,
        status: 'INITIATED',
        message: providerResponse.message,
      };
    } catch (error) {
      // Provider invocation failed — payment intent still created but pending provider response
      return {
        success: true,
        action: 'payment_initiated_provider_pending',
        paymentIntentId,
        amount: escrowVerification.amount,
        currency: escrowVerification.currency,
        status: 'PENDING',
        message: `Payment intent created. Provider invocation: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Query payment status by intent ID.
   */
  async getStatus(paymentIntentId: string): Promise<{
    success: boolean;
    paymentIntentId: string;
    status: string;
    amount: number;
    currency: string;
    providerReferenceId?: string;
    confirmedAt?: string;
    failureReason?: string;
    message: string;
  }> {
    const supabase = await import('@/lib/supabase/server').then(m => m.createClient());
    const { data: intent, error } = await supabase
      .schema('financial_schema')
      .from('payment_intents')
      .select('id, escrow_id, amount, currency, status, provider_reference_id, external_transaction_ref, failure_reason, created_at')
      .eq('id', paymentIntentId)
      .eq('is_deleted', false)
      .single();

    if (error || !intent) {
      return {
        success: false,
        paymentIntentId,
        status: 'NOT_FOUND',
        amount: 0,
        currency: '',
        message: 'Payment intent not found',
      };
    }

    return {
      success: true,
      paymentIntentId: intent.id,
      status: intent.status,
      amount: Number(intent.amount),
      currency: intent.currency,
      providerReferenceId: intent.provider_reference_id || undefined,
      confirmedAt: intent.created_at,
      failureReason: intent.failure_reason || undefined,
      message: `Payment ${intent.status.toLowerCase()} for ${intent.amount} ${intent.currency}`,
    };
  }
}
