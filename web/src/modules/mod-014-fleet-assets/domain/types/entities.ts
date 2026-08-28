// NexCargo MOD-014 — Asset & Logistics Operations Management Module Domain Types
// Wave 2 — Stage 2B, Increment 3 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-014 §4 Core Domain Entities (4.1–4.6), §5 Asset Model
//
// D-S2B-002 condition applied: corridorId is string type (provisional design-time assumption)
// for the MOD-014 ↔ MOD-009 bidirectional BC coupling.

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { UserRole } from '@/shared/types/enums';
import type { VehicleTypeExtended, FleetOperationalStatus, VehicleRegistrationStatus, DriverCertificationStatus, AssignmentStatus, PermitType, PermitStatus, CrossBorderPermitStatus, BackhaulOpportunityStatus, AssetAvailabilityState } from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Structured insurance status per MOD-014 §4.2 */
export interface InsuranceStatusObject {
  /** Insurance provider name */
  provider: string;
  /** Policy number */
  policyNumber: string;
  /** Coverage amount */
  coverageAmount: number;
  /** Currency code */
  currency: string;
  /** Valid until date */
  validUntil: Date;
}

/** Capacity representation per MOD-014 §5.1 */
export interface CapacityRepresentation {
  /** Weight capacity in kilograms */
  weightKg: number;
  /** Volume capacity in cubic metres */
  volumeM3?: number;
}

// ============================================================
// Entity types (extend BaseEntity)
// ============================================================

/**
 * Fleet Object — logistics fleet owned by a transporter.
 * Per MOD-014 §4.1
 * Fleets must be linked to verified transporter accounts (MOD-010).
 * Each asset must be uniquely registered and linked to a fleet.
 */
export interface FleetObject extends BaseEntity {
  /** Unique identifier for the fleet */
  fleetId: string;
  /** Transporter account ID that owns this fleet */
  ownerId: string;
  /** Display name for the fleet */
  fleetName: string;
  /** Primary operating region */
  region: string;
  /** Number of assets currently in this fleet */
  assetCount: number;
  /** Operational status of the fleet */
  operationalStatus: FleetOperationalStatus;
  /** Compliance status reference linked to MOD-010/ESS-006 */
  complianceStatus: string;
}

/**
 * Vehicle Asset Object — physical logistics vehicle.
 * Per MOD-014 §4.2
 * Each asset must be uniquely registered. Asset statuses declared by transporter.
 * In Mozambique, licences are valid nationwide (licencesValidNationwide flag).
 */
export interface VehicleAssetObject extends BaseEntity {
  /** Unique identifier for the vehicle */
  vehicleId: string;
  /** Reference to the parent fleet */
  fleetId: string;
  /** Type classification (HEAVY_TRUCK, LIGHT_DELIVERY, TRAILER, REFRIGERATED, SPECIALISED) */
  vehicleType: VehicleTypeExtended;
  /** Vehicle registration number */
  registrationNumber: string;
  /** Weight capacity in kg */
  capacityWeight: number;
  /** Volume capacity in cubic metres */
  capacityVolume: number;
  /** Registration status */
  registrationStatus: VehicleRegistrationStatus;
  /** Availability state declared by transporter for matching */
  availabilityState: AssetAvailabilityState;
  /** Compliance status reference linked to MOD-010/ESS-006 */
  complianceStatus: string;
  /** Optional insurance validity expiry date */
  insuranceValidity?: Date;
  /** Licensing jurisdiction (e.g., "Mozambique") */
  licenceJurisdiction: string;
  /** Whether licence is valid nationwide (always true for Mozambique per MOD-014 §7.6) */
  licencesValidNationwide: boolean;
  /** Cross-border permit status */
  crossBorderPermitStatus: CrossBorderPermitStatus;
  /** Structured insurance status */
  insuranceStatus?: InsuranceStatusObject;
}

/**
 * Driver Object — logistics operator (human resource).
 * Per MOD-014 §4.3
 * Drivers must be linked to a verified fleet. Driver eligibility depends on licence and compliance status.
 */
export interface DriverObject extends BaseEntity {
  /** Unique identifier for the driver */
  driverId: string;
  /** Reference to the parent fleet */
  fleetId: string;
  /** Driver's first name */
  firstName: string;
  /** Driver's last name */
  lastName: string;
  /** Type of driving licence held */
  licenseType: string;
  /** Licence number */
  licenseNumber: string;
  /** Licence expiry date */
  licenseExpiryDate: Date;
  /** Certification status */
  certificationStatus: DriverCertificationStatus;
  /** Availability state for assignment */
  availabilityState: AssetAvailabilityState;
  /** Compliance status reference linked to MOD-010/ESS-006 */
  complianceStatus: string;
  /** Driver's contact phone number */
  contactNumber: string;
}

/**
 * Asset Assignment Object — linkage between assets and shipment assignments.
 * Per MOD-014 §4.4
 * Drivers and vehicles are linked to shipments via MOD-003 tracking.
 * No double-booking of vehicles or drivers is permitted (§7.3 State Integrity Rule).
 */
export interface AssetAssignmentObject extends BaseEntity {
  /** Unique identifier for this assignment */
  assignmentId: string;
  /** Vehicle being assigned */
  vehicleId: string;
  /** Driver being assigned */
  driverId: string;
  /** Shipment reference from MOD-003 tracking system */
  shipmentId: string;
  /** Current assignment status */
  assignmentStatus: AssignmentStatus;
  /** Scheduled start time */
  startTime: Date;
  /** Scheduled end time */
  endTime: Date;
  /** Actual start time (when assignment physically begins) */
  actualStartTime?: Date;
  /** Actual end time (when assignment completes) */
  actualEndTime?: Date;
  /** Who initiated this assignment (transporter or system reference) */
  assignedBy: string;
}

/**
 * CrossBorderComplianceRecord — declared compliance for cross-border corridors.
 * Per MOD-014 §4.5
 * Vehicles must meet country-specific regulatory requirements (MOD-009).
 * Temporary permits may be obtained at the border for specific shipments.
 *
 * D-S2B-002 CONDITION: corridorId is string type (provisional design-time assumption
 * pending MOD-009 implementation and reconciling BC review).
 */
export interface CrossBorderComplianceRecord extends BaseEntity {
  /** Unique identifier for this compliance record */
  complianceId: string;
  /** Vehicle this compliance record applies to */
  vehicleId: string;
  /** Corridor identifier (string type per D-S2B-002 provisional assumption) */
  corridorId: string;
  /** Country code for the crossing */
  countryCode: string;
  /** Type of permit required */
  permitType: PermitType;
  /** Permit identification number */
  permitNumber: string;
  /** Date the permit was issued */
  issueDate: Date;
  /** Date the permit expires */
  expiryDate: Date;
  /** Current permit status */
  permitStatus: PermitStatus;
  /** Whether this is a temporary permit obtained for a specific shipment */
  temporaryPermit: boolean;
}

/**
 * BackhaulOpportunity Object — empty backhaul optimisation structure.
 * Per MOD-014 §4.6
 * AI suggests return loads based on route matching (MOD-006).
 * Integrated with Marketplace (MOD-001).
 */
export interface BackhaulOpportunityObject extends BaseEntity {
  /** Unique identifier for this backhaul opportunity */
  backhaulId: string;
  /** Primary shipment reference */
  shipmentId: string;
  /** Vehicle available for the backhaul */
  vehicleId: string;
  /** Current location of the vehicle */
  currentLocation: string;
  /** Destination of the primary shipment */
  destination: string;
  /** Description of the return route */
  returnRoute: string;
  /** Optional AI-suggested load ID from MOD-006 */
  suggestedLoadId?: string;
  /** Estimated cost recovery percentage */
  estimatedCostRecovery: number;
  /** Current opportunity status */
  status: BackhaulOpportunityStatus;
}
