// NexCargo MOD-005 — MOD-005 ↔ MOD-013 Bidirectional Coordination Contract (Design-Time)
// Wave 2 — Phase 2A, Increment 1 — Authorized per HAO-MOD005-INC1
// Reference: PROMPT 0 v1.1 relations #18 (MOD-005→MOD-013 [BC]), #46 (MOD-013→MOD-005 [BC])
//
// Governance note: These are design-time data contracts only. No runtime event emission mechanism.
// They define the interface surface required for BC coordination between the two modules.
// No EventEmitter, EventBus, emit(), or subscribe() calls appear in this file.

import type { EscrowState } from '@/shared/types/enums';
import type { DisputeResolutionOutcomeEnum, ReleaseMilestoneEnum } from '../enums';

/**
 * SettlementTriggerInterface — Data shape for triggering settlement from escrow events.
 * CONSUMED BY MOD-013 from MOD-005 signals.
 * Defines what MOD-005 must provide when settlement is ready to be processed.
 */
export interface SettlementTriggerInterface {
  /** Source escrow being settled */
  escrowId: string;
  /** Contract reference */
  contractId: string;
  /** Triggering milestone (PICKUP_CONFIRMED / BORDER_CROSSING / DELIVERY_CONFIRMED / POD_APPROVED) */
  triggerMilestone: ReleaseMilestoneEnum;
  /** Amount to release */
  releaseAmount: number;
  /** Currency of release */
  currency: string;
  /** ISO 8601 timestamp of trigger */
  triggeredAt: string;
}

/**
 * SharedEscrowStateContract — Common escrow status information used by both modules.
 * SHARED CONTRACT — both modules reference these values consistently.
 */
export interface SharedEscrowStateContract {
  escrowId: string;
  status: EscrowState;
  bankReferenceId: string;
  amount: number;
  currency: string;
  lastUpdatedAt: string;
}

/**
 * DisputeResolutionCallback — Interface for communicating dispute resolution outcomes.
 * CONSUMED BY MOD-005 from MOD-013 resolution processing.
 * Defines what MOD-013 returns after dispute financial processing.
 */
export interface DisputeResolutionCallback {
  /** The dispute being resolved */
  disputeId: string;
  /** The escrow involved */
  escrowId: string;
  /** Financial outcome determined */
  resolutionOutcome: DisputeResolutionOutcomeEnum;
  /** Amount allocated per party */
  allocationAmount: number;
  /** Currency of allocation */
  currency: string;
  /** Processing timestamp */
  resolvedAt: string;
}

/**
 * ReconciliationStatusContract — Joint agreement on reconciliation status fields.
 * SHARED CONTRACT — defines the semantics and structure both modules agree on.
 */
export interface ReconciliationStatusContract {
  escrowId: string;
  internalLedgerBalanced: boolean;
  externalBankAligned: boolean;
  mismatchDetected: boolean;
  lastReconciledAt: string;
  nextScheduledReconciliation?: string;
}
