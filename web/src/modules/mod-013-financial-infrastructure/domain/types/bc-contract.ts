// NexCargo MOD-013 — Mod-013 Side of BC Coordination Interfaces
// Wave 2 — Phase 2A, Increment 2 — Authorized per HAO-MOD013-INC2
// Reference: PROMPT 0 v1.1 relations #18 (MOD-005→MOD-013 [BC]), #46 (MOD-013→MOD-005 [BC])
//
// Governance note: These are design-time data contracts only. No runtime event emission mechanism.
// They define MOD-013's side of each BC coordination boundary with MOD-005.
// No EventEmitter, EventBus, emit(), or subscribe() calls appear in this file.

/**
 * Consumed SettlementTriggerInterface — defines how MOD-013 receives settlement triggers FROM MOD-005.
 * This interface provides the schema MOD-013 expects when processing a settlement trigger from MOD-005.
 * Non-blocking issue NB-004 mapping applied internally: MOD-005 REQUESTED → MOD-013 PENDING.
 */
import type { ReleaseMilestoneEnum } from '@/modules/mod-005-escrow/domain/enums';
import type { EscrowState } from '@/shared/types/enums';

export interface Mod013SettlementConsumer {
  escrowId: string;
  contractId: string;
  /** Triggering milestone from MOD-005 (ReleaseMilestoneEnum) */
  triggerMilestone: ReleaseMilestoneEnum;
  /** Amount to release as specified by MOD-005 */
  releaseAmount: number;
  /** Currency code string */
  currency: string;
  /** ISO 8601 timestamp of trigger origin */
  triggeredAt: string;
}

/**
 * SharedEscrowStateContract — MOD-013's view of the shared escrow state for synchronization.
 * Non-blocking issue NB-001 (amount vs totalAmount): MOD-013 uses totalAmount per its spec §4.1;
 *   MOD-005 uses amount per its spec §4.1. The mapping layer handles this during transfer.
 * Non-blocking issue NB-002 (lastUpdatedAt vs updatedAt): handled at integration boundary.
 */
export interface Mod013SharedEscrowView {
  escrowId: string;
  status: EscrowState;
  bankReferenceId: string;
  /** MOD-013 terminology aligned with §4.1 totalAmount field */
  totalAmount: number;
  currency: string;
  /** MOD-013 terminology aligned with §4.1 updatedAt field */
  updatedAt: string;
}

/**
 * DisputeResolutionCallbackOutput — MOD-013's output for dispute resolution decisions.
 * Consumed BY MOD-005 from MOD-013's refund instruction processing (§4.6).
 */
export interface Mod013DisputeResolutionOutput {
  /** Source dispute ID */
  disputeId: string;
  /** Source escrow ID */
  escrowId: string;
  /** Financial outcome determined by MOD-013 processing */
  resolutionOutcome: 'RELEASE_TO_TRANSPORTER' | 'REFUND_TO_SHIPPER' | 'SPLIT_SETTLEMENT';
  /** Allocation amount */
  allocationAmount: number;
  /** Allocation currency */
  currency: string;
  /** Processing completion timestamp */
  resolvedAt: string;
}

/**
 * ReconciliationStatusContract — MOD-013's reconciliation alignment reporting.
 * Shared contract defining both modules' agreement on reconciliation semantics.
 * MOD-013 owns the FinancialLedgerMirrorObject (§4.4) which reports reconciliationStatus values.
 */
export interface Mod013ReconciliationReport {
  escrowId: string;
  internalLedgerBalanced: boolean;
  externalBankAligned: boolean;
  mismatchDetected: boolean;
  lastReconciledAt: string;
  nextScheduledReconciliation?: string;
}
