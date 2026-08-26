// NexCargo MOD-002 — ContractSigned Interface (Design-Time Contract Definition)
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Increment: MOD-002 Increment 1 (Phase 1 — Core Contract Formation)
// Reference: MOD-002 §4.2, §8 (Event Model), §9 (Integration Boundaries)
//
// Governance note: Runtime event emission remains DEFERRED per MOD-001 §8 + PROMPT 0 v1.1 §1039.
// This file defines the CONTRACT/SKHEMA that downstream consumers require — not the emission mechanism.
// The interface describes the data structure that would be passed when ContractSigned occurs.
// No EventEmitter, EventBus, or emit() calls appear in this file.

import type { ContractStatus } from './entities';

/**
 * ContractSigned interface schema — design-time contract for downstream consumers.
 * Per MOD-002 §8 (Event Model — Specification Only):
 *   "ContractSigned (activates the tracking obligation for that shipment)"
 *   Emitted to: MOD-003 (triggers TrackingInitialized)
 *
 * This schema defines what data must be available when the ContractSigned transition occurs.
 * It serves as the integration contract for Phase 2B (MOD-003, MOD-004, MOD-014)
 * and Phase 2A (MOD-005, MOD-013) to consume.
 */
export interface ContractSignedPayload {
  /** Unique contract identifier */
  contractId: string;
  /** Booking reference linked to this contract */
  bookingId: string;
  /** Shipper user ID */
  shipperId: string;
  /** Transporter user ID */
  transporterId: string;
  /** ISO 8601 timestamp of signature completion */
  signedAt: string;
  /** Number of parties who have signed (1 or 2) */
  signatoriesCount: number;
  /** Full terms snapshot stored with the contract */
  termsSnapshot: string;
  /** Pricing agreement agreed upon */
  pricingAgreementJson: string; // JSON serialization of PricingAgreement
  /** Service level (SLA) windows definition */
  serviceLevelDefinitionJson: string; // JSON serialization of ServiceLevelDefinition
  /** TrackingDataObligation clause content */
  trackingDataObligationJson: string; // JSON serialization of TrackingDataObligation
}

/**
 * ContractCompleted payload — emitted when MOD-003 DeliveryConfirmed closes the contract.
 * Per MOD-002 §8:
 *   "DELIVERY_CONFIRMED – triggers ContractStatus → COMPLETED"
 *   Consumed from MOD-003.
 *
 * Note: This is a CONSUMER-side payload definition. The actual DeliveryConfirmed event
 * originates from MOD-003, but MOD-002 needs to know its shape to handle the transition.
 */
export interface ContractCompletedInput {
  /** Contract being finalized */
  contractId: string;
  /** Source module emitting this signal */
  sourceModule: 'MOD-003';
  /** Event that triggered completion */
  triggeringEvent: 'DeliveryConfirmed';
  /** Shipment/tracking reference */
  trackingId?: string;
  /** POD reference if available */
  podId?: string;
  /** Timestamp of completion */
  completedAt: string;
}
