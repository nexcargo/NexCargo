// NexCargo MOD-002 — Booking & Contract Management Module Domain Types
// Per MOD-002 §4 Core Domain Entities
// Wave 2 — Phase 1: Structural Anchor for Wave 2 modules

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { UserRole } from '@/shared/types/enums';
import type { BookingStatus, DigitalSignatureStatus, ChangeType, ApprovalStatus, ValidationStatus, NegotiationStatus } from '../enums';

// ============================================================
// MOD-002 Local ContractStatus — authoritative per MOD-002 §4.2
// Wave 0 scaffold shared ContractStatus used different values;
// this local enum aligns with the authoritative MOD-002 specification.
// Shared ContractStatus remains unchanged for Track B freeze compliance.
// ============================================================

/** Contract lifecycle states per MOD-002 §4.2 */
export enum ContractStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  AMENDED = 'AMENDED',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
  COMPLETED = 'COMPLETED',
}

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Geo-location per PROMPT 0 v1.1 Primitive Registry */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
}

/** Cargo summary captured at booking time */
export interface CargoSummary {
  description: string;
  weightKg: number;
  volumeM3?: number;
  cargoType: string;
  specialHandling?: string[];
}

/** Full snapshot of an accepted TransportOffer at booking time (immutable record) */
export interface AlignedOfferSnapshot {
  offerId: string;
  transporterId: string;
  vehicleType: string;
  declaredWeightKg: number;
  declaredVolumeM3?: number;
  priceProposal: number;
  currency: string;
  availabilityWindowStart: string;
  availabilityWindowEnd: string;
  confirmationTimestamp: string;
}

/** SLA window definition */
export interface ServiceLevelDefinition {
  pickupWindowStart: string; // ISO 8601
  pickupWindowEnd: string;   // ISO 8601
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
}

/** Tracking data obligation embedded in contract */
export interface TrackingDataObligation {
  expectedFrequencyMinutes: number;
  dataSourceType: 'TELEMATICS_API' | 'DRIVER_APP' | 'GPS_MODULE';
  integrationChannel: string;
}

/** Cancellation rules for the contract */
export interface CancellationRules {
  shipperCancellationFeePercentage: number;
  transporterCancellationFeePercentage: number;
  minimumNoticeHours: number;
}

/** Liability rules for the contract */
export interface LiabilityRules {
  damageLiabilityLimit: number;
  delayLiabilityPerHour: number;
  forceMajeureExclusions: string[];
}

/** Pricing agreement captured at contract signing */
export interface PricingAgreement {
  baseAmount: number;
  currency: string;
  milestonePayments: {
    milestone: string;
    percentage: number;
    amount: number;
  }[];
  additionalServiceFees: { service: string; amount: number }[];
}

// ============================================================
// Entity types (extend BaseEntity)
// ============================================================

/**
 * Booking — confirmed commercial commitment between Shipper and Transporter.
 * Per MOD-002 §4.1
 * State machine: REQUESTED → ALIGNMENT_CHECKED → CONFIRMED | FAILED | CANCELLED
 */
export interface Booking extends BaseEntity {
  bookingId: string;
  listingId: string;
  selectedOfferId: string;
  shipperId: string;
  transporterId: string;
  status: BookingStatus;
  confirmationTimestamp?: string;
  origin: GeoLocation;
  destination: GeoLocation;
  cargoSummary: CargoSummary;
  alignedOfferSnapshot: AlignedOfferSnapshot;
  /** Linked contract ID after booking is confirmed */
  contractId?: string;
}

/**
 * Contract — formal commercial agreement binding Shipper and Transporter.
 * Per MOD-002 §4.2
 * State machine: DRAFT → PENDING_APPROVAL → ACTIVE → AMENDED | SUSPENDED | TERMINATED → COMPLETED
 */
export interface Contract extends BaseEntity {
  contractId: string;
  bookingId: string;
  termsSnapshot: string; // JSON serialization of agreed terms at signing
  pricingAgreement: PricingAgreement;
  serviceLevelDefinition: ServiceLevelDefinition;
  cancellationRules: CancellationRules;
  liabilityRules: LiabilityRules;
  trackingDataObligation: TrackingDataObligation;
  status: ContractStatus;
  version: number;
  digitalSignatureStatus: DigitalSignatureStatus;
  negotiationThreadId?: string;
  signedAt?: string; // ISO 8601 timestamp when contract was executed
  completedAt?: string; // ISO 8601 timestamp when DeliveryConfirmed received
}

/** Digital signature tracking per MOD-002 §4.2 */

/**
 * Contract Amendment — versioned modification to an active contract.
 * Per MOD-002 §4.3
 */
export interface ContractAmendment extends BaseEntity {
  amendmentId: string;
  contractId: string;
  changeType: ChangeType;
  changePayload: Record<string, unknown>;
  approvalStatus: ApprovalStatus;
  versionLink: number; // references the new contract version created by this amendment
}

/**
 * Booking Request — intermediate request before booking confirmation.
 * Per MOD-002 §4.4
 */
export interface BookingRequest extends BaseEntity {
  requestId: string;
  matchId: string;
  proposedTerms: Record<string, unknown>;
  validationStatus: ValidationStatus;
}

/**
 * Negotiation Thread — conversation between Shipper and Transporter before booking.
 * Per MOD-002 §4.5
 */
export interface NegotiationThread extends BaseEntity {
  negotiationId: string;
  listingId: string;
  shipperId: string;
  transporterId: string;
  status: NegotiationStatus;
  offers: OfferEntry[];
  expiryTimestamp: string; // ISO 8601
}

/** A single offer/counter-offer in a negotiation thread */
export interface OfferEntry {
  offerId: string;
  offeredBy: UserRole;
  price: number;
  windows?: { pickupStart?: string; pickupEnd?: string; deliveryStart?: string; deliveryEnd?: string };
  specialHandling?: string[];
  waitingTimeFee?: number;
  additionalServices?: string[];
  createdAt: string; // ISO 8601
}
