// NexCargo C4-II — Payment Orchestration Types
// Authorized by: HAO C4-II Authorization (2026-09-08)
// Provides type definitions for the payment orchestration service boundary.

import { type IPaymentIntentRepository, type PaymentIntentRecord } from '@/modules/mod-005-escrow/infrastructure/repositories/payment-intent-repository';
import { type IMobileMoneyAdapter } from '@/modules/mod-011-platform-integration/infrastructure/adapters/base.adapter';
import type { EscrowState } from '@/shared/types/enums';

/** Repository-like interface for escrow state transitions only. Decoupled from full repository contract. */
export interface EscrowTransitionRepo {
  updateStatus(escrowId: string, currentStatus: EscrowState, targetStatus: EscrowState): Promise<void>;
}

/** Dependencies injected into payment orchestration functions. Enables clean testing without real Supabase/provider. */
export interface PaymentOrchestrationDependencies {
  repo: IPaymentIntentRepository;
  adapter: IMobileMoneyAdapter;
  escrowRepo: EscrowTransitionRepo;
}

/** Success result from initiatePayment. Distinguishes new vs idempotent replay. */
export interface InitiatePaymentResult {
  success: boolean;
  existing: boolean;   // true = idempotent replay, false = newly created
  message: string;
  paymentIntent: PaymentIntentRecord;
}

/** Result from processProviderCallback with HTTP semantics. */
export interface ProcessCallbackResult {
  success: boolean;
  error?: string;
  httpStatus?: number;
  existing?: boolean;   // true = idempotent replay
  message: string;
  paymentIntent?: PaymentIntentRecord;
}
